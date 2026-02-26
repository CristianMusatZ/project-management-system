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

    // Member și viewer pot vedea doar proiectele la care sunt alocați
    if (req.user!.role === 'member' || req.user!.role === 'viewer') {
      const isMember = project.memberIds.includes(req.user!.id);
      if (!isMember) {
        res.status(403).json({ error: 'Nu aveți acces la acest proiect.' });
        return;
      }
    }

    res.json({ project });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la obținerea proiectului.' });
  }
}

export async function updateProject(req: AuthRequest, res: Response): Promise<void> {
  try {
    const existing = await Project.findById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }

    // PM poate edita doar proiectele proprii (unde este owner)
    if (req.user!.role === 'project_manager' && existing.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Nu aveți permisiunea de a edita acest proiect.' });
      return;
    }

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
    // PM poate șterge doar proiectele proprii (unde este owner)
    if (req.user!.role === 'project_manager') {
      const existing = await Project.findById(req.params.id);
      if (!existing) {
        res.status(404).json({ error: 'Proiect negăsit.' });
        return;
      }
      if (existing.ownerId !== req.user!.id) {
        res.status(403).json({ error: 'Nu aveți permisiunea de a șterge acest proiect.' });
        return;
      }
    }

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

export async function addMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId este obligatoriu.' });
      return;
    }

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }

    if (req.user!.role === 'project_manager' && project.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Nu aveți permisiunea de a modifica acest proiect.' });
      return;
    }

    const numUserId = Number(userId);
    if (!project.memberIds.includes(numUserId)) {
      project.memberIds.push(numUserId);
      await project.save();
    }

    res.json({ message: 'Membru adăugat.', project });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la adăugarea membrului.' });
  }
}

export async function removeMember(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id, userId } = req.params;

    const project = await Project.findById(id);
    if (!project) {
      res.status(404).json({ error: 'Proiect negăsit.' });
      return;
    }

    if (req.user!.role === 'project_manager' && project.ownerId !== req.user!.id) {
      res.status(403).json({ error: 'Nu aveți permisiunea de a modifica acest proiect.' });
      return;
    }

    const numUserId = Number(userId);
    project.memberIds = project.memberIds.filter((mid: number) => mid !== numUserId);
    await project.save();

    res.json({ message: 'Membru eliminat.', project });
  } catch (error) {
    res.status(500).json({ error: 'Eroare la eliminarea membrului.' });
  }
}
