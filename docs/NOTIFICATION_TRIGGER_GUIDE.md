# When Will You Receive Notifications?

## 📱 Overview: Notification Trigger Rules

The notification system is designed with **high relevance** as the core principle. You will **only** receive notifications when:
1. You have shown genuine interest in something (behavior-based)
2. Something relevant happens (new product, price drop, etc.)
3. Frequency limits allow (no spam)

---

## 🔔 Notification Trigger Rules (4 Rules)

### Rule 1: Category Interest
**Trigger**: You viewed a category 3+ times, and a new product is added

```
IF you viewed category X ≥ 3 times (in last 30 days)
AND a new product is added to category X
AND you have NOT been notified about category X in the last 48 hours
→ You receive a notification
```

**Example**:
- You browse "Pharmacy" category 3+ times
- A new medicine is added to Pharmacy
- You get: "New in Pharmacy: Paracetamol 500mg just added"
- Deep-link: Opens `/category/pharmacy`

---

### Rule 2: Favorite Supplier
**Trigger**: A supplier you favorited adds a new product

```
IF you favorited supplier S
AND supplier S adds a new product
→ You receive a notification
```

**Example**:
- You favorited "ABC Pharmacy"
- ABC Pharmacy adds a new product
- You get: "ABC Pharmacy added a new product: Vitamin C 1000mg is now available"
- Deep-link: Opens `/supplier/abc-pharmacy`

---

### Rule 3: Product Re-engagement
**Trigger**: A product you viewed has a price drop or is back in stock

```
IF you viewed product P (in last 60 days)
AND (product P price drops OR product P is back in stock)
→ You receive a notification
```

**Example (Price Drop)**:
- You viewed "Premium Cement 50kg" (priced at 15,000 RWF)
- Price drops to 12,000 RWF
- You get: "Price Drop: Premium Cement 50kg - Now 12,000 RWF (20% off)"
- Deep-link: Opens `/product/premium-cement-50kg`

**Example (Back in Stock)**:
- You viewed "iPhone 15 Case" (was out of stock)
- It's back in stock
- You get: "iPhone 15 Case is back in stock - Available now, order while supplies last"
- Deep-link: Opens `/product/iphone-15-case`

---

### Rule 4: Search Intent Match (STRONGEST)
**Trigger**: You searched for something, and a matching product is added

```
IF you searched keyword K
AND a new product matching keyword K is added
AND you have NOT been notified about keyword K in the last 48 hours
→ You receive a notification
```

**Example**:
- You searched "cement 32.5"
- A new product "Premium Cement 32.5 50kg" is added
- You get: "Match for 'cement 32.5': Premium Cement 32.5 50kg is now available"
- Deep-link: Opens `/search?q=cement%2032.5`

---

## ⛔ When You WON'T Receive Notifications

### Frequency Limits (Enforced)

| Limit | Description |
|-------|-------------|
| **Max 2 per day** | You won't receive more than 2 notifications in 24 hours |
| **48h cooldown** | Same category/product/keyword won't notify again within 48 hours |
| **Ignore suppression** | If you ignore notifications, the system pauses for 7 days |
| **Quiet hours** | Configurable quiet hours (e.g., 22:00-08:00) block notifications |

### Relevance Gates

| Requirement | What it means |
|-------------|---------------|
| **Category: 3+ views** | You must view a category at least 3 times to get category notifications |
| **Supplier: Must favorite** | You must explicitly favorite a supplier to get supplier notifications |
| **Product: Must view** | You must have viewed the product to get price drop/stock notifications |
| **Search: Must search** | You must have searched for the keyword to get search match notifications |

### Weak Match Protection
The system **ignores weak matches**:
- Partial keyword overlap is not enough
- Generic product names don't trigger notifications
- The product must genuinely match your interest

---

## 🚀 How It Works: End-to-End Flow

### Step 1: Your Behavior is Tracked
```
You search "cement 32.5"
    ↓
Frontend (React) calls API
    ↓
Backend stores in search_history
    ↓
Intent score is calculated
```

### Step 2: Background Scheduler Checks
```
Every 30 minutes, the scheduler:
    1. Checks for new products
    2. Matches against user intents
    3. Applies frequency control
    4. Sends notifications (if all rules pass)
```

### Step 3: You Receive Notification
```
Browser receives push notification
    ↓
Service Worker (sw.js) displays it
    ↓
You click → Deep-link opens relevant page
    ↓
System marks notification as "opened"
```

---

## 📊 Signal Strength Hierarchy

The system prioritizes signals based on strength:

| Signal | Strength | Example |
|--------|----------|---------|
| **Search Intent** | ⭐⭐⭐⭐⭐ (Strongest) | User searched "cement 32.5" |
| **Favorites** | ⭐⭐⭐⭐ | User favorited supplier |
| **Category Views (3+)** | ⭐⭐⭐ | User viewed category 3+ times |
| **Product Views** | ⭐⭐⭐ | User viewed specific product |
| **Clicks** | ⭐⭐ | User clicked on result |
| **Time Spent** | ⭐ | User spent time on page |

**Key Principle**: Search intent is the strongest signal because users explicitly tell you what they want.

---

## 🔧 Frontend Implementation

### 1. Register for Notifications

```typescript
// components/notification-prompt.tsx
import { subscribeToPushNotifications } from '@/lib/notification-service';

// Request permission after user interaction (button click)
async function handleEnableNotifications() {
  const subscription = await subscribeToPushNotifications();
  if (subscription) {
    console.log('Subscribed to notifications!');
  }
}
```

### 2. Track Interactions

```typescript
// Automatically tracked when user browses
import { trackProductView, trackCategoryView, trackSearch } from '@/lib/interaction-tracker';

// Product view
trackProductView('product-123', 'Premium Cement 32.5');

// Category view
trackCategoryView('pharmacy', 'Pharmacy');

// Search
trackSearch('cement 32.5', 10); // 10 results
```

### 3. Service Worker Handles Notifications

```javascript
// sw.js handles push events
self.addEventListener('push', (event) => {
  const payload = event.data.json();
  self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: payload.icon,
    data: { url: payload.data.url }, // Deep-link URL
  });
});

// Click opens the deep-link
self.addEventListener('notificationclick', (event) => {
  const url = event.notification.data.url;
  clients.openWindow(url); // Opens /search?q=cement%2032.5
});
```

---

## 📅 Notification Schedule

The backend scheduler runs **every 30 minutes** and evaluates:

1. **New products in categories** → Category Interest rule
2. **New products from favorited suppliers** → Favorite Supplier rule
3. **Price drops / Back in stock** → Product Re-engagement rule
4. **New products matching search intents** → Search Intent Match rule (highest priority)

**Note**: Notifications are NOT sent immediately. They're queued and sent during the next scheduler run (within 30 minutes of the trigger event).

---

## ✅ Summary: When You'll Be Notified

| Trigger | Condition | Deep-Link |
|---------|-----------|-----------|
| Category Interest | Viewed category 3+ times + new product | `/category/{id}` |
| Favorite Supplier | Favorited supplier + new product | `/supplier/{id}` |
| Price Drop | Viewed product + price dropped | `/product/{id}` |
| Back in Stock | Viewed product + back in stock | `/product/{id}` |
| Search Match | Searched keyword + matching product | `/search?q={keyword}` |

---

## 🛡️ Privacy & Trust

- **No spam**: Max 2 notifications per day
- **Relevant only**: Must show genuine interest
- **Easy opt-out**: Unsubscribe anytime
- **Transparent**: Deep-link to exactly what you cared about
- **Respectful**: Quiet hours, ignore suppression

**Design philosophy**: "Design it like Amazon, not like a spammy ad network."

---

## 🐛 Troubleshooting

### Not receiving notifications?

1. **Check permission**: Browser notification permission must be "granted"
2. **Check subscription**: `push_subscriptions` table must have your record with `is_active = TRUE`
3. **Check behavior**: You need to have tracked interactions (views, searches, favorites)
4. **Check frequency**: You might have hit the daily limit (max 2)
5. **Check cooldown**: Same entity might be in 48h cooldown
6. **Check suppress**: You might have ignored recent notifications (7-day suppression)

### Deep-link not working?

1. Check Service Worker is registered
2. Check `action_url` in notification payload
3. Check `sw.js` notificationclick handler

---

**Last Updated**: 2025-12-17









