import os

path = os.path.join(os.path.dirname(__file__), 'app', 'supplier', 'dashboard', 'page.tsx')
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace: Restock priority line
old1 = '`Restock priority: "${b.name}" led today with ${b.quantity} units sold (${Number(b.total ?? 0).toLocaleString()} RWF).`'
new1 = '`${ui.restockPriority} "${b.name}" ${ui.ledTodayWith} ${b.quantity} ${ui.unitsSold} (${Number(b.total ?? 0).toLocaleString()} RWF).`'
assert old1 in content, "Could not find Restock priority line"
content = content.replace(old1, new1)

# 2. Replace: Runner-up line prefix
old2 = '`Runner-up: "${b.name}"'
new2 = '`${ui.runnerUp} "${b.name}"'
assert old2 in content, "Could not find Runner-up line"
content = content.replace(old2, new2)

# 3. Replace: Low stock bullet
old3 = '`Low stock: ${nm}'
new3 = '`${ui.lowStockColon} ${nm}'
assert old3 in content, "Could not find Low stock line"
content = content.replace(old3, new3)

old3b = 'only ${p.stock} left. Top up before it runs out.`'
new3b = '${ui.only} ${p.stock} ${ui.left}. ${ui.topUpBeforeRunsOut}`'
assert old3b in content, "Could not find 'only X left' part"
content = content.replace(old3b, new3b)

# 4. Replace: ordersRecordedNoLines push
old4 = '''      bullets.push(
        "Orders are recorded for today, but line items were empty. Deploy the latest backend (SellerOrdersServlet fix) and refresh \u2014 best-selling names will appear here.",
      );'''
new4 = '      bullets.push(ui.ordersRecordedNoLines);'
assert old4 in content, "Could not find ordersRecordedNoLines push"
content = content.replace(old4, new4)

# 5. Replace: fulfillOrdersTip push
old5 = '''      bullets.push(
        "Fulfill orders and keep fast movers in stock \u2014 tailored tips appear here from your live sales and inventory.",
      );'''
new5 = '      bullets.push(ui.fulfillOrdersTip);'
assert old5 in content, "Could not find fulfillOrdersTip push"
content = content.replace(old5, new5)

# 6. Replace: useMemo deps
old6 = '  }, [analytics, supplierProducts]);'
new6 = '  }, [analytics, supplierProducts, ui]);'
assert old6 in content, "Could not find useMemo deps"
content = content.replace(old6, new6)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("All topUpSaleBullets replacements applied successfully!")
