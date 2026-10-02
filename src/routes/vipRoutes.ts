import { Router } from 'express';
import {
  getVipPlans,
  getVipStatus,
  subscribeVip,
  subscribeSvip,
} from '../controllers/vipController';
import { verifyToken } from '../middlewares/authorize.middleware';

const router = Router();

router.get('/plans', getVipPlans);
router.get('/status', verifyToken, getVipStatus);
router.post('/subscribe', verifyToken, subscribeVip);

export default router;
