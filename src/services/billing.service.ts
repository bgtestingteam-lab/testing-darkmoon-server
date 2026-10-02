import { ClientSession, Types } from 'mongoose';
import { User } from '../models/user.model';

/**
 * Atomically deducts specified diamond/coin amount from user balance.
 * Uses atomic MongoDB condition to guarantee balance >= amount and prevent negative balance.
 * Handles diamond-only wallets (coins = 0) cleanly without requiring non-zero coins.
 */
export async function deductUserWalletAtomic(
    userId: Types.ObjectId | string,
    amount: number,
    session?: ClientSession
): Promise<{ success: boolean; coinsDeduct: number; diamondsDeduct: number }> {
    if (amount <= 0) return { success: true, coinsDeduct: 0, diamondsDeduct: 0 };

    const query = User.findById(userId);
    if (session) query.session(session);
    const user = await query.lean();

    if (!user) return { success: false, coinsDeduct: 0, diamondsDeduct: 0 };

    const availableCoins = Math.max(0, Number((user as any).coins || 0));
    const availableDiamonds = Math.max(0, Number((user as any).diamonds || 0));

    if (availableCoins + availableDiamonds < amount) {
        return { success: false, coinsDeduct: 0, diamondsDeduct: 0 };
    }

    const coinsDeduct = Math.min(availableCoins, amount);
    const remaining = amount - coinsDeduct;
    const diamondsDeduct = Math.min(availableDiamonds, remaining);

    const updateFilter: any = { _id: userId };
    const updateInc: any = {};

    if (coinsDeduct > 0) {
        updateFilter.coins = { $gte: coinsDeduct };
        updateInc.coins = -coinsDeduct;
    }

    if (diamondsDeduct > 0) {
        updateFilter.diamonds = { $gte: diamondsDeduct };
        updateInc.diamonds = -diamondsDeduct;
    }

    let updatedUser: any = null;
    if (session) {
        updatedUser = await User.findOneAndUpdate(updateFilter, { $inc: updateInc }, { session, new: true });
    } else {
        updatedUser = await User.findOneAndUpdate(updateFilter, { $inc: updateInc }, { new: true });
    }

    if (!updatedUser) {
        return { success: false, coinsDeduct: 0, diamondsDeduct: 0 };
    }

    return { success: true, coinsDeduct, diamondsDeduct };
}

/** Atomically deduct diamond credit from user balance. */
export async function deductUserDiamondsAtomic(
    userId: Types.ObjectId | string,
    amount: number,
    session?: ClientSession
): Promise<boolean> {
    if (amount <= 0) return true;
    return Boolean(await User.findOneAndUpdate(
        { _id: userId, diamonds: { $gte: amount } },
        { $inc: { diamonds: -amount } },
        { new: true, ...(session ? { session } : {}) }
    ));
}
