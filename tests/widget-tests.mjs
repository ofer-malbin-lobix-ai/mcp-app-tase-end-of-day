/**
 * TASE MCP Widget Tests via ChatGPT Web (Puppeteer)
 *
 * Prerequisites:
 *   - Chrome running with: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome
 *       --remote-debugging-port=9226 --user-data-dir=/Users/ofermalbin/.claude/puppeteer-profile
 *   - OR run: npm run test:start-chrome
 *
 * Usage:
 *   node tests/widget-tests.mjs [test-name] [--mcp <name>]
 *
 * Options:
 *   --mcp <name>   MCP app name to use in messages (default: "eod prod")
 *                  e.g. --mcp eod-dev
 *
 * Available tests:
 *   market-end-of-day       — show-market-end-of-day-widget
 *   my-position-table       — show-my-position-table-widget (TEVA, NICE, ESLT) + period buttons
 *   market-sector-heatmap   — show-market-sector-heatmap-widget + drill-down + back
 *   my-position-candlestick — show-my-position-candlestick-widget + symbol switch + period
 *   my-position-end-of-day  — show-my-position-end-of-day-widget + sort + filters
 *   all                     — run all tests sequentially
 */

import puppeteer from 'puppeteer-core';
import { setTimeout as sleep } from 'timers/promises';
import { mkdirSync } from 'fs';

const CHROME_URL = 'http://localhost:9226';
const SCREENSHOT_DIR = '/tmp/tase-widget-tests';
mkdirSync(SCREENSHOT_DIR, { recursive: true });

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const mcpFlagIdx = args.indexOf('--mcp');
const MCP_NAME = mcpFlagIdx !== -1 ? args[mcpFlagIdx + 1] : 'eod prod';
const testArg = args.filter((_, i) => i !== mcpFlagIdx && i !== mcpFlagIdx + 1)[0] || 'all';
console.log(`Using MCP: @${MCP_NAME}`);

// ─── Helpers ────────────────────────────────────────────────────────────────

async function connectBrowser() {
  const browser = await puppeteer.connect({ browserURL: CHROME_URL });
  const pages = await browser.pages();
  const page = pages[pages.length - 1];
  await page.setViewport({ width: 1440, height: 1024 });
  return { browser, page };
}

async function newChat(page) {
  await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await sleep(3000);
}

async function sendMessage(page, message) {
  const textarea = await page.$('#prompt-textarea');
  if (!textarea) throw new Error('No textarea found');
  await textarea.click();
  await page.keyboard.type(message, { delay: 40 });
  await sleep(300);
  const sendBtn = await page.$('[data-testid="send-button"]');
  if (sendBtn) await sendBtn.click();
  else await page.keyboard.press('Enter');
}

async function waitForWidgetFrame(page, { selector = 'table, svg rect[fill]', timeout = 40000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const f of page.frames()) {
      if (f === page.mainFrame()) continue;
      try {
        const found = await f.evaluate((sel) => !!document.querySelector(sel), selector);
        if (found) return f;
      } catch(e) {}
    }
    await sleep(1000);
  }
  return null;
}

async function screenshot(page, name) {
  const path = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 ${path}`);
  return path;
}

async function clickButton(frame, label) {
  return frame.evaluate((lbl) => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === lbl);
    if (btn) { btn.click(); return true; }
    return false;
  }, label);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

async function testMarketEndOfDay(page) {
  console.log('\n🧪 Test: market-end-of-day');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show me the market end of day widget`);
  console.log('  Waiting for widget...');
  await sleep(35000);
  await screenshot(page, 'market-end-of-day');
  console.log('  ✅ market-end-of-day passed');
}

async function testMyPositionTable(page) {
  console.log('\n🧪 Test: my-position-table');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show my position table widget for symbols TEVA, NICE, ESLT`);
  console.log('  Waiting for widget...');
  await sleep(30000);
  await screenshot(page, 'my-position-table-1d');

  const frame = await waitForWidgetFrame(page, { selector: 'table' });
  if (!frame) { console.log('  ⚠️  Widget frame not found'); return; }

  for (const period of ['1W', '1M', '3M']) {
    const clicked = await clickButton(frame, period);
    console.log(`  ${clicked ? '✅' : '⚠️ '} ${period} button ${clicked ? 'clicked' : 'not found'}`);
    await sleep(6000);
    await screenshot(page, `my-position-table-${period.toLowerCase()}`);
  }
  console.log('  ✅ my-position-table passed');
}

async function testMarketSectorHeatmap(page) {
  console.log('\n🧪 Test: market-sector-heatmap');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show me the market sector heatmap widget`);
  console.log('  Waiting for widget...');
  await sleep(35000);
  await screenshot(page, 'market-sector-heatmap-sectors');

  const frame = await waitForWidgetFrame(page, { selector: 'svg rect[fill]' });
  if (!frame) { console.log('  ⚠️  Widget frame not found'); return; }

  // Click largest rect (Technology sector)
  const rects = await frame.$$('svg rect[fill]');
  let largestRect = null, maxArea = 0;
  for (const r of rects) {
    const box = await r.boundingBox();
    if (box && box.width * box.height > maxArea) { maxArea = box.width * box.height; largestRect = r; }
  }
  if (largestRect) {
    await largestRect.click();
    console.log('  ✅ Sector drill-down clicked');
    await sleep(5000);
    await screenshot(page, 'market-sector-heatmap-subsectors');

    // Click back
    const backText = await frame.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => /back|←/i.test(b.textContent));
      if (btn) { btn.click(); return btn.textContent.trim(); }
      return null;
    });
    console.log(`  ${backText ? '✅' : '⚠️ '} Back button: ${backText || 'not found'}`);
    await sleep(3000);
    await screenshot(page, 'market-sector-heatmap-back');
  }
  console.log('  ✅ market-sector-heatmap passed');
}

async function testMyPositionCandlestick(page) {
  console.log('\n🧪 Test: my-position-candlestick');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show my position candlestick widget for symbols TEVA, NICE, ESLT`);
  console.log('  Waiting for widget...');
  await sleep(40000);
  await screenshot(page, 'my-position-candlestick-eslt');

  const frame = await waitForWidgetFrame(page, { selector: 'table' });
  if (!frame) { console.log('  ⚠️  Widget frame not found'); return; }

  // Click NICE row
  const nicePeriod = await frame.evaluate(() => {
    const row = Array.from(document.querySelectorAll('tr')).find(r => r.textContent.includes('NICE'));
    if (row) { row.click(); return true; }
    return false;
  });
  console.log(`  ${nicePeriod ? '✅' : '⚠️ '} NICE symbol ${nicePeriod ? 'clicked' : 'not found'}`);
  await sleep(8000);
  await screenshot(page, 'my-position-candlestick-nice');

  // Switch to 1M period
  const clicked1M = await clickButton(frame, '1M');
  console.log(`  ${clicked1M ? '✅' : '⚠️ '} 1M period ${clicked1M ? 'clicked' : 'not found'}`);
  await sleep(6000);
  await screenshot(page, 'my-position-candlestick-1m');

  console.log('  ✅ my-position-candlestick passed');
}

async function testMyPositionEndOfDay(page) {
  console.log('\n🧪 Test: my-position-end-of-day');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show my position end of day widget for symbols TEVA, NICE, ESLT`);
  console.log('  Waiting for widget...');
  await sleep(35000);
  await screenshot(page, 'my-position-end-of-day');

  const frame = await waitForWidgetFrame(page, { selector: 'table' });
  if (!frame) { console.log('  ⚠️  Widget frame not found'); return; }

  // Sort by Chg
  const sorted = await frame.evaluate(() => {
    const header = Array.from(document.querySelectorAll('th')).find(h => h.textContent.includes('Chg'));
    if (header) { header.click(); return true; }
    return false;
  });
  console.log(`  ${sorted ? '✅' : '⚠️ '} Sort by Chg ${sorted ? 'clicked' : 'not found'}`);
  await sleep(2000);
  await screenshot(page, 'my-position-end-of-day-sorted');

  // Open Filters
  const filtersOpened = await clickButton(frame, 'Filters');
  console.log(`  ${filtersOpened ? '✅' : '⚠️ '} Filters ${filtersOpened ? 'opened' : 'not found'}`);
  await sleep(1500);
  await screenshot(page, 'my-position-end-of-day-filters');

  console.log('  ✅ my-position-end-of-day passed');
}

async function testMyPositionsManager(page) {
  console.log('\n🧪 Test: my-positions-manager');
  await newChat(page);
  await sendMessage(page, `@${MCP_NAME} show my positions manager widget`);
  console.log('  Waiting for widget...');
  await sleep(30000);

  const frame = await waitForWidgetFrame(page, { selector: 'button, .empty' });
  if (!frame) { console.log('  ⚠️  Widget frame not found'); return; }
  await screenshot(page, 'my-positions-manager-empty');

  // ── Add position ──────────────────────────────────────────────────
  const addClicked = await clickButton(frame, '+ Add Position');
  console.log(`  ${addClicked ? '✅' : '⚠️ '} Add Position button ${addClicked ? 'clicked' : 'not found'}`);
  await sleep(1000);
  await screenshot(page, 'my-positions-manager-form');

  // Fill form
  await frame.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    // Symbol, StartDate, Amount
    if (inputs[0]) { inputs[0].focus(); inputs[0].value = ''; }
  });
  await frame.type('input[placeholder="e.g. TEVA"]', 'TEVA');
  await frame.type('input[placeholder="YYYY-MM-DD"]', '2026-01-01');
  await frame.type('input[type="number"]', '100');
  await sleep(500);
  await screenshot(page, 'my-positions-manager-form-filled');

  const saved = await clickButton(frame, 'Save');
  console.log(`  ${saved ? '✅' : '⚠️ '} Save button ${saved ? 'clicked' : 'not found'}`);
  await sleep(8000);
  await screenshot(page, 'my-positions-manager-added');

  // Verify TEVA appears in table
  const hasTeva = await frame.evaluate(() => !!document.querySelector('td,tr') &&
    document.body.textContent.includes('TEVA'));
  console.log(`  ${hasTeva ? '✅' : '⚠️ '} TEVA ${hasTeva ? 'appears in table' : 'not found in table'}`);

  // ── Edit position ─────────────────────────────────────────────────
  const editClicked = await clickButton(frame, 'Edit');
  console.log(`  ${editClicked ? '✅' : '⚠️ '} Edit button ${editClicked ? 'clicked' : 'not found'}`);
  await sleep(1000);

  // Update amount to 200
  await frame.evaluate(() => {
    const input = document.querySelector('input[type="number"]');
    if (input) { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })); }
  });
  await frame.type('input[type="number"]', '200');
  await sleep(300);

  const savedEdit = await clickButton(frame, 'Save');
  console.log(`  ${savedEdit ? '✅' : '⚠️ '} Save edit ${savedEdit ? 'clicked' : 'not found'}`);
  await sleep(8000);
  await screenshot(page, 'my-positions-manager-edited');

  const has200 = await frame.evaluate(() => document.body.textContent.includes('200'));
  console.log(`  ${has200 ? '✅' : '⚠️ '} Amount updated to 200: ${has200 ? 'yes' : 'not confirmed'}`);

  // ── Delete position ───────────────────────────────────────────────
  const deleteClicked = await clickButton(frame, 'Delete');
  console.log(`  ${deleteClicked ? '✅' : '⚠️ '} Delete button ${deleteClicked ? 'clicked' : 'not found'}`);
  await sleep(8000);
  await screenshot(page, 'my-positions-manager-deleted');

  const isEmpty = await frame.evaluate(() => document.body.textContent.includes('No positions yet'));
  console.log(`  ${isEmpty ? '✅' : '⚠️ '} Empty state after delete: ${isEmpty ? 'yes' : 'not confirmed'}`);

  console.log('  ✅ my-positions-manager passed');
}

// ─── Main ────────────────────────────────────────────────────────────────────

const TEST_MAP = {
  'market-end-of-day':        testMarketEndOfDay,
  'my-position-table':        testMyPositionTable,
  'market-sector-heatmap':    testMarketSectorHeatmap,
  'my-position-candlestick':  testMyPositionCandlestick,
  'my-position-end-of-day':   testMyPositionEndOfDay,
  'my-positions-manager':     testMyPositionsManager,
};

const { browser, page } = await connectBrowser();

try {
  if (testArg === 'all') {
    for (const [name, fn] of Object.entries(TEST_MAP)) {
      await fn(page);
    }
    console.log('\n🎉 All tests completed!');
  } else if (TEST_MAP[testArg]) {
    await TEST_MAP[testArg](page);
    console.log('\n🎉 Test completed!');
  } else {
    console.error(`Unknown test: "${testArg}". Available: ${Object.keys(TEST_MAP).join(', ')}, all`);
    process.exit(1);
  }
} finally {
  await browser.disconnect();
}
