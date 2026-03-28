const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('http://localhost:3001', { waitUntil: 'domcontentloaded' });
    console.log('PLAYWRIGHT_LAUNCH_OK', await page.title());
    await browser.close();
  } catch (e) {
    console.log('PLAYWRIGHT_LAUNCH_ERR', e.message);
    process.exit(1);
  }
})();
