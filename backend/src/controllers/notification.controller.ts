import { Response } from 'express';
import pool from '../config/postgres';
import { AuthRequest } from '../types';
import {
  sendTaskAssignedEmail,
  sendStatusChangedEmail,
  sendCommentAddedEmail,
  sendGenericNotificationEmail,
} from '../services/email.service';

// -------------------------------------------------------
// Helper intern — preia email + nume utilizator din PostgreSQL
// -------------------------------------------------------
async function getUserEmailAndName(userId: number): Promise<{ email: string; name: string } | null> {
  try {
    const result = await pool.query(
      `SELECT email, name FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    if (result.rows.length === 0) return null;
    return { email: result.rows[0].email, name: result.rows[0].name };
  } catch {
    return null;
  }
}

// -------------------------------------------------------
// Tipuri de notificări cunoscute
// -------------------------------------------------------
type NotificationType = 'task_assigned' | 'task_status_changed' | 'comment_added' | string;

// -------------------------------------------------------
// createNotification — creat intern de alte controllere
// Salvează în DB + trimite email (non-blocant)
// -------------------------------------------------------
export async function createNotification(
  userId: number,
  type: NotificationType,
  title: string,
  message: string,
  entityType: string,
  entityId: string,
  extra?: {
    /** Noul status (pentru task_status_changed) */
    newStatus?: string;
    /** Numele autorului comentariului (pentru comment_added) */
    authorName?: string;
    /** Preview-ul comentariului (pentru comment_added) */
    commentPreview?: string;
    /** Titlul sarcinii (pentru toate tipurile) */
    taskTitle?: string;
    /** Numele proiectului (opțional, pentru task_assigned) */
    projectName?: string;
  }
): Promise<void> {
  // 1. Salvare în baza de date (non-critică)
  try {
    await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, type, title, message, entityType, entityId]
    );
  } catch (error) {
    console.error('[Notification] Eroare la salvare în DB:', error);
  }

  // 2. Trimitere email (non-critică — nu blochează răspunsul API)
  setImmediate(async () => {
    try {
      const user = await getUserEmailAndName(userId);
      if (!user) return;

      const taskTitle = extra?.taskTitle || title;

      if (type === 'task_assigned') {
        await sendTaskAssignedEmail(user.email, user.name, taskTitle, extra?.projectName);
      } else if (type === 'task_status_changed' && extra?.newStatus) {
        await sendStatusChangedEmail(user.email, user.name, taskTitle, extra.newStatus);
      } else if (type === 'comment_added') {
        await sendCommentAddedEmail(
          user.email,
          user.name,
          taskTitle,
          extra?.authorName || 'Un coleg',
          extra?.commentPreview || message
        );
      } else {
        // Fallback generic pentru orice alt tip de notificare
        await sendGenericNotificationEmail(user.email, user.name, title, message);
      }
    } catch (err) {
      console.error('[Notification] Eroare la trimiterea emailului:', err instanceof Error ? err.message : err);
    }
  });
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
