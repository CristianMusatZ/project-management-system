import mongoose, { Schema, Document } from 'mongoose';

export interface ILabel extends Document {
  name: string;
  color: string; // hex (#3b82f6)
  createdBy: number;
  createdAt: Date;
  updatedAt: Date;
}

const LabelSchema = new Schema<ILabel>(
  {
    name: { type: String, required: true, trim: true, maxlength: 50 },
    color: { type: String, required: true, default: '#3b82f6' },
    createdBy: { type: Number, required: true },
  },
  { timestamps: true }
);

LabelSchema.index({ name: 1 });

export default mongoose.model<ILabel>('Label', LabelSchema);
