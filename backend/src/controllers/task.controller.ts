import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import Task from '../models/Task';
import Project from '../models/Project';
import { AuthRequest } from '../types';
import { createNotification } from './notification.controller';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const statusLabels: Record<string, string> = {
  todo: 'De făcut',
  in_progress: 'În lucru',
  in_review: 'În review',
  done: 'Finalizat',
};

export async function createTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { projectId, title, description, priority, assigneeId, deadline } = req.body;

    if (!projectId || !title) {
      res.status(400).json({ error: 'Proiectul și titlul sunt obligatorii.' });
      return;
    }

    const task = new Task({
      projectId,
      title,
      description: description || '',
      priority: priority || 'medium',
      assigneeId: assigneeId || null,
      reporterId: req.user!.id,
      deadline: deadline ? new Date(deadline) : null,
    });

    await task.save();

    // Notificare: sarcina a fost asignată
    if (assigneeId && Number(assigneeId) !== req.user!.id) {
      await createNotification(
        Number(assigneeId),
        'task_assigned',
        'Sarcină nouă asignată',
        `Ai fost asignat la sarcina: "${title}"`,
        'task',
        task._id.toString(),
        { taskTitle: title }
      );
    }

    res.status(201).json({ message: 'Sarcină creată cu succes.', task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la crearea sarcinii.' });
  }
}

// Returnează toate sarcinile pentru toate proiectele accesibile userului (un singur request)
export async function getAllTasks(req: AuthRequest, res: Response): Promise<void> {
  try {
    const projectFilter: any = {};
    if (req.user!.role === 'member' || req.user!.role === 'viewer') {
      projectFilter.memberIds = req.user!.id;
    }

    const projects = await Project.find(projectFilter).select('_id');
    const projectIds = projects.map((p) => p._id);

    const tasks = await Task.find({ projectId: { $in: projectIds } }).sort({ createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea sarcinilor.' });
  }
}

export async function getTasksByProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const { status, assigneeId } = req.query;

    const filter: any = { projectId };
    if (status) filter.status = status;
    if (assigneeId) filter.assigneeId = Number(assigneeId);

    const tasks = await Task.find(filter).sort({ priority: -1, createdAt: -1 });
    res.json({ tasks });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea sarcinilor.' });
  }
}

export async function getTaskById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }
    res.json({ task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea sarcinii.' });
  }
}

export async function updateTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await Task.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }

    // Member poate actualiza doar sarcinile la care este asignat
    if (req.user!.role === 'member' && existing.assigneeId !== req.user!.id) {
      res.status(403).json({ error: 'Nu aveți permisiunea de a modifica această sarcină.' });
      return;
    }

    const oldAssigneeId = existing.assigneeId;
    const oldStatus = existing.status;
    const newAssigneeId = req.body.assigneeId !== undefined ? req.body.assigneeId : oldAssigneeId;
    const newStatus = req.body.status !== undefined ? req.body.status : oldStatus;

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!task) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }

    // Notificare: assignee schimbat
    if (newAssigneeId && newAssigneeId !== oldAssigneeId && Number(newAssigneeId) !== req.user!.id) {
      await createNotification(
        Number(newAssigneeId),
        'task_assigned',
        'Sarcină asignată',
        `Ai fost asignat la sarcina: "${existing.title}"`,
        'task',
        task._id.toString(),
        { taskTitle: existing.title }
      );
    }

    // Notificare: status schimbat — notifică reporterul și assignee-ul (dacă nu e cel care a schimbat)
    if (newStatus !== oldStatus) {
      const label = statusLabels[newStatus] || newStatus;
      const notify = new Set<number>();
      if (existing.reporterId && existing.reporterId !== req.user!.id) notify.add(existing.reporterId);
      if (existing.assigneeId && existing.assigneeId !== req.user!.id) notify.add(existing.assigneeId);
      for (const uid of notify) {
        await createNotification(
          uid,
          'task_status_changed',
          'Status sarcină actualizat',
          `Sarcina "${existing.title}" a fost mutată în: ${label}`,
          'task',
          task._id.toString(),
          { taskTitle: existing.title, newStatus }
        );
      }
    }

    res.json({ message: 'Sarcină actualizată.', task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea sarcinii.' });
  }
}

export async function deleteTask(req: AuthRequest, res: Response): Promise<void> {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }
    res.json({ message: 'Sarcină ștearsă cu succes.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la ștergerea sarcinii.' });
  }
}

export async function addComment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { text } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Textul comentariului este obligatoriu.' });
      return;
    }

    // Citim sarcina înainte de update pentru a obține assigneeId și reporterId
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }

    const task = await Task.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: { userId: req.user!.id, text, createdAt: new Date() },
        },
      },
      { new: true }
    );

    if (!task) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
    }

    // Notificare: comentariu nou — notifică assigneeul și reporterul (nu cel care a comentat)
    const notify = new Set<number>();
    if (existingTask.reporterId && existingTask.reporterId !== req.user!.id) notify.add(existingTask.reporterId);
    if (existingTask.assigneeId && existingTask.assigneeId !== req.user!.id) notify.add(existingTask.assigneeId);
    const commentPreview = text.length > 120 ? text.slice(0, 117) + '...' : text;
    for (const uid of notify) {
      await createNotification(
        uid,
        'comment_added',
        'Comentariu nou',
        `Comentariu nou pe sarcina: "${existingTask.title}"`,
        'task',
        task._id.toString(),
        {
          taskTitle: existingTask.title,
          authorName: `${req.user!.firstName} ${req.user!.lastName}`.trim() || req.user!.email,
          commentPreview,
        }
      );
    }

    res.json({ message: 'Comentariu adăugat.', task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la adăugarea comentariului.' });
  }
}

export async function uploadAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { filename, data, mimeType } = req.body;

    if (!filename || !data) {
      res.status(400).json({ error: 'Numele fișierului și datele sunt obligatorii.' });
      return;
    }

    const task = await Task.findById(id);
    if (!task) {
      res.status(404).json({ error: 'Sarcina nu a fost găsită.' });
      return;
    }

    // Verificare permisiune — viewer nu poate adăuga atașamente
    if (req.user!.role === 'viewer') {
      res.status(403).json({ error: 'Nu aveți permisiunea de a adăuga atașamente.' });
      return;
    }

    // Sanitizare și unicizare nume fișier
    const ext = path.extname(filename);
    const baseName = path.basename(filename, ext).replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 100);
    const uniqueName = `${Date.now()}_${baseName}${ext}`;
    const filePath = path.join(UPLOADS_DIR, uniqueName);

    // Scriere pe disc din base64
    const buffer = Buffer.from(data, 'base64');
    fs.writeFileSync(filePath, buffer);

    // Actualizare task
    task.attachments.push(uniqueName);
    await task.save();

    res.json({ message: 'Atașament adăugat.', filename: uniqueName, attachments: task.attachments });
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({ error: 'Eroare la încărcarea atașamentului.' });
  }
}

export async function deleteAttachment(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = String(req.params.id);
    const filename = String(req.params.filename);

    const task = await Task.findById(id);
    if (!task) {
      res.status(404).json({ error: 'Sarcina nu a fost găsită.' });
      return;
    }

    // Verificare permisiune
    if (req.user!.role === 'viewer') {
      res.status(403).json({ error: 'Nu aveți permisiunea de a șterge atașamente.' });
      return;
    }

    if (!task.attachments.includes(filename)) {
      res.status(404).json({ error: 'Atașamentul nu a fost găsit.' });
      return;
    }

    // Ștergere din task
    task.attachments = task.attachments.filter((a) => a !== filename);
    await task.save();

    // Ștergere fișier de pe disc
    const filePath = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ message: 'Atașament șters.', attachments: task.attachments });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Eroare la ștergerea atașamentului.' });
  }
}
