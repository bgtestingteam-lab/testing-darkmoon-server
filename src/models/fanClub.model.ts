import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFanClubMembership extends Document {
  userId: Types.ObjectId;
  userNumericId: number;
  hostId: Types.ObjectId;
  hostNumericId: number;
  plan: '1_month' | '3_month';
  costDiamonds: number;
  joinedAt: Date;
  expiresAt: Date;
  intimacyPoints: number;
  fanTier: number; // 1: Iron, 2: Bronze, 3: Silver, 4: Gold, 5: Diamond
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const FanClubMembershipSchema = new Schema<IFanClubMembership>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userNumericId: { type: Number, required: true },
    hostId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    hostNumericId: { type: Number, required: true },
    plan: { type: String, enum: ['1_month', '3_month'], default: '1_month' },
    costDiamonds: { type: Number, required: true },
    joinedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    intimacyPoints: { type: Number, default: 10 },
    fanTier: { type: Number, default: 1, min: 1, max: 5 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

FanClubMembershipSchema.index({ userId: 1, hostId: 1 }, { unique: true });

export const FanClubMembership = mongoose.model<IFanClubMembership>(
  'FanClubMembership',
  FanClubMembershipSchema
);
