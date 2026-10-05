const ejs = require('ejs');
const fs = require('fs');

const files = [
    './views/receiver/dashboard.ejs',
    './views/donor/dashboard.ejs',
    './views/donor/intelligence.ejs',
    './views/receiver/available-food.ejs',
    './views/home.ejs'
];

files.forEach(file => {
    try {
        const content = fs.readFileSync(file, 'utf8');
        ejs.compile(content);
        console.log(`${file} compiled successfully.`);
    } catch (err) {
        console.error(`Error compiling ${file}:`, err);
        process.exit(1);
    }
});
