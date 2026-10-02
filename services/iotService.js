/**
 * IoT Telemetry Simulator prototype for SANCHARI
 * Provides a realistic, deterministic simulated telemetry stream for Phase 4.
 * Designed to be replaced by a real MQTT broker/service in production.
 */

// Configurable thresholds for the prototype
const THRESHOLDS = {
    temp: { min: 2, max: 5, criticalMax: 8 },
    humidity: { min: 40, max: 60, criticalMax: 85 }
};

const HISTORY_LIMIT = 50;
let telemetryHistory = [];

// Initial simulator state
let currentState = {
    temperature: 3.5,
    humidity: 50.0,
    energyUsage: 12.4, // kWh
    machineStatus: 'ONLINE',
    storageStatus: 'NORMAL'
};

// Seed initial history
for (let i = HISTORY_LIMIT; i > 0; i--) {
    telemetryHistory.push({
        ...currentState,
        timestamp: new Date(Date.now() - (i * 10000)).toISOString()
    });
}

function evaluateTelemetryRisk(telemetry) {
    let riskLevel = 'NORMAL';
    const reasons = [];
    let recommendedAction = 'Storage conditions are within configured monitoring limits.';

    if (telemetry.temperature > THRESHOLDS.temp.criticalMax) {
        riskLevel = 'CRITICAL';
        reasons.push(`Temperature critically high (${telemetry.temperature.toFixed(1)}°C)`);
    } else if (telemetry.temperature > THRESHOLDS.temp.max) {
        riskLevel = 'WARNING';
        reasons.push(`Temperature above target range (${telemetry.temperature.toFixed(1)}°C)`);
    } else if (telemetry.temperature < THRESHOLDS.temp.min) {
        riskLevel = 'WARNING';
        reasons.push(`Temperature below target range (${telemetry.temperature.toFixed(1)}°C)`);
    }

    if (telemetry.humidity > THRESHOLDS.humidity.criticalMax) {
        if (riskLevel !== 'CRITICAL') riskLevel = 'WARNING';
        reasons.push(`Humidity critically high (${telemetry.humidity.toFixed(1)}%)`);
    } else if (telemetry.humidity > THRESHOLDS.humidity.max) {
        if (riskLevel === 'NORMAL') riskLevel = 'WARNING';
        reasons.push(`Humidity above target range (${telemetry.humidity.toFixed(1)}%)`);
    }

    if (telemetry.machineStatus !== 'ONLINE') {
        riskLevel = riskLevel === 'CRITICAL' ? 'CRITICAL' : 'WARNING';
        reasons.push(`Machine status is ${telemetry.machineStatus}`);
    }

    if (riskLevel === 'CRITICAL') {
        recommendedAction = 'Immediate storage inspection recommended. Verify refrigeration conditions and inspect affected food.';
    } else if (riskLevel === 'WARNING') {
        recommendedAction = 'Storage conditions require attention. Monitor closely.';
    }

    return {
        level: riskLevel,
        reasons,
        recommendedAction
    };
}

function generateTelemetry() {
    // Gradual realistic drift
    const tempDrift = (Math.random() - 0.45) * 0.4; // Slight upward bias occasionally
    const humDrift = (Math.random() - 0.5) * 1.5;
    const energyDrift = (Math.random() * 0.1); 

    currentState.temperature = Number((currentState.temperature + tempDrift).toFixed(1));
    currentState.humidity = Number((Math.max(0, Math.min(100, currentState.humidity + humDrift))).toFixed(1));
    currentState.energyUsage = Number((currentState.energyUsage + energyDrift).toFixed(2));

    // Force constraints for demo purposes so it doesn't drift into infinity
    if (currentState.temperature < 0) currentState.temperature += 1;
    if (currentState.temperature > 10) currentState.temperature -= 2;

    const risk = evaluateTelemetryRisk(currentState);
    currentState.storageStatus = risk.level;

    const newReading = {
        ...currentState,
        timestamp: new Date().toISOString()
    };

    telemetryHistory.push(newReading);
    if (telemetryHistory.length > HISTORY_LIMIT) {
        telemetryHistory.shift();
    }

    return newReading;
}

function getCurrentTelemetry() {
    return telemetryHistory[telemetryHistory.length - 1];
}

function getTelemetryHistory() {
    return telemetryHistory;
}

function getStorageStatus() {
    return currentState.storageStatus;
}

// Ensure the simulator updates periodically in the background (every 10s)
if (process.env.NODE_ENV !== 'test') {
    setInterval(generateTelemetry, 10000);
}

module.exports = {
    generateTelemetry,
    getCurrentTelemetry,
    evaluateTelemetryRisk,
    getTelemetryHistory,
    getStorageStatus,
    THRESHOLDS
};
