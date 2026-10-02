function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * AI Forecasting Prototype
 * Uses historical consumption and production patterns.
 * Designed to be replaced by an ML model in the future.
 */

function generateForecast(listings) {
    const structured = listings.filter(x => toNumber(x.producedQuantity) > 0);
    
    if (structured.length === 0) {
        return {
            forecast: {
                predictedDemand: 0,
                confidenceScore: 0,
                confidenceLevel: 'LOW'
            },
            surplus: {
                expectedProduction: 0,
                predictedSurplus: 0,
                riskLevel: 'LOW'
            },
            recommendation: {
                recommendedProduction: 0,
                action: 'Not enough historical data to generate a reliable forecast. Please register production records.'
            },
            explanation: {
                summary: 'Limited historical data — forecast confidence is reduced.',
                factors: ['No historical production records found.']
            }
        };
    }

    // Sort ascending by date to get chronological order for trend
    structured.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    let totalProduced = 0;
    let totalConsumed = 0;
    
    const recentConsumptions = [];
    
    structured.forEach(item => {
        const p = toNumber(item.producedQuantity);
        // if consumedQuantity is not set properly, estimate it from produced - surplus
        let c = toNumber(item.consumedQuantity);
        if (c === 0 && toNumber(item.surplusQuantity) > 0) {
             c = Math.max(0, p - toNumber(item.surplusQuantity));
        } else if (c === 0 && item.status === 'completed') {
             c = p;
        }

        totalProduced += p;
        totalConsumed += c;
        recentConsumptions.push(c);
    });

    // We take the last 5 records for recent trend
    const recent = recentConsumptions.slice(-5);
    const recentAvgDemand = recent.reduce((a, b) => a + b, 0) / recent.length;
    
    const historicalAvgDemand = totalConsumed / structured.length;
    const historicalAvgProduction = totalProduced / structured.length;

    // Weighted Demand: 70% recent trend, 30% historical average
    const predictedDemand = Math.round((recentAvgDemand * 0.7) + (historicalAvgDemand * 0.3)) || 10;
    
    // Safety buffer for recommendation (e.g. 5%)
    const recommendedProduction = Math.round(predictedDemand * 1.05);

    // Expected production is assumed to be what they typically produce (historical avg)
    const expectedProduction = Math.round(historicalAvgProduction);
    const predictedSurplus = Math.max(0, expectedProduction - predictedDemand);

    // Confidence Calculation
    let confidenceScore = 50;
    if (structured.length > 10) confidenceScore += 25;
    else if (structured.length > 3) confidenceScore += 10;

    // Variance check - lower confidence if demand fluctuates wildly
    if (recent.length >= 2) {
        const max = Math.max(...recent);
        const min = Math.min(...recent);
        if (max - min < (recentAvgDemand * 0.2)) {
            confidenceScore += 15; // Stable demand
        } else if (max - min > (recentAvgDemand * 0.5)) {
            confidenceScore -= 15; // Volatile demand
        }
    }

    confidenceScore = Math.min(95, Math.max(10, Math.round(confidenceScore)));
    
    let confidenceLevel = 'LOW';
    if (confidenceScore >= 75) confidenceLevel = 'HIGH';
    else if (confidenceScore >= 50) confidenceLevel = 'MEDIUM';

    // Risk Calculation
    let riskLevel = 'LOW';
    let surplusRiskMsg = '';
    const surplusRatio = expectedProduction > 0 ? (predictedSurplus / expectedProduction) : 0;
    
    if (surplusRatio > 0.15) {
        riskLevel = 'HIGH';
        surplusRiskMsg = 'Reduce planned production or prepare redistribution capacity immediately.';
    } else if (surplusRatio > 0.05) {
        riskLevel = 'MEDIUM';
        surplusRiskMsg = 'Monitor production levels and prepare for potential surplus matching.';
    } else {
        surplusRiskMsg = 'Production aligns closely with expected demand. Minor surplus expected.';
    }

    let summary = 'Demand is estimated from recent consumption patterns and historical behavior.';
    if (structured.length < 3) {
        summary = 'Limited historical data — forecast confidence is reduced.';
    }

    const action = recommendedProduction < expectedProduction 
        ? `Reduce planned production by approximately ${Math.round((1 - (recommendedProduction / expectedProduction)) * 100)}%.`
        : `Production levels are optimal. Recommend preparing ${recommendedProduction} portions.`;

    const factors = [
        `Historical production-consumption ratio: ${Math.round((totalConsumed / (totalProduced || 1)) * 100)}% utilization.`,
        `Recent consumption trend average: ${Math.round(recentAvgDemand)} portions.`,
        `Historical baseline demand: ${Math.round(historicalAvgDemand)} portions.`
    ];

    if (recent.length >= 2 && recent[recent.length - 1] > recent[0]) {
        factors.push('Short-term trend indicates increasing demand.');
    } else if (recent.length >= 2 && recent[recent.length - 1] < recent[0]) {
        factors.push('Short-term trend indicates decreasing demand.');
    }

    return {
        forecast: {
            predictedDemand,
            confidenceScore,
            confidenceLevel
        },
        surplus: {
            expectedProduction,
            predictedSurplus,
            riskLevel
        },
        recommendation: {
            recommendedProduction,
            action
        },
        explanation: {
            summary,
            factors
        }
    };
}

module.exports = {
    generateForecast
};
