"use client"

import { useMemo, useState } from "react"

type Category =
  | "Boutique"
  | "Supermarket"
  | "Pharmacy"
  | "Restaurant"
  | "Liquor Store"
  | "Bakery"
  | "Veterinary"
  | "Others"

type Product = {
  id: number
  category: Category
  name: string
  price: number
  emoji: string
  qty: number
}

type LogisticsId = "human" | "bike" | "moto"
type LogisticsOption = { id: LogisticsId; icon: string; label: string; price: number }

type PaymentId = "momo" | "airtel" | "bk" | "cash"
type PaymentMode = { id: PaymentId; label: string; icon: string }

const CATEGORIES: { name: Category; icon: string }[] = [
  { name: "Boutique", icon: "🏪" },
  { name: "Supermarket", icon: "🛒" },
  { name: "Pharmacy", icon: "💊" },
  { name: "Restaurant", icon: "🍽️" },
  { name: "Liquor Store", icon: "🍺" },
  { name: "Bakery", icon: "🥖" },
  { name: "Veterinary", icon: "🐾" },
  { name: "Others", icon: "◻️" },
]

const INITIAL_PRODUCTS: Product[] = [
  { id: 1, category: "Boutique", name: "Inyange Milk", price: 500, emoji: "🥛", qty: 0 },
  { id: 2, category: "Boutique", name: "Sugar", price: 1250, emoji: "🧂", qty: 0 },
  { id: 3, category: "Boutique", name: "Mützig Beer", price: 1000, emoji: "🍺", qty: 0 },
  { id: 4, category: "Boutique", name: "Heineken Beer", price: 1200, emoji: "🍾", qty: 0 },
  { id: 5, category: "Boutique", name: "Fanta Orange", price: 500, emoji: "🥤", qty: 0 },
  { id: 6, category: "Boutique", name: "Nyange Water", price: 300, emoji: "💧", qty: 0 },
  { id: 7, category: "Boutique", name: "Bread", price: 700, emoji: "🍞", qty: 0 },
  { id: 8, category: "Supermarket", name: "Rice", price: 1800, emoji: "🍚", qty: 0 },
  { id: 9, category: "Supermarket", name: "Cooking Oil", price: 2500, emoji: "🫗", qty: 0 },
  { id: 10, category: "Supermarket", name: "Soap", price: 800, emoji: "🧼", qty: 0 },
  { id: 11, category: "Pharmacy", name: "Paracetamol", price: 1000, emoji: "💊", qty: 0 },
  { id: 12, category: "Pharmacy", name: "ORS", price: 1500, emoji: "🧴", qty: 0 },
  { id: 13, category: "Restaurant", name: "Rolex", price: 1500, emoji: "🌯", qty: 0 },
  { id: 14, category: "Restaurant", name: "Rice & Beans", price: 2500, emoji: "🍛", qty: 0 },
  { id: 15, category: "Liquor Store", name: "Skol Lager", price: 900, emoji: "🍺", qty: 0 },
  { id: 16, category: "Bakery", name: "Mandazi", price: 200, emoji: "🥯", qty: 0 },
  { id: 17, category: "Veterinary", name: "Animal Feed", price: 4000, emoji: "🐄", qty: 0 },
  { id: 18, category: "Others", name: "Matches", price: 200, emoji: "🔥", qty: 0 },
]

const LOGISTICS: LogisticsOption[] = [
  { id: "human", icon: "🚶", label: "Human", price: 300 },
  { id: "bike", icon: "🚲", label: "Bike", price: 500 },
  { id: "moto", icon: "🏍", label: "Moto", price: 800 },
]

const PAYMENTS: PaymentMode[] = [
  { id: "momo", label: "MTN MoMo", icon: "📱" },
  { id: "airtel", label: "Airtel Money", icon: "📱" },
  { id: "bk", label: "BK", icon: "🏦" },
  { id: "cash", label: "Cash on Delivery", icon: "💵" },
]

function formatRwf(v: number): string {
  return `${Math.round(v).toLocaleString()} RWF`
}

export default function GrandmaPage() {
  const [page, setPage] = useState<1 | 2 | 3 | 4>(1)
  const [category, setCategory] = useState<Category>("Boutique")
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS)
  const [selectedLogistics, setSelectedLogistics] = useState<LogisticsId>("human")
  const [selectedPayment, setSelectedPayment] = useState<PaymentId>("momo")

  const selectedProducts = useMemo(() => products.filter((p) => p.qty > 0), [products])
  const itemsCount = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty, 0), [selectedProducts])
  const itemsTotal = useMemo(() => selectedProducts.reduce((a, p) => a + p.qty * p.price, 0), [selectedProducts])
  const logisticsTotal = useMemo(() => LOGISTICS.find((x) => x.id === selectedLogistics)?.price ?? 0, [selectedLogistics])
  const grandTotal = useMemo(() => itemsTotal + logisticsTotal, [itemsTotal, logisticsTotal])

  const title =
    page === 1 ? "Ishyiga Ihute" : page === 2 ? category : page === 3 ? "Order Summary" : "Payment Mode"

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter((p) => p.category === category && (!q || p.name.toLowerCase().includes(q)))
  }, [products, category, search])

  const changeQty = (id: number, diff: number) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, qty: Math.max(0, p.qty + diff) } : p))
    )
  }

  const goToPage = (p: 1 | 2 | 3 | 4) => setPage(p)
  const goBack = () => setPage((p) => (p > 1 ? ((p - 1) as any) : p))

  return (
    <div className="app">
      <style>{`
        :root{
          --blue:#1897e0;--blue-dark:#127fc0;--bg:#eef4fb;--card:#ffffff;--text:#17324d;
          --muted:#6f8399;--line:#dbe7f3;--green:#22c55e;
        }
        *{box-sizing:border-box}
        body{margin:0;font-family:Arial, Helvetica, sans-serif;background:var(--bg);color:var(--text);}
        .app{max-width:430px;margin:0 auto;min-height:100vh;background:linear-gradient(180deg,#f7fbff 0%,#eef4fb 100%);padding-bottom:90px;}
        .topbar{background:linear-gradient(90deg,var(--blue),#30acef,var(--blue-dark));color:#fff;padding:14px 16px;position:sticky;top:0;z-index:10;box-shadow:0 8px 20px rgba(0,0,0,.10);}
        .topbar-row{display:flex;align-items:center;gap:10px;}
        .back-btn,.more-btn{border:none;background:rgba(255,255,255,.14);color:#fff;border-radius:10px;width:36px;height:36px;font-size:18px;cursor:pointer;}
        .brand{display:flex;align-items:center;gap:10px;flex:1;min-width:0;}
        .logo{width:34px;height:34px;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;font-weight:900;color:var(--blue-dark);}
        .title{font-size:22px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .page{display:none;padding:14px;}
        .page.active{display:block}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
        .card{background:var(--card);border-radius:16px;border:1px solid var(--line);box-shadow:0 8px 18px rgba(24,151,224,.08);}
        .cat-card{padding:18px 10px;text-align:center;cursor:pointer;}
        .cat-icon{font-size:34px;margin-bottom:10px;}
        .cat-name{font-size:16px;font-weight:700;line-height:1.2;}
        .search{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:12px;box-shadow:0 8px 18px rgba(24,151,224,.08);}
        .search input{border:none;outline:none;width:100%;font-size:16px;background:transparent;}
        .reorder-btn{border:none;background:#e8f3ff;color:var(--blue-dark);border-radius:10px;padding:8px 10px;font-weight:700;cursor:pointer;}
        .product-list{display:flex;flex-direction:column;gap:10px;}
        .product-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;grid-template-columns:42px 1fr auto;gap:10px;align-items:center;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .emoji{font-size:28px;text-align:center;}
        .p-name{font-size:16px;font-weight:700;}
        .p-price{margin-top:4px;color:var(--muted);font-size:14px;}
        .qty{display:flex;align-items:center;gap:8px;background:#f1f8ff;border-radius:12px;padding:6px;}
        .qty button{width:30px;height:30px;border:none;border-radius:9px;background:#d8edfb;color:var(--blue-dark);font-size:20px;cursor:pointer;}
        .qty span{min-width:18px;text-align:center;font-weight:700;}
        .bottom-bar{position:sticky;bottom:74px;margin-top:12px;background:linear-gradient(90deg,var(--blue),var(--blue-dark));color:#fff;border-radius:16px;padding:14px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:700;box-shadow:0 10px 20px rgba(24,151,224,.22);}
        .section-title{font-size:14px;font-weight:700;text-transform:uppercase;color:var(--muted);margin:8px 4px 10px;letter-spacing:.3px;}
        .summary-card{padding:14px;margin-bottom:12px;}
        .summary-row{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid var(--line);}
        .summary-row:last-child{border-bottom:none;}
        .summary-left{font-weight:700;}
        .summary-sub{color:var(--muted);font-size:13px;margin-top:4px;}
        .logistics-row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;}
        .log-option{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 8px;text-align:center;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .log-option.active{border:2px solid var(--blue);background:#f2f9ff;}
        .log-icon{font-size:24px;display:block;margin-bottom:6px;}
        .log-label{font-weight:700;font-size:14px;}
        .log-price{color:var(--muted);margin-top:4px;font-size:13px;font-weight:700;}
        .shop-box{display:flex;align-items:center;gap:10px;padding:14px;margin-bottom:12px;}
        .shop-main{flex:1;min-width:0;}
        .shop-name{font-size:18px;font-weight:700;}
        .shop-code{color:var(--blue-dark);font-size:14px;margin-top:4px;word-break:break-word;}
        .contact-btn{border:none;background:var(--green);color:#fff;padding:10px 14px;border-radius:12px;font-weight:700;cursor:pointer;}
        .action-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:12px;}
        .action-btn{border:none;background:#fff;color:var(--text);border:1px solid var(--line);border-radius:12px;padding:12px 8px;font-weight:700;cursor:pointer;box-shadow:0 8px 18px rgba(24,151,224,.06);}
        .primary-btn{width:100%;border:none;border-radius:16px;padding:16px;font-size:20px;font-weight:700;color:#fff;background:linear-gradient(90deg,var(--blue),var(--blue-dark));cursor:pointer;box-shadow:0 10px 20px rgba(24,151,224,.22);}
        .note{padding:14px;font-size:13px;color:var(--muted);line-height:1.45;}
        .pay-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;margin-bottom:10px;cursor:pointer;}
        .pay-left{display:flex;align-items:center;gap:10px;font-weight:700;}
        .pay-logo{width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:8px;background:#fff;}
        .radio{width:20px;height:20px;border:2px solid var(--blue);border-radius:50%;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;}
        .pay-item.active .radio::after{content:'';width:10px;height:10px;background:var(--blue);border-radius:50%;display:block;}
        .breakdown{padding:14px;margin-top:12px;margin-bottom:12px;}
        .rider{padding:14px;display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:12px;}
        .stars{color:#f4b400;font-weight:700;}
        .footer{position:fixed;left:50%;transform:translateX(-50%);bottom:0;width:100%;max-width:430px;background:rgba(255,255,255,.96);border-top:1px solid var(--line);display:flex;justify-content:space-around;padding:10px 6px 12px;z-index:20;}
        .footer button{border:none;background:none;color:var(--muted);font-size:12px;display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;}
        .footer button.active{color:var(--blue-dark);font-weight:700;}
      `}</style>

      <div className="topbar">
        <div className="topbar-row">
          <button className="back-btn" onClick={goBack} aria-label="Back">
            ←
          </button>
          <div className="brand">
            <div className="logo" aria-hidden>
              I
            </div>
            <div className="title" id="pageTitle">
              {title}
            </div>
          </div>
          <button
            className="more-btn"
            onClick={() => alert(page === 2 ? "Old orders / reorder" : "More options")}
            aria-label="More"
          >
            ⋮
          </button>
        </div>
      </div>

      {/* Page 1 */}
      <section className={`page ${page === 1 ? "active" : ""}`} id="page1">
        <div className="grid">
          {CATEGORIES.map((c) => (
            <div
              key={c.name}
              className="card cat-card"
              onClick={() => {
                setCategory(c.name)
                setSearch("")
                goToPage(2)
              }}
              role="button"
              tabIndex={0}
            >
              <div className="cat-icon">{c.icon}</div>
              <div className="cat-name">{c.name}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Page 2 */}
      <section className={`page ${page === 2 ? "active" : ""}`} id="page2">
        <div className="search">
          <span aria-hidden>🔎</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search item"
            aria-label="Search item"
          />
          <button className="reorder-btn" onClick={() => alert("Old orders / reorder")}>
            ↻
          </button>
        </div>

        <div className="product-list" id="productList">
          {visibleProducts.map((p) => (
            <div className="product-row" key={p.id}>
              <div className="emoji">{p.emoji}</div>
              <div>
                <div className="p-name">{p.name}</div>
                <div className="p-price">{formatRwf(p.price)}</div>
              </div>
              <div className="qty">
                <button onClick={() => changeQty(p.id, -1)} aria-label="Decrease">
                  −
                </button>
                <span>{p.qty}</span>
                <button onClick={() => changeQty(p.id, 1)} aria-label="Increase">
                  +
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="bottom-bar">
          <div id="bottomItems">{itemsCount} items</div>
          <div id="bottomTotal">Items Total: {formatRwf(itemsTotal)}</div>
        </div>
      </section>

      {/* Page 3 */}
      <section className={`page ${page === 3 ? "active" : ""}`} id="page3">
        <div className="card summary-card">
          <div className="summary-row">
            <div className="summary-left">Order Summary</div>
            <div id="summaryCount">{itemsCount} items</div>
          </div>
          <div id="summaryItems">
            {selectedProducts.length ? (
              selectedProducts.map((p) => (
                <div className="summary-row" key={p.id}>
                  <div>
                    <div className="summary-left">
                      {p.name} x{p.qty}
                    </div>
                    <div className="summary-sub">{formatRwf(p.price)} each</div>
                  </div>
                  <strong>{formatRwf(p.qty * p.price)}</strong>
                </div>
              ))
            ) : (
              <div className="note">No items selected yet.</div>
            )}
          </div>
        </div>

        <div className="section-title">Shipment / Logistics</div>
        <div className="logistics-row" id="logisticsRow">
          {LOGISTICS.map((opt) => (
            <div
              key={opt.id}
              className={`log-option ${selectedLogistics === opt.id ? "active" : ""}`}
              onClick={() => setSelectedLogistics(opt.id)}
              role="button"
              tabIndex={0}
            >
              <span className="log-icon" aria-hidden>
                {opt.icon}
              </span>
              <div className="log-label">{opt.label}</div>
              <div className="log-price">{formatRwf(opt.price)}</div>
            </div>
          ))}
        </div>

        <div className="card summary-card">
          <div className="summary-row">
            <span>Items</span>
            <strong id="sumItemsCount">{itemsCount}</strong>
          </div>
          <div className="summary-row">
            <span>Total Items</span>
            <strong id="sumItemsTotal">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Logistics</span>
            <strong id="sumLogistics">{formatRwf(logisticsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Grand Total</span>
            <strong id="sumGrand">{formatRwf(grandTotal)}</strong>
          </div>
        </div>

        <div className="card shop-box">
          <div className="logo" aria-hidden>
            I
          </div>
          <div className="shop-main">
            <div className="shop-name">Mama Nadia</div>
            <div className="shop-code">MTN MoMo: 547255</div>
          </div>
          <button className="contact-btn" onClick={() => alert("Pick another shop / contact")}>
            Contact
          </button>
        </div>

        <div className="action-row">
          <button className="action-btn" onClick={() => alert("Call shop")}>
            📞 Call
          </button>
          <button className="action-btn" onClick={() => alert("SMS shop")}>
            💬 SMS
          </button>
          <button className="action-btn" onClick={() => goToPage(2)}>
            ↩ Go Back
          </button>
          <button className="action-btn" onClick={() => goToPage(4)}>
            💳 Pay
          </button>
        </div>

        <div className="card note">
          Items subject to availability. Replace with a similar product if out of stock.
        </div>
      </section>

      {/* Page 4 */}
      <section className={`page ${page === 4 ? "active" : ""}`} id="page4">
        <div className="card note">
          <strong>Estimated time of arrival:</strong> 20–30 min
        </div>

        <div className="section-title">Payment Mode</div>
        <div id="paymentList">
          {PAYMENTS.map((mode) => (
            <div
              key={mode.id}
              className={`card pay-item ${selectedPayment === mode.id ? "active" : ""}`}
              onClick={() => setSelectedPayment(mode.id)}
              role="button"
              tabIndex={0}
            >
              <div className="pay-left">
                <span className="pay-logo" aria-hidden>
                  {mode.icon}
                </span>
                <span>{mode.label}</span>
              </div>
              <span className="radio" aria-hidden />
            </div>
          ))}
        </div>

        <div className="card breakdown">
          <div className="summary-row">
            <span>Amount to shop</span>
            <strong id="payShop">{formatRwf(itemsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Amount to logistics</span>
            <strong id="payLogistics">{formatRwf(logisticsTotal)}</strong>
          </div>
          <div className="summary-row">
            <span>Total amount to pay</span>
            <strong id="payTotal">{formatRwf(grandTotal)}</strong>
          </div>
        </div>

        <div className="card rider">
          <div>
            <div style={{ fontWeight: 700 }}>Emma</div>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>Delivery person</div>
          </div>
          <div className="stars">★★★★☆ 4.6</div>
        </div>

        <button className="primary-btn" onClick={() => alert("Order sent successfully")}>
          Send Order
        </button>
      </section>

      <div className="footer">
        <button className={page === 1 ? "active" : ""} onClick={() => goToPage(1)}>
          🏠<span>Home</span>
        </button>
        <button className={page === 2 ? "active" : ""} onClick={() => goToPage(2)}>
          🛍️<span>Items</span>
        </button>
        <button className={page === 3 ? "active" : ""} onClick={() => goToPage(3)}>
          📦<span>Summary</span>
        </button>
        <button className={page === 4 ? "active" : ""} onClick={() => goToPage(4)}>
          💳<span>Pay</span>
        </button>
      </div>
    </div>
  )
}

