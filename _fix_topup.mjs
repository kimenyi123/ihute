import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = join(__dirname, 'app', 'supplier', 'dashboard', 'page.tsx');
let content = readFileSync(filePath, 'utf-8');

const replacements = [
  // 1. Restock priority line
  [
    '`Restock priority: "${b.name}" led today with ${b.quantity} units sold (${Number(b.total ?? 0).toLocaleString()} RWF).`',
    '`${ui.restockPriority} "${b.name}" ${ui.ledTodayWith} ${b.quantity} ${ui.unitsSold} (${Number(b.total ?? 0).toLocaleString()} RWF).`',
  ],
  // 2. Runner-up line prefix
  [
    '`Runner-up: "${b.name}"',
    '`${ui.runnerUp} "${b.name}"',
  ],
  // 3. Low stock bullet prefix
  [
    '`Low stock: ${nm}',
    '`${ui.lowStockColon} ${nm}',
  ],
  // 3b. "only X left..." part
  [
    'only ${p.stock} left. Top up before it runs out.`',
    '${ui.only} ${p.stock} ${ui.left}. ${ui.topUpBeforeRunsOut}`',
  ],
  // 4. ordersRecordedNoLines (em-dash is U+2014)
  [
    `"Orders are recorded for today, but line items were empty. Deploy the latest backend (SellerOrdersServlet fix) and refresh \u2014 best-selling names will appear here."`,
    'ui.ordersRecordedNoLines',
  ],
  // 5. fulfillOrdersTip (em-dash is U+2014)
  [
    `"Fulfill orders and keep fast movers in stock \u2014 tailored tips appear here from your live sales and inventory."`,
    'ui.fulfillOrdersTip',
  ],
  // 6. useMemo deps
  [
    '}, [analytics, supplierProducts]);',
    '}, [analytics, supplierProducts, ui]);',
  ],
];

let count = 0;
for (const [old, rep] of replacements) {
  if (content.includes(old)) {
    content = content.replace(old, rep);
    count++;
    console.log(`OK: replaced "${old.slice(0, 40)}..."`);
  } else {
    console.log(`SKIP (not found): "${old.slice(0, 60)}..."`);
  }
}

writeFileSync(filePath, content, 'utf-8');
console.log(`\nDone: ${count}/${replacements.length} replacements applied.`);
