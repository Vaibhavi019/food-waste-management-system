const mongoose = require('mongoose');

const TraceabilityEventSchema = new mongoose.Schema({
    foodListingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodListing',
        required: true,
        index: true
    },
    claimId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Claim',
        default: null,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: [
            'FOOD_CREATED',
            'QUALITY_ASSESSED',
            'RECIPIENT_MATCHED',
            'LOGISTICS_ESTIMATED',
            'CLAIM_CREATED',
            'PICKUP_STARTED',
            'OTP_VERIFIED',
            'HANDOVER_COMPLETED',
            'CLAIM_CANCELLED',
            'ASSESSMENT_UPDATED',
            'UTILIZATION_PATHWAY_RECOMMENDED',
            'UTILIZATION_PATHWAY_CONFIRMED'
        ]
    },
    eventLabel: {
        type: String,
        required: true
    },
    actorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    actorRole: {
        type: String,
        default: null
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    previousEventHash: {
        type: String,
        default: null
    },
    eventHash: {
        type: String,
        required: true
    }
}, { timestamps: true });

// Compound index for chronological querying
TraceabilityEventSchema.index({ foodListingId: 1, timestamp: 1 });

module.exports = mongoose.model('TraceabilityEvent', TraceabilityEventSchema);
