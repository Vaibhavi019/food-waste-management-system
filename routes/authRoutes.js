const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET /register
router.get('/register', (req, res) => {
    res.render('register');
});

// POST /register
router.post('/register', async (req, res) => {
    try {
        const { name, username, email, phone, password, confirmPassword, role, organization, latitude, longitude } = req.body;

        // Validation
        if (!name || !username || !email || !phone || !password || !role) {
            req.session.error = 'All fields are required.';
            return res.redirect('/register');
        }

        if (password !== confirmPassword) {
            req.session.error = 'Passwords do not match.';
            return res.redirect('/register');
        }

        if (password.length < 6) {
            req.session.error = 'Password must be at least 6 characters.';
            return res.redirect('/register');
        }

        // Check existing user
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            req.session.error = 'Username or email already exists.';
            return res.redirect('/register');
        }

        // Create user
        await User.create({
            name,
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            phone,
            password,
            role,
            organization: organization || '',
            latitude: latitude === '' || latitude === undefined || !Number.isFinite(Number(latitude)) ? null : Number(latitude),
            longitude: longitude === '' || longitude === undefined || !Number.isFinite(Number(longitude)) ? null : Number(longitude)
        });

        req.session.success = 'Registration successful! Please log in.';
        res.redirect('/login');
    } catch (err) {
        console.error('Registration error:', err);
        req.session.error = 'Registration failed. Please try again.';
        res.redirect('/register');
    }
});

// GET /login
router.get('/login', (req, res) => {
    if (req.session.userId) {
        return res.redirect('/');
    }
    const role = req.query.role || '';
    res.render('login', { role });
});

// POST /login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            req.session.error = 'Username and password are required.';
            return res.redirect('/login');
        }

        const user = await User.findOne({ username: username.toLowerCase() });
        if (!user) {
            req.session.error = 'Invalid username or password.';
            return res.redirect('/login');
        }

        if (user.isBlocked) {
            req.session.error = 'Your account has been blocked. Contact admin.';
            return res.redirect('/login');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            req.session.error = 'Invalid username or password.';
            return res.redirect('/login');
        }

        // Regenerate session for security and to avoid stale session issues
        const userData = {
            userId: user._id,
            username: user.username,
            role: user.role,
            name: user.name,
            latitude: user.latitude,
            longitude: user.longitude,
            isVerified: user.isVerified
        };

        req.session.regenerate((err) => {
            if (err) {
                console.error('Session regenerate error:', err);
                return res.redirect('/');
            }
            req.session.userId = userData.userId;
            req.session.username = userData.username;
            req.session.role = userData.role;
            req.session.name = userData.name;
            req.session.latitude = userData.latitude;
            req.session.longitude = userData.longitude;
            req.session.isVerified = userData.isVerified;
            req.session.success = `Welcome back, ${userData.name}!`;

            req.session.save((err) => {
                if (err) console.error('Session save error:', err);
                return res.redirect('/');
            });
        });
    } catch (err) {
        console.error('Login error:', err);
        req.session.error = 'Login failed. Please try again.';
        res.redirect('/login');
    }
});

// GET /logout
router.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) console.error('Logout error:', err);
        res.redirect('/');
    });
});

module.exports = router;
