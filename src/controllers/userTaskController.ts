import { Response } from 'express';
import { AuthRequest } from '../middlewares/authorize.middleware';
import sendResponse from '../utils/reponse';
import { User } from '../models/user.model';
import { UserDailyTaskProgress } from '../models/userTask.model';
import { CoinsTransaction } from '../models/spentCoinModel';
import { TransactionType, CallStatus } from '../constants/user';
import { Logger } from '../utils/logger';

const DEFAULT_DAILY_TASKS = [
  { taskId: 't1', title: 'Stay in room for 10 mins', target: 10, rewardCoins: 10 },
  { taskId: 't2', title: 'Stay in room for 30 mins', target: 30, rewardCoins: 30 },
  { taskId: 't3', title: 'Take the mic for 10 mins', target: 10, rewardCoins: 10 },
  { taskId: 't4', title: 'Send gifts', target: 1, rewardCoins: 10 },
  { taskId: 't5', title: 'Recharge', target: 1, rewardCoins: 10 },
];

const getTodayDateKey = (): string => {
  return new Date().toISOString().slice(0, 10);
};

/**
 * Get User Daily Tasks with Progress
 * GET /api/tasks
 */
export const getUserTasks = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const user = await User.findOne({ userId });
    if (!user) return sendResponse(res, 404, false, 'User not found');

    const dateKey = getTodayDateKey();
    let progress = await UserDailyTaskProgress.findOne({ userId: user._id, dateKey });

    if (!progress) {
      progress = await UserDailyTaskProgress.create({
        userId: user._id,
        userNumericId: user.userId,
        dateKey,
        tasks: DEFAULT_DAILY_TASKS.map((t) => ({
          ...t,
          current: 0,
          completed: false,
          claimed: false,
        })),
      });
    }

    return sendResponse(res, 200, true, 'Tasks fetched successfully', {
      dateKey,
      tasks: progress.tasks,
    });
  } catch (error: any) {
    await Logger('getUserTasks', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Claim Task Reward
 * POST /api/tasks/:id/claim
 */
export const claimUserTaskReward = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const { id: taskId } = req.params;

    const user = await User.findOne({ userId });
    if (!user) return sendResponse(res, 404, false, 'User not found');

    const dateKey = getTodayDateKey();
    const progress = await UserDailyTaskProgress.findOne({ userId: user._id, dateKey });

    if (!progress) {
      return sendResponse(res, 404, false, 'No task progress found for today');
    }

    const task = progress.tasks.find((t) => t.taskId === taskId);
    if (!task) {
      return sendResponse(res, 404, false, 'Task not found');
    }

    if (!task.completed && (task.current || 0) < task.target) {
      return sendResponse(res, 400, false, `Task not completed yet (${task.current || 0}/${task.target})`);
    }

    if (task.claimed) {
      return sendResponse(res, 400, false, 'Task reward already claimed today');
    }

    // Atomic claim update to prevent concurrent double-claiming
    const updatedProgress = await UserDailyTaskProgress.findOneAndUpdate(
      {
        _id: progress._id,
        'tasks.taskId': taskId,
        'tasks.claimed': false,
      },
      {
        $set: {
          'tasks.$.completed': true,
          'tasks.$.claimed': true,
        },
      },
      { new: true }
    );

    if (!updatedProgress) {
      return sendResponse(res, 400, false, 'Task reward already claimed or update conflict');
    }

    // Credit coins atomically to user
    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $inc: { coins: task.rewardCoins } },
      { new: true }
    );

    // Ledger record
    await CoinsTransaction.create({
      userId: user._id,
      hostId: user._id,
      type: TransactionType.TASK_REWARD,
      coinsSpent: 0,
      hostEarning: task.rewardCoins,
      status: CallStatus.ENDED,
      meta: { taskId, rewardCoins: task.rewardCoins, dateKey },
    });

    return sendResponse(res, 200, true, `Reward claimed! +${task.rewardCoins} coins added to your wallet. 🎉`, {
      rewardCoins: task.rewardCoins,
      newCoinsBalance: updatedUser?.coins,
      task,
    });
  } catch (error: any) {
    await Logger('claimUserTaskReward', error);
    return sendResponse(res, 500, false, error.message);
  }
};
