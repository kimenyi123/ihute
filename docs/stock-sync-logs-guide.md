# Stock Sync Logs Guide

This guide explains:

- what the `/stock-sync-logs` page shows,
- how backend events are written to MongoDB,
- how to configure Linux Tomcat environment variables for this feature.

## What The Page Shows

`/stock-sync-logs` displays stock pipeline events from MongoDB:

- `send_to_redis` (stored as `redis_ingest`)
- `redis_to_mysql_sync`

It includes:

- filters (`seller`, `stage`, `status`, `source`)
- pagination (default: 10 rows/page)
- per-stage summary cards:
  - unique seller accounts
  - event counts
- event details and skipped reasons

## Data Source

The Next.js API route is:

- `app/api/stock-sync/logs/route.ts`

Priority order:

1. `MONGO_URI` (native Mongo driver)
2. Atlas Data API (`MONGO_DATA_API_URL`, `MONGO_DATA_API_KEY`, `MONGO_DATA_SOURCE`)

Recommended: use `MONGO_URI`.

## Backend Logger Requirements (Java / Kaos)

`StockSyncMongoLogger` writes events. For `MONGO_URI` mode:

1. Environment variables must exist in Tomcat runtime.
2. Mongo Java jars must be on backend classpath:
   - `mongodb-driver-sync`
   - `mongodb-driver-core`
   - `bson`

If jars are missing, logger fails in native mode.

## Linux Tomcat: Set Environment Variables

Use these steps on the Linux server.

### 1) Find Tomcat service name

```bash
systemctl list-units --type=service | rg -i tomcat
```

Examples: `tomcat`, `tomcat9`, `tomcat10`.

### 2) Add env variables to service override

Replace `<tomcat-service>` with your service name.

```bash
sudo systemctl edit <tomcat-service>
```

Add:

```ini
[Service]
Environment="MONGO_URI=mongodb://ihuteLogger:<PASSWORD>@127.0.0.1:27017/ihute_ops?authSource=ihute_ops"
Environment="MONGO_DATABASE=ihute_ops"
Environment="MONGO_COLLECTION=stock_sync_events"
```

### 3) Reload and restart

```bash
sudo systemctl daemon-reload
sudo systemctl restart <tomcat-service>
sudo systemctl status <tomcat-service> --no-pager
```

### 4) Verify logs

After one stock insert/sync event:

```bash
journalctl -u <tomcat-service> -n 300 --no-pager | rg "StockSyncMongoLogger"
```

Expected:

- `mode=MONGO_URI`
- `native_driver inserted`

If you see `mode=DATA_API` + `skipped (not configured)`, env vars are not loaded by the Tomcat process.

## Frontend Env (for local dev)

In `ihute-frontend/.env.local`:

```env
MONGO_URI=mongodb://ihuteLogger:<PASSWORD>@<SERVER_IP>:27017/ihute_ops?authSource=ihute_ops
MONGO_DATABASE=ihute_ops
MONGO_COLLECTION=stock_sync_events
```

## Optional: Create Indexes

From `ihute-frontend`:

```bash
npm run mongo:stock-sync-indexes
```

This sets core indexes and can optionally set TTL if `STOCK_SYNC_LOG_TTL_SECONDS` is provided.
