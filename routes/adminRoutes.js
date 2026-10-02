const express = require('express');
const router = express.Router();
const { isLoggedIn, isAdmin } = require('../middleware/auth');
const User = require('../models/User');
const FoodListing = require('../models/FoodListing');
const Claim = require('../models/Claim');
const TraceabilityEvent = require('../models/TraceabilityEvent');
const { getSustainabilityAnalytics } = require('../services/sustainabilityService');

// GET /admin/dashboard
router.get('/dashboard', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const totalDonors = await User.countDocuments({ role: 'donor' });
        const totalReceivers = await User.countDocuments({ role: 'receiver' });
        const totalListings = await FoodListing.countDocuments();
        const availableListings = await FoodListing.countDocuments({ status: 'available' });
        const completedDonations = await FoodListing.countDocuments({ status: 'completed' });
        const totalClaims = await Claim.countDocuments();
        const blockedUsers = await User.countDocuments({ isBlocked: true });
        const verifiedNGOs = await User.countDocuments({ role: 'receiver', isVerified: true });
        
        // Phase 8: Traceability Overview
        const totalTraceabilityEvents = await TraceabilityEvent.countDocuments();
        const completedHandovers = await TraceabilityEvent.countDocuments({ eventType: 'HANDOVER_COMPLETED' });

        // Phase 9: Processing Intelligence
        const processingRecsCount = await TraceabilityEvent.countDocuments({ eventType: 'UTILIZATION_PATHWAY_RECOMMENDED' });

        // Phase 10: Sustainability Analytics
        const allListings = await FoodListing.find().lean();
        const allEvents = await TraceabilityEvent.find().lean();
        const sustainabilityAnalytics = getSustainabilityAnalytics({
            events: allEvents,
            listings: allListings
        });

        res.render('admin/dashboard', {
            stats: {
                totalDonors,
                totalReceivers,
                totalListings,
                availableListings,
                completedDonations,
                totalClaims,
                blockedUsers,
                verifiedNGOs,
                totalTraceabilityEvents,
                completedHandovers,
                processingRecsCount
            },
            impact: sustainabilityAnalytics
        });
    } catch (err) {
        console.error('Admin dashboard error:', err);
        req.session.error = 'Error loading admin dashboard.';
        res.redirect('/');
    }
});

// GET /admin/users
router.get('/users', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const roleFilter = req.query.role || '';
        const query = { role: { $ne: 'admin' } };
        if (roleFilter) query.role = roleFilter;

        const users = await User.find(query).sort({ createdAt: -1 });
        res.render('admin/users', { users, roleFilter });
    } catch (err) {
        console.error('Admin users error:', err);
        req.session.error = 'Error loading users.';
        res.redirect('/admin/dashboard');
    }
});

// POST /admin/block-user/:id
router.post('/block-user/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role === 'admin') {
            req.session.error = 'User not found or cannot block admin.';
            return res.redirect('/admin/users');
        }

        user.isBlocked = !user.isBlocked;
        await user.save();

        req.session.success = `User ${user.username} has been ${user.isBlocked ? 'blocked' : 'unblocked'}.`;
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Block user error:', err);
        req.session.error = 'Error updating user status.';
        res.redirect('/admin/users');
    }
});

// POST /admin/delete-user/:id
router.post('/delete-user/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role === 'admin') {
            req.session.error = 'User not found or cannot delete admin.';
            return res.redirect('/admin/users');
        }

        await User.findByIdAndDelete(req.params.id);

        req.session.success = `User ${user.username} has been deleted.`;
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Delete user error:', err);
        req.session.error = 'Error deleting user.';
        res.redirect('/admin/users');
    }
});

// GET /admin/listings
router.get('/listings', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const statusFilter = req.query.status || '';
        const query = {};
        if (statusFilter) query.status = statusFilter;

        const listings = await FoodListing.find(query)
            .populate('donor', 'name username')
            .sort({ createdAt: -1 });

        res.render('admin/listings', { listings, statusFilter });
    } catch (err) {
        console.error('Admin listings error:', err);
        req.session.error = 'Error loading listings.';
        res.redirect('/admin/dashboard');
    }
});

// POST /admin/remove-listing/:id
router.post('/remove-listing/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        await FoodListing.findByIdAndDelete(req.params.id);
        req.session.success = 'Food listing removed successfully.';
        res.redirect('/admin/listings');
    } catch (err) {
        console.error('Remove listing error:', err);
        req.session.error = 'Error removing listing.';
        res.redirect('/admin/listings');
    }
});

// POST /admin/verify-ngo/:id
router.post('/verify-ngo/:id', isLoggedIn, isAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user || user.role !== 'receiver') {
            req.session.error = 'User not found or not a receiver.';
            return res.redirect('/admin/users');
        }

        user.isVerified = !user.isVerified;
        await user.save();

        req.session.success = `${user.name} has been ${user.isVerified ? 'verified' : 'unverified'}.`;
        res.redirect('/admin/users');
    } catch (err) {
        console.error('Verify NGO error:', err);
        req.session.error = 'Error updating verification status.';
        res.redirect('/admin/users');
    }
});

module.exports = router;
