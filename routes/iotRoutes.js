const express = require('express');
const router = express.Router();
const { isLoggedIn, isDonor } = require('../middleware/auth');
const iotService = require('../services/iotService');

// GET /api/iot/telemetry
router.get('/telemetry', isLoggedIn, isDonor, (req, res) => {
    try {
        const current = iotService.getCurrentTelemetry();
        const risk = iotService.evaluateTelemetryRisk(current);
        const history = iotService.getTelemetryHistory();

        res.json({
            current,
            risk,
            history
        });
    } catch (err) {
        console.error('IoT Telemetry error:', err);
        res.status(500).json({ error: 'Failed to retrieve telemetry' });
    }
});

module.exports = router;
