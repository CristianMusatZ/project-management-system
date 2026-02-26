import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/postgres';
import { generateToken } from '../middleware/auth';
import { UserPayload } from '../types';

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

    // Inserare utilizator
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, 'member']
    );

    const user = result.rows[0];

    // Generare token
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };
    const token = generateToken(payload);

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, 'REGISTER', 'user', user.id.toString(), req.ip]
    );

    res.status(201).json({
      message: 'Cont creat cu succes.',
      token,
      user: payload,
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

    // Generare token
    const payload: UserPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      firstName: user.first_name,
      lastName: user.last_name,
    };
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
