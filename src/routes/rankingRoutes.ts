import { Router } from 'express';
import { getRankings, getSupporters } from '../controllers/rankingController';

const router = Router();

router.get('/', getRankings);
router.get('/supporters', getSupporters);

export default router;
