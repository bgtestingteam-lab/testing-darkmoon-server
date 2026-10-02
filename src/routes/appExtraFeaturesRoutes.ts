import { Router } from 'express';
import { getSupportersByUser } from '../controllers/supporterController';
import { getCPRanking, getMyCPZone, bindCP } from '../controllers/cpController';
import { getAgencyRankings, applyToAgency } from '../controllers/agencyPublicController';
import { getFilteredBills } from '../controllers/billController';
import { getRoomWealthRanking, getRoomMembersList, getRoomOnlineUsers } from '../controllers/roomFeaturesController';

const router = Router();

// Supporter Routes
router.get('/user/supporters/:userId', getSupportersByUser);
router.get('/user/:userId/supporters', getSupportersByUser);

// CP / Couple Routes
router.get('/cp/ranking', getCPRanking);
router.get('/cp/zone/:userId', getMyCPZone);
router.post('/cp/bind', bindCP);

// Agency Routes
router.get('/agency/ranking', getAgencyRankings);
router.post('/agency/apply', applyToAgency);

// Bill & Recharge History Routes
router.get('/recharge/bills', getFilteredBills);
router.get('/user/bills', getFilteredBills);

// Room Extra Features Routes
router.get('/voiceclub/:roomId/wealth', getRoomWealthRanking);
router.get('/voiceclub/:roomId/members', getRoomMembersList);
router.get('/voiceclub/:roomId/online-users', getRoomOnlineUsers);

export default router;
