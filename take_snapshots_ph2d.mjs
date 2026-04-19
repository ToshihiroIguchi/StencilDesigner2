import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    
    // Draw a rectangle
    await page.click('#btn-rect');
    await page.mouse.move(200, 200);
    await page.mouse.down();
    await page.mouse.move(250, 250, {steps: 5});
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Array copy it
    await page.click('#btn-select');
    await page.mouse.move(190, 190);
    await page.mouse.down();
    await page.mouse.move(260, 260, {steps: 5});
    await page.mouse.up(); // Rect selected
    await page.waitForTimeout(500);

    await page.fill('#array-rows', '2');
    await page.fill('#array-cols', '3');
    await page.fill('#array-px', '20'); // pitch 20mm -> 1000px, wait that's too big! It's model scale (mm).
    // Viewport zoom is 50px/mm. 
    await page.fill('#array-px', '4');  // 4mm -> 200px
    await page.fill('#array-py', '-2'); // -2mm -> 100px (Y-up)
    
    await page.click('#btn-array-exec');
    await page.waitForTimeout(500);
    
    // Capture array result
    await page.screenshot({ path: 'stencil_array_result.png' });

    // Click fillet tool
    await page.click('#btn-fillet');
    
    // Hover top-left corner of the first rectangle (model coords approx, screen is 200, 200)
    await page.mouse.move(200, 200, {steps: 5});
    await page.waitForTimeout(500);
    
    // Capture hover highlight
    await page.screenshot({ path: 'stencil_fillet_hover.png' });
    
    // Click to fillet
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Capture fillet result
    await page.screenshot({ path: 'stencil_fillet_result.png' });
    
    await browser.close();
    console.log('Phase 2-D screenshots captured successfully.');
})();
