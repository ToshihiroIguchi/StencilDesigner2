import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Log things in case anything fails
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);

    // Call testArrayCopy
    await page.evaluate(() => window.testArrayCopy());
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'stencil_array_programmatic.png' });
    console.log('Array programmatic screenshot taken.');

    // Reload to clear
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);

    // Call testFillet
    await page.evaluate(() => window.testFillet());
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'stencil_fillet_programmatic.png' });
    console.log('Fillet programmatic screenshot taken.');
    
    await browser.close();
})();
