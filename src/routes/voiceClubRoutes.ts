import { Router } from 'express';
import {
  getVoiceClubConfig,
  getVipRewards,
  getAllActiveVoiceRooms,
  getMyVoiceRoom,
  createOrUpdateMyVoiceRoom,
  closeVoiceRoom,
  generateVoiceRoomToken,
} from '../controllers/voiceClubController';
import { verifyToken } from '../middlewares/authorize.middleware';

const router = Router();

router.get('/config', getVoiceClubConfig);
router.get('/vip-rewards', getVipRewards);

// Voice Room Endpoints
router.get('/rooms', getAllActiveVoiceRooms);
router.get('/my-room', verifyToken, getMyVoiceRoom);
router.post('/my-room', verifyToken, createOrUpdateMyVoiceRoom);
router.post('/rooms/:id/close', verifyToken, closeVoiceRoom);

// Voice Room Token for Agora Audio
router.post('/token', verifyToken, generateVoiceRoomToken);
router.post('/rooms/token', verifyToken, generateVoiceRoomToken);

export default router;
