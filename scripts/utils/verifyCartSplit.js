const fs = require('fs');
const path = require('path');

// Поддержка node-fetch v2 и v3
const fetchImport = require('node-fetch');
const fetch = fetchImport.default || fetchImport;

async function getPcodes(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const finalUrl = res.url;
  const u = new URL(finalUrl);
  const pcodesParam = u.searchParams.get('pcodes');
  if (!pcodesParam) {
    throw new Error(`В URL ${url} не найден параметр pcodes`);
  }
  const segments = pcodesParam.split('_');
  const items = {};
  segments.forEach(seg => {
    const m = seg.match(/^(.+?)qty(\d+)$/);
    if (m) {
      const code = m[1];
      const qty  = parseInt(m[2], 10);
      items[code] = (items[code] || 0) + qty;
    } else {
      console.warn(`Не удалось распознать сегмент: ${seg}`);
    }
  });
  return { items, count: segments.length };
}

async function main() {
  // Путь к JSON-файлу с корзинами
  const cartsPath = path.join(__dirname, 'verifyCartSplit', 'carts.json');
  if (!fs.existsSync(cartsPath)) {
    console.error(`Файл не найден: ${cartsPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(cartsPath, 'utf8');
  let config;
  try {
    config = JSON.parse(raw);
  } catch (err) {
    console.error(`Ошибка парсинга JSON в ${cartsPath}: ${err.message}`);
    process.exit(1);
  }

  const mainUrl = config.mainCart;
  const parts  = config.dropCarts || [];
  if (!mainUrl || !parts.length) {
    console.error('В конфиге должно быть mainCart и непустой массив dropCarts');
    process.exit(1);
  }

  console.log('→ Основная корзина:', mainUrl);
  const { items: mainItems, count: mainCount } = await getPcodes(mainUrl);
  console.log(`  уникальных товаров: ${Object.keys(mainItems).length}, позиций: ${mainCount}\n`);

  const partItemsList = [];
  let totalPartCount = 0;
  for (let i = 0; i < parts.length; i++) {
    const url = parts[i];
    console.log(`→ Частичная корзина ${i+1}:`, url);
    const { items, count } = await getPcodes(url);
    console.log(`  уникальных товаров: ${Object.keys(items).length}, позиций: ${count}\n`);
    partItemsList.push(items);
    totalPartCount += count;
  }
  console.log(`Всего позиций в частичных корзинах: ${totalPartCount}\n`);

  // Слияние
  const merged = {};
  partItemsList.forEach(items => {
    for (const [code, qty] of Object.entries(items)) {
      merged[code] = (merged[code] || 0) + qty;
    }
  });

  let ok = true;
  const mainCodes = Object.keys(mainItems);
  const partCodes = Object.keys(merged);

  // Отсутствующие
  const missing = mainCodes.filter(c => !partCodes.includes(c));
  if (missing.length) {
    ok = false;
    console.error('❌ Отсутствующие товары:');
    missing.forEach(c => {
      console.error(`   • ${c}: ожидалось ${mainItems[c]}, найдено 0`);
    });
    console.error('');
  }

  // Лишние
  const extra = partCodes.filter(c => !mainCodes.includes(c));
  if (extra.length) {
    ok = false;
    console.error('❌ Лишние товары в частичных корзинах:');
    extra.forEach(c => {
      console.error(`   • ${c}: найдено ${merged[c]}`);
    });
    console.error('');
  }

  // Несоответствие по qty
  const mismatches = mainCodes.filter(c => merged[c] !== mainItems[c]);
  if (mismatches.length) {
    ok = false;
    console.error('❌ Несоответствие количества:');
    mismatches.forEach(c => {
      const exp = mainItems[c], act = merged[c]||0;
      console.error(`   • ${c}: ожидалось ${exp}, найдено ${act}`);
    });
    console.error('');
  }

  // Сравнение позиций
  if (mainCount !== totalPartCount) {
    ok = false;
    console.error(`❌ Разное число позиций: основная=${mainCount}, частичные=${totalPartCount}\n`);
  }

  if (ok) {
    console.log('✅ Разбиение прошло успешно: все товары и позиции совпадают.');
    process.exit(0);
  } else {
    console.error('🚨 Разбиение НЕ соответствует основной корзине.');
    process.exit(2);
  }
}

main().catch(err => {
  console.error('Ошибка:', err.message);
  process.exit(3);
});
