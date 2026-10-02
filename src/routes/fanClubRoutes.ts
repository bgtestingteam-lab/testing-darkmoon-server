import { Router } from 'express';
import {
  joinFanClub,
  getFanClubDetails,
  getFanClubMembers,
} from '../controllers/fanClubController';
import { verifyToken } from '../middlewares/authorize.middleware';

const router = Router();

router.post('/join', verifyToken, joinFanClub);
router.get('/members/:hostId', verifyToken, getFanClubMembers);
router.get('/:hostId', verifyToken, getFanClubDetails);

export default router;
