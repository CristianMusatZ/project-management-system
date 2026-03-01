import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import pool from '../config/postgres';
import { generateToken } from '../middleware/auth';
import { UserPayload } from '../types';
import { sendEmailVerificationEmail, isSmtpConfigured } from '../services/email.service';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validare input
    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Toate câmpurile sunt obligatorii.' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
      return;
    }

    // Verificare email existent
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Adresa de email este deja înregistrată.' });
      return;
    }

    // Hash parolă
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const smtpOk = isSmtpConfigured();
    // Dacă SMTP e configurat, contul începe neactivat până la confirmare email
    const isActive = !smtpOk;
    const emailVerified = !smtpOk;
    const verificationToken = smtpOk ? crypto.randomBytes(32).toString('hex') : null;

    // Inserare utilizator
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, is_active, email_verified, email_verification_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, 'member', isActive, emailVerified, verificationToken]
    );

    const user = result.rows[0];

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'REGISTER', 'user', user.id.toString(), req.ip]
    );

    // Dacă SMTP nu e configurat → auto-activat, returnăm token direct
    if (!smtpOk) {
      const payload: UserPayload = {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.first_name,
        lastName: user.last_name,
      };
      const token = generateToken(payload);
      res.status(201).json({
        message: 'Cont creat cu succes.',
        token,
        user: payload,
      });
      return;
    }

    // SMTP configurat → trimitem email de verificare (non-blocking)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verifyUrl = `${frontendUrl}/verify-email?token=${verificationToken}`;
    setImmediate(() => {
      sendEmailVerificationEmail(user.email, `${firstName} ${lastName}`.trim(), verifyUrl).catch((err) =>
        console.error('[EMAIL] Eroare trimitere verificare:', err)
      );
    });

    res.status(201).json({
      message: 'Cont creat. Verifică emailul pentru a activa contul.',
      requiresEmailVerification: true,
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Eroare la înregistrare.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email și parola sunt obligatorii.' });
      return;
    }

    // Căutare utilizator
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Email sau parolă incorectă.' });
      return;
    }

    const user = result.rows[0];

    // Verificare parolă
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      res.status(401).json({ error: 'Email sau parolă incorectă.' });
      return;
    }

    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };

    // MFA — doar pentru admini cu MFA activat
    if (user.role === 'admin' && user.mfa_enabled) {
      // Emitem un token temporar (expiră în 5 min) marcat ca mfaPending
      const tempToken = generateToken({ ...payload, mfaPending: true });
      // Nu logăm audit login complet până la verificarea MFA
      res.json({ requiresMFA: true, tempToken });
      return;
    }

    // Generare token complet (non-admin sau admin fără MFA)
    const token = generateToken(payload);

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'LOGIN', 'user', user.id.toString(), req.ip]
    );

    res.json({
      message: 'Autentificare reușită.',
      token,
      user: payload,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Eroare la autentificare.' });
  }
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id;

    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilizator negăsit.' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea profilului.' });
  }
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id;
    const { firstName, lastName } = req.body;

    if (!firstName || !lastName) {
      res.status(400).json({ error: 'Prenumele și numele sunt obligatorii.' });
      return;
    }

    const result = await pool.query(
      `UPDATE users SET first_name = $1, last_name = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING id, email, first_name, last_name, role`,
      [firstName, lastName, userId]
    );

    res.json({ message: 'Profil actualizat.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea profilului.' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as any;
    const userId = authReq.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'Parola curentă și cea nouă sunt obligatorii.' });
      return;
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Parola nouă trebuie să aibă cel puțin 8 caractere.' });
      return;
    }

    const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const isValid = await bcrypt.compare(currentPassword, result.rows[0].password_hash);
    if (!isValid) {
      res.status(401).json({ error: 'Parola curentă este incorectă.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const newHash = await bcrypt.hash(newPassword, salt);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);

    res.json({ message: 'Parola a fost schimbată cu succes.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la schimbarea parolei.' });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/verify-email?token=xxx  — activare cont prin link din email
// ─────────────────────────────────────────────────────────────────────────────
export async function verifyEmail(req: Request, res: Response): Promise<void> {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ error: 'Token invalid.' });
      return;
    }

    const result = await pool.query(
      `SELECT id, email, first_name, last_name, role, email_verified
       FROM users
       WHERE email_verification_token = $1 AND is_active = false`,
      [token]
    );

    if (!result.rows.length) {
      res.status(400).json({ error: 'Token invalid sau contul este deja activat.' });
      return;
    }

    const user = result.rows[0];

    // Activăm contul
    await pool.query(
      `UPDATE users
       SET is_active = true, email_verified = true, email_verification_token = NULL, updated_at = NOW()
       WHERE id = $1`,
      [user.id]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'EMAIL_VERIFIED', 'user', user.id.toString(), req.ip]
    );

    // Returnăm token JWT — utilizatorul e logat automat după verificare
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };
    const jwtToken = generateToken(payload);

    res.json({
      message: 'Adresa de email a fost confirmată. Contul tău este acum activ.',
      token: jwtToken,
      user: payload,
    });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Eroare la verificarea emailului.' });
  }
}

export async function forgotPassword(req: Request, res: Response): Promise<void> {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'Email-ul este obligatoriu.' });
      return;
    }

    const result = await pool.query(
      'SELECT id, first_name FROM users WHERE email = $1 AND is_active = true',
      [email.toLowerCase()]
    );

    // Răspuns identic indiferent dacă emailul există (previne enumerarea)
    if (result.rows.length === 0) {
      res.json({ message: 'Dacă adresa există, vei primi instrucțiuni de resetare.' });
      return;
    }

    const user = result.rows[0];

    // Generare token securizat
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 oră

    // Invalidare tokenuri vechi
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE user_id = $1 AND used = FALSE',
      [user.id]
    );

    // Inserare token nou
    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    );

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

    // În producție, se trimite email. Deocamdată logăm și returnăm link-ul în dev.
    console.log(`\n🔑 Link resetare parolă pentru ${email}:\n${resetUrl}\n`);

    res.json({
      message: 'Dacă adresa există, vei primi instrucțiuni de resetare.',
      // Returnăm link-ul doar în development pentru testare
      ...(process.env.NODE_ENV !== 'production' && { resetUrl }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Eroare la procesarea cererii.' });
  }
}

export async function resetPassword(req: Request, res: Response): Promise<void> {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      res.status(400).json({ error: 'Token-ul și parola nouă sunt obligatorii.' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
      return;
    }

    // Validare token
    const result = await pool.query(
      `SELECT prt.id, prt.user_id, u.email
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1
         AND prt.used = FALSE
         AND prt.expires_at > NOW()`,
      [token]
    );

    if (result.rows.length === 0) {
      res.status(400).json({ error: 'Token invalid sau expirat. Solicită un nou link de resetare.' });
      return;
    }

    const { id: tokenId, user_id: userId } = result.rows[0];

    // Hash parolă nouă
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Actualizare parolă
    await pool.query(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [passwordHash, userId]
    );

    // Marcare token ca folosit
    await pool.query(
      'UPDATE password_reset_tokens SET used = TRUE WHERE id = $1',
      [tokenId]
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, 'PASSWORD_RESET', 'user', userId.toString(), req.ip]
    );

    res.json({ message: 'Parola a fost resetată cu succes. Te poți autentifica acum.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Eroare la resetarea parolei.' });
  }
}
