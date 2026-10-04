import mongoose, { Model } from 'mongoose';
import { IGift as IEnterpriseGift } from '../gift/gift.types';
import { Gift as EnterpriseGift, giftSchema } from '../gift/gift.model';

export type IGift = IEnterpriseGift;

export const Gift: Model<IGift> =
    (mongoose.models.Gift as Model<IGift>) ||
    EnterpriseGift ||
    mongoose.model<IGift>('Gift', giftSchema);

export default Gift;
