import { Request, Response } from 'express';
import { CPRelation } from '../models/cpRelation.model';
import { User } from '../models/user.model';

export const getCPRanking = async (_req: Request, res: Response): Promise<void> => {
  try {
    const sampleRankings = [
      {
        rank: 1,
        id: 'cp_1',
        partner1: { name: 'PIRPIR😎', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', gender: 'male', level: 36 },
        partner2: { name: 'EBRAR KARA', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', gender: 'female', level: 35 },
        intimacy: '5.2M',
        cpLevel: 'LV9 Love CP',
        days: 142,
      },
      {
        rank: 2,
        id: 'cp_2',
        partner1: { name: 'PARS', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200', gender: 'male', level: 28 },
        partner2: { name: 'Lucia', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', gender: 'female', level: 25 },
        intimacy: '3.1M',
        cpLevel: 'LV7 Love CP',
        days: 98,
      },
      {
        rank: 3,
        id: 'cp_3',
        partner1: { name: 'Şahin', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', gender: 'male', level: 22 },
        partner2: { name: 'NuR', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', gender: 'female', level: 21 },
        intimacy: '1.8M',
        cpLevel: 'LV5 Love CP',
        days: 64,
      },
      {
        rank: 4,
        id: 'cp_4',
        partner1: { name: 'Deniz', avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200', gender: 'male', level: 19 },
        partner2: { name: 'SİMA', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200', gender: 'female', level: 18 },
        intimacy: '890.5K',
        cpLevel: 'LV3 Love CP',
        days: 31,
      },
    ];

    res.status(200).json({
      success: true,
      data: sampleRankings,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMyCPZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?._id || req.params.userId;

    const dummyZone = {
      hasCP: true,
      partner1: { name: 'You', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', gender: 'male' },
      partner2: { name: 'My Angel', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', gender: 'female' },
      cpLevel: 'LV1 Love CP',
      intimacy: 4200,
      maxIntimacy: 10000,
      promiseGiftsSent: 12,
      privileges: [
        { title: 'Exclusive Ring', unlocked: true },
        { title: 'Couples Entry Effect', unlocked: true },
        { title: 'Romantic Palace Backdrop', unlocked: true },
      ],
    };

    res.status(200).json({
      success: true,
      data: dummyZone,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const bindCP = async (req: Request, res: Response): Promise<void> => {
  try {
    const { targetUserId } = req.body;
    res.status(200).json({
      success: true,
      message: 'CP Proposal sent successfully! Waiting for acceptance.',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
