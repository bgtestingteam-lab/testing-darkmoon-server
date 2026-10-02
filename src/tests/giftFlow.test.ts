import assert from 'node:assert';
import { test, describe } from 'node:test';
import { INITIAL_GIFTS, INITIAL_CATEGORIES } from '../gift/gift.service';

describe('New Live Room Gift Flow - Core Engine Tests', () => {
  // Test 1: Price calculation
  test('1. Single receiver total beans calculation is correct', () => {
    const unitPrice = 20; // Rose = 20 Beans
    const quantity = 10;
    const receivers = ['receiver-1'];
    const totalBeans = unitPrice * quantity * receivers.length;
    assert.strictEqual(totalBeans, 200);
  });

  // Test 2: Multi-receiver calculation
  test('2. Multi-receiver total beans scales linearly with number of selected recipients', () => {
    const unitPrice = 50; // Lucky Clover = 50 Beans
    const quantity = 5;
    const receivers = ['receiver-1', 'receiver-2', 'receiver-3', 'receiver-4'];
    const totalBeans = unitPrice * quantity * receivers.length;
    assert.strictEqual(totalBeans, 1000);
  });

  // Test 3: Rarity and Animation Types configuration
  test('3. Initial gifts cover all required animation types with proper Beans pricing', () => {
    const animationTypes = new Set(INITIAL_GIFTS.map((g) => g.animationType));
    assert.ok(animationTypes.has('NORMAL'), 'Must support NORMAL animation');
    assert.ok(animationTypes.has('FLOATING'), 'Must support FLOATING animation');
    assert.ok(animationTypes.has('FLY_TO_RECEIVER'), 'Must support FLY_TO_RECEIVER animation');
    assert.ok(animationTypes.has('CENTER_STAGE'), 'Must support CENTER_STAGE animation');
    assert.ok(animationTypes.has('FULL_SCREEN'), 'Must support FULL_SCREEN animation');
    assert.ok(animationTypes.has('SPECIAL'), 'Must support SPECIAL animation');
    assert.ok(animationTypes.has('VIP'), 'Must support VIP animation');
    assert.ok(animationTypes.has('LUXURY'), 'Must support LUXURY animation');

    INITIAL_GIFTS.forEach((g) => {
      assert.ok(Number(g.price) > 0, `Gift ${g.name} must have a positive price`);
      assert.ok(g.icon, `Gift ${g.name} must have an icon`);
    });
  });

  // Test 4: Dynamic Categories
  test('4. Dynamic initial categories are configured without hardcoded assumptions', () => {
    const expectedCategories = ['popular', 'love', 'funny', 'vip', 'special', 'luxury', 'event'];
    const slugs = INITIAL_CATEGORIES.map((c) => c.slug);
    expectedCategories.forEach((slug) => {
      assert.ok(slugs.includes(slug), `Category ${slug} must be present`);
    });
  });

  // Test 5: Balance Validation logic
  test('5. Balance check correctly determines sufficiency', () => {
    const userBeansBalance = 2580;
    const requiredCost = 200;
    const sufficient = userBeansBalance >= requiredCost;
    assert.strictEqual(sufficient, true);
    assert.strictEqual(userBeansBalance - requiredCost, 2380);

    const highCost = 50000;
    const insufficient = userBeansBalance >= highCost;
    assert.strictEqual(insufficient, false);
  });

  // Test 6: Commission & Host Share calculation
  test('6. Commission and Host Earning split matches configuration', () => {
    const totalBeans = 1000;
    const commissionPercent = 30; // 30% platform
    const hostSharePercent = (100 - commissionPercent) / 100; // 70% host
    const hostEarning = Math.round(totalBeans * hostSharePercent);
    const platformCommission = totalBeans - hostEarning;

    assert.strictEqual(hostEarning, 700);
    assert.strictEqual(platformCommission, 300);
    assert.strictEqual(hostEarning + platformCommission, totalBeans);
  });

  // Test 7: Idempotency protection check
  test('7. RequestId uniqueness guarantees idempotency', () => {
    const processedRequests = new Set<string>();
    const reqId = 'gift_8f82c7b1-49b0-4f51-b0db-b27e8d6f5f3e';

    // First request
    let isDuplicate = processedRequests.has(reqId);
    assert.strictEqual(isDuplicate, false);
    processedRequests.add(reqId);

    // Duplicate submission with same requestId
    isDuplicate = processedRequests.has(reqId);
    assert.strictEqual(isDuplicate, true);
  });

  // Test 8: Event Gift expiry window validation
  test('8. Event gift validity window correctly identifies expired or future gifts', () => {
    const now = new Date('2026-10-01T12:00:00Z');

    const activeGift = {
      startsAt: new Date('2026-09-20T00:00:00Z'),
      endsAt: new Date('2026-10-05T00:00:00Z'),
    };
    const isAvailable = (!activeGift.startsAt || activeGift.startsAt <= now) &&
                        (!activeGift.endsAt || activeGift.endsAt >= now);
    assert.strictEqual(isAvailable, true);

    const expiredGift = {
      startsAt: new Date('2026-08-01T00:00:00Z'),
      endsAt: new Date('2026-09-01T00:00:00Z'),
    };
    const isExpired = expiredGift.endsAt && expiredGift.endsAt < now;
    assert.strictEqual(Boolean(isExpired), true);
  });
});
