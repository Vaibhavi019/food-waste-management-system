const assert = require('assert');
const { recommendUtilizationPath } = require('../services/processingService');

console.log('▶ Processing Service Tests (Phase 9)');
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

const now = Date.now();
const oneHourMs = 1000 * 60 * 60;
const goodFood = { category: 'Cooked', expiryTime: new Date(now + 10 * oneHourMs), quantity: 10, overallRiskLevel: 'LOW' };
const topMatch = { recipientName: 'NGO A' };
const goodLogistics = { feasibility: 'FEASIBLE' };
const badLogistics = { feasibility: 'NOT_FEASIBLE' };

runTest('1. redistribution candidate', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'REDISTRIBUTION');
});

runTest('2. no recipient -> process upcycle', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch: null });
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.reasons.some(r => r.includes('No suitable recipient found.')));
});

runTest('3. short remaining time with feasible logistics -> redistribution with urgency', () => {
    const shortFood = { ...goodFood, expiryTime: new Date(now + 1 * oneHourMs) }; // 1 hour left
    const result = recommendUtilizationPath(shortFood, { topMatch, logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'REDISTRIBUTION');
    assert.ok(result.reasons.some(r => r.includes('Urgent redistribution required')));
});

runTest('4. missing expiryTime -> warning', () => {
    const noExpiry = { category: 'Cooked', quantity: 10 };
    const result = recommendUtilizationPath(noExpiry, { topMatch, logisticsDetails: goodLogistics });
    assert.ok(result.warnings.some(w => w.includes('Time-based processing decision unavailable')));
});

runTest('5. high quality risk -> process upcycle', () => {
    const risky = { ...goodFood, overallRiskLevel: 'HIGH' };
    const result = recommendUtilizationPath(risky, { topMatch, logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.warnings.some(w => w.includes('Human verification required')));
});

runTest('6. normal quality risk -> redistribution', () => {
    const normal = { ...goodFood, overallRiskLevel: 'LOW' };
    const result = recommendUtilizationPath(normal, { topMatch, logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'REDISTRIBUTION');
});

runTest('7. storage warning', () => {
    const result = recommendUtilizationPath(goodFood, { 
        topMatch, 
        logisticsDetails: goodLogistics, 
        liveTelemetry: { temperature: 10, humidity: 90 } 
    });
    // Still redistributes if risks are not officially "HIGH", but issues a storage warning
    assert.strictEqual(result.recommendedPath, 'REDISTRIBUTION');
    assert.ok(result.warnings.some(w => w.includes('elevated operational risk')));
});

runTest('8. vegetables/fruit processing candidate', () => {
    const vegFood = { category: 'Vegetables', expiryTime: new Date(now + 10 * oneHourMs), quantity: 10 };
    const result = recommendUtilizationPath(vegFood, { topMatch: null }); // no match
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.reasons.some(r => r.includes('organic recovery pathway')));
});

runTest('9. bakery processing candidate', () => {
    const bakeryFood = { category: 'Bakery', expiryTime: new Date(now + 10 * oneHourMs), quantity: 10 };
    const result = recommendUtilizationPath(bakeryFood, { topMatch: null }); 
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.reasons.some(r => r.includes('organic recovery pathway')));
});

runTest('10. cooked food processing candidate', () => {
    const cookedFood = { category: 'Cooked', expiryTime: new Date(now + 10 * oneHourMs), quantity: 10 };
    const result = recommendUtilizationPath(cookedFood, { topMatch: null }); 
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
});

runTest('11. organic recovery fallback', () => {
    const weirdFood = { category: 'Unknown Category', expiryTime: new Date(now + 10 * oneHourMs), quantity: 10 };
    const result = recommendUtilizationPath(weirdFood, { topMatch: null }); 
    assert.strictEqual(result.recommendedPath, 'ORGANIC_RECOVERY');
});

runTest('12. missing quantity', () => {
    const noQty = { category: 'Cooked', expiryTime: new Date(now + 10 * oneHourMs) };
    const result = recommendUtilizationPath(noQty, {});
    assert.ok(result.warnings.some(w => w.includes('Quantity information unavailable')));
});

runTest('13. missing category', () => {
    const noCat = { expiryTime: new Date(now + 10 * oneHourMs), quantity: 10 };
    const result = recommendUtilizationPath(noCat, {});
    assert.strictEqual(result.recommendedPath, 'ORGANIC_RECOVERY');
});

runTest('14. missing IoT', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: goodLogistics, liveTelemetry: null });
    assert.strictEqual(result.recommendedPath, 'REDISTRIBUTION');
    assert.ok(!result.warnings.some(w => w.includes('elevated operational risk')));
});

runTest('15. missing logistics', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch });
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
});

runTest('16. human review required', () => {
    const result = recommendUtilizationPath(goodFood, {});
    assert.strictEqual(result.humanReviewRequired, true);
});

runTest('17. deterministic output', () => {
    const r1 = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: goodLogistics });
    const r2 = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: goodLogistics });
    assert.deepStrictEqual(r1, r2);
});

runTest('18. explainable reasons', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: goodLogistics });
    assert.ok(result.reasons.length > 0);
});

runTest('19. expired listing', () => {
    const expiredFood = { ...goodFood, expiryTime: new Date(now - 1 * oneHourMs) };
    const result = recommendUtilizationPath(expiredFood, { topMatch, logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'ORGANIC_RECOVERY');
    assert.ok(result.reasons.some(r => r.includes('Material has passed its safe utilization window')));
});

runTest('20. logistics NOT_FEASIBLE', () => {
    const result = recommendUtilizationPath(goodFood, { topMatch, logisticsDetails: badLogistics });
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.reasons.some(r => r.includes('Logistics not feasible')));
});

runTest('21. missing matching context', () => {
    const result = recommendUtilizationPath(goodFood, { logisticsDetails: goodLogistics });
    assert.strictEqual(result.recommendedPath, 'PROCESS_UPCYCLE');
    assert.ok(result.reasons.some(r => r.includes('No suitable recipient found.')));
});

console.log(`\n✔ Processing Service Tests: ${passed}/${total} passed\n`);
