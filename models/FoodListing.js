const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema({
    donor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    itemName: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        trim: true,
        default: 'Prepared Food'
    },
    foodType: {
        type: String,
        enum: ['Vegetarian', 'Non-Vegetarian', 'Vegan', 'Mixed', 'Unknown'],
        default: 'Unknown'
    },

    // Existing human-readable quantity is retained for backward compatibility.
    quantity: {
        type: String,
        required: true,
        trim: true
    },

    // Structured quantities for AI analytics / forecasting.
    producedQuantity: {
        type: Number,
        min: 0,
        default: 0
    },
    consumedQuantity: {
        type: Number,
        min: 0,
        default: 0
    },
    surplusQuantity: {
        type: Number,
        min: 0,
        default: 0
    },
    unit: {
        type: String,
        trim: true,
        default: 'portions'
    },

    pickupLocation: {
        type: String,
        required: true,
        trim: true
    },
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    },

    // Smart storage / quality fields
    storageTempC: {
        type: Number,
        default: null
    },
    humidityPct: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    qualityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: null
    },
    qualityStatus: {
        type: String,
        enum: ['Fresh', 'Monitor', 'High Risk', 'Unknown'],
        default: 'Unknown'
    },

    // --- PHASE 5: Computer Vision & Risk Fusion ---
    imagePath: {
        type: String,
        default: null
    },
    visualRiskScore: {
        type: Number,
        default: null
    },
    visualRiskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
        default: 'UNKNOWN'
    },
    visualIndicators: [{
        type: String
    }],
    visualAssessmentConfidence: {
        type: Number,
        default: null
    },
    overallRiskScore: {
        type: Number,
        default: null
    },
    overallRiskLevel: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'UNKNOWN'],
        default: 'UNKNOWN'
    },
    riskFactors: [{
        type: String
    }],
    recommendedAction: {
        type: String,
        default: null
    },
    humanVerificationRequired: {
        type: Boolean,
        default: true
    },
    qualityAssessedAt: {
        type: Date,
        default: null
    },

    expiryTime: {
        type: Date,
        required: true
    },

    // Optional demo/operations metadata
    pickupWindowMinutes: {
        type: Number,
        min: 15,
        default: 120
    },

    status: {
        type: String,
        enum: ['available', 'claimed', 'completed', 'expired'],
        default: 'available'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('FoodListing', foodListingSchema);
