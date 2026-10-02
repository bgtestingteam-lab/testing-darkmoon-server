import { Request, Response } from 'express';

export const getRoomWealthRanking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type = 'daily' } = req.query;

    const sampleWealth = {
      type,
      top3: [
        { rank: 1, name: 'Pirpir', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200', score: '1.2M', isCrown: true },
        { rank: 2, name: 'Sharabi', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', score: '840.5K', isCrown: true },
        { rank: 3, name: 'Pars', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200', score: '520.1K', isCrown: true },
      ],
      list: [
        { rank: 4, name: 'Soly', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100', score: '310.2K' },
        { rank: 5, name: 'Ebrar', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', score: '190.4K' },
      ],
    };

    res.status(200).json({ success: true, data: sampleWealth });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRoomMembersList = async (req: Request, res: Response): Promise<void> => {
  try {
    const members = [
      { id: 'm1', name: 'Vandana', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120', gender: 'male', starLevel: 14, charmLevel: 23, coins: 0 },
      { id: 'm2', name: 'Ayush', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120', gender: 'male', starLevel: 27, charmLevel: 27, coins: 0 },
      { id: 'm3', name: 'rai', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=120', gender: 'male', starLevel: 0, charmLevel: 0, coins: 0 },
      { id: 'm4', name: 'Sofia-Official', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120', gender: 'female', starLevel: 27, charmLevel: 27, coins: 0 },
    ];

    res.status(200).json({
      success: true,
      data: {
        totalMembers: 13,
        maxMembers: 1000,
        adminCount: 3,
        maxAdmin: 50,
        members,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRoomOnlineUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const online = [
      { id: 'u1', name: 'Shivansh Bajpeyi', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100', role: 'owner', level: 15, flag: '🇹🇷' },
      { id: 'u2', name: 'PIRPIR😎', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100', role: 'admin', level: 36, flag: '🇹🇷' },
      { id: 'u3', name: 'Ebrar', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100', role: 'guest', level: 25, flag: '🇹🇷' },
    ];

    res.status(200).json({ success: true, count: online.length, users: online });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
