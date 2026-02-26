import { Response } from 'express';
import Project from '../models/Project';
import { AuthRequest } from '../types';
import pool from '../config/postgres';

export async function createProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, description, priority, startDate, deadline, memberIds } = req.body;

    if (!name || !deadline) {
      res.status(400).json({ error: 'Numele și deadline-ul sunt obligatorii.' });
      return;
    }

    const project = new Project({
      name,
      description: description || '',
      priority: priority || 'medium',
      startDate: startDate || new Date(),
      deadline: new Date(deadline),
      ownerId: req.user!.id,
      memberIds: memberIds || [req.user!.id],
    });

    await project.save();

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'CREATE_PROJECT', 'project', project._id.toString(), JSON.stringify({ name })]
    );

    res.status(201).json({ message: 'Proiect creat cu succes.', project });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Eroare la crearea proiectului.' });
  }
}

export async function getProjects(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { status, priority, search } = req.query;
    const filter: any = {};

    // Filtrare pe baza rolului
    if (req.user!.role === 'member' || req.user!.role === 'viewer') {
      filter.memberIds = req.user!.id;
    }

    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (search) filter.name = { $regex: search, $options: 'i' };

    const projects = await Project.find(filter).sort({ updatedAt: -1 });
    res.json({ projects });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea proiectelor.' });
  }
}

export async function getProjectById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }
    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea proiectului.' });
  }
}

export async function updateProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'UPDATE_PROJECT', 'project', project._id.toString(), JSON.stringify(req.body)]
    );

    res.json({ message: 'Proiect actualizat.', project });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la actualizarea proiectului.' });
  }
}

export async function deleteProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const project = await Project.findByIdAndDelete(req.params.id);
    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }

    // Audit log
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user!.id, 'DELETE_PROJECT', 'project', req.params.id, JSON.stringify({ name: project.name })]
    );

    res.json({ message: 'Proiect șters cu succes.' });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la ștergerea proiectului.' });
  }
}
