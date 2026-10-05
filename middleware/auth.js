// Authentication middleware

// Check if user is logged in
function isLoggedIn(req, res, next) {
    if (req.session && req.session.userId) {
        return next();
    }
    req.session.error = 'Please log in to access this page.';
    return res.redirect('/login');
}

// Check if user is a donor
function isDonor(req, res, next) {
    if (req.session && req.session.role === 'donor') {
        return next();
    }
    req.session.error = 'Access denied. Donors only.';
    return res.redirect('/login');
}

// Check if user is a receiver
function isReceiver(req, res, next) {
    if (req.session && req.session.role === 'receiver') {
        return next();
    }
    req.session.error = 'Access denied. Receivers only.';
    return res.redirect('/login');
}

// Check if user is an admin
function isAdmin(req, res, next) {
    if (req.session && req.session.role === 'admin') {
        return next();
    }
    req.session.error = 'Access denied. Admins only.';
    return res.redirect('/login');
}

module.exports = { isLoggedIn, isDonor, isReceiver, isAdmin };
