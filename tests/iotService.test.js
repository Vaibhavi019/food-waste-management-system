const test = require('node:test');
const assert = require('node:assert');
const iotService = require('../services/iotService');

test('IoT Telemetry Service Tests', async (t) => {

    await t.test('1 & 2: Telemetry generation and gradual changes', () => {
        const initial = iotService.getCurrentTelemetry();
        const next = iotService.generateTelemetry();
        
        // Ensure values exist and didn't jump insanely
        assert.ok(next.temperature !== undefined);
        assert.ok(next.humidity !== undefined);
        assert.ok(Math.abs(next.temperature - initial.temperature) <= 1.0);
        assert.ok(Math.abs(next.humidity - initial.humidity) <= 2.0);
    });

    await t.test('3: Normal conditions', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 4.0,
            humidity: 50.0,
            machineStatus: 'ONLINE',
            timestamp: new Date().toISOString()
        });
        assert.strictEqual(risk.level, 'NORMAL');
        assert.ok(risk.recommendedAction.includes('within configured monitoring limits'));
    });

    await t.test('4: Warning temperature', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 6.5, // > 5, <= 8
            humidity: 50.0,
            machineStatus: 'ONLINE',
            timestamp: new Date().toISOString()
        });
        assert.strictEqual(risk.level, 'WARNING');
        assert.ok(risk.reasons.some(r => r.includes('Temperature above target range')));
    });

    await t.test('5: Critical temperature', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 9.0, // > 8
            humidity: 50.0,
            machineStatus: 'ONLINE',
            timestamp: new Date().toISOString()
        });
        assert.strictEqual(risk.level, 'CRITICAL');
        assert.ok(risk.reasons.some(r => r.includes('Temperature critically high')));
        assert.ok(risk.recommendedAction.includes('Immediate storage inspection recommended'));
    });

    await t.test('6: Humidity warning', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 4.0,
            humidity: 75.0, // > 60
            machineStatus: 'ONLINE',
            timestamp: new Date().toISOString()
        });
        assert.strictEqual(risk.level, 'WARNING');
        assert.ok(risk.reasons.some(r => r.includes('Humidity above target range')));
    });

    await t.test('7: Stale telemetry / Machine Offline', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 4.0,
            humidity: 50.0,
            machineStatus: 'OFFLINE',
            timestamp: new Date(Date.now() - (1000 * 60 * 60)).toISOString() // 1 hour ago
        });
        // Offline machine triggers WARNING
        assert.strictEqual(risk.level, 'WARNING');
        assert.ok(risk.reasons.some(r => r.includes('Machine status is OFFLINE')));
    });

    await t.test('8 & 9: Risk calculation & Recommended action (Combined risks)', () => {
        const risk = iotService.evaluateTelemetryRisk({
            temperature: 9.0, // CRITICAL
            humidity: 90.0, // CRITICAL
            machineStatus: 'ATTENTION' // WARNING
        });
        assert.strictEqual(risk.level, 'CRITICAL');
        assert.strictEqual(risk.reasons.length, 3);
    });

    await t.test('10: Telemetry history limit', () => {
        // Generate more than 50 readings
        for(let i=0; i<60; i++) {
            iotService.generateTelemetry();
        }
        const history = iotService.getTelemetryHistory();
        assert.strictEqual(history.length, 50); // It should not exceed HISTORY_LIMIT (50)
    });
});
