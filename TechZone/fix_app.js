const fs = require('fs');

const appPath = 'c:/Users/nsr/idk/TechZone/app.js';
const carouselPath = 'c:/Users/nsr/idk/TechZone/carousel_clean.js';

try {
    const appContent = fs.readFileSync(appPath, 'utf8');
    const appLines = appContent.split('\n');

    // Find where the corruption likely starts or just take the first 1119 lines
    // Line 1119 was "}" of renderCartItems.
    // Let's verify line 1119 content to be safe.

    // Safety: just look for "function initCarousel" and cut before it if found?
    // Or stick to the hard line count if we are sure?
    // Let's stick to slicing.

    const cleanApp = appLines.slice(0, 1120).join('\n'); // Include 1119
    const carouselContent = fs.readFileSync(carouselPath, 'utf8');

    fs.writeFileSync(appPath, cleanApp + '\n' + carouselContent, 'utf8');
    console.log('Fixed app.js');
} catch (e) {
    console.error(e);
}
