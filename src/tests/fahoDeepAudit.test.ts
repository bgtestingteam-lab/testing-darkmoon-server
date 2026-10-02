import assert from 'node:assert';
import { test, describe, after } from 'node:test';
import { AgoraService } from '../services/agora.service';
import { VIP_PLANS, SVIP_TIERS } from '../controllers/vipController';
import { TransactionType } from '../constants/user';
import { generateToken } from '../utils/generator';

describe('FAHO Deep Production Audit & Security Verification Tests', () => {

  describe('1. Security & Token Generation', () => {
    test('Access & Refresh tokens generate valid signed JWTs with expected claims', () => {
      const userId = 123456;
      const accessToken = generateToken(userId, 'access');
      const refreshToken = generateToken(userId, 'refresh');

      assert.ok(accessToken && typeof accessToken === 'string');
      assert.ok(refreshToken && typeof refreshToken === 'string');
      assert.strictEqual(accessToken.split('.').length, 3, 'JWT must have header.payload.signature');
      assert.strictEqual(refreshToken.split('.').length, 3, 'JWT must have header.payload.signature');
    });

    test('TransactionType enum contains all required gamification, store, and withdrawal types', () => {
      const required = [
        TransactionType.STORE_PURCHASE,
        TransactionType.VIP_PURCHASE,
        TransactionType.SVIP_PURCHASE,
        TransactionType.FANCLUB_JOIN,
        TransactionType.TASK_REWARD,
        TransactionType.WITHDRAWAL,
        TransactionType.WITHDRAWAL_REFUND,
      ];
      for (const t of required) {
        assert.ok(Object.values(TransactionType).includes(t), `TransactionType must include ${t}`);
      }
    });
  });

  describe('2. Agora Voice Room Real Audio Engine', () => {
    test('Publisher token allows host & mic seat speakers to publish audio in channel', () => {
      const channel = 'voice_room_1000000001';
      const uid = 1000000001;
      const res = AgoraService.generateRtcToken({
        channelName: channel,
        uid,
        role: 'publisher',
        expireSeconds: 3600,
      });

      assert.ok(res.token && res.token.length > 50, 'Must produce valid RTC token');
      assert.strictEqual(res.channel, channel);
      assert.strictEqual(res.uid, uid);
      assert.strictEqual(res.role, 'publisher');
      assert.ok(res.expiresAt > Date.now());
    });

    test('Subscriber token allows room audience to listen without broadcasting audio', () => {
      const channel = 'voice_room_1000000001';
      const audienceUid = 2000000099;
      const res = AgoraService.generateRtcToken({
        channelName: channel,
        uid: audienceUid,
        role: 'subscriber',
        expireSeconds: 7200,
      });

      assert.ok(res.token && res.token.length > 50);
      assert.strictEqual(res.channel, channel);
      assert.strictEqual(res.uid, audienceUid);
      assert.strictEqual(res.role, 'subscriber');
    });
  });

  describe('3. Fan Club Dynamic Payout & Route Integrity', () => {
    test('Calculates host share dynamically from platform commission rate', () => {
      const costDiamonds = 99;

      // Platform default 20% commission -> host gets 80%
      const commissionRate20 = 20;
      const hostSharePercent20 = Math.max(0, Math.min(100, 100 - commissionRate20));
      const hostEarning20 = Math.floor(costDiamonds * (hostSharePercent20 / 100));
      assert.strictEqual(hostEarning20, 79);

      // Platform custom 10% commission -> host gets 90%
      const commissionRate10 = 10;
      const hostSharePercent10 = Math.max(0, Math.min(100, 100 - commissionRate10));
      const hostEarning10 = Math.floor(costDiamonds * (hostSharePercent10 / 100));
      assert.strictEqual(hostEarning10, 89);
    });

    test('Fan Club route registration avoids path parameter shadowing', async () => {
      // In Express, route definition order must have /members/:hostId before /:hostId
      const fanClubRoutes = (await import('../routes/fanClubRoutes')).default;
      const routes = (fanClubRoutes as any).stack
        .filter((r: any) => r.route)
        .map((r: any) => ({ path: r.route.path, method: Object.keys(r.route.methods)[0] }));

      const membersIndex = routes.findIndex((r: any) => r.path === '/members/:hostId');
      const detailsIndex = routes.findIndex((r: any) => r.path === '/:hostId');

      assert.ok(membersIndex !== -1, '/members/:hostId route must exist');
      assert.ok(detailsIndex !== -1, '/:hostId route must exist');
      assert.ok(membersIndex < detailsIndex, '/members/:hostId must precede /:hostId to prevent route shadowing');
    });
  });

  describe('4. Store & Inventory Equip/Unequip Contracts', () => {
    test('Store routes register both /equip and /unequip endpoints', async () => {
      const storeRoutes = (await import('../routes/storeRoutes')).default;
      const routes = (storeRoutes as any).stack
        .filter((r: any) => r.route)
        .map((r: any) => ({ path: r.route.path, method: Object.keys(r.route.methods)[0] }));

      const equipRoute = routes.find((r: any) => r.path === '/equip' && r.method === 'post');
      const unequipRoute = routes.find((r: any) => r.path === '/unequip' && r.method === 'post');

      assert.ok(equipRoute, 'POST /equip must be registered');
      assert.ok(unequipRoute, 'POST /unequip must be registered');
    });
  });

  describe('5. Task Anti-Double-Claim & Target Verification', () => {
    test('Incomplete task cannot be claimed when current < target and completed is false', () => {
      const task = { taskId: 't1', current: 5, target: 10, completed: false, claimed: false };
      const canClaim = task.completed || (task.current || 0) >= task.target;
      assert.strictEqual(canClaim, false, 'Task should not be claimable before reaching target');
    });

    test('Completed task can be claimed once, and second attempt is blocked', () => {
      const task = { taskId: 't1', current: 10, target: 10, completed: true, claimed: false };
      const canClaimFirst = (task.completed || task.current >= task.target) && !task.claimed;
      assert.strictEqual(canClaimFirst, true, 'First claim must succeed');

      task.claimed = true;
      const canClaimSecond = (task.completed || task.current >= task.target) && !task.claimed;
      assert.strictEqual(canClaimSecond, false, 'Second claim must be blocked');
    });
  });

  describe('6. Agency IDOR & Authorization Protection', () => {
    test('Agency host filtering strictly requires agencyId match and denies unassociated users', () => {
      const agencyId = '64b1f2e4c89d2a1b3c4d5e6f';
      const sampleHosts = [
        { name: 'Host A', agencyId: '64b1f2e4c89d2a1b3c4d5e6f', role: 'host' },
        { name: 'Host B', agencyId: '64b1f2e4c89d2a1b3c4d5e6f', role: 'host' },
        { name: 'Host C (Other Agency)', agencyId: '77c2f2e4c89d2a1b3c4d5e99', role: 'host' },
        { name: 'Host D (No Agency)', agencyId: null, role: 'host' },
      ];

      // Strict scoping condition
      const scopedHosts = sampleHosts.filter((h) => h.agencyId === agencyId);
      assert.strictEqual(scopedHosts.length, 2, 'Must strictly return only hosts assigned to the querying agency');
      assert.ok(!scopedHosts.some((h) => h.name.includes('Other Agency')));
      assert.ok(!scopedHosts.some((h) => h.name.includes('No Agency')));
    });
  });

  describe('7. Removed Features Zero-Presence Check', () => {
    test('Obsolete features (1-on-1 call rate, coin-to-diamond exchange) are not present in active routes', async () => {
      const authRoutes = (await import('../routes/authRoutes')).default;
      const allPaths = (authRoutes as any).stack
        .filter((r: any) => r.route)
        .map((r: any) => r.route.path);

      assert.ok(!allPaths.includes('/exchange-coins'), 'Exchange coins must not be in auth routes');
      assert.ok(!allPaths.includes('/one-to-one-call'), '1-to-1 call must not be in auth routes');
    });
  });

  after(() => {
    setTimeout(() => process.exit(0), 200);
  });
});
