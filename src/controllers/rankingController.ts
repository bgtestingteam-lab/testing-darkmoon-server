import { Request, Response } from 'express';
import sendResponse from '../utils/reponse';
import { CoinsTransaction } from '../models/spentCoinModel';
import { User } from '../models/user.model';
import { Logger } from '../utils/logger';
import mongoose from 'mongoose';

const formatScore = (num: number): string => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'm';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num || 0);
};

const getStartDateForPeriod = (period: string): Date | null => {
  const now = Date.now();
  switch (String(period).toLowerCase()) {
    case 'daily':
    case 'day':
      return new Date(now - 24 * 3600 * 1000);
    case 'weekly':
    case 'week':
      return new Date(now - 7 * 24 * 3600 * 1000);
    case 'monthly':
    case 'month':
      return new Date(now - 30 * 24 * 3600 * 1000);
    case 'last_month':
      return new Date(now - 60 * 24 * 3600 * 1000);
    case 'all':
    default:
      return null;
  }
};

/**
 * Get Dynamic Wealth & Charm Leaderboard Rankings
 * GET /api/ranking?type=wealth|charm&period=daily|weekly|monthly
 */
export const getRankings = async (req: Request, res: Response) => {
  try {
    const { type = 'wealth', period = 'daily', limit = 30 } = req.query;
    const isWealth = String(type).toLowerCase() === 'wealth';
    const startDate = getStartDateForPeriod(String(period));

    const matchStage: any = {};
    if (startDate) {
      matchStage.createdAt = { $gte: startDate };
    }

    let groupField = isWealth ? '$userId' : '$hostId';
    let sumField = isWealth ? '$coinsSpent' : '$hostEarning';

    if (isWealth) {
      matchStage.coinsSpent = { $gt: 0 };
    } else {
      matchStage.hostEarning = { $gt: 0 };
    }

    const aggregated = await CoinsTransaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupField,
          totalScore: { $sum: sumField },
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: Number(limit) || 30 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userDetails',
        },
      },
      { $unwind: '$userDetails' },
      {
        $project: {
          _id: 1,
          totalScore: 1,
          'userDetails.userId': 1,
          'userDetails.name': 1,
          'userDetails.userName': 1,
          'userDetails.image': 1,
          'userDetails.avatar': 1,
          'userDetails.gender': 1,
          'userDetails.level': 1,
          'userDetails.country': 1,
        },
      },
    ]);

    // Format into ranking items
    const allRanked = aggregated.map((entry, index) => {
      const u = entry.userDetails || {};
      const rankNum = index + 1;
      return {
        rank: rankNum,
        name: u.name || u.userName || `User #${u.userId || rankNum}`,
        id: String(u.userId || entry._id),
        avatar: u.image || u.avatar || 'https://api.darkmoon.app/uploads/avatars/female_default.webp',
        gender: u.gender || 'male',
        flag: u.country?.flag || (typeof u.country === 'string' ? u.country : '🇮🇳'),
        score: formatScore(entry.totalScore),
        rawScore: entry.totalScore,
        level: u.level || Math.min(60, Math.floor(Math.sqrt(entry.totalScore / 100)) + 1),
        isCenter: rankNum === 1,
      };
    });

    // Align top3 with the frontend podium layout: [Rank 2 (Left), Rank 1 (Center), Rank 3 (Right)]
    const rank1 = allRanked[0] || null;
    const rank2 = allRanked[1] || null;
    const rank3 = allRanked[2] || null;

    const top3 = [
      rank2 || {
        rank: 2,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/female_default.webp',
        gender: 'female',
        flag: '',
        score: '0',
        rawScore: 0,
        level: 1,
        isCenter: false,
      },
      rank1 || {
        rank: 1,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/male_default.webp',
        gender: 'male',
        flag: '',
        score: '0',
        rawScore: 0,
        level: 1,
        isCenter: true,
      },
      rank3 || {
        rank: 3,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/female_default.webp',
        gender: 'female',
        flag: '',
        score: '0',
        rawScore: 0,
        level: 1,
        isCenter: false,
      },
    ];
    const list = allRanked.slice(3);

    return sendResponse(res, 200, true, 'Rankings fetched successfully', {
      type,
      period,
      top3,
      list,
      totalRanked: allRanked.length,
    });
  } catch (error: any) {
    await Logger('getRankings', error);
    return sendResponse(res, 500, false, error.message);
  }
};

/**
 * Get Supporters for a Target User or Host
 * GET /api/user/supporters?userId=...&period=this_month|last_month
 */
export const getSupporters = async (req: Request, res: Response) => {
  try {
    const { userId, period = 'this_month', limit = 30 } = req.query;
    const targetUserId = userId || (req as any).user?.userId || (req as any).user?._id;
    if (!targetUserId) return sendResponse(res, 400, false, 'userId is required');

    // Find host user document
    const isNumeric = /^\d+$/.test(String(targetUserId));
    const targetFilter: any = isNumeric
      ? { $or: [{ userId: Number(targetUserId) }, { meethiId: targetUserId }] }
      : { _id: targetUserId };
    const targetUser = await User.findOne(targetFilter).select('_id');
    if (!targetUser) return sendResponse(res, 404, false, 'Target user not found');

    const startDate = getStartDateForPeriod(period === 'last_month' ? 'last_month' : 'monthly');
    const matchStage: any = {
      hostId: targetUser._id,
      coinsSpent: { $gt: 0 },
    };
    if (startDate) {
      matchStage.createdAt = { $gte: startDate };
    }

    const aggregated = await CoinsTransaction.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$userId',
          totalScore: { $sum: '$coinsSpent' },
        },
      },
      { $sort: { totalScore: -1 } },
      { $limit: Number(limit) || 30 },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'supporter',
        },
      },
      { $unwind: '$supporter' },
    ]);

    const allSupporters = aggregated.map((entry, index) => {
      const s = entry.supporter || {};
      const rankNum = index + 1;
      return {
        rank: rankNum,
        name: s.name || s.userName || `Supporter #${s.userId || rankNum}`,
        id: String(s.userId || entry._id),
        avatar: s.image || s.avatar || 'https://api.darkmoon.app/uploads/avatars/male_default.webp',
        gender: s.gender || 'male',
        score: formatScore(entry.totalScore),
        rawScore: entry.totalScore,
        badgeColor: rankNum === 1 ? '#EF4444' : rankNum === 2 ? '#38BDF8' : '#10B981',
        ribbonText: `No.${rankNum}`,
        hasBadge: true,
      };
    });

    const sup1 = allSupporters[0] || null;
    const sup2 = allSupporters[1] || null;
    const sup3 = allSupporters[2] || null;

    const top3 = [
      sup2 || {
        rank: 2,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/female_default.webp',
        gender: 'female',
        score: '0',
        rawScore: 0,
        badgeColor: '#38BDF8',
        ribbonText: 'No.2',
        hasBadge: true,
      },
      sup1 || {
        rank: 1,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/male_default.webp',
        gender: 'male',
        score: '0',
        rawScore: 0,
        badgeColor: '#EF4444',
        ribbonText: 'No.1',
        hasBadge: true,
      },
      sup3 || {
        rank: 3,
        name: '-',
        id: '-',
        avatar: 'https://api.darkmoon.app/uploads/avatars/female_default.webp',
        gender: 'female',
        score: '0',
        rawScore: 0,
        badgeColor: '#10B981',
        ribbonText: 'No.3',
        hasBadge: true,
      },
    ];
    const list = allSupporters.slice(3);

    return sendResponse(res, 200, true, 'Supporters fetched successfully', {
      period,
      top3,
      list,
    });
  } catch (error: any) {
    await Logger('getSupporters', error);
    return sendResponse(res, 500, false, error.message);
  }
};
