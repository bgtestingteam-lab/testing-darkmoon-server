import { Request, Response } from 'express';
import { AgencyApplication } from '../models/agencyApplication.model';

export const getAgencyRankings = async (_req: Request, res: Response): Promise<void> => {
  try {
    const top3 = [
      { rank: 1, id: '3034', name: '506c', members: 19, avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', type: 'ruby' },
      { rank: 2, id: '2944', name: 'المحاسن', members: 11, avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200', type: 'sapphire' },
      { rank: 3, id: '1240', name: 'Faha Official', members: 19, avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', type: 'emerald' },
    ];

    const ranked = [
      { rank: 4, id: '4132', name: 'تحطيم', members: 9, avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200' },
      { rank: 5, id: '5531', name: 'ك كيميد', members: 7, avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' },
      { rank: 6, id: '3809', name: 'BEST AJANS', members: 20, avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200' },
      { rank: 7, id: '3518', name: 'ملك توك', members: 7, avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200' },
      { rank: 8, id: '8217', name: 'GOLD REMIX', members: 11, avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200' },
    ];

    res.status(200).json({
      success: true,
      data: { top3, ranked },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const applyToAgency = async (req: Request, res: Response): Promise<void> => {
  try {
    const { agencyId, agencyName, country, whatsappNumber } = req.body;
    const userId = (req as any).user?._id;

    if (!agencyId || !whatsappNumber) {
      res.status(400).json({ success: false, message: 'Agency ID and WhatsApp Number are required' });
      return;
    }

    if (userId) {
      await AgencyApplication.create({
        agencyId,
        agencyName: agencyName || `Agency #${agencyId}`,
        userId,
        country: country || 'Turkey',
        whatsappNumber,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Applied to join agency successfully!',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
