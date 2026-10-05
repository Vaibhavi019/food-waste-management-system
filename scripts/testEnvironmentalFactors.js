const { getSustainabilityAnalytics, ENVIRONMENTAL_FACTORS } = require('../services/sustainabilityService');

function runTest(name, listing, events, expected) {
    console.log(`\n--- Test: ${name} ---`);
    const result = getSustainabilityAnalytics({ listings: [listing], events });
    const { co2eAvoidedKg, waterAvoidedLiters, factorCoverage, co2eFactorSource, waterFactorSource, methodologies } = result.estimatedImpact;
    
    let passed = true;
    if (expected.co2eAvoidedKg !== undefined && co2eAvoidedKg !== expected.co2eAvoidedKg) {
        console.error(`❌ CO2e mismatch: expected ${expected.co2eAvoidedKg}, got ${co2eAvoidedKg}`);
        passed = false;
    }
    if (expected.waterAvoidedLiters !== undefined && waterAvoidedLiters !== expected.waterAvoidedLiters) {
        console.error(`❌ Water mismatch: expected ${expected.waterAvoidedLiters}, got ${waterAvoidedLiters}`);
        passed = false;
    }
    
    if (passed) {
        console.log(`✅ Passed! CO2e: ${co2eAvoidedKg}, Water: ${waterAvoidedLiters}`);
        if (co2eAvoidedKg !== null) {
            console.log(`   CO2e Source: ${co2eFactorSource}`);
        }
        if (waterAvoidedLiters !== null) {
            console.log(`   Water Source: ${waterFactorSource}`);
        }
        if (methodologies && methodologies.length > 0) {
            console.log(`   Methodology: ${methodologies[0]}`);
        }
        if (co2eAvoidedKg === null) {
            console.log(`   Factor Coverage: ${factorCoverage.co2e}`);
        }
    }
}

// Setup base data
const baseEvents = [
    { eventType: 'HANDOVER_COMPLETED', foodListingId: '1' }
];

const baseListing = {
    _id: '1',
    itemName: 'Test Food',
    category: 'Unknown',
    foodType: 'Unknown',
    quantity: '50',
    unit: 'portions',
    weightKg: 12.5,
    surplusQuantity: 50
};

runTest('1. Rice + 12.5 kg', { ...baseListing, category: 'Rice' }, baseEvents, {
    co2eAvoidedKg: 12.5 * 4.45,
    waterAvoidedLiters: 12.5 * 2497
});

runTest('2. Poultry + 12.5 kg', { ...baseListing, category: 'Poultry' }, baseEvents, {
    co2eAvoidedKg: 12.5 * 9.87,
    waterAvoidedLiters: 12.5 * 4325
});

runTest('3. Vegetables + 12.5 kg', { ...baseListing, category: 'Vegetables' }, baseEvents, {
    co2eAvoidedKg: 12.5 * 0.53,
    waterAvoidedLiters: 12.5 * 322
});

runTest('4. Prepared Food + 12.5 kg', { ...baseListing, category: 'Prepared Food' }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

runTest('5. Non-Vegetarian + 12.5 kg', { ...baseListing, category: 'Non-Vegetarian' }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

runTest('6. Vegetarian + 12.5 kg', { ...baseListing, category: 'Vegetarian' }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

runTest('7. Mixed + 12.5 kg', { ...baseListing, category: 'Mixed' }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

runTest('8. No weight', { ...baseListing, category: 'Rice', weightKg: null }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

runTest('9. Zero weight', { ...baseListing, category: 'Rice', weightKg: 0 }, baseEvents, {
    co2eAvoidedKg: null,
    waterAvoidedLiters: null
});

// --- Existing 50-portion demo ---
console.log('\n--- Test: Existing 50-portion demo ---');
const demoListing = { ...baseListing, category: 'Prepared Food' };
const demoResult = getSustainabilityAnalytics({ listings: [demoListing], events: baseEvents });
console.log(demoResult.foodDiverted === 50 && demoResult.foodDivertedUnit === 'portions' && demoResult.redistributed === 50
    ? '✅ Passed! Food diverted remains 50 portions and redistributed is 50 portions' 
    : `❌ Failed! Food diverted is ${demoResult.foodDiverted} ${demoResult.foodDivertedUnit}, redistributed is ${demoResult.redistributed}`);

