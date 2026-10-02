const test = require('node:test');
const assert = require('node:assert');
const visionService = require('../services/visionService');

test('Vision Service & Quality Risk Fusion Tests', async (t) => {
    
    await t.test('1, 3 & 4: Valid image input, missing file, visual analysis', () => {
        // Missing file uses default fallback hash
        const noFile = visionService.assessFoodImage(null);
        assert.strictEqual(noFile.riskLevel, 'LOW');
        assert.ok(noFile.visualIndicators.includes('Prototype analysis: Visual appearance matches baseline.'));
        
        // Mock a specific string length to trigger HIGH risk (hash < 15)
        const highRiskStr = 'a'.repeat(10); // length 10 % 100 = 10
        const highRisk = visionService.assessFoodImage(highRiskStr);
        assert.strictEqual(highRisk.riskLevel, 'HIGH');
        assert.ok(highRisk.visualIndicators.some(i => i.includes('Prototype visual anomaly indicator:')));

        // Mock a specific string length to trigger MEDIUM risk (15 <= hash < 40)
        const medRiskStr = 'a'.repeat(25); // length 25 % 100 = 25
        const medRisk = visionService.assessFoodImage(medRiskStr);
        assert.strictEqual(medRisk.riskLevel, 'MEDIUM');
    });

    await t.test('10 & 11: Human verification flag and confidence output', () => {
        const result = visionService.assessFoodImage('test.jpg');
        assert.strictEqual(typeof result.confidence, 'number');
        
        const fusion = visionService.calculateOverallRisk(result, null, new Date(Date.now() + 1000000));
        assert.strictEqual(fusion.humanVerificationRequired, true); // ALWAYS required
    });

    await t.test('5, 6: Risk fusion with NORMAL telemetry and plenty of time', () => {
        const cv = { riskLevel: 'LOW', visualRiskScore: 90 };
        const storage = { level: 'NORMAL' };
        // Expiry is 10 hours from now
        const expiry = new Date(Date.now() + (10 * 60 * 60 * 1000));
        
        const fusion = visionService.calculateOverallRisk(cv, storage, expiry);
        assert.strictEqual(fusion.overallRiskLevel, 'LOW');
        assert.strictEqual(fusion.overallRiskScore, 90);
    });

    await t.test('7: Risk fusion with WARNING telemetry', () => {
        const cv = { riskLevel: 'LOW', visualRiskScore: 90 };
        const storage = { level: 'WARNING' };
        const expiry = new Date(Date.now() + (10 * 60 * 60 * 1000));
        
        const fusion = visionService.calculateOverallRisk(cv, storage, expiry);
        assert.strictEqual(fusion.overallRiskLevel, 'MEDIUM');
        // Warning drops score by 15 => 75
        assert.strictEqual(fusion.overallRiskScore, 75);
    });

    await t.test('8: Risk fusion with CRITICAL telemetry overrides to HIGH', () => {
        const cv = { riskLevel: 'LOW', visualRiskScore: 90 };
        const storage = { level: 'CRITICAL' };
        const expiry = new Date(Date.now() + (10 * 60 * 60 * 1000));
        
        const fusion = visionService.calculateOverallRisk(cv, storage, expiry);
        assert.strictEqual(fusion.overallRiskLevel, 'HIGH');
        assert.ok(fusion.riskFactors.some(f => f.includes('critically exceeded')));
    });

    await t.test('9: Risk fusion with missing expiry', () => {
        const cv = { riskLevel: 'LOW', visualRiskScore: 90 };
        const storage = { level: 'NORMAL' };
        const fusion = visionService.calculateOverallRisk(cv, storage, 'Invalid Date');
        
        assert.strictEqual(fusion.overallRiskLevel, 'LOW');
        assert.ok(fusion.riskFactors.some(f => f.includes('Time-based risk unavailable')));
    });

    await t.test('Time-based limits', () => {
        const cv = { riskLevel: 'LOW', visualRiskScore: 90 };
        const storage = { level: 'NORMAL' };
        
        // Expiry in 1 hour
        const fusionShort = visionService.calculateOverallRisk(cv, storage, new Date(Date.now() + (1 * 60 * 60 * 1000)));
        assert.strictEqual(fusionShort.overallRiskLevel, 'HIGH');
        assert.ok(fusionShort.riskFactors.some(f => f.includes('< 2 hours')));

        // Expired
        const fusionExpired = visionService.calculateOverallRisk(cv, storage, new Date(Date.now() - 1000));
        assert.strictEqual(fusionExpired.overallRiskLevel, 'HIGH');
        assert.strictEqual(fusionExpired.overallRiskScore, 0);
    });
});
