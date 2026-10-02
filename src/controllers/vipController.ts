import { Response } from 'express';
import { AuthRequest } from '../middlewares/authorize.middleware';
import sendResponse from '../utils/reponse';
import { User } from '../models/user.model';
import { CoinsTransaction } from '../models/spentCoinModel';
import { TransactionType, CallStatus } from '../constants/user';
import { Logger } from '../utils/logger';

export const VIP_PLANS: Record<string, { name: string; costCoins: number; durationDays: number }> = {
  VIP1: { name: 'VIP1', costCoins: 400000, durationDays: 30 },
  VIP2: { name: 'VIP2', costCoins: 400000, durationDays: 30 },
  VIP3: { name: 'VIP3', costCoins: 400000, durationDays: 30 },
  VIP4: { name: 'VIP4', costCoins: 400000, durationDays: 30 },
  VIP5: { name: 'VIP5', costCoins: 400000, durationDays: 30 },
  VIP6: { name: 'VIP6', costCoins: 400000, durationDays: 30 },
  VIP7: { name: 'VIP7', costCoins: 400000, durationDays: 30 },
  VIP8: { name: 'VIP8', costCoins: 400000, durationDays: 30 },
};

export const SVIP_TIERS: Record<string, { name: string; costDiamonds: number; dailyReturn: number; durationDays: number }> = {
  knight: { name: 'Knight', costDiamonds: 99000, dailyReturn: 3600, durationDays: 30 },
  count: { name: 'Count', costDiamonds: 180000, dailyReturn: 6000, durationDays: 30 },
  duke: { name: 'Duke', costDiamonds: 360000, dailyReturn: 12000, durationDays: 30 },
  prince: { name: 'Prince', costDiamonds: 750000, dailyReturn: 25000, durationDays: 30 },
  king: { name: 'King', costDiamonds: 1500000, dailyReturn: 50000, durationDays: 30 },
};

/**
 * Get all VIP & SVIP Plans
 */
export const getVipPlans = async (req: AuthRequest, res: Response) => {
  try {
    return sendResponse(res, 200, true, 'Plans fetched successfully', {
      vipPlans: Object.values(VIP_PLANS),
      svipPlans: Object.values(SVIP_TIERS),
    });
  } catch (error: any) {
    await Logger('getVipPlans', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Get User VIP & SVIP Status
 */
export const getVipStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const user = await User.findOne({ userId }).select('isVIP vipTier vipExpiresAt svipTier svipExpiresAt coins diamonds').lean();
    if (!user) return sendResponse(res, 404, false, 'User not found');

    const now = Date.now();
    const isVipActive = Boolean(user.isVIP && user.vipExpiresAt && new Date(user.vipExpiresAt).getTime() > now);
    const isSvipActive = Boolean(user.svipTier && user.svipExpiresAt && new Date(user.svipExpiresAt).getTime() > now);

    return sendResponse(res, 200, true, 'Status fetched successfully', {
      isVIP: isVipActive,
      vipTier: isVipActive ? user.vipTier : '',
      vipExpiresAt: isVipActive ? user.vipExpiresAt : null,
      isSVIP: isSvipActive,
      svipTier: isSvipActive ? user.svipTier : '',
      svipExpiresAt: isSvipActive ? user.svipExpiresAt : null,
    });
  } catch (error: any) {
    await Logger('getVipStatus', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Subscribe to standard VIP (costs Coins)
 */
export const subscribeVip = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const { planId = 'VIP1' } = req.body;

    const plan = VIP_PLANS[planId.toUpperCase()];
    if (!plan) {
      return sendResponse(res, 400, false, `Invalid VIP plan. Choose from: ${Object.keys(VIP_PLANS).join(', ')}`);
    }

    const user = await User.findOne({ userId });
    if (!user) return sendResponse(res, 404, false, 'User not found');

    if ((user.coins || 0) < plan.costCoins) {
      return sendResponse(res, 400, false, `Insufficient Coins. You need ${plan.costCoins.toLocaleString()} coins.`);
    }

    // Atomic deduction
    const updatedUser = await User.findOneAndUpdate(
      { userId, coins: { $gte: plan.costCoins } },
      {
        $inc: { coins: -plan.costCoins },
        $set: {
          isVIP: true,
          vipTier: plan.name,
          vipExpiresAt: new Date(Date.now() + plan.durationDays * 86400000),
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return sendResponse(res, 400, false, 'Transaction failed. Insufficient coin balance.');
    }

    // Ledger record
    await CoinsTransaction.create({
      userId: updatedUser._id,
      hostId: updatedUser._id,
      type: TransactionType.VIP_PURCHASE,
      coinsSpent: plan.costCoins,
      status: CallStatus.ENDED,
      meta: { planName: plan.name, durationDays: plan.durationDays },
    });

    return sendResponse(res, 200, true, `Successfully subscribed to ${plan.name}!`, {
      vipTier: updatedUser.vipTier,
      vipExpiresAt: updatedUser.vipExpiresAt,
      coins: updatedUser.coins,
    });
  } catch (error: any) {
    await Logger('subscribeVip', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Subscribe to SVIP (King of Kings, costs Diamonds)
 */
export const subscribeSvip = async (req: AuthRequest, res: Response) => {
  try {
    const { userId } = req.user || {};
    const { tierId = 'knight' } = req.body;

    const key = String(tierId).toLowerCase();
    const tier = SVIP_TIERS[key];
    if (!tier) {
      return sendResponse(res, 400, false, `Invalid SVIP tier. Choose from: ${Object.keys(SVIP_TIERS).join(', ')}`);
    }

    const user = await User.findOne({ userId });
    if (!user) return sendResponse(res, 404, false, 'User not found');

    if ((user.diamonds || 0) < tier.costDiamonds) {
      return sendResponse(res, 400, false, `Insufficient Diamonds. You need ${tier.costDiamonds.toLocaleString()} diamonds.`);
    }

    // Atomic deduction
    const updatedUser = await User.findOneAndUpdate(
      { userId, diamonds: { $gte: tier.costDiamonds } },
      {
        $inc: { diamonds: -tier.costDiamonds },
        $set: {
          svipTier: tier.name,
          svipExpiresAt: new Date(Date.now() + tier.durationDays * 86400000),
        },
      },
      { new: true }
    );

    if (!updatedUser) {
      return sendResponse(res, 400, false, 'Transaction failed. Insufficient diamond balance.');
    }

    // Ledger record
    await CoinsTransaction.create({
      userId: updatedUser._id,
      hostId: updatedUser._id,
      type: TransactionType.SVIP_PURCHASE,
      coinsSpent: tier.costDiamonds,
      status: CallStatus.ENDED,
      meta: { tierName: tier.name, durationDays: tier.durationDays, dailyReturn: tier.dailyReturn },
    });

    return sendResponse(res, 200, true, `Royal Activation Successful! Welcome to ${tier.name}!`, {
      svipTier: updatedUser.svipTier,
      svipExpiresAt: updatedUser.svipExpiresAt,
      diamonds: updatedUser.diamonds,
      dailyReturn: tier.dailyReturn,
    });
  } catch (error: any) {
    await Logger('subscribeSvip', error);
    return sendResponse(res, 500, false, error.message);
  }
};
