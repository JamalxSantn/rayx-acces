// Manually (re)register the slash commands to the main guild.
//   npm run deploy   (from the bot/ folder)   or   npm run bot:deploy (root)
// The bot also auto-registers on startup, so this is only needed if you want
// to refresh commands without restarting.

import { REST, Routes } from 'discord.js';
import config from './config.js';
import { commands } from './commands.js';

const rest = new REST({ version: '10' }).setToken(config.token);

try {
  console.log(`[Rayx Acces] Registering ${commands.length} commands to guild ${config.mainGuildId}...`);
  await rest.put(Routes.applicationGuildCommands(config.clientId, config.mainGuildId), { body: commands });
  if (config.ticketGuildId && config.ticketGuildId !== config.mainGuildId) {
    const ticketCmds = commands.filter((c) => c.name === 'clear');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.ticketGuildId), { body: ticketCmds });
    console.log(`[Rayx Acces] Registered ${ticketCmds.length} command(s) to the ticket guild.`);
  }
  console.log('[Rayx Acces] Slash commands registered.');
} catch (e) {
  console.error('[Rayx Acces] Registration failed:', e.message);
  process.exit(1);
}
