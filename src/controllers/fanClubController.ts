import { Response } from 'express';
import { AuthRequest } from '../middlewares/authorize.middleware';
import sendResponse from '../utils/reponse';
import { User } from '../models/user.model';
import { FanClubMembership } from '../models/fanClub.model';
import { CoinsTransaction } from '../models/spentCoinModel';
import { TransactionType, CallStatus } from '../constants/user';
import { Logger } from '../utils/logger';
import { getCachedSettings } from './settingsController';
import mongoose from 'mongoose';

const PLAN_COSTS: Record<string, { cost: number; days: number }> = {
  '1_month': { cost: 99, days: 30 },
  '3_month': { cost: 249, days: 90 },
};

/**
 * Join or Renew Fan Club of a Host
 */
export const joinFanClub = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const { hostId, plan = '1_month' } = req.body;

    if (!hostId) {
      return sendResponse(res, 400, false, 'hostId is required');
    }

    const planConfig = PLAN_COSTS[plan] || PLAN_COSTS['1_month'];
    const costDiamonds = planConfig.cost;

    // Find user
    const user = await User.findOne({ userId });
    if (!user) return sendResponse(res, 404, false, 'User not found');

    // Find host
    const isNumeric = /^\d+$/.test(String(hostId));
    const hostFilter: any = isNumeric
      ? { $or: [{ userId: Number(hostId) }, { meethiId: hostId }] }
      : { _id: hostId };
    const host = await User.findOne(hostFilter);
    if (!host) return sendResponse(res, 404, false, 'Host not found');

    if (String(user._id) === String(host._id)) {
      return sendResponse(res, 400, false, 'You cannot join your own Fan Club');
    }

    if ((user.diamonds || 0) < costDiamonds) {
      return sendResponse(res, 400, false, `Insufficient Diamonds. You need ${costDiamonds} Diamonds to join.`);
    }

    // Atomic deduction from user
    const updatedUser = await User.findOneAndUpdate(
      { _id: user._id, diamonds: { $gte: costDiamonds } },
      { $inc: { diamonds: -costDiamonds } },
      { new: true }
    );

    if (!updatedUser) {
      return sendResponse(res, 400, false, 'Transaction failed. Insufficient diamond balance.');
    }

    // Host earnings based on platform commission rate
    const settings = await getCachedSettings().catch(() => null);
    const commissionRate = typeof (settings as any)?.commissionRate === 'number' ? (settings as any).commissionRate : 20;
    const hostSharePercent = Math.max(0, Math.min(100, 100 - commissionRate));
    const hostEarning = Math.floor(costDiamonds * (hostSharePercent / 100));
    await User.findByIdAndUpdate(host._id, { $inc: { diamonds: hostEarning } });

    // Ledger transaction
    await CoinsTransaction.create({
      userId: user._id,
      hostId: host._id,
      type: TransactionType.FANCLUB_JOIN,
      coinsSpent: costDiamonds,
      hostEarning,
      status: CallStatus.ENDED,
      meta: { plan, hostUserId: host.userId, hostName: host.name },
    });

    const now = Date.now();
    const expiresAt = new Date(now + planConfig.days * 86400000);

    // Create or update membership
    const membership = await FanClubMembership.findOneAndUpdate(
      { userId: user._id, hostId: host._id },
      {
        userNumericId: user.userId,
        hostNumericId: host.userId,
        plan,
        costDiamonds,
        joinedAt: new Date(now),
        expiresAt,
        $inc: { intimacyPoints: 50 }, // Bonus intimacy points on joining
        fanTier: 1,
        isActive: true,
      },
      { upsert: true, new: true }
    );

    return sendResponse(res, 200, true, `Congratulations! You are now a proud member of ${host.name}'s Fan Club! 🎉`, {
      membership,
      remainingDiamonds: updatedUser.diamonds,
    });
  } catch (error: any) {
    await Logger('joinFanClub', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Get Fan Club Details for a Host
 */
export const getFanClubDetails = async (req: AuthRequest, res: Response) => {
  try {
    const { hostId } = req.params;
    const { userId } = req.user || {};

    if (!hostId) {
      return sendResponse(res, 400, false, 'hostId is required');
    }

    const isNumeric = /^\d+$/.test(String(hostId));
    const hostFilter: any = isNumeric
      ? { $or: [{ userId: Number(hostId) }, { meethiId: hostId }] }
      : { _id: hostId };
    const host = await User.findOne(hostFilter).select('userId name image avatar gender level bio meethiId').lean();
    if (!host) return sendResponse(res, 404, false, 'Host not found');

    const totalMembers = await FanClubMembership.countDocuments({
      hostId: host._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    });

    let isMember = false;
    let membership: any = null;

    if (userId) {
      const user = await User.findOne({ userId }).select('_id');
      if (user) {
        membership = await FanClubMembership.findOne({
          userId: user._id,
          hostId: host._id,
          isActive: true,
          expiresAt: { $gt: new Date() },
        }).lean();
        isMember = Boolean(membership);
      }
    }

    return sendResponse(res, 200, true, 'Fan club details fetched successfully', {
      host: {
        id: host._id,
        userId: host.userId,
        name: host.name,
        avatar: host.image || (host as any).avatar,
        gender: host.gender,
        level: host.level || 1,
      },
      membersCount: totalMembers,
      isMember,
      membership: membership
        ? {
            plan: membership.plan,
            expiresAt: membership.expiresAt,
            intimacyPoints: membership.intimacyPoints,
            fanTier: membership.fanTier,
          }
        : null,
    });
  } catch (error: any) {
    await Logger('getFanClubDetails', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Get Top Fan Club Members
 */
export const getFanClubMembers = async (req: AuthRequest, res: Response) => {
  try {
    const { hostId } = req.params;
    if (!hostId) return sendResponse(res, 400, false, 'hostId is required');

    const isNumeric = /^\d+$/.test(String(hostId));
    const hostFilter: any = isNumeric
      ? { $or: [{ userId: Number(hostId) }, { meethiId: hostId }] }
      : { _id: hostId };
    const host = await User.findOne(hostFilter).select('_id');
    if (!host) return sendResponse(res, 404, false, 'Host not found');

    const members = await FanClubMembership.find({
      hostId: host._id,
      isActive: true,
      expiresAt: { $gt: new Date() },
    })
      .populate('userId', 'userId name image avatar gender level equippedFrame badges')
      .sort({ intimacyPoints: -1 })
      .limit(30)
      .lean();

    const formatted = members.map((m: any, idx: number) => ({
      rank: idx + 1,
      user: m.userId,
      intimacyPoints: m.intimacyPoints,
      fanTier: m.fanTier,
      joinedAt: m.joinedAt,
    }));

    return sendResponse(res, 200, true, 'Fan club members fetched', { members: formatted });
  } catch (error: any) {
    await Logger('getFanClubMembers', error);
    return sendResponse(res, 500, false, error.message);
  }
};
