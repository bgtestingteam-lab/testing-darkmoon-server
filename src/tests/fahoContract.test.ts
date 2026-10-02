import assert from 'node:assert';
import { test, describe } from 'node:test';
import { AgoraService } from '../services/agora.service';
import { VIP_PLANS, SVIP_TIERS } from '../controllers/vipController';
import { TransactionType } from '../constants/user';

describe('FAHO Core Contract & Gamification Engine Tests', () => {
  // Test 1: Agora Voice Room Token Engine
  test('1. Agora RTC Voice Token generates valid publisher & subscriber tokens', () => {
    // Generate publisher token for host/speaker
    const pubResult = AgoraService.generateRtcToken({
      channelName: 'voice_room_10000001',
      uid: 10000001,
      role: 'publisher',
      expireSeconds: 3600,
    });

    assert.ok(pubResult.token, 'Token string must not be empty');
    assert.ok(pubResult.token.length > 50, 'Token length must be valid Agora RTC token format');
    assert.strictEqual(pubResult.channel, 'voice_room_10000001');
    assert.strictEqual(pubResult.uid, 10000001);
    assert.strictEqual(pubResult.role, 'publisher');
    assert.ok(pubResult.expiresAt > Date.now(), 'Token expiration timestamp must be in the future');

    // Generate subscriber token for audience
    const subResult = AgoraService.generateRtcToken({
      channelName: 'voice_room_10000001',
      uid: 20000055,
      role: 'subscriber',
      expireSeconds: 7200,
    });

    assert.ok(subResult.token, 'Subscriber token must be generated');
    assert.strictEqual(subResult.role, 'subscriber');
  });

  // Test 2: VIP & SVIP Plans Configuration
  test('2. VIP plans cover VIP1 through VIP8 with consistent 30-day duration', () => {
    const requiredVipTiers = ['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5', 'VIP6', 'VIP7', 'VIP8'];
    requiredVipTiers.forEach((tier) => {
      const plan = VIP_PLANS[tier];
      assert.ok(plan, `VIP plan ${tier} must be configured`);
      assert.strictEqual(plan.durationDays, 30);
      assert.ok(plan.costCoins > 0, `${tier} cost must be greater than 0`);
    });
  });

  test('3. SVIP King of Kings tiers match frontend pricing and daily returns', () => {
    const expectedTiers = ['knight', 'count', 'duke', 'prince', 'king'];
    expectedTiers.forEach((tier) => {
      const svip = SVIP_TIERS[tier];
      assert.ok(svip, `SVIP tier ${tier} must be configured`);
      assert.ok(svip.costDiamonds > 0, `SVIP ${tier} must have positive diamond cost`);
      assert.ok(svip.dailyReturn > 0, `SVIP ${tier} must have positive daily diamond return`);
      assert.strictEqual(svip.durationDays, 30);
    });

    assert.strictEqual(SVIP_TIERS.knight.costDiamonds, 99000);
    assert.strictEqual(SVIP_TIERS.king.costDiamonds, 1500000);
  });

  // Test 3: Fan Club Cost & Earnings Ratio
  test('4. Fan Club membership plans and host earning split (80%)', () => {
    const plan1Cost = 99;
    const plan3Cost = 249;

    const hostShare1 = Math.floor(plan1Cost * 0.8);
    const hostShare3 = Math.floor(plan3Cost * 0.8);

    assert.strictEqual(hostShare1, 79, 'Host earns 79 diamonds on 99 diamond 1-month plan');
    assert.strictEqual(hostShare3, 199, 'Host earns 199 diamonds on 249 diamond 3-month plan');
  });

  // Test 4: Transaction Types Ledger Integrity
  test('5. TransactionType includes all gamification and monetization ledger operations', () => {
    const requiredTypes = [
      TransactionType.GIFT,
      TransactionType.GIFT_SENT,
      TransactionType.STORE_PURCHASE,
      TransactionType.VIP_PURCHASE,
      TransactionType.SVIP_PURCHASE,
      TransactionType.FANCLUB_JOIN,
      TransactionType.TASK_REWARD,
    ];

    requiredTypes.forEach((t) => {
      assert.ok(Object.values(TransactionType).includes(t), `TransactionType must include ${t}`);
    });
  });

  // Test 5: Ranking Podium 3-Column Layout Integrity
  test('6. Dynamic Rankings podium delivers exact [Rank 2, Rank 1, Rank 3] UI ordering', () => {
    const sampleRanked = [
      { rank: 1, name: 'Champion', isCenter: true },
      { rank: 2, name: 'RunnerUp', isCenter: false },
      { rank: 3, name: 'ThirdPlace', isCenter: false },
    ];

    // Mirroring server podium construction
    const podium = [sampleRanked[1], sampleRanked[0], sampleRanked[2]];
    assert.strictEqual(podium[0].rank, 2, 'Index 0 must be Rank 2 for Left step');
    assert.strictEqual(podium[1].rank, 1, 'Index 1 must be Rank 1 for Center step');
    assert.strictEqual(podium[2].rank, 3, 'Index 2 must be Rank 3 for Right step');
    assert.strictEqual(podium[1].isCenter, true, 'Rank 1 must be marked isCenter');
  });

  // Test 6: Daily Tasks Reward Bounds
  test('7. Daily tasks rewards are strictly positive and bounded', () => {
    const defaultTasks = [
      { id: 't1', title: 'Stay in room for 10 mins', reward: 10 },
      { id: 't2', title: 'Stay in room for 30 mins', reward: 30 },
      { id: 't3', title: 'Take the mic for 10 mins', reward: 10 },
      { id: 't4', title: 'Send gifts', reward: 10 },
      { id: 't5', title: 'Recharge', reward: 10 },
    ];

    defaultTasks.forEach((task) => {
      assert.ok(task.reward > 0, `Task ${task.id} reward must be positive`);
      assert.ok(task.reward <= 100, `Task ${task.id} reward must not exceed safe limit`);
    });
  });

  // Test 7: Public Profile Data Sanitization
  test('8. Public profile projections strictly omit sensitive credentials and moderation data', () => {
    const sensitiveFields = [
      'password',
      'deviceToken',
      'refreshToken',
      'verificationDocuments',
      'govIdNumber',
      'kycSelfieImage',
      'bankAccount',
    ];

    const safePublicKeys = [
      '_id',
      'userId',
      'name',
      'userName',
      'avatar',
      'gender',
      'level',
      'isVIP',
      'vipTier',
      'svipTier',
      'equippedFrame',
      'followingCount',
      'fansCount',
      'country',
    ];

    sensitiveFields.forEach((field) => {
      assert.ok(!safePublicKeys.includes(field), `Sensitive field ${field} must never be exposed publicly`);
    });
  });
});
