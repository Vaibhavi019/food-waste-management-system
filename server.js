require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

const User = require('./models/User');
const FoodListing = require('./models/FoodListing');

const authRoutes = require('./routes/authRoutes');
const donorRoutes = require('./routes/donorRoutes');
const receiverRoutes = require('./routes/receiverRoutes');
const adminRoutes = require('./routes/adminRoutes');
const iotRoutes = require('./routes/iotRoutes');
const processingRoutes = require('./routes/processingRoutes');
const sustainabilityRoutes = require('./routes/sustainabilityRoutes');

const app = express();

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback_secret',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foodwaste'
    }),
    cookie: { maxAge: 1000 * 60 * 60 * 24 } // 1 day
}));

// Make session data available in all views
app.use((req, res, next) => {
    res.locals.currentUser = req.session.userId ? {
        id: req.session.userId,
        username: req.session.username,
        role: req.session.role,
        name: req.session.name
    } : null;
    res.locals.success = req.session.success || null;
    res.locals.error = req.session.error || null;
    delete req.session.success;
    delete req.session.error;
    next();
});

// Routes
app.get('/', (req, res) => {
    res.render('home');
});

app.use('/', authRoutes);
app.use('/donor', donorRoutes);
app.use('/receiver', receiverRoutes);
app.use('/admin', adminRoutes);
app.use('/api/iot', iotRoutes);
app.use('/api/processing', processingRoutes);
app.use('/api/sustainability', sustainabilityRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).render('404');
});

// Connect to MongoDB and start server
const PORT = process.env.PORT || 3000;

mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/foodwaste')
    .then(async () => {
        console.log('Connected to MongoDB');

        // Seed admin user if not exists
        const adminExists = await User.findOne({ role: 'admin' });
        if (!adminExists) {
            await User.create({
                name: 'Admin',
                username: 'admin',
                email: 'admin@foodwaste.com',
                phone: '0000000000',
                password: 'admin123',
                role: 'admin',
                isVerified: true
            });
            console.log('Default admin created: admin / admin123');
        }

        // Auto-expire food listings every minute
        setInterval(async () => {
            try {
                const now = new Date();
                await FoodListing.updateMany(
                    { status: 'available', expiryTime: { $lte: now } },
                    { $set: { status: 'expired' } }
                );
            } catch (err) {
                console.error('Auto-expire error:', err.message);
            }
        }, 60 * 1000); // every 60 seconds

        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    });
