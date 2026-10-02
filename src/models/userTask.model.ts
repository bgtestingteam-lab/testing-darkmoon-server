import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUserDailyTaskProgress extends Document {
  userId: Types.ObjectId;
  userNumericId: number;
  dateKey: string; // YYYY-MM-DD
  tasks: Array<{
    taskId: string;
    title: string;
    target: number;
    current: number;
    rewardCoins: number;
    completed: boolean;
    claimed: boolean;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

const UserDailyTaskProgressSchema = new Schema<IUserDailyTaskProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    userNumericId: { type: Number, required: true },
    dateKey: { type: String, required: true, index: true },
    tasks: [
      {
        taskId: { type: String, required: true },
        title: { type: String, required: true },
        target: { type: Number, required: true, default: 1 },
        current: { type: Number, default: 0 },
        rewardCoins: { type: Number, required: true, default: 10 },
        completed: { type: Boolean, default: false },
        claimed: { type: Boolean, default: false },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

UserDailyTaskProgressSchema.index({ userId: 1, dateKey: 1 }, { unique: true });

export const UserDailyTaskProgress = mongoose.model<IUserDailyTaskProgress>(
  'UserDailyTaskProgress',
  UserDailyTaskProgressSchema
);
