import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:5173/');
    await page.waitForTimeout(1000);
    
    // Select Rect tool
    await page.click('#btn-rect');
    
    // Draw rect
    await page.mouse.move(300, 300);
    await page.mouse.down();
    await page.mouse.move(400, 400, {steps: 5});
    await page.mouse.up();
    await page.waitForTimeout(500);

    // Select Select tool
    await page.click('#btn-select');
    
    // Draw selection box
    await page.mouse.move(250, 250);
    await page.mouse.down();
    await page.mouse.move(450, 450, {steps: 10});
    await page.waitForTimeout(500);
    
    // Capture selection box
    await page.screenshot({ path: 'stencil_selection_box.png' });
    
    // Finalize selection
    await page.mouse.up();
    await page.waitForTimeout(500);
    
    // Capture highlighted selection
    await page.screenshot({ path: 'stencil_selection_highlighted.png' });
    
    await browser.close();
    console.log('Screenshots captured successfully.');
})();
