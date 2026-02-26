import { Response } from 'express';
import pool from '../config/postgres';
import { AuthRequest } from '../types';

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
