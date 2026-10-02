/**
 * SANCHARI Food Processing & Upcycling Intelligence Service (Phase 9)
 * 
 * Provides rule-based decision support for utilization pathways based on
 * food condition, time remaining, matches, and logistics.
 * 
 * PROTOTYPE - NOT A FOOD SAFETY CERTIFICATION OR AUTONOMOUS DISPOSAL ENGINE.
 */

function recommendUtilizationPath(foodListing, context = {}) {
    const { topMatch = null, logisticsDetails = null, liveTelemetry = null } = context;

    let recommendedPath = 'ORGANIC_RECOVERY';
    let confidence = 'Low';
    let reasons = [];
    let warnings = [];
    let alternatives = [];
    let humanReviewRequired = true; // Always true for this prototype

    // 1. Time Remaining Check
    let hoursLeft = null;
    if (foodListing.expiryTime) {
        const expiry = new Date(foodListing.expiryTime).getTime();
        const now = Date.now();
        hoursLeft = Math.max(0, (expiry - now) / (1000 * 60 * 60));
    } else {
        warnings.push("Time-based processing decision unavailable.");
    }

    // 2. Quantity Check
    if (!foodListing.surplusQuantity && !foodListing.quantity) {
        warnings.push("Quantity information unavailable.");
    }

    // 3. Quality & Storage Context
    const isHighRisk = foodListing.overallRiskLevel === 'HIGH' || foodListing.qualityStatus === 'High Risk' || foodListing.qualityScore < 60;
    
    if (isHighRisk) {
        warnings.push("Human verification required before redistribution. Elevated risk detected.");
    }

    if (liveTelemetry && (liveTelemetry.temperature > 8 || liveTelemetry.humidity > 85)) {
        warnings.push("Storage conditions indicate elevated operational risk.");
    }

    // 4. Logistics and Matching Context
    const hasRecipient = !!topMatch;
    const isFeasible = logisticsDetails && logisticsDetails.feasibility !== 'NOT_FEASIBLE';

    // 5. Decision Rules
    if (hoursLeft === 0) {
        recommendedPath = 'ORGANIC_RECOVERY';
        confidence = 'High';
        reasons.push("Material has passed its safe utilization window for redistribution.");
        reasons.push("Alternative organic recovery recommended.");
    } else if (hasRecipient && isFeasible && !isHighRisk) {
        recommendedPath = 'REDISTRIBUTION';
        confidence = 'High';
        reasons.push("Suitable recipient match exists and estimated pickup is feasible.");
        if (hoursLeft !== null && hoursLeft <= 2) {
            reasons.push("Urgent redistribution required due to limited remaining time.");
        } else if (hoursLeft !== null) {
            reasons.push("Remaining time supports redistribution.");
        }
        alternatives.push("PROCESS_UPCYCLE");
    } else if (hasRecipient && isFeasible && isHighRisk) {
        recommendedPath = 'PROCESS_UPCYCLE';
        confidence = 'Medium';
        reasons.push("Redistribution candidate exists, but elevated risk requires human verification.");
        warnings.push("Consider alternative utilization pathways pending verification.");
        alternatives.push("ORGANIC_RECOVERY");
    } else {
        // Not feasible for redistribution (no match, or logistics not feasible)
        const category = (foodListing.category || foodListing.foodType || '').toLowerCase();
        
        if (category.includes('veg') || category.includes('fruit')) {
            recommendedPath = 'PROCESS_UPCYCLE';
            confidence = 'Medium';
            reasons.push(!hasRecipient ? "No suitable recipient found." : "Logistics not feasible.");
            reasons.push("Potential secondary processing or organic recovery pathway.");
            alternatives.push("ORGANIC_RECOVERY");
            warnings.push("Requires operational validation.");
        } else if (category.includes('bakery') || category.includes('bread')) {
            recommendedPath = 'PROCESS_UPCYCLE';
            confidence = 'Medium';
            reasons.push(!hasRecipient ? "No suitable recipient found." : "Logistics not feasible.");
            reasons.push("Potential secondary processing or organic recovery pathway.");
            alternatives.push("ORGANIC_RECOVERY");
            warnings.push("Requires operational validation.");
        } else if (category.includes('cooked') || category.includes('prepared')) {
            recommendedPath = 'PROCESS_UPCYCLE';
            confidence = 'Medium';
            reasons.push(!hasRecipient ? "No suitable recipient found." : "Logistics not feasible.");
            reasons.push("Potential processing/upcycling pathway.");
            alternatives.push("ORGANIC_RECOVERY");
            warnings.push("Requires operational validation.");
        } else {
            recommendedPath = 'ORGANIC_RECOVERY';
            confidence = 'Medium';
            reasons.push("Redistribution not feasible and processing not suitable.");
            reasons.push("Alternative organic recovery recommended.");
            alternatives.push("PROCESS_UPCYCLE");
        }
    }

    return {
        recommendedPath,
        confidence,
        reasons,
        warnings,
        alternatives,
        humanReviewRequired
    };
}

module.exports = {
    recommendUtilizationPath
};
