import { Response } from 'express';
import Label from '../models/Label';
import Project from '../models/Project';
import Task from '../models/Task';
import { AuthRequest } from '../types';

export async function getLabels(req: AuthRequest, res: Response): Promise<void> {
  try {
    const labels = await Label.find().sort({ name: 1 });
    res.json({ labels });
  } catch {
    res.status(500).json({ error: 'Eroare la obținerea etichetelor.' });
  }
}

export async function createLabel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, color } = req.body;
    if (!name) {
      res.status(400).json({ error: 'Numele etichetei este obligatoriu.' });
      return;
    }

    const existing = await Label.findOne({ name: new RegExp(`^${name}$`, 'i') });
    if (existing) {
      res.status(409).json({ error: 'O etichetă cu acest nume există deja.' });
      return;
    }

    const label = new Label({
      name,
      color: color || '#3b82f6',
      createdBy: req.user!.id,
    });
    await label.save();

    res.status(201).json({ message: 'Etichetă creată.', label });
  } catch {
    res.status(500).json({ error: 'Eroare la crearea etichetei.' });
  }
}

export async function updateLabel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, color } = req.body;
    const update: Partial<{ name: string; color: string }> = {};
    if (name) update.name = name;
    if (color) update.color = color;

    const label = await Label.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!label) {
      res.status(404).json({ error: 'Eticheta nu a fost găsită.' });
      return;
    }

    res.json({ message: 'Etichetă actualizată.', label });
  } catch {
    res.status(500).json({ error: 'Eroare la actualizarea etichetei.' });
  }
}

export async function deleteLabel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const label = await Label.findByIdAndDelete(req.params.id);
    if (!label) {
      res.status(404).json({ error: 'Eticheta nu a fost găsită.' });
      return;
    }

    // Curățare referințe în proiecte și sarcini
    await Project.updateMany({ labelIds: label._id }, { $pull: { labelIds: label._id } });
    await Task.updateMany({ labelIds: label._id }, { $pull: { labelIds: label._id } });

    res.json({ message: 'Etichetă ștearsă.' });
  } catch {
    res.status(500).json({ error: 'Eroare la ștergerea etichetei.' });
  }
}
