const assert = require('assert');
const traceabilityService = require('../services/traceabilityService');

console.log('▶ Traceability Service Tests');
let passed = 0;
let total = 0;

async function runTest(name, fn) {
    total++;
    try {
        await fn();
        console.log(`  ✔ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✘ ${name}`);
        console.error(err.stack);
    }
}

(async () => {
    const mockFoodId = '64f0a0000000000000000001';
    const mockClaimId = '64f0a0000000000000000002';
    const mockUserId = '64f0a0000000000000000003';
    const TS = new Date('2026-10-01T12:00:00Z');

    let ev1, ev2, ev3;

    await runTest('1 & 3 & 10. first event hash, deterministic hash, metadata sanitization', async () => {
        ev1 = await traceabilityService.recordEvent({
            foodListingId: mockFoodId,
            eventType: 'FOOD_CREATED',
            eventLabel: 'Food surplus recorded',
            timestamp: TS,
            actorUserId: mockUserId,
            metadata: { category: 'Prepared', otp: '123456', password: 'secretpassword', sensitive: 'data' },
            _mockSkipSave: true
        });

        assert.strictEqual(ev1.previousEventHash, null);
        assert.ok(ev1.eventHash.length === 64); // SHA-256 is 64 hex chars
        
        // Sanitize check (10, 11, 12)
        assert.strictEqual(ev1.metadata.otp, undefined);
        assert.strictEqual(ev1.metadata.password, undefined);
        assert.strictEqual(ev1.metadata.category, 'Prepared');

        // Deterministic check
        const h2 = traceabilityService.createEventHash({
            foodListingId: mockFoodId,
            eventType: 'FOOD_CREATED',
            timestamp: TS,
            actorUserId: mockUserId,
            metadata: { category: 'Prepared' } // sanitization already stripped it before hashing
        }, null);
        assert.strictEqual(ev1.eventHash, h2);
    });

    await runTest('2 & 4. chained events, timeline ordering', async () => {
        ev2 = await traceabilityService.recordEvent({
            foodListingId: mockFoodId,
            eventType: 'QUALITY_ASSESSED',
            eventLabel: 'Quality assessed',
            timestamp: new Date(TS.getTime() + 1000),
            actorUserId: mockUserId,
            _mockPreviousHash: ev1.eventHash, // Mocking DB fetch of last event
            _mockSkipSave: true
        });

        assert.strictEqual(ev2.previousEventHash, ev1.eventHash);
        assert.ok(ev2.eventHash !== ev1.eventHash);

        ev3 = await traceabilityService.recordEvent({
            foodListingId: mockFoodId,
            claimId: mockClaimId,
            eventType: 'CLAIM_CREATED',
            eventLabel: 'Claim created',
            timestamp: new Date(TS.getTime() + 2000),
            actorUserId: mockUserId,
            _mockPreviousHash: ev2.eventHash,
            _mockSkipSave: true
        });

        assert.strictEqual(ev3.previousEventHash, ev2.eventHash);
    });

    await runTest('5. integrity verification', async () => {
        const timeline = [ev1, ev2, ev3];
        const res = traceabilityService.verifyTimelineIntegrity(timeline);
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.checkedEvents, 3);
    });

    await runTest('6. modified event detection', async () => {
        const timeline = [ev1, { ...ev2, eventType: 'MODIFIED_EVENT' }, ev3];
        const res = traceabilityService.verifyTimelineIntegrity(timeline);
        assert.strictEqual(res.valid, false);
        assert.strictEqual(res.brokenAt, 1);
        assert.ok(res.reason.includes('Hash mismatch'));
    });

    await runTest('7. broken previous hash detection', async () => {
        const timeline = [ev1, ev2, { ...ev3, previousEventHash: 'fakehash' }];
        const res = traceabilityService.verifyTimelineIntegrity(timeline);
        assert.strictEqual(res.valid, false);
        assert.strictEqual(res.brokenAt, 2);
        assert.ok(res.reason.includes('Broken chain linkage'));
    });

    await runTest('8 & 9. multiple timelines remain independent', async () => {
        const food2 = '64f0a0000000000000000010';
        const evOther = await traceabilityService.recordEvent({
            foodListingId: food2,
            eventType: 'FOOD_CREATED',
            eventLabel: 'Another food',
            timestamp: TS,
            _mockSkipSave: true
        });
        assert.strictEqual(evOther.previousEventHash, null); // starts a new chain
        
        // They do not share hashes
        assert.notStrictEqual(evOther.eventHash, ev1.eventHash);
    });

    await runTest('13. duplicate event prevention', async () => {
        // If the mock sees that the last event was already QUALITY_ASSESSED, it skips
        const existing = [ev1, ev2]; // ev2 is QUALITY_ASSESSED
        const dup = await traceabilityService.recordEvent({
            foodListingId: mockFoodId,
            eventType: 'QUALITY_ASSESSED', // Duplicate
            eventLabel: 'Quality assessed again',
            _mockExistingEvents: existing,
            _mockSkipSave: true
        });
        
        // Should return the last event (ev2) instead of creating a new one
        assert.strictEqual(dup.eventHash, ev2.eventHash);
    });

    await runTest('14. empty timeline', async () => {
        const res = traceabilityService.verifyTimelineIntegrity([]);
        assert.strictEqual(res.valid, true);
        assert.strictEqual(res.checkedEvents, 0);
    });

    await runTest('15. legacy food with partial timeline', async () => {
        // If a food was created before phase 8, the first event might be CLAIM_CREATED
        const leg1 = await traceabilityService.recordEvent({
            foodListingId: 'legacyFoodId',
            eventType: 'CLAIM_CREATED',
            eventLabel: 'Claimed',
            timestamp: TS,
            _mockSkipSave: true
        });
        assert.strictEqual(leg1.previousEventHash, null);

        const leg2 = await traceabilityService.recordEvent({
            foodListingId: 'legacyFoodId',
            eventType: 'HANDOVER_COMPLETED',
            eventLabel: 'Done',
            timestamp: new Date(TS.getTime() + 1000),
            _mockPreviousHash: leg1.eventHash,
            _mockSkipSave: true
        });

        const timeline = [leg1, leg2];
        const res = traceabilityService.verifyTimelineIntegrity(timeline);
        assert.strictEqual(res.valid, true);
    });

    console.log(`\n✔ Traceability Service Tests: ${passed}/${total} passed\n`);
})();
