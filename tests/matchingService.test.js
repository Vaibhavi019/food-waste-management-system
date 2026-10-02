const assert = require('assert');
const { scoreSingleMatch, rankRecipients, haversineKm } = require('../services/matchingService');

console.log('▶ Matching Service Tests');
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

// Mock Data
const mockFood = {
    _id: 'food1',
    itemName: 'Rice & Curry',
    category: 'Prepared Food',
    surplusQuantity: 50,
    unit: 'portions', // 50 * 0.4 = 20 kg
    latitude: 12.9716,
    longitude: 77.5946,
    expiryTime: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(), // 5 hours left
    humanVerificationRequired: false,
    overallRiskLevel: 'LOW'
};

const mockRecipientPerfect = {
    _id: 'rec1',
    name: 'Shelter A',
    acceptedCategories: ['Prepared Food', 'Vegetables'],
    capacityKg: 50,
    latitude: 12.9720,
    longitude: 77.5950, // very close
    availabilityStatus: 'Available',
    isVerified: true
};

runTest('1. Perfect category + quantity + nearby recipient', () => {
    const result = scoreSingleMatch(mockFood, mockRecipientPerfect);
    // 25 (cat) + 35 (qty) + 15 (dist) + 10 (avail) + 10 (time) + 5 (ver) = 100
    assert.strictEqual(result.matchScore, 100);
    assert.strictEqual(result.foodTypeCompatibility, 'Excellent');
    assert.strictEqual(result.quantitySuitability, 'High');
    assert.ok(result.distanceKm < 5);
});

runTest('2. Category mismatch', () => {
    const recMismatch = { ...mockRecipientPerfect, acceptedCategories: ['Raw Ingredients'] };
    const result = scoreSingleMatch(mockFood, recMismatch);
    assert.strictEqual(result.matchScore, 0); // disqualified
    assert.strictEqual(result.foodTypeCompatibility, 'Incompatible');
    assert.ok(result.warnings.includes('Incompatible food category'));
});

runTest('3. Recipient capacity too small', () => {
    const recSmall = { ...mockRecipientPerfect, capacityKg: 10 }; // Needs 20kg
    const result = scoreSingleMatch(mockFood, recSmall);
    assert.strictEqual(result.quantitySuitability, 'Partial Fit');
    assert.strictEqual(result.capacitySuitability, 'Exceeded');
    assert.ok(result.matchScore < 100); // 35 -> 15 points
});

runTest('4. Recipient capacity unavailable', () => {
    const recNoCap = { ...mockRecipientPerfect, capacityKg: null };
    const result = scoreSingleMatch(mockFood, recNoCap);
    assert.strictEqual(result.capacitySuitability, 'Unknown');
    assert.ok(result.warnings.includes('Capacity information unavailable'));
});

runTest('5. Far recipient', () => {
    const recFar = { ...mockRecipientPerfect, latitude: 13.5, longitude: 78.0 };
    const result = scoreSingleMatch(mockFood, recFar);
    assert.ok(result.distanceKm > 30);
    assert.ok(result.matchScore < 100);
});

runTest('6. Recipient unavailable', () => {
    const recBusy = { ...mockRecipientPerfect, availabilityStatus: 'Busy' };
    const result = scoreSingleMatch(mockFood, recBusy);
    assert.strictEqual(result.matchScore, 0);
    assert.strictEqual(result.availabilityScore, 'Busy');
    assert.ok(result.warnings.includes('Recipient unavailable'));
});

runTest('7. Missing expiryTime', () => {
    const foodNoTime = { ...mockFood, expiryTime: null };
    const result = scoreSingleMatch(foodNoTime, mockRecipientPerfect);
    assert.strictEqual(result.timeSuitability, 'Unknown');
    assert.ok(result.warnings.includes('Time-based suitability unavailable'));
});

runTest('8. Expired/zero usable time', () => {
    const foodExpired = { ...mockFood, expiryTime: new Date(Date.now() - 1000).toISOString() };
    const result = scoreSingleMatch(foodExpired, mockRecipientPerfect);
    assert.strictEqual(result.matchScore, 0);
    assert.strictEqual(result.timeSuitability, 'Expired');
});

runTest('9. Quality-risk warning', () => {
    const foodRisk = { ...mockFood, overallRiskLevel: 'HIGH' };
    const result = scoreSingleMatch(foodRisk, mockRecipientPerfect);
    assert.strictEqual(result.qualitySuitability, 'High Risk');
    assert.ok(result.warnings.includes('High quality risk detected; prioritize verification.'));
});

runTest('10. Human verification required', () => {
    const foodHuman = { ...mockFood, humanVerificationRequired: true };
    const result = scoreSingleMatch(foodHuman, mockRecipientPerfect);
    assert.strictEqual(result.qualitySuitability, 'Human Verification Required');
    assert.ok(result.warnings.includes('Human verification required before redistribution.'));
});

runTest('11. Missing location', () => {
    const recNoLoc = { ...mockRecipientPerfect, latitude: null, longitude: null };
    const result = scoreSingleMatch(mockFood, recNoLoc);
    assert.strictEqual(result.distanceKm, null);
    assert.ok(result.warnings.includes('Location information unavailable'));
});

runTest('12. Multiple recipients ranking', () => {
    const rec1 = { ...mockRecipientPerfect, _id: 'r1' };
    const rec2 = { ...mockRecipientPerfect, _id: 'r2', latitude: 13.5, longitude: 78.0 }; // far -> lower score
    const rec3 = { ...mockRecipientPerfect, _id: 'r3', availabilityStatus: 'Busy' }; // disqualified -> score 0
    
    const ranked = rankRecipients(mockFood, [rec3, rec1, rec2]);
    assert.strictEqual(ranked.length, 3);
    assert.strictEqual(ranked[0].recipientId, 'r1');
    assert.strictEqual(ranked[1].recipientId, 'r2');
    assert.strictEqual(ranked[2].recipientId, 'r3');
});

runTest('13. Explainable reasons', () => {
    const result = scoreSingleMatch(mockFood, mockRecipientPerfect);
    assert.ok(result.reasons.length > 0);
    assert.ok(result.reasons.includes('Food category accepted by recipient'));
});

runTest('14. Score remains within 0-100', () => {
    const result = scoreSingleMatch(mockFood, mockRecipientPerfect);
    assert.ok(result.matchScore >= 0 && result.matchScore <= 100);
});

console.log(`\n✔ Matching Service Tests: ${passed}/${total} passed\n`);
