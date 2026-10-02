import mongoose, { Types } from 'mongoose';
import { Gift, GiftCategory, GiftTransaction } from './gift.model';
import { User } from '../models/user.model';
import { CoinsTransaction } from '../models/spentCoinModel';
import { CallStatus, TransactionType } from '../constants/user';
import { getCachedSettings } from '../controllers/settingsController';
import { deductUserWalletAtomic } from '../services/billing.service';
import { broadcastGiftSuccess } from './gift.socket';
import {
  CreateCategoryDTO,
  CreateGiftDTO,
  GiftFilterQuery,
  SendGiftDTO,
  UpdateCategoryDTO,
  UpdateGiftDTO,
} from './gift.types';

const DEFAULT_COMMISSION_PERCENT = 30;

// Default categories if database has none
export const INITIAL_CATEGORIES = [
  { name: 'Popular', slug: 'popular', sortOrder: 1, icon: '🔥', isActive: true },
  { name: 'Love', slug: 'love', sortOrder: 2, icon: '💖', isActive: true },
  { name: 'Funny', slug: 'funny', sortOrder: 3, icon: '🎭', isActive: true },
  { name: 'VIP', slug: 'vip', sortOrder: 4, icon: '👑', isActive: true, isVipOnly: true },
  { name: 'Special', slug: 'special', sortOrder: 5, icon: '✨', isActive: true },
  { name: 'Luxury', slug: 'luxury', sortOrder: 6, icon: '💎', isActive: true },
  { name: 'Event', slug: 'event', sortOrder: 7, icon: '🎉', isActive: true },
];

// Rich default gifts across all animation tiers and categories
export const INITIAL_GIFTS: Array<Partial<CreateGiftDTO>> = [
  // Popular / Normal Tier
  {
    name: 'Rose',
    slug: 'rose',
    category: 'Popular',
    icon: '🌹',
    price: 10,
    rarity: 'common',
    animationType: 'NORMAL',
    duration: 2000,
    sortOrder: 1,
    isActive: true,
  },
  {
    name: 'Heart Balloon',
    slug: 'heart-balloon',
    category: 'Love',
    icon: '🎈',
    price: 30,
    rarity: 'common',
    animationType: 'FLOATING',
    duration: 2500,
    sortOrder: 2,
    isActive: true,
  },
  {
    name: 'Lucky Clover',
    slug: 'lucky-clover',
    category: 'Popular',
    icon: '🍀',
    price: 50,
    rarity: 'common',
    animationType: 'FLY_TO_RECEIVER',
    duration: 2200,
    sortOrder: 3,
    isActive: true,
  },
  {
    name: 'Teddy Bear',
    slug: 'teddy-bear',
    category: 'Love',
    icon: '🧸',
    price: 100,
    rarity: 'rare',
    animationType: 'FLY_TO_RECEIVER',
    duration: 3000,
    sortOrder: 4,
    isActive: true,
  },
  {
    name: 'Perfume Bouquet',
    slug: 'perfume-bouquet',
    category: 'Love',
    icon: '🧴',
    price: 200,
    rarity: 'rare',
    animationType: 'FLY_TO_RECEIVER',
    duration: 3000,
    sortOrder: 5,
    isActive: true,
  },
  {
    name: 'Party Clown',
    slug: 'party-clown',
    category: 'Funny',
    icon: '🤡',
    price: 150,
    rarity: 'rare',
    animationType: 'SPECIAL',
    duration: 3500,
    sortOrder: 6,
    isActive: true,
  },
  {
    name: 'Rocket Blast',
    slug: 'rocket-blast',
    category: 'Special',
    icon: '🚀',
    price: 500,
    rarity: 'rare',
    animationType: 'CENTER_STAGE',
    duration: 4000,
    sortOrder: 7,
    isActive: true,
  },
  {
    name: 'Crystal Crown',
    slug: 'crystal-crown',
    category: 'VIP',
    icon: '👑',
    price: 1200,
    rarity: 'epic',
    isVipOnly: true,
    animationType: 'VIP',
    duration: 4500,
    sortOrder: 8,
    isActive: true,
  },
  {
    name: 'Sports Car',
    slug: 'sports-car',
    category: 'Luxury',
    icon: '🏎️',
    price: 5000,
    rarity: 'epic',
    animationType: 'FULL_SCREEN',
    duration: 5000,
    sortOrder: 9,
    isActive: true,
  },
  {
    name: 'Private Jet',
    slug: 'private-jet',
    category: 'Luxury',
    icon: '✈️',
    price: 10000,
    rarity: 'legendary',
    animationType: 'FULL_SCREEN',
    duration: 6000,
    sortOrder: 10,
    isActive: true,
  },
  {
    name: 'Super Yacht',
    slug: 'super-yacht',
    category: 'Luxury',
    icon: '🛥️',
    price: 25000,
    rarity: 'legendary',
    animationType: 'LUXURY',
    duration: 7000,
    sortOrder: 11,
    isActive: true,
  },
  {
    name: 'Royal Palace',
    slug: 'royal-palace',
    category: 'Luxury',
    icon: '🏰',
    price: 50000,
    rarity: 'legendary',
    animationType: 'LUXURY',
    duration: 8000,
    sortOrder: 12,
    isActive: true,
  },
  {
    name: 'Festival Fireworks',
    slug: 'festival-fireworks',
    category: 'Event',
    icon: '🎆',
    price: 888,
    rarity: 'epic',
    animationType: 'CENTER_STAGE',
    duration: 4500,
    sortOrder: 13,
    isActive: true,
  },
];

export class GiftService {
  /**
   * Ensure default categories and initial gifts exist.
   */
  static async seedInitialCatalog(): Promise<void> {
    try {
      const categoryCount = await GiftCategory.countDocuments();
      if (categoryCount === 0) {
        console.log('[GiftService] Seeding default gift categories...');
        await GiftCategory.insertMany(INITIAL_CATEGORIES);
      }

      const giftCount = await Gift.countDocuments();
      if (giftCount === 0) {
        console.log('[GiftService] Seeding initial rich gifts catalog...');
        const categories = await GiftCategory.find().lean();
        const categoryMap = new Map(categories.map((c) => [c.name.toLowerCase(), c._id]));

        const giftsWithRefs = INITIAL_GIFTS.map((g) => ({
          ...g,
          categoryId: categoryMap.get((g.category || 'Popular').toLowerCase()) || categories[0]?._id,
          currency: 'beans',
          cost: g.price,
        }));
        await Gift.insertMany(giftsWithRefs);
      }
    } catch (err: any) {
      console.warn('[GiftService] Seed warning:', err.message);
    }
  }

  /**
   * Fetch categories with automatic fallback seed if empty.
   */
  static async getCategories() {
    let categories = await GiftCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    if (!categories || categories.length === 0) {
      await this.seedInitialCatalog();
      categories = await GiftCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    }
    return categories;
  }

  /**
   * Fetch active gifts with optional category, search, and rarity filtering.
   * Auto-excludes expired limited-time/event gifts.
   */
  static async getGifts(filter: GiftFilterQuery = {}) {
    const now = new Date();
    const query: any = {};

    if (String(filter.includeInactive) !== 'true') {
      query.isActive = true;
      query.$and = [
        { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
        { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
      ];
    }

    if (filter.categoryId && Types.ObjectId.isValid(String(filter.categoryId))) {
      query.categoryId = filter.categoryId;
    } else if (filter.category && filter.category.toLowerCase() !== 'all') {
      // Find category by slug or name
      const cat = await GiftCategory.findOne({
        $or: [
          { slug: filter.category.toLowerCase() },
          { name: new RegExp(`^${filter.category}$`, 'i') },
        ],
      }).lean();
      if (cat) {
        query.$or = [{ categoryId: cat._id }, { category: new RegExp(`^${filter.category}$`, 'i') }];
      } else {
        query.category = new RegExp(`^${filter.category}$`, 'i');
      }
    }

    if (filter.rarity) {
      query.rarity = filter.rarity;
    }

    if (filter.isVipOnly !== undefined) {
      query.isVipOnly = String(filter.isVipOnly) === 'true';
    }

    let gifts = await Gift.find(query).sort({ sortOrder: 1, price: 1, cost: 1 }).lean();

    if ((!gifts || gifts.length === 0) && (!filter.category || filter.category.toLowerCase() === 'all')) {
      await this.seedInitialCatalog();
      gifts = await Gift.find(query).sort({ sortOrder: 1, price: 1, cost: 1 }).lean();
    }

    // Ensure both `price` and `cost` are populated for frontends
    return gifts.map((g) => ({
      ...g,
      price: g.price !== undefined ? g.price : g.cost,
      cost: g.cost !== undefined ? g.cost : g.price,
      currency: 'beans',
    }));
  }

  /**
   * Get user's current Beans balance.
   * Seamlessly checks `beans` first, falling back to diamonds/coins for existing accounts.
   */
  static async getUserBeansBalance(userId: string | Types.ObjectId): Promise<number> {
    const user = await User.findById(userId).select('beans diamonds coins').lean();
    if (!user) return 0;
    if ((user as any).beans !== undefined && (user as any).beans > 0) {
      return Number((user as any).beans);
    }
    // Fallback: sum of diamonds and coins
    return Math.max(0, Number(user.diamonds || 0) + Number(user.coins || 0));
  }

  /**
   * Core Send Gift Engine:
   * 1. Idempotency protection with requestId
   * 2. Server-side gift and price validation
   * 3. Multi-receiver calculation
   * 4. Atomic balance deduction
   * 5. Platform commission and host earnings split
   * 6. GiftTransaction creation
   * 7. Real-time Socket broadcast
   */
  static async sendGift(senderId: string | Types.ObjectId, dto: SendGiftDTO) {
    const { requestId, giftId, quantity: rawQty = 1, comboCount = 1, roomId, callId } = dto;

    if (!requestId || typeof requestId !== 'string') {
      throw new Error('requestId is required for idempotency protection');
    }

    // 1. Idempotency Check: if requestId was already processed, return existing transaction
    const existingTx = await GiftTransaction.findOne({ requestId })
      .populate('giftId')
      .lean();
    if (existingTx) {
      console.log(`[GiftService] Idempotent replay detected for requestId: ${requestId}`);
      const senderBal = await this.getUserBeansBalance(senderId);
      return {
        isReplay: true,
        transaction: existingTx,
        newBalance: senderBal,
        gift: existingTx.giftId,
        totalBeans: existingTx.totalBeans,
        quantity: existingTx.quantity,
      };
    }

    // 2. Validate Gift
    if (!giftId || !Types.ObjectId.isValid(String(giftId))) {
      throw new Error('Invalid giftId specified');
    }
    const gift = await Gift.findById(giftId);
    if (!gift || !gift.isActive) {
      throw new Error('Gift not found or currently unavailable');
    }

    // Check event expiration
    const now = new Date();
    if (gift.startsAt && gift.startsAt > now) {
      throw new Error(`This event gift is not yet active (starts at ${gift.startsAt.toISOString()})`);
    }
    if (gift.endsAt && gift.endsAt < now) {
      throw new Error('This limited-time gift has expired');
    }

    const unitPrice = Number(gift.price !== undefined ? gift.price : gift.cost);
    if (isNaN(unitPrice) || unitPrice < 0) {
      throw new Error('Invalid gift price');
    }

    // 3. Validate Quantity
    const qty = Math.max(1, Math.min(1000, Math.floor(Number(rawQty) || 1)));

    // 4. Resolve Receivers
    let targetReceiverIds: string[] = [];
    if (Array.isArray(dto.receiverIds) && dto.receiverIds.length > 0) {
      targetReceiverIds = dto.receiverIds.map(String);
    } else if (dto.receiverId) {
      targetReceiverIds = [String(dto.receiverId)];
    }

    // Deduplicate
    targetReceiverIds = Array.from(new Set(targetReceiverIds.filter(Boolean)));
    if (targetReceiverIds.length === 0) {
      throw new Error('Please select at least one gift recipient');
    }

    // Lookup receivers in DB (supports ObjectId, numeric userId, or meethiId)
    const receivers: any[] = [];
    for (const rawId of targetReceiverIds) {
      let rec: any = null;
      if (Types.ObjectId.isValid(rawId)) {
        rec = await User.findById(rawId).select('_id userId name image avatar coins diamonds beans').lean();
      }
      if (!rec) {
        const num = Number(rawId);
        rec = await User.findOne({
          $or: [
            ...(isNaN(num) ? [] : [{ userId: num }]),
            { meethiId: String(rawId) },
          ],
        }).select('_id userId name image avatar coins diamonds beans').lean();
      }
      if (rec) {
        receivers.push(rec);
      }
    }

    if (receivers.length === 0) {
      throw new Error('Selected recipients could not be found');
    }

    // 5. Total Beans Calculation: unitPrice * quantity * numberOfReceivers
    const totalBeans = unitPrice * qty * receivers.length;

    // 6. Sender Validation
    const sender = await User.findById(senderId).select('_id userId name image avatar coins diamonds beans level').lean();
    if (!sender) {
      throw new Error('Sender user not found');
    }

    // Check VIP-only permission
    if (gift.isVipOnly) {
      const userLevel = Number(sender.level || 1);
      if (userLevel < 5) {
        throw new Error('This gift is exclusive to VIP members (Level 5+)');
      }
    }

    // 7. Check Balance & Deduct Atomically
    // Check available beans (or fallback diamonds+coins)
    const currentBeans = Number((sender as any).beans || 0);
    const currentDiamonds = Number(sender.diamonds || 0);
    const currentCoins = Number(sender.coins || 0);
    const totalAvailable = currentBeans > 0 ? currentBeans : currentDiamonds + currentCoins;

    if (totalAvailable < totalBeans) {
      const err: any = new Error(
        `Insufficient Beans balance. Required: ${totalBeans} Beans, Available: ${totalAvailable} Beans`
      );
      err.code = 'INSUFFICIENT_BEANS';
      err.requiredBeans = totalBeans;
      err.availableBeans = totalAvailable;
      throw err;
    }

    // Perform atomic deduction
    let updatedSender: any = null;
    if (currentBeans >= totalBeans) {
      updatedSender = await User.findOneAndUpdate(
        { _id: sender._id, beans: { $gte: totalBeans } },
        { $inc: { beans: -totalBeans } },
        { new: true }
      );
    } else {
      // Deduct from diamonds/coins and sync
      const deductRes = await deductUserWalletAtomic(sender._id as any, totalBeans);
      if (!deductRes.success) {
        const err: any = new Error('Wallet transaction failed: balance changed during processing');
        err.code = 'INSUFFICIENT_BEANS';
        throw err;
      }
      updatedSender = await User.findById(sender._id).lean();
    }

    if (!updatedSender) {
      const err: any = new Error('Insufficient Beans balance (concurrency lock)');
      err.code = 'INSUFFICIENT_BEANS';
      throw err;
    }

    // 8. Calculate Earnings & Credit Receivers
    const settings = await getCachedSettings();
    const commissionPercent = Math.max(
      0,
      Math.min(100, Number(settings.giftCommissionPercent ?? DEFAULT_COMMISSION_PERCENT))
    );
    const hostShare = (100 - commissionPercent) / 100;
    const perReceiverCost = unitPrice * qty;
    const perReceiverEarning = Math.round(perReceiverCost * hostShare);
    const totalHostEarnings = perReceiverEarning * receivers.length;
    const platformCommission = Math.max(0, totalBeans - totalHostEarnings);

    // Credit each recipient atomically
    const receiverBalances: Array<{ userId: string; beans: number }> = [];
    for (const rec of receivers) {
      if (perReceiverEarning > 0) {
        // Credit to beans (or coins for legacy host cashouts)
        const updatedRec = await User.findByIdAndUpdate(
          rec._id,
          { $inc: { beans: perReceiverEarning, coins: perReceiverEarning } },
          { new: true }
        ).select('_id beans coins diamonds').lean();
        receiverBalances.push({
          userId: String(rec._id),
          beans: Number((updatedRec as any)?.beans || (updatedRec as any)?.coins || 0),
        });
      } else {
        receiverBalances.push({
          userId: String(rec._id),
          beans: Number((rec as any)?.beans || (rec as any)?.coins || 0),
        });
      }
    }

    // 9. Record Gift Transaction with Unique RequestId (Idempotency guarantee)
    let transactionDoc: any;
    try {
      transactionDoc = await GiftTransaction.create({
        requestId,
        senderId: sender._id,
        receiverId: receivers[0]._id,
        receiverIds: receivers.map((r) => r._id),
        roomId: roomId || '',
        callId: callId || '',
        giftId: gift._id,
        quantity: qty,
        unitPrice,
        totalBeans,
        status: 'COMPLETED',
        hostEarning: totalHostEarnings,
        platformCommission,
        commissionPercent,
        comboCount: Number(comboCount) || 1,
        meta: {
          giftName: gift.name,
          giftIcon: gift.icon,
          animationType: gift.animationType,
          receiverCount: receivers.length,
        },
      });
    } catch (createErr: any) {
      // If unique requestId conflict occurs concurrently, fetch and return
      if (createErr.code === 11000) {
        console.warn(`[GiftService] Duplicate key conflict caught on requestId ${requestId}`);
        const existing = await GiftTransaction.findOne({ requestId }).lean();
        if (existing) {
          return {
            isReplay: true,
            transaction: existing,
            newBalance: await this.getUserBeansBalance(senderId),
            gift,
            totalBeans,
            quantity: qty,
          };
        }
      }
      throw createErr;
    }

    // Optional: write to legacy CoinsTransaction for call history/audit compatibility
    try {
      await CoinsTransaction.create({
        userId: sender._id,
        hostId: receivers[0]._id,
        type: TransactionType.GIFT_SENT || 'gift_sent',
        coinsSpent: totalBeans,
        hostEarning: totalHostEarnings,
        status: CallStatus.ENDED,
        meta: {
          giftId: gift._id,
          giftName: gift.name,
          roomId,
          callId,
          count: qty,
          requestId,
        },
      });
    } catch (ignoreAudit) {}

    // 10. Broadcast Real-Time Socket Events
    const finalSenderBeans =
      (updatedSender as any).beans !== undefined && (updatedSender as any).beans > 0
        ? Number((updatedSender as any).beans)
        : Number(updatedSender.diamonds || 0) + Number(updatedSender.coins || 0);

    try {
      broadcastGiftSuccess({
        transaction: transactionDoc,
        sender,
        receivers,
        gift,
        quantity: qty,
        totalBeans,
        comboCount: Number(comboCount) || 1,
        roomId,
        callId,
        senderBalance: {
          beans: finalSenderBeans,
          coins: Number(updatedSender.coins || 0),
          diamonds: Number(updatedSender.diamonds || 0),
        },
        receiverBalances,
      });
    } catch (sockErr: any) {
      console.warn('[GiftService] Socket broadcast failed non-fatally:', sockErr.message);
    }

    return {
      success: true,
      transactionId: transactionDoc._id,
      requestId,
      newBalance: finalSenderBeans,
      gift: {
        id: gift._id,
        name: gift.name,
        icon: gift.icon,
        animationUrl: gift.animationUrl,
        animationType: gift.animationType,
        price: unitPrice,
      },
      receivers: receivers.map((r) => ({
        id: r._id,
        name: r.name,
        avatar: r.image || r.avatar,
      })),
      quantity: qty,
      totalBeans,
      comboCount: Number(comboCount) || 1,
    };
  }

  /**
   * Fetch user gift history (Sent & Received).
   */
  static async getHistory(
    userId: string | Types.ObjectId,
    type: 'all' | 'sent' | 'received' = 'all',
    page: number = 1,
    limit: number = 20
  ) {
    const userObjId = new Types.ObjectId(String(userId));
    const skip = (Math.max(1, page) - 1) * Math.max(1, Math.min(100, limit));

    let query: any = {};
    if (type === 'sent') {
      query.senderId = userObjId;
    } else if (type === 'received') {
      query.$or = [{ receiverId: userObjId }, { receiverIds: userObjId }];
    } else {
      query.$or = [{ senderId: userObjId }, { receiverId: userObjId }, { receiverIds: userObjId }];
    }

    const [transactions, total] = await Promise.all([
      GiftTransaction.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('giftId', 'name icon animationUrl animationType price rarity')
        .populate('senderId', 'name image avatar userId')
        .populate('receiverId', 'name image avatar userId')
        .lean(),
      GiftTransaction.countDocuments(query),
    ]);

    return {
      items: transactions.map((tx: any) => ({
        id: tx._id,
        requestId: tx.requestId,
        type: String(tx.senderId?._id) === String(userObjId) ? 'sent' : 'received',
        gift: tx.giftId || { name: tx.meta?.giftName, icon: tx.meta?.giftIcon },
        sender: tx.senderId,
        receiver: tx.receiverId,
        quantity: tx.quantity,
        unitPrice: tx.unitPrice,
        totalBeans: tx.totalBeans,
        createdAt: tx.createdAt,
      })),
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  // ========================
  // Admin Operations
  // ========================
  static async adminCreateGift(dto: CreateGiftDTO) {
    const price = dto.price !== undefined ? dto.price : (dto.cost || 10);
    const gift = await Gift.create({
      ...dto,
      price,
      cost: price,
      currency: 'beans',
    });
    return gift;
  }

  static async adminUpdateGift(id: string, dto: UpdateGiftDTO) {
    const updateData: any = { ...dto };
    if (dto.price !== undefined) {
      updateData.cost = dto.price;
    } else if (dto.cost !== undefined) {
      updateData.price = dto.cost;
    }
    const updated = await Gift.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    return updated;
  }

  static async adminDeleteGift(id: string) {
    return await Gift.findByIdAndDelete(id);
  }

  static async adminToggleGiftActive(id: string, isActive: boolean) {
    return await Gift.findByIdAndUpdate(id, { isActive }, { new: true });
  }

  static async adminCreateCategory(dto: CreateCategoryDTO) {
    const slug = dto.slug || dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return await GiftCategory.create({ ...dto, slug });
  }

  static async adminUpdateCategory(id: string, dto: UpdateCategoryDTO) {
    return await GiftCategory.findByIdAndUpdate(id, dto, { new: true });
  }

  static async adminDeleteCategory(id: string) {
    return await GiftCategory.findByIdAndDelete(id);
  }
}
