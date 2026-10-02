const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

// Accept only common image formats
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads/'));
    },
    filename: function (req, file, cb) {
        // Generate safe unique filename: random hex + original extension (if safe)
        const ext = path.extname(file.originalname).toLowerCase();
        
        // Final fallback validation for extension just in case
        const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
        
        const uniqueSuffix = crypto.randomBytes(16).toString('hex');
        cb(null, `food_${uniqueSuffix}${safeExt}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limit
    },
    fileFilter: fileFilter
});

module.exports = upload;
