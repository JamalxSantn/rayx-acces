import { PermissionFlagsBits } from 'discord.js';
import config from './config.js';

// Who may use the bot's commands.
//  - The server owner always can (prevents an accidental lockout).
//  - If a staff role is configured AND this guild actually has that role,
//    the member MUST hold it — Administrator alone is not enough.
//  - In guilds that do not have the staff role (e.g. the ticket/log server,
//    where the role lives on the main server), fall back to Administrator.
export function isStaff(member) {
  if (!member) return false;
  if (member.guild?.ownerId && member.guild.ownerId === member.id) return true;

  if (config.staffRoleId && member.guild?.roles?.cache?.has(config.staffRoleId)) {
    return member.roles?.cache?.has(config.staffRoleId);
  }
  return !!member.permissions?.has(PermissionFlagsBits.Administrator);
}

export function isAdmin(member) {
  return !!member?.permissions?.has(PermissionFlagsBits.Administrator);
}
