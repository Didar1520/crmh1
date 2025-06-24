/* helpers.js – универсальные утилиты */

const fs   = require('fs');
const path = require('path');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function getRandomElement(arr)   { return arr[Math.floor(Math.random() * arr.length)]; }

function readArrayFromJson(filename) {
  try {
    const p = path.join(__dirname, '..', 'data', filename);
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.log(`[helpers] Не прочитан ${filename}:`, e.message);
    return [];
  }
}

async function clearAndType(page, el, txt) {
  await el.click({ clickCount: 3 });
  await el.press('Backspace');

  if (txt.length === 1) {
    await el.type(txt);
    return (await page.evaluate(n => n.value, el)) === txt;
  }

  const bulk = txt.slice(0, -1);
  const last = txt.slice(-1);

  await page.evaluate((e, v) => {
    e.value = v;
    e.dispatchEvent(new Event('input',  { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }, el, bulk);

  await el.type(last);
  return (await page.evaluate(n => n.value, el)) === txt;
}

module.exports = {
  sleep,
  getRandomInt,
  getRandomElement,
  readArrayFromJson,
  clearAndType
};
