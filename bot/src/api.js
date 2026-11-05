import axios from 'axios';
import config from './config.js';

const http = axios.create({
  baseURL: config.api.baseUrl.replace(/\/+$/, '') + '/api/bot',
  headers: { 'x-bot-key': config.api.key },
  timeout: 15000,
});

const withActor = (actor) => ({ headers: { 'x-bot-actor': actor || 'Discord Bot' } });

export async function createMember(actor, discord_id, uuid, plan) {
  const { data } = await http.post('/members', { discord_id, uuid, plan, actor }, withActor(actor));
  return data;
}
export async function banMember(actor, id, reason) {
  const { data } = await http.post(`/members/${encodeURIComponent(id)}/ban`, { reason, actor }, withActor(actor));
  return data;
}
export async function unbanMember(actor, id) {
  const { data } = await http.post(`/members/${encodeURIComponent(id)}/unban`, { actor }, withActor(actor));
  return data;
}
export async function freezeMember(actor, id) {
  const { data } = await http.post(`/members/${encodeURIComponent(id)}/freeze`, { actor }, withActor(actor));
  return data;
}
export async function unfreezeMember(actor, id) {
  const { data } = await http.post(`/members/${encodeURIComponent(id)}/unfreeze`, { actor }, withActor(actor));
  return data;
}
export async function addDays(actor, id, days) {
  const { data } = await http.post(`/members/${encodeURIComponent(id)}/add-days`, { days, actor }, withActor(actor));
  return data;
}
export async function searchMember(id) {
  const { data } = await http.get(`/member/${encodeURIComponent(id)}`);
  return data; // { member, inGuild }
}
export async function syncGuildMembers(ids) {
  const { data } = await http.post('/guild-members', { ids });
  return data;
}
export async function guildMemberAdd(id) {
  await http.post('/guild-members/add', { id });
}
export async function guildMemberRemove(id) {
  await http.post('/guild-members/remove', { id });
}
export async function getOutbox() {
  const { data } = await http.get('/outbox');
  return data.notifications;
}
export async function ackOutbox(id) {
  await http.post(`/outbox/${id}/ack`, {});
}
export async function getChangelogs() {
  const { data } = await http.get('/changelogs');
  return data.changelogs;
}
export async function getCount() {
  const { data } = await http.get('/count');
  return data;
}
export async function getLogs(after = 0) {
  const { data } = await http.get('/logs', { params: { after } });
  return data;
}

// Turn any axios / thrown error into a short human message.
export function apiErr(e) {
  if (e?.response?.data?.error) return e.response.data.error;
  if (e?.code === 'ECONNREFUSED') return 'Cannot reach the Rayx Acces API. Is the website running?';
  return e?.message || 'Request failed.';
}
