const assert = require('assert');
const { calculateLogistics } = require('../services/logisticsService');

console.log('▶ Logistics Service Tests');
let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`  ✔ ${name}`);
        passed++;
    } catch (err) {
        console.error(`  ✘ ${name}`);
        console.error(err.stack);
    }
}

// Fixed reference time for deterministic ETA tests
const REF_TIME = new Date('2026-10-01T12:00:00.000Z').getTime();

const mockFood = {
    latitude: 12.9716,
    longitude: 77.5946,
    pickupWindowMinutes: 120, // 2 hours
    expiryTime: new Date(REF_TIME + 5 * 60 * 60 * 1000).toISOString(), // 5 hours left
    humanVerificationRequired: false,
    overallRiskLevel: 'LOW'
};

const mockRecipientNearby = {
    latitude: 12.9720,
    longitude: 77.5950,
};

const mockRecipientDistant = {
    latitude: 13.5,
    longitude: 78.0,
};

runTest('1. nearby donor/recipient', () => {
    const res = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.distanceKm, 0.1);
    assert.ok(res.estimatedTravelMinutes < 5);
    assert.strictEqual(res.feasibility, 'FEASIBLE');
});

runTest('2. distant donor/recipient', () => {
    const res = calculateLogistics(mockFood, mockRecipientDistant, { referenceTime: REF_TIME });
    assert.ok(res.distanceKm > 70);
    assert.ok(res.estimatedTravelMinutes > 150);
});

runTest('3. missing donor location', () => {
    const food = { ...mockFood, latitude: null };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.distanceKm, null);
    assert.ok(res.warnings.includes('Location information unavailable'));
});

runTest('4. missing recipient location', () => {
    const rec = { ...mockRecipientNearby, latitude: null };
    const res = calculateLogistics(mockFood, rec, { referenceTime: REF_TIME });
    assert.strictEqual(res.distanceKm, null);
    assert.ok(res.warnings.includes('Location information unavailable'));
});

runTest('5. zero distance', () => {
    const rec = { latitude: mockFood.latitude, longitude: mockFood.longitude };
    const res = calculateLogistics(mockFood, rec, { referenceTime: REF_TIME });
    assert.strictEqual(res.distanceKm, 0);
    assert.strictEqual(res.estimatedTravelMinutes, 0);
});

runTest('6. valid pickup window', () => {
    const res = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.feasibility, 'FEASIBLE');
});

runTest('7. pickup window too short', () => {
    const food = { ...mockFood, pickupWindowMinutes: 5 }; // Very short window
    const res = calculateLogistics(food, mockRecipientDistant, { referenceTime: REF_TIME }); // long travel
    assert.strictEqual(res.feasibility, 'NOT_FEASIBLE');
    assert.ok(res.warnings.some(w => w.includes('exceeds donor pickup window')));
});

runTest('8. missing pickup window', () => {
    const food = { ...mockFood, pickupWindowMinutes: null };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.ok(res.warnings.includes('Pickup window information unavailable'));
});

runTest('9. valid expiryTime', () => {
    const res = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.remainingUsableMinutes, 300);
    assert.strictEqual(res.feasibility, 'FEASIBLE');
});

runTest('10. missing expiryTime', () => {
    const food = { ...mockFood, expiryTime: null };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.remainingUsableMinutes, null);
    assert.ok(res.warnings.includes('Time-based feasibility unavailable'));
});

runTest('11. expired food', () => {
    const food = { ...mockFood, expiryTime: new Date(REF_TIME - 1000).toISOString() };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.feasibility, 'NOT_FEASIBLE');
    assert.ok(res.warnings.includes('Food has expired or has zero usable time remaining'));
});

runTest('12. insufficient remaining usable time', () => {
    const food = { ...mockFood, expiryTime: new Date(REF_TIME + 20 * 60000).toISOString() }; // 20 mins left
    const res = calculateLogistics(food, mockRecipientDistant, { referenceTime: REF_TIME }); // >150 mins travel
    assert.strictEqual(res.feasibility, 'NOT_FEASIBLE');
    assert.ok(res.warnings.some(w => w.includes('exceeds remaining usable time')));
});

runTest('13. ETA calculation using fixed referenceTime', () => {
    const rec = { latitude: mockFood.latitude, longitude: mockFood.longitude }; // 0 dist -> 0 travel mins
    const res = calculateLogistics(mockFood, rec, { referenceTime: REF_TIME });
    // buffer is 10 mins, so ETA = 12:10
    assert.strictEqual(res.estimatedArrivalTime, '2026-10-01T12:10:00.000Z');
});

runTest('14. high-risk warning', () => {
    const food = { ...mockFood, overallRiskLevel: 'HIGH' };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.ok(res.warnings.includes('High quality-risk assessment requires verification before dispatch.'));
    assert.strictEqual(res.feasibility, 'TIGHT');
    assert.strictEqual(res.logisticsPriority, 'URGENT');
});

runTest('15. human verification warning', () => {
    const food = { ...mockFood, humanVerificationRequired: true };
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.ok(res.warnings.includes('Human verification required before redistribution.'));
});

runTest('16. logistics priority', () => {
    const food = { ...mockFood, expiryTime: new Date(REF_TIME + 60 * 60000).toISOString() }; // 60 mins left
    const res = calculateLogistics(food, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.strictEqual(res.logisticsPriority, 'URGENT');
});

runTest('17. deterministic output', () => {
    const res1 = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    const res2 = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.deepStrictEqual(res1, res2);
});

runTest('18. score/values remain valid', () => {
    const res = calculateLogistics(mockFood, mockRecipientNearby, { referenceTime: REF_TIME });
    assert.ok(res.estimatedTravelMinutes >= 0);
    assert.ok(res.distanceKm >= 0);
});

console.log(`\n✔ Logistics Service Tests: ${passed}/${total} passed\n`);
