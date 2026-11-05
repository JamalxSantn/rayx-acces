import { Client, GatewayIntentBits, Partials, Events, REST, Routes, ActivityType } from 'discord.js';
import config from './config.js';
import { commands, execute } from './commands.js';
import * as tickets from './tickets.js';
import * as api from './api.js';
import { store } from './store.js';
import { startLogMirror } from './logs.js';
import { syncGuildMembers, startOutboxPoller, pruneStaleTickets } from './sync.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privileged: needed to relay ticket text
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers, // privileged: needed for auto-role + member sync
  ],
  partials: [Partials.Channel, Partials.Message], // needed to receive DMs
  // Idle presence + server name, re-sent on every (re)connect.
  presence: {
    status: 'online',
    activities: [{ name: 'Rayx Acces', type: ActivityType.Custom, state: 'Rayx Acces' }],
  },
});

// Re-apply the presence on every ready (covers reconnects / gateway resumes).
const PRESENCE = {
  status: 'online',
  activities: [{ name: 'Rayx Acces', type: ActivityType.Custom, state: 'Rayx Acces' }],
};

client.once(Events.ClientReady, async (c) => {
  console.log(`[Rayx Acces] Logged in as ${c.user.tag}`);
  c.user.setPresence(PRESENCE);
  try {
    const rest = new REST({ version: '10' }).setToken(config.token);
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.mainGuildId), { body: commands });
    console.log(`[Rayx Acces] Registered ${commands.length} slash commands to the main guild.`);

    // Also expose /clear on the ticket/log server.
    if (config.ticketGuildId && config.ticketGuildId !== config.mainGuildId) {
      const ticketCmds = commands.filter((c) => c.name === 'clear');
      await rest.put(Routes.applicationGuildCommands(config.clientId, config.ticketGuildId), { body: ticketCmds });
      console.log(`[Rayx Acces] Registered ${ticketCmds.length} command(s) to the ticket guild.`);
    }
  } catch (e) {
    console.error('[Rayx Acces] Command registration failed:', e.message);
  }
  // Diagnose access to the configured servers so misconfig is obvious.
  const ticketGuild = await client.guilds.fetch(config.ticketGuildId).catch(() => null);
  if (ticketGuild) {
    console.log(`[Rayx Acces] Ticket/log server: ${ticketGuild.name}`);
  } else {
    console.warn(`[Rayx Acces] WARNING: I am NOT in the ticket server (ticketGuildId=${config.ticketGuildId}).`);
    console.warn('             Invite the bot there, or fix ticketGuildId in bot/config.json.');
    console.warn('             Tickets and log mirroring will not work until this is fixed.');
  }

  await syncGuildMembers(client);
  await pruneStaleTickets(client);
  startLogMirror(client);
  startOutboxPoller(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) return execute(interaction, client);
    if (interaction.isButton()) return tickets.handleButton(interaction, client);
  } catch (e) {
    console.error('[Rayx Acces] Interaction error:', e);
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    if (!message.guild) return tickets.onDirectMessage(message, client);
    return tickets.onGuildMessage(message, client);
  } catch (e) {
    console.error('[Rayx Acces] Message error:', e);
  }
});

// Mirror deletions between the ticket channel and the user's DM.
client.on(Events.MessageDelete, async (message) => {
  try {
    await tickets.onMessageDelete(message, client);
  } catch (e) {
    console.error('[Rayx Acces] Message delete error:', e);
  }
});

// New member joins the main server: apply the auto-role and keep the site in sync.
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.guild.id !== config.mainGuildId) return;
  api.guildMemberAdd(member.id).catch(() => {});
  const roleId = store.getAutorole();
  if (roleId) {
    try {
      await member.roles.add(roleId);
    } catch (e) {
      console.error('[Rayx Acces] Auto-role assignment failed:', e.message);
    }
  }
});

client.on(Events.GuildMemberRemove, (member) => {
  if (member.guild.id === config.mainGuildId) api.guildMemberRemove(member.id).catch(() => {});
});

// A ticket channel was deleted (rather than closed) -> notify the user.
client.on(Events.ChannelDelete, async (channel) => {
  try {
    await tickets.onChannelDelete(channel, client);
  } catch (e) {
    console.error('[Rayx Acces] Channel delete error:', e);
  }
});

client.on('error', (e) => console.error('[Rayx Acces] Client error:', e));
client.on('shardError', (e) => console.error('[Rayx Acces] Shard error:', e.message));
process.on('unhandledRejection', (e) => console.error('[Rayx Acces] Unhandled rejection:', e?.message || e));

// Log in with automatic retry. On a VDS the first TLS connection to Discord can
// be reset (ECONNRESET) or time out; without this the login promise would reject,
// nothing would keep the event loop alive, and the process would exit (code 0).
// Once connected, discord.js handles gateway reconnects on its own.
async function login(attempt = 1) {
  try {
    await client.login(config.token);
  } catch (e) {
    const wait = Math.min(60, attempt * 10); // 10s, 20s, ... capped at 60s
    console.error(
      `[Rayx Acces] Login attempt ${attempt} failed: ${e?.message || e}. Retrying in ${wait}s...`
    );
    setTimeout(() => login(attempt + 1), wait * 1000);
  }
}
login();
