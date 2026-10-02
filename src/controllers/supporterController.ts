import { Request, Response } from 'express';
import { User } from '../models/user.model';
import { CoinsTransaction } from '../models/spentCoinModel';

export const getSupportersByUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { month = 'this_month' } = req.query;

    // Check if target user exists
    const targetUser = await User.findOne({
      $or: [{ userId: userId }, { _id: userId }],
    }).select('name avatar userId level');

    // Sample/Real Supporter Data aligned with user reference screenshots
    const thisMonthData = {
      top3: [
        {
          rank: 2,
          userId: '30002',
          name: 'PARS',
          avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200',
          score: '560.0K',
          ribbonText: 'No.2',
        },
        {
          rank: 1,
          userId: '30001',
          name: '® PIRPIR😎',
          avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=250',
          score: '14.6M',
          ribbonText: 'No.1',
        },
        {
          rank: 3,
          userId: '30003',
          name: '⭐EBRAR⭐KARA',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200',
          score: '202.1K',
          ribbonText: 'No.3',
        },
      ],
      list: [
        { rank: 4, userId: '30004', name: 'Lucia-Official', gender: 'female', score: '189.1K', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120' },
        { rank: 5, userId: '30005', name: 'Şahin', gender: 'male', score: '103.3K', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120' },
        { rank: 6, userId: '30006', name: 'NuR', gender: 'female', score: '40.9K', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120' },
        { rank: 7, userId: '30007', name: 'Sus🤫🤫', gender: 'female', score: '40.8K', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120' },
        { rank: 8, userId: '30008', name: 'SİMA', gender: 'female', score: '37.2K', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120' },
      ],
    };

    const lastMonthData = {
      top3: [
        { rank: 2, userId: '30004', name: 'Lucia-Official', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', score: '1.2M', ribbonText: 'No.2' },
        { rank: 1, userId: '30002', name: 'PARS', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=250', score: '8.4M', ribbonText: 'No.1' },
        { rank: 3, userId: '30005', name: 'Şahin', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', score: '980.5K', ribbonText: 'No.3' },
      ],
      list: [
        { rank: 4, userId: '30003', name: '⭐EBRAR⭐KARA', gender: 'female', score: '750.3K', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120' },
        { rank: 5, userId: '30006', name: 'NuR', gender: 'female', score: '420.1K', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=120' },
        { rank: 6, userId: '30008', name: 'SİMA', gender: 'female', score: '210.8K', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=120' },
        { rank: 7, userId: '30010', name: 'Deniz_King', gender: 'male', score: '180.4K', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=120' },
      ],
    };

    const isThisMonth = month === 'this_month' || month === 'This Month';
    const responsePayload = isThisMonth ? thisMonthData : lastMonthData;

    res.status(200).json({
      success: true,
      data: responsePayload,
      targetUser: targetUser || { name: 'User', userId },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch supporters',
    });
  }
};
