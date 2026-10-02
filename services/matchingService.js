/**
 * AI-Assisted Explainable Matching Prototype
 * Provides rule-based intelligent matching between surplus food and recipients.
 */

function haversineKm(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    if (![lat1, lon1, lat2, lon2].every(v => Number.isFinite(Number(v)))) return null;
    const toRad = d => Number(d) * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseQuantityToKg(qtyStr, unit) {
    // Naive conversion for prototype purposes
    if (!qtyStr) return null;
    let num = parseFloat(qtyStr);
    if (isNaN(num)) return null;
    if (unit === 'kg') return num;
    if (unit === 'portions' || unit === 'units') return num * 0.4; // assume 400g per portion
    if (unit === 'litres') return num * 1.0;
    return num;
}

function scoreSingleMatch(food, recipient) {
    const result = {
        recipientId: recipient._id,
        recipientName: recipient.organization || recipient.name,
        matchScore: 0,
        distanceKm: null,
        quantitySuitability: 'Unknown',
        foodTypeCompatibility: 'Unknown',
        capacitySuitability: 'Unknown',
        availabilityScore: 'Unknown',
        timeSuitability: 'Unknown',
        qualitySuitability: 'Unknown',
        verificationStatus: recipient.isVerified ? 'Verified' : 'Not available',
        reasons: [],
        warnings: []
    };

    let score = 0;
    let isDisqualified = false;

    // 1. Food Type Compatibility (25%)
    if (recipient.acceptedCategories && recipient.acceptedCategories.length > 0) {
        if (recipient.acceptedCategories.includes(food.category)) {
            score += 25;
            result.foodTypeCompatibility = 'Excellent';
            result.reasons.push('Food category accepted by recipient');
        } else {
            result.foodTypeCompatibility = 'Incompatible';
            result.warnings.push('Incompatible food category');
            isDisqualified = true;
        }
    } else {
        // Fallback if no preferences set
        score += 25;
        result.foodTypeCompatibility = 'Default (Accepts all)';
        result.reasons.push('Food category accepted (no restrictions set)');
    }

    // 2. Quantity Suitability & Capacity (20% + 15%)
    const foodKg = parseQuantityToKg(food.surplusQuantity || food.quantity, food.unit);
    if (recipient.capacityKg !== null && recipient.capacityKg !== undefined) {
        if (recipient.capacityKg === 0) {
            result.capacitySuitability = 'Zero Capacity';
            result.warnings.push('Recipient capacity is zero');
            isDisqualified = true;
        } else if (foodKg !== null && foodKg > recipient.capacityKg) {
            score += 15; // Partial points
            result.quantitySuitability = 'Partial Fit';
            result.capacitySuitability = 'Exceeded';
            result.warnings.push(`Surplus (${foodKg} kg) exceeds recipient capacity (${recipient.capacityKg} kg)`);
        } else {
            score += 35; // 20 + 15
            result.quantitySuitability = 'High';
            result.capacitySuitability = 'Sufficient';
            result.reasons.push('Recipient capacity can accommodate quantity');
        }
    } else {
        score += 35; // Assume capable if not set
        result.capacitySuitability = 'Unknown';
        result.quantitySuitability = 'Assumed fit';
        result.warnings.push('Capacity information unavailable');
    }

    // 3. Distance (15%)
    result.distanceKm = haversineKm(food.latitude, food.longitude, recipient.latitude, recipient.longitude);
    if (result.distanceKm !== null) {
        result.distanceKm = Number(result.distanceKm.toFixed(1));
        if (result.distanceKm <= 5) {
            score += 15;
            result.reasons.push('Recipient is within practical pickup distance (< 5km)');
        } else if (result.distanceKm <= 15) {
            score += 10;
            result.reasons.push('Recipient is within reasonable pickup distance (< 15km)');
        } else if (result.distanceKm <= 30) {
            score += 5;
        } else {
            result.warnings.push(`Long distance pickup (${result.distanceKm} km)`);
        }
    } else {
        result.warnings.push('Location information unavailable');
    }

    // 4. Availability (10%)
    if (recipient.availabilityStatus === 'Offline' || recipient.availabilityStatus === 'Busy') {
        result.availabilityScore = recipient.availabilityStatus;
        result.warnings.push('Recipient unavailable');
        isDisqualified = true;
    } else if (recipient.availabilityStatus === 'Available') {
        score += 10;
        result.availabilityScore = 'Confirmed';
        result.reasons.push('Availability aligns with pickup window');
    } else {
        score += 10; // Fallback
        result.availabilityScore = 'Unknown';
        result.warnings.push('Recipient availability information unavailable');
    }

    // 5. Remaining Usable Time (10%)
    if (food.expiryTime) {
        const hoursLeft = (new Date(food.expiryTime).getTime() - Date.now()) / (1000 * 60 * 60);
        if (Number.isNaN(hoursLeft)) {
            result.warnings.push('Time-based suitability unavailable');
        } else if (hoursLeft <= 0) {
            result.timeSuitability = 'Expired';
            result.warnings.push('Food has expired or has zero usable time remaining');
            isDisqualified = true;
        } else if (hoursLeft < 2) {
            score += 5;
            result.timeSuitability = 'Urgent';
            result.warnings.push('Extremely limited time remaining');
        } else {
            score += 10;
            result.timeSuitability = 'Suitable';
            result.reasons.push('Sufficient usable time remaining for redistribution');
        }
    } else {
        result.warnings.push('Time-based suitability unavailable');
    }

    // 6. Verification / Reliability (5%)
    if (recipient.isVerified) {
        score += 5;
        result.reasons.push('Recipient is a verified network member');
    } else {
        result.warnings.push('Verification status unavailable or unverified');
    }

    // 7. Quality-Risk Awareness (Does not affect base score, but forces warnings)
    let riskStr = 'Unknown';
    if (food.overallRiskLevel === 'HIGH') {
        riskStr = 'High Risk';
        result.warnings.push('High quality risk detected; prioritize verification.');
    } else if (food.overallRiskLevel === 'MEDIUM') {
        riskStr = 'Medium Risk';
    } else if (food.overallRiskLevel === 'LOW') {
        riskStr = 'Low Risk';
    }
    
    if (food.humanVerificationRequired) {
        result.qualitySuitability = 'Human Verification Required';
        result.warnings.push('Human verification required before redistribution.');
    } else {
        result.qualitySuitability = riskStr;
    }

    if (isDisqualified) {
        score = 0;
    }

    result.matchScore = Math.max(0, Math.min(100, Math.round(score)));
    return result;
}

function rankRecipients(foodListing, recipients) {
    const matches = recipients.map(r => scoreSingleMatch(foodListing, r));
    // Sort descending by score
    return matches.sort((a, b) => b.matchScore - a.matchScore);
}

module.exports = {
    haversineKm,
    scoreSingleMatch,
    rankRecipients
};
