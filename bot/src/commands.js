import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from 'discord.js';
import * as api from './api.js';
import { embed, remainingFrom, EMO } from './ui.js';
import { isStaff } from './perm.js';
import { joinVc, leaveVc } from './voice.js';
import { ticketPanel } from './tickets.js';
import { store } from './store.js';
import config from './config.js';

const PLAN_CHOICES = [
  { name: 'Month', value: 'month' },
  { name: '3 Months', value: '3months' },
  { name: 'Year', value: 'year' },
  { name: 'Lifetime', value: 'lifetime' },
];

// ---- Slash command definitions (registered to the main guild) ----
export const commands = [
  new SlashCommandBuilder().setName('changelogs').setDescription('View the latest Rayx Acces changelogs'),

  new SlashCommandBuilder()
    .setName('keygen')
    .setDescription('Add a member to the whitelist')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true))
    .addStringOption((o) => o.setName('uuid').setDescription('UUID to whitelist').setRequired(true))
    .addStringOption((o) =>
      o.setName('plan').setDescription('Membership plan').setRequired(true).addChoices(...PLAN_CHOICES)
    ),

  new SlashCommandBuilder()
    .setName('banuser')
    .setDescription('Ban a member (same ban as the website)')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban').setRequired(false)),

  new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a member')
    .addStringOption((o) => o.setName('identifier').setDescription('Discord ID or UUID').setRequired(true)),

  new SlashCommandBuilder()
    .setName('freezeuser')
    .setDescription('Freeze a member (pause their timer)')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true)),

  new SlashCommandBuilder()
    .setName('unfreezeuser')
    .setDescription('Unfreeze a member (resume their timer)')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true)),

  new SlashCommandBuilder()
    .setName('addtime')
    .setDescription('Add days to a member')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true))
    .addIntegerOption((o) => o.setName('days').setDescription('Number of days to add').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('removetime')
    .setDescription('Remove days from a member')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID of the member').setRequired(true))
    .addIntegerOption((o) => o.setName('days').setDescription('Number of days to remove').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder().setName('usercount').setDescription('Show how many members are registered'),

  new SlashCommandBuilder()
    .setName('search')
    .setDescription('Look up whether a Discord ID has a membership')
    .addStringOption((o) => o.setName('discordid').setDescription('Discord ID to look up').setRequired(true)),

  new SlashCommandBuilder()
    .setName('autoroleon')
    .setDescription('Automatically give a role to new members joining the server')
    .addRoleOption((o) => o.setName('role').setDescription('Role to assign on join').setRequired(true)),

  new SlashCommandBuilder().setName('autoroleoff').setDescription('Turn off the auto-role'),

  new SlashCommandBuilder().setName('autorolestatus').setDescription('Show the current auto-role setting'),

  new SlashCommandBuilder()
    .setName('joinvc')
    .setDescription('Join a voice channel (deafened)')
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Voice channel to join').addChannelTypes(ChannelType.GuildVoice).setRequired(true)
    ),

  new SlashCommandBuilder().setName('leavevc').setDescription('Leave the current voice channel'),

  new SlashCommandBuilder().setName('setticket').setDescription('Post the ticket panel in this channel'),

  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Delete recent messages in this channel')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How many messages to delete (default 100, max 100)').setMinValue(1).setMaxValue(100).setRequired(false)
    ),
].map((c) => c.toJSON());

// ---- Command execution ----
export async function execute(interaction, client) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
  }

  const actor = `${interaction.user.username} (Discord)`;
  let status = 'completed';
  let errMsg = null;

  try {
    switch (interaction.commandName) {
      case 'changelogs': {
        const list = await api.getChangelogs();
        if (!list.length) {
          await interaction.reply({
            embeds: [embed({ title: 'Changelogs', description: 'No changelogs have been posted yet.' })],
            ephemeral: true,
          });
          break;
        }
        const fields = list.slice(0, 10).map((c) => ({
          name: `${EMO.changelog} ${c.title}  ·  \`${c.tag}\``,
          value: `${c.body}\n*— ${c.author} · ${c.created_at}*`,
        }));
        await interaction.reply({ embeds: [embed({ title: `${EMO.changelog} Rayx Acces Changelogs`, fields })], ephemeral: true });
        break;
      }

      case 'keygen': {
        const discordid = interaction.options.getString('discordid');
        const uuid = interaction.options.getString('uuid');
        const plan = interaction.options.getString('plan');
        await interaction.deferReply({ ephemeral: true });
        const { key } = await api.createMember(actor, discordid, uuid, plan);
        await interaction.editReply({
          embeds: [
            embed({
              title: `${EMO.added} Member Added`,
              description: 'A new member has been **added to the whitelist**.',
              fields: [
                { name: `${EMO.user} Discord`, value: `**${key.discord_username || key.discord_id}** (\`${key.discord_id}\`)` },
                { name: `${EMO.uuid} UUID`, value: `\`${key.uuid}\`` },
                { name: `${EMO.plan} Plan`, value: `**${key.plan_label}**`, inline: true },
                { name: `${EMO.clock} Time Remaining`, value: `**${key.remaining_human || remainingFrom(key.expires_at)}**`, inline: true },
              ],
            }),
          ],
        });
        break;
      }

      case 'banuser': {
        const id = interaction.options.getString('discordid');
        const reason = interaction.options.getString('reason') || null;
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.banMember(actor, id, reason);
        await interaction.editReply({
          embeds: [
            embed({
              title: `${EMO.ban} Member Banned`,
              description: `**Banned** ${count} membership(s) for \`${id}\`.`,
              fields: reason ? [{ name: '📄 Reason', value: `*${reason}*` }] : undefined,
            }),
          ],
        });
        break;
      }

      case 'unban': {
        const id = interaction.options.getString('identifier');
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.unbanMember(actor, id);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.unban} Member Unbanned`, description: `**Unbanned** ${count} membership(s) for \`${id}\`.` })],
        });
        break;
      }

      case 'freezeuser': {
        const id = interaction.options.getString('discordid');
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.freezeMember(actor, id);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.freeze} Member Frozen`, description: `**Froze** ${count} membership(s) for \`${id}\`.\n${EMO.info} *The expiry timer is now paused.*` })],
        });
        break;
      }

      case 'unfreezeuser': {
        const id = interaction.options.getString('discordid');
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.unfreezeMember(actor, id);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.unfreeze} Member Unfrozen`, description: `**Unfroze** ${count} membership(s) for \`${id}\`.\n${EMO.info} *The expiry timer has resumed.*` })],
        });
        break;
      }

      case 'addtime': {
        const id = interaction.options.getString('discordid');
        const days = interaction.options.getInteger('days');
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.addDays(actor, id, days);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.addTime} Time Added`, description: `**Added ${days} day(s)** to ${count} membership(s) for \`${id}\`.` })],
        });
        break;
      }

      case 'removetime': {
        const id = interaction.options.getString('discordid');
        const days = interaction.options.getInteger('days');
        await interaction.deferReply({ ephemeral: true });
        const { count } = await api.addDays(actor, id, -days);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.removeTime} Time Removed`, description: `**Removed ${days} day(s)** from ${count} membership(s) for \`${id}\`.` })],
        });
        break;
      }

      case 'usercount': {
        const { members, users } = await api.getCount();
        await interaction.reply({
          embeds: [
            embed({
              title: `${EMO.count} Registered Members`,
              fields: [
                { name: '📦 Memberships', value: `**${members}**`, inline: true },
                { name: `${EMO.user} Discord Users`, value: `**${users}**`, inline: true },
              ],
            }),
          ],
          ephemeral: true,
        });
        break;
      }

      case 'search': {
        const id = interaction.options.getString('discordid');
        await interaction.deferReply({ ephemeral: true });
        const { member, inGuild } = await api.searchMember(id);
        const guildText = inGuild === null ? '❔ Unknown (not synced yet)' : inGuild ? '✅ Yes' : '❌ No';
        if (!member) {
          await interaction.editReply({
            embeds: [
              embed({
                title: `${EMO.search} No Membership Found`,
                description: `No member is registered for \`${id}\`.`,
                fields: [{ name: '🏠 In main server', value: guildText, inline: true }],
              }),
            ],
          });
          break;
        }
        const statusEmoji = { active: '🟢', frozen: '❄️', expired: '🟠', banned: '🔴' }[member.status] || '⚪';
        await interaction.editReply({
          embeds: [
            embed({
              title: `${EMO.search} Member Found`,
              fields: [
                { name: `${EMO.user} Discord`, value: `**${member.discord_username || member.discord_id}** (\`${member.discord_id}\`)` },
                { name: `${EMO.uuid} UUID`, value: `\`${member.uuid || '—'}\`` },
                { name: `${EMO.plan} Plan`, value: `**${member.plan_label}**`, inline: true },
                { name: '📊 Status', value: `${statusEmoji} ${member.status}`, inline: true },
                { name: `${EMO.clock} Time Remaining`, value: `**${member.remaining_human || remainingFrom(member.expires_at)}**`, inline: true },
                { name: '🏠 In main server', value: guildText, inline: true },
              ],
            }),
          ],
        });
        break;
      }

      case 'autoroleon': {
        const role = interaction.options.getRole('role');
        const me = interaction.guild.members.me;

        // Verify the bot can actually assign this role, so it does not fail
        // silently later when a member joins.
        const problems = [];
        if (!me?.permissions?.has(PermissionFlagsBits.ManageRoles))
          problems.push('I am missing the **Manage Roles** permission.');
        if (role.managed) problems.push('That role is **managed by an integration** and cannot be assigned manually.');
        if (role.id === interaction.guild.id) problems.push('That is the **@everyone** role.');
        if (me && me.roles.highest.comparePositionTo(role) <= 0)
          problems.push(`My highest role must be **above** ${role} — reorder it in Server Settings → Roles.`);

        if (problems.length) {
          await interaction.reply({
            embeds: [
              embed({
                title: `${EMO.error} Cannot Enable Auto-role`,
                description: `I cannot assign ${role} yet:\n\n- ${problems.join('\n- ')}\n\n*Fix the above, then run this command again.*`,
              }),
            ],
            ephemeral: true,
          });
          break;
        }

        store.setAutorole(role.id);
        await interaction.reply({
          embeds: [
            embed({
              title: `${EMO.autorole} Auto-role Enabled`,
              description: `${EMO.success} New members will automatically receive ${role} when they join.`,
            }),
          ],
          ephemeral: true,
        });
        break;
      }

      case 'autoroleoff': {
        store.setAutorole(null);
        await interaction.reply({
          embeds: [embed({ title: `${EMO.autorole} Auto-role Disabled`, description: 'New members will **no longer** receive a role automatically.' })],
          ephemeral: true,
        });
        break;
      }

      case 'autorolestatus': {
        const roleId = store.getAutorole();
        const role = roleId ? interaction.guild?.roles?.cache?.get(roleId) : null;
        await interaction.reply({
          embeds: [
            embed({
              title: `${EMO.autorole} Auto-role Status`,
              description: roleId
                ? `${EMO.success} Auto-role is **enabled**: ${role ? `${role}` : `\`${roleId}\``}.`
                : '⭕ Auto-role is currently **disabled**.',
            }),
          ],
          ephemeral: true,
        });
        break;
      }

      case 'joinvc': {
        const channel = interaction.options.getChannel('channel');
        await interaction.deferReply({ ephemeral: true });
        await joinVc(channel);
        await interaction.editReply({
          embeds: [embed({ title: `${EMO.voice} Joined Voice`, description: `Connected to **${channel.name}**.\n${EMO.info} *I am deafened — mic stays on.*` })],
        });
        break;
      }

      case 'leavevc': {
        const left = leaveVc(interaction.guildId);
        await interaction.reply({
          embeds: [
            embed({
              title: left ? `${EMO.leave} Left Voice` : `${EMO.voice} Not Connected`,
              description: left ? 'I have **left** the voice channel.' : 'I am **not** in a voice channel here.',
            }),
          ],
          ephemeral: true,
        });
        break;
      }

      case 'setticket': {
        await interaction.channel.send(ticketPanel());
        await interaction.reply({ content: `${EMO.success} Ticket panel posted.`, ephemeral: true });
        break;
      }

      case 'clear': {
        const amount = interaction.options.getInteger('amount') || 100;
        await interaction.deferReply({ ephemeral: true });
        const me = interaction.guild?.members?.me;
        if (!interaction.channel?.bulkDelete) {
          await interaction.editReply({ embeds: [embed({ title: `${EMO.error} Cannot Clear`, description: 'This channel does not support bulk deletion.' })] });
          break;
        }
        if (me && !interaction.channel.permissionsFor(me)?.has(PermissionFlagsBits.ManageMessages)) {
          await interaction.editReply({ embeds: [embed({ title: `${EMO.error} Missing Permission`, description: 'I need the **Manage Messages** permission in this channel.' })] });
          break;
        }
        // bulkDelete skips messages older than 14 days (the `true` filter).
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await interaction.editReply({
          embeds: [
            embed({
              title: '🧹 Messages Cleared',
              description: `Deleted **${deleted.size}** message(s) in this channel.${deleted.size < amount ? '\n*Messages older than 14 days cannot be bulk-deleted.*' : ''}`,
            }),
          ],
        });
        break;
      }

      default:
        await interaction.reply({ content: 'Unknown command.', ephemeral: true });
    }
  } catch (e) {
    status = 'failed';
    errMsg = api.apiErr(e);
    const payload = { embeds: [embed({ title: `${EMO.error} Error`, description: `**${errMsg}**` })] };
    if (interaction.deferred || interaction.replied) await interaction.editReply(payload).catch(() => {});
    else await interaction.reply({ ...payload, ephemeral: true }).catch(() => {});
  } finally {
    logBotUsage(client, interaction, status, errMsg);
  }
}

// ---- Mirror every command use into the bot-logs channel ----
async function logBotUsage(client, interaction, status, errMsg) {
  try {
    if (!config.channels?.botLogs) return;
    const guild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
    const channel = guild ? await guild.channels.fetch(config.channels.botLogs).catch(() => null) : null;
    if (!channel) return;

    const opts = (interaction.options?.data || []).map((o) => `\`${o.name}: ${o.value}\``).join(' · ');
    const statusIcon = status === 'completed' ? EMO.success : EMO.error;
    const fields = [
      { name: `${EMO.command} Command`, value: `**/${interaction.commandName}**`, inline: true },
      { name: `${EMO.user} User`, value: `${interaction.user.tag}`, inline: true },
      { name: '📊 Status', value: `${statusIcon} ${status}`, inline: true },
    ];
    if (opts) fields.push({ name: '⚙️ Options', value: opts });
    if (errMsg) fields.push({ name: `${EMO.error} Error`, value: `*${errMsg}*` });

    await channel.send({ embeds: [embed({ title: `${EMO.command} Command Used`, fields, footer: 'Rayx Acces' })] });
  } catch {
    /* logging must never throw */
  }
}
