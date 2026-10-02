import { Request, Response } from 'express';

export const getFilteredBills = async (req: Request, res: Response): Promise<void> => {
  try {
    const { filter = 'All', date } = req.query;

    const sampleBills = [
      {
        id: 'bill_1',
        title: 'Sent Luxury Rocket',
        category: 'Send gifts',
        amount: -25000,
        currency: 'Coins',
        timestamp: '2026/09/30 02:40',
        counterparty: 'Voice Room #30001',
      },
      {
        id: 'bill_2',
        title: 'Google Play Recharge',
        category: 'Recharge',
        amount: 50000,
        currency: 'Coins',
        timestamp: '2026/09/29 18:22',
        counterparty: 'Payment Gateway',
      },
      {
        id: 'bill_3',
        title: 'Received Crystal Rose',
        category: 'Receive gifts',
        amount: 1000,
        currency: 'Diamonds',
        timestamp: '2026/09/29 14:10',
        counterparty: 'Lucia-Official',
      },
    ];

    const filtered = sampleBills.filter((b) => {
      if (filter === 'All') return true;
      return b.category.toLowerCase() === String(filter).toLowerCase();
    });

    res.status(200).json({
      success: true,
      data: filtered,
      activeFilter: filter,
      date: date || '2026/09/30',
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
