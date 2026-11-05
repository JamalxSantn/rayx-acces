import {
  joinVoiceChannel,
  getVoiceConnection,
  entersState,
  VoiceConnectionStatus,
} from '@discordjs/voice';
// No external encryption library is needed: @discordjs/voice negotiates
// "aead_aes256_gcm_rtpsize" using Node's built-in crypto (aes-256-gcm), which
// is exactly what Discord's voice servers use. The handshake completes with
// zero native build steps.

// Join a voice channel deafened (headphones off) but NOT muted, so it looks
// like a normal deafened user. We never transmit audio.
export async function joinVc(channel) {
  const connection = joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator,
    selfDeaf: true,
    selfMute: false,
  });
  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
  } catch (e) {
    connection.destroy();
    throw new Error('Could not connect to that voice channel.');
  }
  return connection;
}

export function leaveVc(guildId) {
  const connection = getVoiceConnection(guildId);
  if (!connection) return false;
  connection.destroy();
  return true;
}
