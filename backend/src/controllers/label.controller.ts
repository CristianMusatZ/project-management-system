import { Response } from 'express';
import Label from '../models/Label';
import Project from '../models/Project';
import Task from '../models/Task';
import { AuthRequest } from '../types';

export async function getLabels(req: AuthRequest, res: Response): Promise<void> {
  try {
    const labels = await Label.find().sort({ name: 1 });
    res.json({ labels });
  } catch (err) {
    console.error('[Label] getLabels error:', err);
    res.status(500).json({ error: 'Eroare la obținerea etichetelor.' });
  }
}

export async function createLabel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, color } = req.body;

    if (!name || !String(name).trim()) {
      res.status(400).json({ error: 'Numele etichetei este obligatoriu.' });
      return;
    }

    const trimmedName = String(name).trim();

    // Escapăm caracterele speciale regex
    const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existing = await Label.findOne({ name: new RegExp(`^${escapedName}$`, 'i') });
    if (existing) {
      res.status(409).json({ error: 'O etichetă cu acest nume există deja.' });
      return;
    }

    const label = new Label({
      name: trimmedName,
      color: color || '#3b82f6',
      createdBy: req.user!.id,
    });
    await label.save();

    res.status(201).json({ message: 'Etichetă creată.', label });
  } catch (err) {
    console.error('[Label] createLabel error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Eroare la crearea etichetei: ${message}` });
  }
}

export async function updateLabel(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, color } = req.body;
    const update: Partial<{ name: string; color: string }> = {};
    if (name) update.name = String(name).trim();
    if (color) update.color = color;

    const label = await Label.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!label) {
      res.status(404).json({ error: 'Eticheta nu a fost găsită.' });
      return;
    }

    res.json({ message: 'Etichetă actualizată.', label });
  } catch (err) {
    console.error('[Label] updateLabel error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Eroare la actualizarea etichetei: ${message}` });
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
  } catch (err) {
    console.error('[Label] deleteLabel error:', err);
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: `Eroare la ștergerea etichetei: ${message}` });
  }
}
