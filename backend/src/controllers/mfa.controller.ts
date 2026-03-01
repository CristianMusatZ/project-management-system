import { Response } from 'express';
import pool from '../config/postgres';
import { AuthRequest } from '../types';
import { generateSecret, verifyTOTP, getTOTPUri } from '../services/totp.service';
import { generateToken } from '../middleware/auth';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mfa/setup  — generează un secret nou + URI pentru QR code
// Doar admin, doar dacă MFA nu e deja activat
// ─────────────────────────────────────────────────────────────────────────────
export async function setupMFA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const { rows } = await pool.query(
      `SELECT mfa_enabled, email FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) {
      res.status(404).json({ error: 'Utilizator negăsit.' });
      return;
    }
    if (rows[0].mfa_enabled) {
      res.status(400).json({ error: 'MFA este deja activat pentru acest cont.' });
      return;
    }

    const secret = generateSecret();
    const uri = getTOTPUri(secret, rows[0].email, 'PMS');

    // Salvăm secretul temporar (neconfirmat încă) — va fi marcat enabled după confirmare
    await pool.query(
      `UPDATE users SET mfa_secret = $1 WHERE id = $2`,
      [secret, userId]
    );

    res.json({ secret, uri });
  } catch (err) {
    console.error('[MFA] setupMFA error:', err);
    res.status(500).json({ error: 'Eroare la configurarea MFA.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mfa/enable  — confirmă primul cod TOTP și activează MFA
// Body: { code: "123456" }
// ─────────────────────────────────────────────────────────────────────────────
export async function enableMFA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Codul TOTP este obligatoriu.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length || !rows[0].mfa_secret) {
      res.status(400).json({ error: 'MFA nu a fost inițializat. Apelați mai întâi /api/mfa/setup.' });
      return;
    }
    if (rows[0].mfa_enabled) {
      res.status(400).json({ error: 'MFA este deja activat.' });
      return;
    }

    if (!verifyTOTP(rows[0].mfa_secret, String(code))) {
      res.status(400).json({ error: 'Cod TOTP invalid sau expirat.' });
      return;
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = TRUE WHERE id = $1`,
      [userId]
    );

    res.json({ message: 'MFA activat cu succes. De acum înainte vei fi rugat să introduci codul la fiecare autentificare.' });
  } catch (err) {
    console.error('[MFA] enableMFA error:', err);
    res.status(500).json({ error: 'Eroare la activarea MFA.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mfa/disable  — dezactivează MFA (cere parola curentă ca verificare)
// Body: { password: "..." }
// ─────────────────────────────────────────────────────────────────────────────
export async function disableMFA(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { code } = req.body;

    if (!code) {
      res.status(400).json({ error: 'Codul TOTP curent este obligatoriu pentru dezactivare.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length || !rows[0].mfa_enabled) {
      res.status(400).json({ error: 'MFA nu este activat.' });
      return;
    }

    if (!verifyTOTP(rows[0].mfa_secret, String(code))) {
      res.status(400).json({ error: 'Cod TOTP invalid sau expirat.' });
      return;
    }

    await pool.query(
      `UPDATE users SET mfa_enabled = FALSE, mfa_secret = NULL WHERE id = $1`,
      [userId]
    );

    res.json({ message: 'MFA dezactivat.' });
  } catch (err) {
    console.error('[MFA] disableMFA error:', err);
    res.status(500).json({ error: 'Eroare la dezactivarea MFA.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/mfa/verify  — al doilea pas al login-ului admin
// Body: { tempToken: "...", code: "123456" }
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyMFA(req: AuthRequest, res: Response): Promise<void> {
  try {
    // req.user este deja populat de middleware-ul authenticate cu token-ul temp
    const user = req.user!;

    if (!user.mfaPending) {
      res.status(400).json({ error: 'Token invalid pentru verificare MFA.' });
      return;
    }

    const { code } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Codul TOTP este obligatoriu.' });
      return;
    }

    const { rows } = await pool.query(
      `SELECT mfa_secret, mfa_enabled, is_active FROM users WHERE id = $1`,
      [user.id]
    );

    if (!rows.length || !rows[0].is_active) {
      res.status(403).json({ error: 'Cont inactiv sau negăsit.' });
      return;
    }
    if (!rows[0].mfa_enabled || !rows[0].mfa_secret) {
      res.status(400).json({ error: 'MFA nu este configurat pentru acest cont.' });
      return;
    }

    if (!verifyTOTP(rows[0].mfa_secret, String(code))) {
      res.status(400).json({ error: 'Cod TOTP invalid sau expirat.' });
      return;
    }

    // Cod valid — emitem JWT-ul complet (fără mfaPending)
    const fullToken = generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    });

    res.json({ token: fullToken });
  } catch (err) {
    console.error('[MFA] verifyMFA error:', err);
    res.status(500).json({ error: 'Eroare la verificarea MFA.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/mfa/status  — returnează statusul MFA pentru utilizatorul curent
// ─────────────────────────────────────────────────────────────────────────────
export async function getMFAStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT mfa_enabled FROM users WHERE id = $1`,
      [req.user!.id]
    );
    res.json({ mfaEnabled: rows[0]?.mfa_enabled ?? false });
  } catch (err) {
    console.error('[MFA] getMFAStatus error:', err);
    res.status(500).json({ error: 'Eroare.' });
  }
}
