const test = require('node:test');
const assert = require('node:assert');
const { generateForecast } = require('../services/aiForecastingService');

test('AI Forecasting Service Tests', async (t) => {
    
    await t.test('1 & 3: Insufficient/No historical data', () => {
        const result = generateForecast([]);
        assert.strictEqual(result.forecast.confidenceLevel, 'LOW');
        assert.strictEqual(result.forecast.predictedDemand, 0);
        assert.strictEqual(result.recommendation.action.includes('Not enough historical data'), true);
    });

    await t.test('4: Increasing demand', () => {
        const listings = [
            { producedQuantity: 100, consumedQuantity: 80, createdAt: new Date('2026-01-01') },
            { producedQuantity: 100, consumedQuantity: 85, createdAt: new Date('2026-01-02') },
            { producedQuantity: 100, consumedQuantity: 90, createdAt: new Date('2026-01-03') },
            { producedQuantity: 100, consumedQuantity: 95, createdAt: new Date('2026-01-04') },
            { producedQuantity: 100, consumedQuantity: 100, createdAt: new Date('2026-01-05') }
        ];
        const result = generateForecast(listings);
        assert.ok(result.explanation.factors.some(f => f.includes('increasing demand')));
        // Recent avg = 90, historical avg = 90. 70/30 split => 90
        assert.strictEqual(result.forecast.predictedDemand, 90);
    });

    await t.test('5: Decreasing demand', () => {
        const listings = [
            { producedQuantity: 100, consumedQuantity: 100, createdAt: new Date('2026-01-01') },
            { producedQuantity: 100, consumedQuantity: 90, createdAt: new Date('2026-01-02') },
            { producedQuantity: 100, consumedQuantity: 80, createdAt: new Date('2026-01-03') }
        ];
        const result = generateForecast(listings);
        assert.ok(result.explanation.factors.some(f => f.includes('decreasing demand')));
        assert.strictEqual(result.forecast.predictedDemand, 90);
    });

    await t.test('6 & 9: High production vs demand (surplus risk HIGH)', () => {
        // High surplus scenario
        const listings = [
            { producedQuantity: 200, consumedQuantity: 100, createdAt: new Date('2026-01-01') },
            { producedQuantity: 200, consumedQuantity: 100, createdAt: new Date('2026-01-02') },
            { producedQuantity: 200, consumedQuantity: 100, createdAt: new Date('2026-01-03') }
        ];
        const result = generateForecast(listings);
        // expectedProduction = 200, predictedDemand = 100, projected surplus = 100.
        // surplusRatio = 100/200 = 0.5 (>0.15) => HIGH risk
        assert.strictEqual(result.surplus.riskLevel, 'HIGH');
        assert.strictEqual(result.surplus.predictedSurplus, 100);
        assert.ok(result.recommendation.action.includes('Reduce planned production'));
    });

    await t.test('7: Low production vs demand (Optimal)', () => {
        const listings = [
            { producedQuantity: 100, consumedQuantity: 100, createdAt: new Date('2026-01-01') },
            { producedQuantity: 100, consumedQuantity: 98, createdAt: new Date('2026-01-02') }
        ];
        const result = generateForecast(listings);
        // optimal
        assert.strictEqual(result.surplus.riskLevel, 'LOW');
        assert.ok(result.recommendation.action.includes('Production levels are optimal'));
    });

    await t.test('8: Confidence calculation - Highly volatile data reduces confidence', () => {
        const listings = [
            { producedQuantity: 100, consumedQuantity: 10, createdAt: new Date('2026-01-01') },
            { producedQuantity: 100, consumedQuantity: 90, createdAt: new Date('2026-01-02') },
            { producedQuantity: 100, consumedQuantity: 20, createdAt: new Date('2026-01-03') },
            { producedQuantity: 100, consumedQuantity: 100, createdAt: new Date('2026-01-04') }
        ];
        const result = generateForecast(listings);
        // Base confidence starts at 50, +10 for >3 items = 60.
        // Range is 90 (max 100, min 10). Avg is 55. Range > Avg * 0.5, so -15. Total = 45.
        // 45 is < 50, so level should be LOW.
        assert.strictEqual(result.forecast.confidenceScore, 45);
        assert.strictEqual(result.forecast.confidenceLevel, 'LOW');
    });

    await t.test('10: Production recommendation logic', () => {
        const listings = [
            { producedQuantity: 1000, consumedQuantity: 800, createdAt: new Date('2026-01-01') }
        ];
        const result = generateForecast(listings);
        // Demand 800 * 1.05 = 840 recommended
        assert.strictEqual(result.recommendation.recommendedProduction, 840);
        // Action says reduce planned production by ~16% (1 - 840/1000)
        assert.ok(result.recommendation.action.includes('Reduce planned production by approximately 16%'));
    });
});
