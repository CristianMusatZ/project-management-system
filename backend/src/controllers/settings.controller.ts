import { Response } from 'express';
import pool from '../config/postgres';
import { AuthRequest } from '../types';

// -------------------------------------------------------
// GET /api/settings  — oricine autentificat (pentru org_name în UI)
// -------------------------------------------------------
export async function getSettings(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query('SELECT key, value FROM settings ORDER BY key');
    const settings: Record<string, string> = {};
    result.rows.forEach((row) => { settings[row.key] = row.value; });
    res.json({ settings });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea setărilor.' });
  }
}

// -------------------------------------------------------
// PUT /api/settings  — doar admin
// -------------------------------------------------------
export async function updateSettings(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { settings } = req.body;
    if (!settings || typeof settings !== 'object') {
      res.status(400).json({ error: 'Date invalide.' });
      return;
    }

    for (const [key, value] of Object.entries(settings)) {
      await pool.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
        [key, String(value)]
      );
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'UPDATE_SETTINGS', 'settings', 'system', JSON.stringify(settings)]
    );

    res.json({ message: 'Setări actualizate cu succes.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea setărilor.' });
  }
}

// -------------------------------------------------------
// GET /api/settings/audit-logs  — doar admin, paginat
// -------------------------------------------------------
export async function getAuditLogs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 25);
    const offset = (page - 1) * limit;
    const action = req.query.action as string | undefined;
    const filterUserId = req.query.userId as string | undefined;

    const conditions: string[] = [];
    const params: any[] = [];

    if (action) {
      conditions.push(`a.action = $${params.length + 1}`);
      params.push(action);
    }
    if (filterUserId) {
      conditions.push(`a.user_id = $${params.length + 1}`);
      params.push(Number(filterUserId));
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total count
    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM audit_logs a ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Paginated data
    const dataResult = await pool.query(
      `SELECT a.id, a.action, a.entity_type, a.entity_id, a.details, a.created_at,
              u.email, u.first_name, u.last_name, u.role
       FROM audit_logs a
       LEFT JOIN users u ON a.user_id = u.id
       ${whereClause}
       ORDER BY a.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    res.json({
      logs: dataResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
    res.status(500).json({ error: 'Eroare la obținerea jurnalului de activitate.' });
  }
}

// -------------------------------------------------------
// GET /api/settings/audit-logs/actions  — lista acțiunilor distincte (pentru filtru)
// -------------------------------------------------------
export async function getAuditActions(_req: AuthRequest, res: Response): Promise<void> {
  try {
    const result = await pool.query(
      `SELECT DISTINCT action FROM audit_logs ORDER BY action`
    );
    res.json({ actions: result.rows.map((r) => r.action) });
  } catch (error) {
    res.status(500).json({ error: 'Eroare.' });
  }
}
