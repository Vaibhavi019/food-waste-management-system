const ejs = require('ejs');
const fs = require('fs');

const files = [
  'views/donor/dashboard.ejs',
  'views/donor/intelligence.ejs',
  'views/receiver/dashboard.ejs',
  'views/admin/dashboard.ejs',
  'views/home.ejs'
];

files.forEach(file => {
  try {
    const template = fs.readFileSync(file, 'utf8');
    ejs.compile(template);
    console.log(`${file} is valid!`);
  } catch(e) {
    console.error(`Error in ${file}:`, e.message);
  }
});
