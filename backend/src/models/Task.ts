import mongoose, { Schema, Document } from 'mongoose';

export interface IComment {
  userId: number;
  text: string;
  createdAt: Date;
}

export interface ITask extends Document {
  projectId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigneeId: number | null;  // referință la user din PostgreSQL
  reporterId: number;         // cine a creat task-ul
  deadline: Date | null;
  comments: IComment[];
  attachments: string[];
  labelIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<IComment>(
  {
    userId: { type: Number, required: true },
    text: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const TaskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true },
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: '', maxlength: 5000 },
    status: {
      type: String,
      enum: ['todo', 'in_progress', 'in_review', 'done'],
      default: 'todo',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    assigneeId: { type: Number, default: null },
    reporterId: { type: Number, required: true },
    deadline: { type: Date, default: null },
    comments: [CommentSchema],
    attachments: [{ type: String }],
    labelIds: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
  },
  {
    timestamps: true,
  }
);

// Indexuri
TaskSchema.index({ projectId: 1 });
TaskSchema.index({ status: 1 });
TaskSchema.index({ assigneeId: 1 });
TaskSchema.index({ deadline: 1 });

export default mongoose.model<ITask>('Task', TaskSchema);
