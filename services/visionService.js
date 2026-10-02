/**
 * AI-Assisted Quality Risk Assessment Service (Prototype)
 * 
 * IMPORTANT: This is a prototype visual analysis service. 
 * It is NOT a trained food-spoilage classifier and does NOT guarantee food safety.
 * Designed to be replaced by a trained ML model in production.
 */

function assessFoodImage(imagePath) {
    // In a real implementation, this would pass the image to a TensorFlow/PyTorch model.
    // For this prototype, we mock a deterministic visual risk score based on the filename length 
    // just to have deterministic but varying results for testing/demo.
    const hash = imagePath ? imagePath.length % 100 : 50; 
    
    let visualRiskScore = 90; // Default good
    let riskLevel = 'LOW';
    const indicators = ['Prototype analysis: Visual appearance matches baseline.'];

    // Mock some variations
    if (hash < 15) {
        visualRiskScore = 30;
        riskLevel = 'HIGH';
        indicators.push('Prototype visual anomaly indicator: Surface deviation.');
        indicators.push('Prototype visual anomaly indicator: Texture variation.');
    } else if (hash < 40) {
        visualRiskScore = 65;
        riskLevel = 'MEDIUM';
        indicators.push('Prototype visual anomaly indicator: Minor deviation.');
    }

    return {
        visualRiskScore,
        riskLevel,
        visualIndicators: indicators,
        confidence: 82, // Prototype confidence
        limitations: 'Prototype visual analysis — not a trained food-spoilage classifier.'
    };
}

function calculateOverallRisk(visualAssessment, storageRisk, expiryTime) {
    const riskFactors = [];
    let overallRiskLevel = 'LOW';
    let overallRiskScore = visualAssessment.visualRiskScore;

    // 1. Visual factors
    if (visualAssessment.riskLevel === 'HIGH') {
        riskFactors.push('Visual inspection requires immediate attention.');
        overallRiskLevel = 'HIGH';
    } else if (visualAssessment.riskLevel === 'MEDIUM') {
        riskFactors.push('Visual indicators suggest minor quality degradation.');
        if (overallRiskLevel !== 'HIGH') overallRiskLevel = 'MEDIUM';
    }

    // 2. Storage factors (from IoT)
    if (storageRisk && storageRisk.level === 'CRITICAL') {
        riskFactors.push('Storage temperature has critically exceeded target range.');
        overallRiskLevel = 'HIGH';
        overallRiskScore -= 40;
    } else if (storageRisk && storageRisk.level === 'WARNING') {
        riskFactors.push('Storage telemetry requires attention.');
        if (overallRiskLevel !== 'HIGH') overallRiskLevel = 'MEDIUM';
        overallRiskScore -= 15;
    }

    // 3. Time factors
    const now = Date.now();
    const expiry = new Date(expiryTime).getTime();
    
    if (!expiryTime || Number.isNaN(expiry)) {
        riskFactors.push('Time-based risk unavailable.');
    } else {
        const hoursLeft = (expiry - now) / (1000 * 60 * 60);
        if (hoursLeft < 0) {
            riskFactors.push('Food has exceeded its safe usability window.');
            overallRiskLevel = 'HIGH';
            overallRiskScore = 0;
        } else if (hoursLeft < 2) {
            riskFactors.push('Extremely limited usable time remaining (< 2 hours).');
            overallRiskLevel = 'HIGH';
            overallRiskScore -= 30;
        } else if (hoursLeft < 6) {
            riskFactors.push('Limited usable time remaining (< 6 hours).');
            if (overallRiskLevel !== 'HIGH') overallRiskLevel = 'MEDIUM';
            overallRiskScore -= 10;
        }
    }

    overallRiskScore = Math.max(0, Math.min(100, overallRiskScore));

    // Force High risk if score drops below 50
    if (overallRiskScore < 50) overallRiskLevel = 'HIGH';

    let recommendedAction = 'Proceed with standard redistribution routing.';
    if (overallRiskLevel === 'HIGH') {
        recommendedAction = 'Do not redistribute until physical inspection is completed. High quality risk detected.';
    } else if (overallRiskLevel === 'MEDIUM') {
        recommendedAction = 'Inspect the food manually and verify storage conditions before redistribution.';
    }

    return {
        overallRiskScore,
        overallRiskLevel,
        riskFactors,
        recommendedAction,
        humanVerificationRequired: true // ALWAYS TRUE for the prototype
    };
}

module.exports = {
    assessFoodImage,
    calculateOverallRisk
};
