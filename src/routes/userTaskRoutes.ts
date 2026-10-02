import { Router } from 'express';
import {
  getUserTasks,
  claimUserTaskReward,
} from '../controllers/userTaskController';
import { verifyToken } from '../middlewares/authorize.middleware';

const router = Router();

router.get('/', verifyToken, getUserTasks);
router.post('/:id/claim', verifyToken, claimUserTaskReward);

export default router;
