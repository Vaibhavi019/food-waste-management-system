/**
 * Smart Logistics Engine Prototype (Phase 7)
 * Estimates pickup feasibility, travel time, and ETA deterministically.
 * Does NOT use real-time traffic or live GPS.
 */

const { haversineKm } = require('./matchingService');

// Configurable prototype assumptions
const AVERAGE_SPEED_KMH = 25;
const LOADING_BUFFER_MINUTES = 10; // Time assumed for handover/loading

function calculateLogistics(food, recipient, options = {}) {
    const refTime = options.referenceTime ? new Date(options.referenceTime).getTime() : Date.now();

    const result = {
        distanceKm: null,
        estimatedTravelMinutes: null,
        estimatedArrivalTime: null,
        pickupWindowMinutes: null,
        remainingUsableMinutes: null,
        feasibility: 'UNKNOWN',
        logisticsPriority: 'UNKNOWN',
        bufferMinutes: LOADING_BUFFER_MINUTES,
        reasons: [],
        warnings: []
    };

    // 1. Distance Calculation
    if (food.latitude != null && food.longitude != null && recipient.latitude != null && recipient.longitude != null) {
        result.distanceKm = haversineKm(food.latitude, food.longitude, recipient.latitude, recipient.longitude);
        if (result.distanceKm !== null) {
            result.distanceKm = Number(result.distanceKm.toFixed(1));
        }
    } else {
        result.warnings.push('Location information unavailable');
    }

    // 2. Travel-time Estimation & ETA
    if (result.distanceKm !== null) {
        // Simple linear estimation
        result.estimatedTravelMinutes = Math.round((result.distanceKm / AVERAGE_SPEED_KMH) * 60);

        const totalMinutes = result.estimatedTravelMinutes + result.bufferMinutes;
        result.estimatedArrivalTime = new Date(refTime + totalMinutes * 60000).toISOString();
        result.reasons.push(`Estimated travel time: ${result.estimatedTravelMinutes} mins (Prototype ETA based on ${AVERAGE_SPEED_KMH} km/h average speed)`);
    } else {
        result.warnings.push('Distance unavailable; cannot estimate travel time');
    }

    // 3. Pickup Window
    if (food.pickupWindowMinutes != null && Number.isFinite(Number(food.pickupWindowMinutes)) && food.pickupWindowMinutes > 0) {
        result.pickupWindowMinutes = Number(food.pickupWindowMinutes);

        if (result.estimatedTravelMinutes !== null) {
            const requiredTime = result.estimatedTravelMinutes + result.bufferMinutes;
            if (requiredTime > result.pickupWindowMinutes) {
                result.feasibility = 'NOT_FEASIBLE';
                result.warnings.push(`Estimated travel time (${requiredTime}m) exceeds donor pickup window (${result.pickupWindowMinutes}m)`);
            } else if (requiredTime > result.pickupWindowMinutes * 0.75) {
                result.feasibility = 'TIGHT';
                result.reasons.push('Travel fits within pickup window but margin is tight');
            } else {
                result.feasibility = 'FEASIBLE';
                result.reasons.push('Travel easily fits within the stated pickup window');
            }
        }
    } else {
        result.warnings.push('Pickup window information unavailable');
    }

    // 4. Expiry / Remaining Time
    if (food.expiryTime) {
        const expiryTimeMs = new Date(food.expiryTime).getTime();

        if (Number.isNaN(expiryTimeMs)) {
            result.warnings.push('Time-based feasibility unavailable (Invalid expiry time)');
        } else {
            const remainingMs = expiryTimeMs - refTime;
            result.remainingUsableMinutes = Math.floor(remainingMs / 60000);

            if (result.remainingUsableMinutes <= 0) {
                result.feasibility = 'NOT_FEASIBLE';
                result.warnings.push('Food has expired or has zero usable time remaining');
            } else if (result.estimatedTravelMinutes !== null) {
                const requiredTime = result.estimatedTravelMinutes + result.bufferMinutes;

                if (requiredTime > result.remainingUsableMinutes) {
                    result.feasibility = 'NOT_FEASIBLE';
                    result.warnings.push(`Estimated travel time (${requiredTime}m) exceeds remaining usable time (${result.remainingUsableMinutes}m)`);
                } else if (result.feasibility === 'UNKNOWN' || result.feasibility === 'FEASIBLE') {
                    // Update feasibility if it hasn't failed the pickup window check
                    if (requiredTime > result.remainingUsableMinutes * 0.75) {
                        result.feasibility = 'TIGHT';
                        result.warnings.push('Tight deadline for usable time');
                    } else if (result.feasibility === 'UNKNOWN') {
                        result.feasibility = 'FEASIBLE';
                    }
                }
            }
        }
    } else {
        result.warnings.push('Time-based feasibility unavailable');
    }

    // 5. Quality-Risk Integration
    if (food.humanVerificationRequired) {
        result.warnings.push('Human verification required before redistribution.');
    }
    if (food.overallRiskLevel === 'HIGH') {
        result.warnings.push('High quality-risk assessment requires verification before dispatch.');
        if (result.feasibility !== 'NOT_FEASIBLE') {
            result.feasibility = 'TIGHT'; // Downgrade feasibility due to risk block
        }
    }

    // 6. Logistics Priority
    if (result.feasibility === 'NOT_FEASIBLE') {
        result.logisticsPriority = 'LOW';
        result.reasons.push('Not feasible due to time constraints or expired food');
    } else if (result.remainingUsableMinutes !== null && result.remainingUsableMinutes < 120) {
        result.logisticsPriority = 'URGENT';
        result.reasons.push(`Only ${result.remainingUsableMinutes} minutes remain — prioritize pickup`);
    } else if (food.overallRiskLevel === 'HIGH') {
        result.logisticsPriority = 'URGENT';
        result.reasons.push('High quality risk detected; immediate action required if verified');
    } else if (result.feasibility === 'TIGHT' || (result.pickupWindowMinutes !== null && result.pickupWindowMinutes <= 60)) {
        result.logisticsPriority = 'HIGH';
        result.reasons.push('Tight logistics timeline requires priority execution');
    } else if (result.feasibility === 'FEASIBLE') {
        result.logisticsPriority = 'NORMAL';
        result.reasons.push('Routine redistribution logistics');
    } else {
        result.logisticsPriority = 'UNKNOWN';
    }

    return result;
}

module.exports = {
    calculateLogistics,
    AVERAGE_SPEED_KMH,
    LOADING_BUFFER_MINUTES
};
