import { Response } from 'express';
import pool from '../config/postgres';
import { AuthRequest } from '../types';

// -------------------------------------------------------
// Helper — creat intern de alte controllere, nu e un route handler
// -------------------------------------------------------
export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  entityType: string,
  entityId: string
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, message, entityType, entityId]
    );
  } catch (error) {
    // Notificările sunt non-critice — nu blocăm operațiunea principală
    console.error('Failed to create notification:', error);
  }
}

// -------------------------------------------------------
// GET /api/notifications  — ultimele 30, cu număr unread
// -------------------------------------------------------
export async function getNotifications(req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT id, type, title, message, entity_type, entity_id, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user!.id]
    );

    const unreadCount = result.rows.filter((n) => !n.is_read).length;
    res.json({ notifications: result.rows, unreadCount });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea notificărilor.' });
  }
}

// -------------------------------------------------------
// PUT /api/notifications/:id/read  — marchează una ca citită
// -------------------------------------------------------
export async function markAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user!.id]
    );
    res.json({ message: 'Notificare marcată ca citită.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare.' });
  }
}

// -------------------------------------------------------
// PUT /api/notifications/read-all  — marchează toate ca citite
// -------------------------------------------------------
export async function markAllAsRead(req: AuthRequest, res: Response): Promise<void> {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [req.user!.id]
    );
    res.json({ message: 'Toate notificările au fost marcate ca citite.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare.' });
  }
}
