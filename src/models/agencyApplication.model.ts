import mongoose, { Schema, Document } from 'mongoose';

export interface IAgencyApplication extends Document {
  agencyId: string;
  agencyName: string;
  userId: mongoose.Types.ObjectId;
  country: string;
  whatsappNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  appliedAt: Date;
  reviewedAt?: Date;
  reviewerNotes?: string;
}

const AgencyApplicationSchema = new Schema<IAgencyApplication>(
  {
    agencyId: { type: String, required: true },
    agencyName: { type: String, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    country: { type: String, default: 'Turkey' },
    whatsappNumber: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: { type: Date },
    reviewerNotes: { type: String },
  },
  { timestamps: true }
);

AgencyApplicationSchema.index({ userId: 1 });
AgencyApplicationSchema.index({ agencyId: 1 });

export const AgencyApplication = mongoose.model<IAgencyApplication>(
  'AgencyApplication',
  AgencyApplicationSchema
);
