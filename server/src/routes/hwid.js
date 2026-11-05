import { Router } from 'express';
import db from '../db.js';
import { decorateKey, log, requireAuth } from '../lib.js';
import crypto from 'crypto';

const router = Router();

// ---- HWID doğrulama endpoint'i (public - token gerektirmez) ----
// Premium menu başlatıldığında bu endpoint'e istek atar
router.post('/validate', async (req, res) => {
  try {
    const { hwid, discord_id } = req.body;

    // Parametreleri kontrol et
    if (!hwid || !discord_id) {
      return res.status(400).json({ 
        success: false, 
        error: 'HWID and Discord ID are required.' 
      });
    }

    const cleanHwid = String(hwid).trim();
    const cleanDiscordId = String(discord_id).trim();

    // Discord ID formatını kontrol et (17-20 digit)
    if (!/^\d{17,20}$/.test(cleanDiscordId)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid Discord ID format.' 
      });
    }

    // Kullanıcıyı bul
    const member = db.prepare('SELECT * FROM license_keys WHERE discord_id = ?').get(cleanDiscordId);

    if (!member) {
      log({
        actor: 'HWID System',
        action: 'Login attempt failed',
        target: cleanDiscordId,
        detail: 'User not found',
        level: 'warning'
      });
      
      return res.status(404).json({ 
        success: false, 
        error: 'No active license found for this Discord ID.' 
      });
    }

    // Kullanıcı banned mi kontrol et
    if (member.banned) {
      log({
        actor: 'HWID System',
        action: 'Login attempt failed',
        target: member.uuid || cleanDiscordId,
        detail: `Banned user attempted login. Reason: ${member.ban_reason || 'No reason'}`,
        level: 'danger'
      });
      
      return res.status(403).json({ 
        success: false, 
        error: 'Your account is banned.',
        ban_reason: member.ban_reason 
      });
    }

    // Key frozen mu kontrol et
    if (member.frozen) {
      log({
        actor: 'HWID System',
        action: 'Login attempt failed',
        target: member.uuid || cleanDiscordId,
        detail: 'Frozen account attempted login',
        level: 'warning'
      });
      
      return res.status(403).json({ 
        success: false, 
        error: 'Your license is currently frozen.' 
      });
    }

    // Expire durumu kontrol et
    const decorated = decorateKey(member);
    if (decorated.expired) {
      log({
        actor: 'HWID System',
        action: 'Login attempt failed',
        target: member.uuid || cleanDiscordId,
        detail: 'Expired license',
        level: 'warning'
      });
      
      return res.status(403).json({ 
        success: false, 
        error: 'Your license has expired.' 
      });
    }

    // HWID kayıtlı mı kontrol et
    if (!member.uuid || member.uuid.trim() === '') {
      // İlk kez giriş yapıyor, HWID'yi kaydet
      db.prepare('UPDATE license_keys SET uuid = ? WHERE id = ?').run(cleanHwid, member.id);
      
      log({
        actor: 'HWID System',
        action: 'HWID registered',
        target: cleanDiscordId,
        detail: `First login - HWID set to ${cleanHwid}`,
        level: 'success'
      });
      
      return res.json({ 
        success: true, 
        message: 'HWID registered successfully.',
        user: {
          discord_id: member.discord_id,
          discord_username: member.discord_username,
          plan: decorated.plan_label,
          expires_at: member.expires_at,
          remaining: decorated.remaining_human,
          status: decorated.status
        }
      });
    }

    // HWID eşleşiyor mu kontrol et
    if (member.uuid !== cleanHwid) {
      log({
        actor: 'HWID System',
        action: 'Login attempt failed',
        target: member.uuid,
        detail: `HWID mismatch. Expected: ${member.uuid}, Got: ${cleanHwid}`,
        level: 'danger'
      });
      
      return res.status(403).json({ 
        success: false, 
        error: 'HWID mismatch. This license is registered to another machine.' 
      });
    }

    // Son giriş zamanını güncelle
    db.prepare('UPDATE license_keys SET key_value = ? WHERE id = ?').run(
      `LAST_LOGIN_${new Date().toISOString()}`,
      member.id
    );

    log({
      actor: 'HWID System',
      action: 'Login successful',
      target: member.uuid,
      detail: `User ${member.discord_username || cleanDiscordId} logged in`,
      level: 'success'
    });

    // Başarılı giriş
    return res.json({ 
      success: true,
      message: 'Authentication successful.',
      user: {
        discord_id: member.discord_id,
        discord_username: member.discord_username,
        discord_avatar: member.discord_avatar,
        plan: decorated.plan_label,
        expires_at: member.expires_at,
        remaining: decorated.remaining_human,
        remaining_ms: decorated.remaining_ms,
        status: decorated.status,
        created_at: member.created_at
      }
    });

  } catch (error) {
    console.error('HWID validation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Internal server error during validation.' 
    });
  }
});

// ---- HWID sıfırlama endpoint'i (admin only) ----
router.post('/reset/:id', requireAuth, async (req, res) => {
  try {
    const memberId = parseInt(req.params.id);
    const member = db.prepare('SELECT * FROM license_keys WHERE id = ?').get(memberId);

    if (!member) {
      return res.status(404).json({ error: 'Member not found.' });
    }

    // HWID'yi sıfırla
    db.prepare('UPDATE license_keys SET uuid = NULL WHERE id = ?').run(memberId);

    log({
      actor: req.user.username,
      action: 'HWID reset',
      target: member.discord_id,
      detail: `Previous HWID: ${member.uuid || 'None'}`,
      level: 'info'
    });

    return res.json({ 
      success: true,
      message: 'HWID reset successfully.' 
    });

  } catch (error) {
    console.error('HWID reset error:', error);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ---- Heartbeat endpoint (oyun çalışırken düzenli ping) ----
router.post('/heartbeat', async (req, res) => {
  try {
    const { hwid, discord_id } = req.body;

    if (!hwid || !discord_id) {
      return res.status(400).json({ success: false });
    }

    const member = db.prepare('SELECT * FROM license_keys WHERE discord_id = ? AND uuid = ?').get(
      String(discord_id).trim(),
      String(hwid).trim()
    );

    if (!member) {
      return res.json({ success: false, error: 'Session invalid' });
    }

    const decorated = decorateKey(member);

    // Banned, frozen veya expired durumlarını kontrol et
    if (member.banned || member.frozen || decorated.expired) {
      return res.json({ 
        success: false, 
        error: 'License no longer valid',
        banned: !!member.banned,
        frozen: !!member.frozen,
        expired: decorated.expired
      });
    }

    return res.json({ 
      success: true,
      remaining_ms: decorated.remaining_ms,
      status: decorated.status
    });

  } catch (error) {
    return res.status(500).json({ success: false });
  }
});

export default router;
