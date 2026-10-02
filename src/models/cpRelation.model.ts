import mongoose, { Schema, Document } from 'mongoose';

export interface ICPRelation extends Document {
  user1: mongoose.Types.ObjectId;
  user2: mongoose.Types.ObjectId;
  intimacyScore: number;
  level: number;
  status: 'pending' | 'active' | 'dissolved';
  promiseGiftCount: number;
  bindDate: Date;
  ringEquipped?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CPRelationSchema = new Schema<ICPRelation>(
  {
    user1: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    user2: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    intimacyScore: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    status: { type: String, enum: ['pending', 'active', 'dissolved'], default: 'active' },
    promiseGiftCount: { type: Number, default: 0 },
    bindDate: { type: Date, default: Date.now },
    ringEquipped: { type: String, default: 'Promise Ring' },
  },
  { timestamps: true }
);

CPRelationSchema.index({ user1: 1, user2: 1 });
CPRelationSchema.index({ intimacyScore: -1 });

export const CPRelation = mongoose.model<ICPRelation>('CPRelation', CPRelationSchema);
