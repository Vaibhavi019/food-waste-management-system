const assert = require('assert');
const { getSustainabilityAnalytics, ENVIRONMENTAL_FACTORS } = require('../services/sustainabilityService');

console.log('▶ Sustainability Service Tests (Phase 10)');
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

const mockListingId1 = '609d1b111111111111111111';
const mockListingId2 = '609d1b222222222222222222';
const mockListingId3 = '609d1b333333333333333333';

const listings = [
    { _id: mockListingId1, quantity: 50 }, // No surplusQuantity explicitly, should fallback to quantity
    { _id: mockListingId2, surplusQuantity: 20 },
    { _id: mockListingId3, surplusQuantity: 0 } // missing quantity case
];

runTest('1. empty database context', () => {
    const result = getSustainabilityAnalytics({ events: [], listings: [] });
    assert.strictEqual(result.foodDivertedKg, 0);
    assert.ok(result.warnings.some(w => w.includes('No historical sustainability records')));
});

runTest('2. completed redistribution', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.redistributedKg, 50);
    assert.strictEqual(result.foodDivertedKg, 50);
});

runTest('3. incomplete claim not counted', () => {
    const events = [
        { eventType: 'CLAIM_CREATED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0);
});

runTest('4. confirmed processing', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId2, metadata: { confirmedPath: 'PROCESS_UPCYCLE' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.processedKg, 20);
    assert.strictEqual(result.foodDivertedKg, 20);
});

runTest('5. confirmed organic recovery', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId1, metadata: { confirmedPath: 'ORGANIC_RECOVERY' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.organicRecoveryKg, 50);
});

runTest('6. recommendation not counted as completed', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_RECOMMENDED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0);
    assert.strictEqual(result.dataCoverage.recommendationRecords, 1);
});

runTest('7. multiple pathways', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 },
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId2, metadata: { confirmedPath: 'PROCESS_UPCYCLE' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 70);
    assert.strictEqual(result.redistributedKg, 50);
    assert.strictEqual(result.processedKg, 20);
});

runTest('8. no environmental factor', () => {
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.estimatedImpact.co2eAvoidedKg, null);
});

runTest('9. configured environmental factor', () => {
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }];
    const oldVal = ENVIRONMENTAL_FACTORS.co2ePerKg;
    ENVIRONMENTAL_FACTORS.co2ePerKg = 2.5;
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.estimatedImpact.co2eAvoidedKg, 50 * 2.5); // 125
    ENVIRONMENTAL_FACTORS.co2ePerKg = oldVal;
});

runTest('10. quantity consistency', () => {
    // Tests fallback from surplusQuantity to quantity
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 50);
});

runTest('11. duplicate/double-count protection', () => {
    // Two handovers for same food listing
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 },
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 50); // counted only once
});

runTest('12. date filtering', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1, timestamp: new Date('2026-01-01T00:00:00Z') },
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId2, timestamp: new Date('2026-10-01T00:00:00Z') }
    ];
    const result = getSustainabilityAnalytics({ events, listings, startDate: '2026-09-01T00:00:00Z' });
    assert.strictEqual(result.foodDivertedKg, 20); // only mockListingId2
});

runTest('13. missing quantity', () => {
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId3 }];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0); 
});

runTest('14. missing traceability data', () => {
    const result = getSustainabilityAnalytics({ events: [], listings });
    assert.strictEqual(result.foodDivertedKg, 0);
});

runTest('15. deterministic calculations', () => {
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }];
    const r1 = getSustainabilityAnalytics({ events, listings });
    const r2 = getSustainabilityAnalytics({ events, listings });
    assert.deepStrictEqual(r1, r2);
});

runTest('16. data coverage', () => {
    const events = [{ eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.dataCoverage.quantityRecords, 3);
    assert.strictEqual(result.dataCoverage.completedHandoverRecords, 1);
});

runTest('17. warning generation', () => {
    const events = [{ eventType: 'CLAIM_CREATED', foodListingId: mockListingId1 }];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.ok(result.warnings.some(w => w.includes('No confirmed recovery/redistribution records yet.')));
});

runTest('18. unauthorized/invalid context handling where service-level appropriate', () => {
    // Tests behavior when events array contains garbage or is null/missing items
    const events = [null, undefined, { eventType: 'HANDOVER_COMPLETED' }]; // no foodListingId
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0);
});

runTest('19. unsourced CO2 factor is unavailable', () => {
    const result = getSustainabilityAnalytics({ events: [], listings });
    assert.strictEqual(result.estimatedImpact.co2eAvoidedKg, null);
});

runTest('20. no fabricated environmental number is generated', () => {
    const result = getSustainabilityAnalytics({ events: [], listings });
    assert.strictEqual(result.estimatedImpact.co2eAvoidedKg, null);
    assert.strictEqual(result.estimatedImpact.waterAvoidedLiters, null);
});

runTest('21. handover + utilization confirmation does not double-count', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 },
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId1, metadata: { confirmedPath: 'PROCESS_UPCYCLE' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 50); // Counted only once
});

runTest('22. recommendation does not contribute to completed totals', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_RECOMMENDED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0);
});

runTest('23. incomplete claim does not contribute', () => {
    const events = [
        { eventType: 'CLAIM_CREATED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 0);
});

runTest('24. distinct listings are both counted', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 },
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId2 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.foodDivertedKg, 70);
});

runTest('25. confirmed processing is counted', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId1, metadata: { confirmedPath: 'PROCESS_UPCYCLE' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.processedKg, 50);
});

runTest('26. confirmed organic recovery is counted', () => {
    const events = [
        { eventType: 'UTILIZATION_PATHWAY_CONFIRMED', foodListingId: mockListingId1, metadata: { confirmedPath: 'ORGANIC_RECOVERY' } }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.organicRecoveryKg, 50);
});

runTest('27. completed redistribution is counted', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.redistributedKg, 50);
});

runTest('28. environmental estimate remains unavailable without factor', () => {
    const events = [
        { eventType: 'HANDOVER_COMPLETED', foodListingId: mockListingId1 }
    ];
    const result = getSustainabilityAnalytics({ events, listings });
    assert.strictEqual(result.estimatedImpact.co2eAvoidedKg, null);
});

console.log(`\n✔ Sustainability Service Tests: ${passed}/${total} passed\n`);
