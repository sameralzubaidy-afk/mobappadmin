try {
  const p = require('playwright');
  console.log('PLAYWRIGHT_OK', !!p.chromium);
} catch (e) {
  console.log('PLAYWRIGHT_ERR', e.message);
}
