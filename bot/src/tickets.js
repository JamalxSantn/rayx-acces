// Ticket relay: users talk to the bot in DMs, staff talk in a per-ticket
// channel on the ticket/log server. The bot bridges the two as plain text:
//   user DM   -> ticket channel   shown as   **username:** *message*
//   staff msg -> user DM          shown as   **Staff:** *message*
// Each relayed message is marked on the ORIGINAL with a check (delivered) or
// cross (failed) reaction.

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
} from 'discord.js';
import config from './config.js';
import { store } from './store.js';
import { embed, BRAND, EMO } from './ui.js';
import { isStaff } from './perm.js';

const OK_REACT = '✅';
const FAIL_REACT = '❌';

async function mark(message, success) {
  try {
    await message.react(success ? OK_REACT : FAIL_REACT);
  } catch {
    /* reacting is best-effort */
  }
}

// Links an original ticket message to the copy the bot relayed, so deletions
// can be mirrored:
//   staff deletes their message  -> remove the copy from the user's DM
//   user deletes their message    -> keep the staff copy, just mark it with 🗑️
const relayLinks = new Map(); // originalMessageId -> { kind, relayedId, locationId }
function linkRelay(originalId, entry) {
  relayLinks.set(originalId, entry);
  if (relayLinks.size > 20000) relayLinks.delete(relayLinks.keys().next().value);
}

export async function onMessageDelete(message, client) {
  const link = relayLinks.get(message.id);
  if (!link) return;
  relayLinks.delete(message.id);
  const channel = await client.channels.fetch(link.locationId).catch(() => null);
  if (!channel) return;
  if (link.kind === 'toDM') {
    // a staff message was deleted -> delete its copy in the user's DM
    await channel.messages.delete(link.relayedId).catch(() => {});
  } else if (link.kind === 'toChannel') {
    // a user's DM message was deleted -> mark the staff copy, do NOT delete it
    const relayed = await channel.messages.fetch(link.relayedId).catch(() => null);
    if (relayed) await relayed.react(EMO.deleted).catch(() => {});
  }
}

function attachmentUrls(message) {
  return [...message.attachments.values()].map((a) => a.url);
}

async function ticketLog(client, title, fields) {
  try {
    if (!config.channels?.ticketLogs) return;
    const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
    const channel = guild ? await guild.channels.fetch(config.channels.ticketLogs).catch(() => null) : null;
    if (channel) await channel.send({ embeds: [embed({ title, fields, footer: 'Ticket log' })] });
  } catch {
    /* logging must never throw */
  }
}

// ---- The panel posted by /setticket (Create Ticket + Clear DM) ----
export function ticketPanel() {
  const s = config.support || {};
  const panel = new EmbedBuilder()
    .setColor(s.color ?? BRAND)
    .setTitle(`${EMO.panel} ${s.title || 'Rayx Acces Support'}`)
    .setDescription(
      `${s.description ||
        'Need help? Click the button below to open a private ticket. A member of our staff team will assist you as soon as possible.'}\n\n` +
        `${EMO.ticket} **Create Ticket** — open a private conversation with our team.\n` +
        `${EMO.deleted} **Clear DM** — wipe my past messages from your direct messages.`
    );
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_open').setLabel(s.buttonLabel || 'Create Ticket').setStyle(ButtonStyle.Success).setEmoji(EMO.ticket),
    new ButtonBuilder().setCustomId('ticket_cleardm_self').setLabel('Clear DM').setStyle(ButtonStyle.Secondary).setEmoji('🧹')
  );
  return { embeds: [panel], components: [row] };
}

// ---- Button router ----
export async function handleButton(interaction, client) {
  if (interaction.customId === 'ticket_open') return openTicket(interaction, client);
  if (interaction.customId === 'ticket_close') return closeTicket(interaction, client);
  if (interaction.customId === 'ticket_cleardm_self') return clearOwnDm(interaction, client);
}

async function openTicket(interaction, client) {
  const user = interaction.user;

  await interaction.deferReply({ ephemeral: true });

  const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
  if (!guild) return interaction.editReply({ content: `${EMO.error} The support system is not available right now.` });

  // One open ticket per user — but only if that channel still exists. If the
  // channel was deleted (e.g. while the bot was offline), the stored entry is
  // stale, so we clear it and let the user open a fresh ticket.
  const existing = store.getTicketByUser(user.id);
  if (existing) {
    const stillThere = await guild.channels.fetch(existing.channelId).catch(() => null);
    if (stillThere) {
      return interaction.editReply({
        content: `${EMO.ticket} You already have an open ticket. Please continue in your direct messages with me.`,
      });
    }
    store.closeTicket(user.id); // stale mapping — channel no longer exists
  }

  const safeName =
    `ticket-${user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 90) || `ticket-${user.id}`;

  let channel;
  try {
    channel = await guild.channels.create({
      name: safeName,
      type: ChannelType.GuildText,
      parent: config.categories?.openTickets || undefined,
      topic: `Ticket owner: ${user.tag} (${user.id})`,
    });
  } catch {
    return interaction.editReply({ content: 'I could not create your ticket channel. Please contact an administrator.' });
  }

  store.openTicket(user.id, { channelId: channel.id, username: user.username, tag: user.tag, createdAt: Date.now() });

  const info = embed({
    title: `${EMO.opened} New Ticket`,
    description:
      '**Reply in this channel** to talk to the user — your messages reach them as *Staff*.\n' +
      `${EMO.info} Only **staff** can close this ticket.`,
    fields: [
      { name: `${EMO.user} User`, value: `**${user.tag}**`, inline: true },
      { name: '🆔 User ID', value: `\`${user.id}\``, inline: true },
    ],
    thumbnail: user.displayAvatarURL(),
    footer: 'Rayx Acces Support',
  });
  const controls = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setStyle(ButtonStyle.Danger).setEmoji(EMO.closed)
  );
  await channel.send({ embeds: [info], components: [controls] });

  try {
    await user.send({
      embeds: [
        embed({
          title: `${EMO.ticket} Ticket Opened`,
          description:
            'Your ticket has been **created successfully**. A member of our staff team will be with you shortly.\n\n' +
            `${EMO.chat} *Simply reply to this direct message to talk to them.*`,
          footer: 'Rayx Acces Support',
        }),
      ],
    });
  } catch {
    await channel.send({
      embeds: [embed({ title: `${EMO.error} Note`, description: 'This user has **direct messages disabled**, so they may not receive replies.' })],
    });
  }

  ticketLog(client, `${EMO.opened} Ticket Opened`, [
    { name: `${EMO.user} User`, value: `${user.tag} (\`${user.id}\`)` },
    { name: `${EMO.ticket} Channel`, value: `#${channel.name}` },
  ]);

  await interaction.editReply({ content: 'Your ticket has been created. Please check your direct messages.' });
}

async function closeTicket(interaction, client) {
  const uid = store.getUserByChannel(interaction.channelId);
  if (!uid) return interaction.reply({ content: 'This channel is not an open ticket.', ephemeral: true });
  if (!isStaff(interaction.member))
    return interaction.reply({ content: 'Only staff can close tickets.', ephemeral: true });

  await interaction.deferReply();

  try {
    await interaction.channel.setParent(config.categories?.closedTickets || null, { lockPermissions: false });
    const closedName = `closed-${interaction.channel.name}`.replace(/^closed-closed-/, 'closed-').slice(0, 95);
    await interaction.channel.setName(closedName).catch(() => {});
  } catch {
    /* moving is best-effort */
  }

  store.closeTicket(uid);

  try {
    const user = await client.users.fetch(uid);
    await user.send({
      embeds: [
        embed({
          title: `${EMO.closed} Ticket Closed`,
          description: 'Your ticket has been **closed** by our staff team.\n\n*Thank you for reaching out — feel free to open a new ticket anytime.*',
          footer: 'Rayx Acces Support',
        }),
      ],
    });
  } catch {
    /* user DMs closed */
  }

  ticketLog(client, `${EMO.closed} Ticket Closed`, [
    { name: `${EMO.user} User`, value: `<@${uid}> (\`${uid}\`)` },
    { name: '🛡️ Closed by', value: `**${interaction.user.tag}**` },
  ]);

  await interaction.editReply({
    embeds: [
      embed({
        title: `${EMO.closed} Ticket Closed`,
        description: `Closed by **${interaction.user.tag}**.\n${EMO.info} This channel has been moved to **Closed Tickets**.`,
      }),
    ],
  });
}

// Anyone may clear their own DM history with the bot (from the panel button).
async function clearOwnDm(interaction, client) {
  await interaction.deferReply({ ephemeral: true });
  try {
    const dm = await interaction.user.createDM();
    const messages = await dm.messages.fetch({ limit: 100 });
    const mine = messages.filter((m) => m.author.id === client.user.id);
    for (const m of mine.values()) await m.delete().catch(() => {});
    await interaction.editReply({ content: `🧹 Cleared **${mine.size}** message(s) from your direct messages with me.` });
  } catch {
    await interaction.editReply({ content: `${EMO.error} I could not clear your direct messages.` });
  }
}

// ---- A ticket channel was deleted (not closed) -> notify the user ----
export async function onChannelDelete(channel, client) {
  const uid = store.getUserByChannel(channel.id);
  if (!uid) return;
  store.closeTicket(uid);
  try {
    const user = await client.users.fetch(uid);
    await user.send({
      embeds: [
        embed({
          title: `${EMO.deleted} Ticket Deleted`,
          description: 'Your ticket has been **deleted**.\n\n*If you still need help, please open a new ticket.*',
          footer: 'Rayx Acces Support',
        }),
      ],
    });
  } catch {
    /* user DMs closed */
  }
  ticketLog(client, `${EMO.deleted} Ticket Deleted`, [
    { name: `${EMO.user} User`, value: `<@${uid}> (\`${uid}\`)` },
    { name: `${EMO.ticket} Channel`, value: `#${channel.name || channel.id}` },
  ]);
}

// ---- user DM -> ticket channel ----
export async function onDirectMessage(message, client) {
  if (message.author.bot || message.guild) return;
  const ticket = store.getTicketByUser(message.author.id);
  if (!ticket) return; // no open ticket: stay quiet

  const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
  const channel = guild ? await guild.channels.fetch(ticket.channelId).catch(() => null) : null;
  if (!channel) {
    store.closeTicket(message.author.id); // channel gone
    return;
  }

  const text = message.content?.trim();
  const line = `${EMO.chat} **${message.author.username}:** ${text ? `*${text}*` : '*(attachment)*'}`;
  try {
    const sent = await channel.send({ content: line, files: attachmentUrls(message), allowedMentions: { parse: [] } });
    linkRelay(message.id, { kind: 'toChannel', relayedId: sent.id, locationId: channel.id });
    await mark(message, true);
  } catch {
    await mark(message, false);
  }
}

// ---- staff message in ticket channel -> user DM (as "Staff") ----
export async function onGuildMessage(message, client) {
  if (message.author.bot) return;
  if (message.guildId !== config.ticketGuildId) return;

  const uid = store.getUserByChannel(message.channelId);
  if (!uid) return;

  const user = await client.users.fetch(uid).catch(() => null);
  if (!user) return;

  const text = message.content?.trim();
  const line = `${EMO.staff} **Staff:** ${text ? `*${text}*` : '*(attachment)*'}`;
  try {
    const sent = await user.send({ content: line, files: attachmentUrls(message) });
    linkRelay(message.id, { kind: 'toDM', relayedId: sent.id, locationId: sent.channelId });
    await mark(message, true);
  } catch {
    await mark(message, false);
  }
}
