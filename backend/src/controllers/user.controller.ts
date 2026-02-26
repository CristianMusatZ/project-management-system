import { Response } from 'express';
import bcrypt from 'bcryptjs';
import pool from '../config/postgres';
import { AuthRequest } from '../types';

// Listă simplificată (id + nume) pentru dropdown-uri — accesibilă admin + PM
export async function getUsersList(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role FROM users WHERE is_active = true ORDER BY first_name, last_name'
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea utilizatorilor.' });
  }
}

// Creare utilizator de către admin (cu rol specificat, fără auto-login)
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!email || !password || !firstName || !lastName) {
      res.status(400).json({ error: 'Toate câmpurile sunt obligatorii.' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Parola trebuie să aibă cel puțin 8 caractere.' });
      return;
    }
    const validRoles = ['admin', 'project_manager', 'member', 'viewer'];
    if (role && !validRoles.includes(role)) {
      res.status(400).json({ error: 'Rol invalid.' });
      return;
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      res.status(409).json({ error: 'Adresa de email este deja înregistrată.' });
      return;
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, first_name, last_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, firstName, lastName, role || 'member']
    );

    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'CREATE_USER', 'user', result.rows[0].id.toString(), JSON.stringify({ email, role: role || 'member' })]
    );

    res.status(201).json({ message: 'Utilizator creat cu succes.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la crearea utilizatorului.' });
  }
}

export async function getUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );
    res.json({ users: result.rows });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea utilizatorilor.' });
  }
}

export async function getUserById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, first_name, last_name, role, is_active, created_at FROM users WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilizator negăsit.' });
      return;
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea utilizatorului.' });
  }
}

export async function updateUserRole(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const validRoles = ['admin', 'project_manager', 'member', 'viewer'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Rol invalid.' });
      return;
    }

    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, first_name, last_name, role',
      [role, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilizator negăsit.' });
      return;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user?.id, 'UPDATE_ROLE', 'user', id, JSON.stringify({ newRole: role })]
    );

    res.json({ message: 'Rol actualizat cu succes.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea rolului.' });
  }
}

export async function toggleUserActive(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active, updated_at = NOW() WHERE id = $1 RETURNING id, email, is_active',
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Utilizator negăsit.' });
      return;
    }

    res.json({ message: 'Status actualizat.', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea statusului.' });
  }
}
