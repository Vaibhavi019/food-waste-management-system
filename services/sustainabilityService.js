/**
 * SANCHARI Sustainability Analytics Service (Phase 10)
 * 
 * Converts ACTUAL platform records (TraceabilityEvents) into
 * transparent sustainability indicators. No fabricated data.
 */

const ENVIRONMENTAL_FACTORS = {
    // Prototype assumption: No validated environmental conversion factor configured.
    co2ePerKg: null, 
    
    // Configurable: null means unavailable/not configured.
    waterPerKg: null
};

/**
 * Parses events and listings to calculate confirmed diversion
 * @param {Array} events - Array of TraceabilityEvent objects
 * @param {Array} listings - Array of FoodListing objects (for quantity resolution)
 * @returns {Object} Structured analytics payload
 */
function getSustainabilityAnalytics(context = {}) {
    const { events = [], listings = [] } = context;

    let foodDivertedKg = 0;
    let redistributedKg = 0;
    let processedKg = 0;
    let organicRecoveryKg = 0;

    const utilizationBreakdown = {
        REDISTRIBUTION: 0,
        PROCESS_UPCYCLE: 0,
        ORGANIC_RECOVERY: 0
    };

    const warnings = [];
    const assumptions = [
        "Environmental impact values are estimates derived from configured assumptions and should not be interpreted as measured site-specific impacts.",
        `CO2e factor: ${ENVIRONMENTAL_FACTORS.co2ePerKg ? ENVIRONMENTAL_FACTORS.co2ePerKg + ' kg CO2e/kg' : 'Unavailable'}.`,
        `Water footprint factor: ${ENVIRONMENTAL_FACTORS.waterPerKg ? ENVIRONMENTAL_FACTORS.waterPerKg + ' L/kg' : 'Unavailable'}.`
    ];

    const dataCoverage = {
        quantityRecords: listings.length,
        completedHandoverRecords: 0,
        confirmedUtilizationRecords: 0,
        recommendationRecords: 0,
        environmentalFactorsConfigured: ENVIRONMENTAL_FACTORS.co2ePerKg !== null
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
        const listing = listings.find(l => l._id && l._id.toString() === listingId);
        // Use surplusQuantity if available, fallback to quantity, fallback to 0
        let qty = 0;
        if (listing) {
            qty = Number(listing.surplusQuantity) || Number(listing.quantity) || 0;
        }

        if (ev.eventType === 'HANDOVER_COMPLETED') {
            dataCoverage.completedHandoverRecords++;
            if (!processedListings.has(listingId)) {
                redistributedKg += qty;
                foodDivertedKg += qty;
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
                    processedKg += qty;
                    utilizationBreakdown.PROCESS_UPCYCLE += qty;
                    foodDivertedKg += qty;
                    processedListings.add(listingId);
                } else if (path === 'ORGANIC_RECOVERY') {
                    organicRecoveryKg += qty;
                    utilizationBreakdown.ORGANIC_RECOVERY += qty;
                    foodDivertedKg += qty;
                    processedListings.add(listingId);
                } else if (path === 'REDISTRIBUTION') {
                    // In case confirmed via utilization instead of normal handover
                    redistributedKg += qty;
                    utilizationBreakdown.REDISTRIBUTION += qty;
                    foodDivertedKg += qty;
                    processedListings.add(listingId);
                }
            }
        }
    });

    if (foodDivertedKg === 0 && events.length > 0) {
        warnings.push("No confirmed recovery/redistribution records yet.");
    } else if (events.length === 0) {
        warnings.push("No historical sustainability records available yet.");
    }

    const estimatedImpact = {
        co2eAvoidedKg: ENVIRONMENTAL_FACTORS.co2ePerKg !== null ? (foodDivertedKg * ENVIRONMENTAL_FACTORS.co2ePerKg) : null,
        waterAvoidedLiters: ENVIRONMENTAL_FACTORS.waterPerKg !== null ? (foodDivertedKg * ENVIRONMENTAL_FACTORS.waterPerKg) : null
    };

    return {
        foodDivertedKg,
        redistributedKg,
        processedKg,
        organicRecoveryKg,
        utilizationBreakdown,
        estimatedImpact,
        dataCoverage,
        assumptions,
        warnings
    };
}

module.exports = {
    getSustainabilityAnalytics,
    ENVIRONMENTAL_FACTORS
};
