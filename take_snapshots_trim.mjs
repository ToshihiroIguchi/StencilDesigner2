import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    
    // Select Line tool
    await page.click('#btn-line');
    
    // Draw horizontal line
    await page.mouse.move(200, 300);
    await page.mouse.down();
    await page.mouse.move(400, 300, {steps: 5});
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Draw vertical line intersecting it
    await page.mouse.move(300, 200);
    await page.mouse.down();
    await page.mouse.move(300, 400, {steps: 5});
    await page.mouse.up();
    await page.waitForTimeout(200);

    // Select Trim tool
    await page.click('#btn-trim');
    
    // Hover over right leg
    await page.mouse.move(350, 300, {steps: 5});
    await page.waitForTimeout(500);
    
    // Capture hover highlight
    await page.screenshot({ path: 'stencil_trim_hover.png' });
    
    // Click to trim
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Capture trimmed state
    await page.screenshot({ path: 'stencil_trim_result.png' });
    
    await browser.close();
    console.log('Trim screenshots captured successfully.');
})();
