import { Response } from 'express';
import Task from '../models/Task';
import { AuthRequest } from '../types';

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
    res.status(201).json({ message: 'Sarcină creată cu succes.', task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la crearea sarcinii.' });
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
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!task) {
      res.status(404).json({ error: 'Sarcină negăsită.' });
      return;
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

    res.json({ message: 'Comentariu adăugat.', task });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la adăugarea comentariului.' });
  }
}
