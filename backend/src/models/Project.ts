import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  startDate: Date;
  deadline: Date;
  ownerId: number;       // referință la user din PostgreSQL
  memberIds: number[];   // referințe la useri din PostgreSQL
  labelIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 2000 },
    status: {
      type: String,
      enum: ['planning', 'active', 'on_hold', 'completed', 'cancelled'],
      default: 'planning',
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
    startDate: { type: Date, default: Date.now },
    deadline: { type: Date, required: true },
    ownerId: { type: Number, required: true },
    memberIds: [{ type: Number }],
    labelIds: [{ type: Schema.Types.ObjectId, ref: 'Label' }],
  },
  {
    timestamps: true,
  }
);

// Indexuri pentru performanță
ProjectSchema.index({ status: 1 });
ProjectSchema.index({ ownerId: 1 });
ProjectSchema.index({ deadline: 1 });

export default mongoose.model<IProject>('Project', ProjectSchema);
