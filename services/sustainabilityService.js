/**
 * SANCHARI Sustainability Analytics Service (Phase 10)
 * 
 * Converts ACTUAL platform records (TraceabilityEvents) into
 * transparent sustainability indicators. No fabricated data.
 */

const ENVIRONMENTAL_FACTORS = {
    default: {
        co2ePerKg: null,
        waterPerKg: null,
        co2eSource: null,
        waterSource: null,
        methodology: "Estimated using recorded food weight and configured food-specific environmental factors."
    },
    'Prepared Food': {
        co2ePerKg: null,
        waterPerKg: null,
        co2eSource: null,
        waterSource: null,
        methodology: "Estimated using recorded food weight and configured food-specific environmental factors."
    },
    'Vegetables': {
        co2ePerKg: 0.53,
        waterPerKg: 322,
        co2eSource: "Our World in Data / Poore & Nemecek (2018)",
        waterSource: "Water Footprint Network",
        methodology: "Estimated using recorded food weight and configured food-specific environmental factors."
    },
    'Rice': {
        co2ePerKg: 4.45,
        waterPerKg: 2497,
        co2eSource: "Our World in Data / Poore & Nemecek (2018)",
        waterSource: "Water Footprint Network",
        methodology: "Estimated using recorded food weight and configured food-specific environmental factors."
    },
    'Poultry': {
        co2ePerKg: 9.87,
        waterPerKg: 4325,
        co2eSource: "Our World in Data / Poore & Nemecek (2018)",
        waterSource: "Water Footprint Network",
        methodology: "Estimated using recorded food weight and configured food-specific environmental factors."
    }
};

/**
 * Resolves the most specific environmental factor for a food listing.
 * Priority: food-specific (itemName) -> category -> foodType -> default -> unavailable
 */
function getEnvironmentalFactor(listing) {
    let factor = ENVIRONMENTAL_FACTORS.default;
    let factorKey = 'default';

    if (!listing) {
        return { ...factor, factorKey, available: factor.co2ePerKg !== null || factor.waterPerKg !== null };
    }

    if (listing.itemName && ENVIRONMENTAL_FACTORS[listing.itemName]) {
        factor = ENVIRONMENTAL_FACTORS[listing.itemName];
        factorKey = listing.itemName;
    } else if (listing.category && ENVIRONMENTAL_FACTORS[listing.category]) {
        factor = ENVIRONMENTAL_FACTORS[listing.category];
        factorKey = listing.category;
    } else if (listing.foodType && ENVIRONMENTAL_FACTORS[listing.foodType]) {
        factor = ENVIRONMENTAL_FACTORS[listing.foodType];
        factorKey = listing.foodType;
    }

    const available = factor.co2ePerKg !== null || factor.waterPerKg !== null;
    return { ...factor, factorKey, available };
}

/**
 * Parses events and listings to calculate confirmed diversion
 * @param {Array} events - Array of TraceabilityEvent objects
 * @param {Array} listings - Array of FoodListing objects (for quantity resolution)
 * @returns {Object} Structured analytics payload
 */
function getSustainabilityAnalytics(context = {}) {
    const { events = [], listings = [] } = context;

    let foodDiverted = 0;
    let foodDivertedUnit = 'portions';
    let totalWeightKg = 0;
    let redistributed = 0;
    let processed = 0;
    let organicRecovery = 0;

    const utilizationBreakdown = {
        REDISTRIBUTION: 0,
        PROCESS_UPCYCLE: 0,
        ORGANIC_RECOVERY: 0
    };

    const warnings = [];
    const assumptions = [
        "Environmental impact values are estimates derived from configured assumptions and should not be interpreted as measured site-specific impacts."
    ];

    const dataCoverage = {
        quantityRecords: listings.length,
        completedHandoverRecords: 0,
        confirmedUtilizationRecords: 0,
        recommendationRecords: 0,
        environmentalFactorsConfigured: Object.values(ENVIRONMENTAL_FACTORS).some(f => f.co2ePerKg !== null)
    };

    let filteredEvents = events;
    if (context.startDate || context.endDate) {
        filteredEvents = events.filter(ev => {
            const evDate = new Date(ev.timestamp || Date.now());
            if (context.startDate && evDate < new Date(context.startDate)) return false;
            if (context.endDate && evDate > new Date(context.endDate)) return false;
            return true;
        });
    }

    // Prevent double counting by tracking processed foodListingIds
    const processedListings = new Set();

    filteredEvents.forEach(ev => {
        if (!ev) return;

        if (ev.eventType === 'UTILIZATION_PATHWAY_RECOMMENDED') {
            dataCoverage.recommendationRecords++;
            return; // Recommendations do not count towards actual diversion
        }

        const listingId = ev.foodListingId ? ev.foodListingId.toString() : null;
        if (!listingId) return;

        // Determine authoritative quantity
        // Determine authoritative quantity.
        // Structured surplusQuantity is preferred because it is numeric.
        // The legacy `quantity` field is a human-readable string and is
        // intentionally not parsed here.
        // Determine the authoritative quantity for sustainability calculations.
        const listing = listings.find(
            l => l._id && l._id.toString() === listingId
        );

        let qty = 0;
        let itemWeight = 0;
        let itemUnit = 'portions';

        if (listing) {
            itemUnit = listing.unit || 'portions';
            
            // Preferred: structured surplus quantity.
            if (Number(listing.surplusQuantity) > 0) {
                qty = Number(listing.surplusQuantity);
            } else {
                // Backward compatibility for older listings.
                // Examples:
                // "10"
                // "25"
                // "50 portions"
                const rawQuantity = String(listing.quantity || '');

                const match = rawQuantity.match(/[\d.]+/);

                if (match) {
                    qty = Number(match[0]) || 0;
                }
            }
            
            if (Number(listing.weightKg) > 0) {
                itemWeight = Number(listing.weightKg);
            }
        }
        if (ev.eventType === 'HANDOVER_COMPLETED') {
            dataCoverage.completedHandoverRecords++;
            if (!processedListings.has(listingId)) {
                redistributed += qty;
                foodDiverted += qty;
                totalWeightKg += itemWeight;
                foodDivertedUnit = itemUnit;
                utilizationBreakdown.REDISTRIBUTION += qty;
                processedListings.add(listingId);
            }
        }

        if (ev.eventType === 'UTILIZATION_PATHWAY_CONFIRMED') {
            dataCoverage.confirmedUtilizationRecords++;

            // The pathway should be in metadata.confirmedPath
            const path = ev.metadata && ev.metadata.confirmedPath ? ev.metadata.confirmedPath : 'UNKNOWN';

            if (!processedListings.has(listingId)) {
                if (path === 'PROCESS_UPCYCLE') {
                    processed += qty;
                    utilizationBreakdown.PROCESS_UPCYCLE += qty;
                    foodDiverted += qty;
                    totalWeightKg += itemWeight;
                    foodDivertedUnit = itemUnit;
                    processedListings.add(listingId);
                } else if (path === 'ORGANIC_RECOVERY') {
                    organicRecovery += qty;
                    utilizationBreakdown.ORGANIC_RECOVERY += qty;
                    foodDiverted += qty;
                    totalWeightKg += itemWeight;
                    foodDivertedUnit = itemUnit;
                    processedListings.add(listingId);
                } else if (path === 'REDISTRIBUTION') {
                    // In case confirmed via utilization instead of normal handover
                    redistributed += qty;
                    utilizationBreakdown.REDISTRIBUTION += qty;
                    foodDiverted += qty;
                    totalWeightKg += itemWeight;
                    foodDivertedUnit = itemUnit;
                    processedListings.add(listingId);
                }
            }
        }
    });

    if (foodDiverted === 0 && events.length > 0) {
        warnings.push("No confirmed recovery/redistribution records yet.");
    } else if (events.length === 0) {
        warnings.push("No historical sustainability records available yet.");
    }
    
    if (totalWeightKg === 0 && foodDiverted > 0) {
        warnings.push("No reliable weight (kg) data available for environmental impact calculations.");
    }

    let totalCo2e = null;
    let totalWater = null;
    const co2eSources = new Set();
    const waterSources = new Set();
    let hasCo2eFactor = false;
    let hasWaterFactor = false;
    const methodologies = new Set();

    processedListings.forEach(listingId => {
        const listing = listings.find(l => l._id && l._id.toString() === listingId);
        if (listing && Number(listing.weightKg) > 0) {
            const w = Number(listing.weightKg);
            const factorData = getEnvironmentalFactor(listing);
            
            if (factorData.methodology) methodologies.add(factorData.methodology);
            
            if (factorData.co2ePerKg !== null) {
                totalCo2e = (totalCo2e || 0) + (w * factorData.co2ePerKg);
                hasCo2eFactor = true;
                if (factorData.co2eSource) co2eSources.add(factorData.co2eSource);
            }
            
            if (factorData.waterPerKg !== null) {
                totalWater = (totalWater || 0) + (w * factorData.waterPerKg);
                hasWaterFactor = true;
                if (factorData.waterSource) waterSources.add(factorData.waterSource);
            }
        }
    });

    const factorCoverage = {
        co2e: hasCo2eFactor ? 'Environmental factor configured' : 'No validated factor configured',
        water: hasWaterFactor ? 'Environmental factor configured' : 'No validated factor configured'
    };

    const estimatedImpact = {
        totalWeightKg,
        co2eAvoidedKg: totalCo2e,
        waterAvoidedLiters: totalWater,
        co2eFactorSource: co2eSources.size > 0 ? Array.from(co2eSources).join(', ') : null,
        waterFactorSource: waterSources.size > 0 ? Array.from(waterSources).join(', ') : null,
        methodologies: Array.from(methodologies),
        factorCoverage
    };

    return {
        foodDiverted,
        foodDivertedUnit,
        totalWeightKg,
        redistributed,
        processed,
        organicRecovery,
        utilizationBreakdown,
        estimatedImpact,
        dataCoverage,
        assumptions,
        warnings
    };
}

module.exports = {
    getSustainabilityAnalytics,
    getEnvironmentalFactor,
    ENVIRONMENTAL_FACTORS
};
