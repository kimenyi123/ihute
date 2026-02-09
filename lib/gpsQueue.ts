/**
 * GPS Queue - IndexedDB Storage for Offline GPS Updates
 * Stores GPS updates when offline, syncs when connection restored
 */

import Dexie, { type Table } from 'dexie'

export interface QueuedGPSUpdate {
    id?: number
    lat: number
    lng: number
    accuracy: number
    speed: number
    heading: number
    source: string
    timestamp: number
    synced: boolean
    retries: number
    error?: string
}

class GPSQueueDB extends Dexie {
    gpsQueue!: Table<QueuedGPSUpdate>

    constructor() {
        super('GPSQueueDB')
        this.version(1).stores({
            gpsQueue: '++id, timestamp, synced',
        })
    }
}

const db = new GPSQueueDB()

/**
 * Add GPS update to queue
 */
export async function queueGPSUpdate(payload: Omit<QueuedGPSUpdate, 'id' | 'synced' | 'retries' | 'timestamp'>) {
    try {
        const id = await db.gpsQueue.add({
            ...payload,
            timestamp: Date.now(),
            synced: false,
            retries: 0,
        })
        console.log('[GPS-Queue] Queued update:', id)
        return id
    } catch (error) {
        console.error('[GPS-Queue] Failed to queue:', error)
        throw error
    }
}

/**
 * Get all pending (unsynced) updates
 */
export async function getPendingUpdates(): Promise<QueuedGPSUpdate[]> {
    try {
        return await db.gpsQueue
            .where('synced')
            .equals(false)
            .and((item) => item.retries < 5) // Max 5 retries
            .sortBy('timestamp')
    } catch (error) {
        console.error('[GPS-Queue] Failed to get pending:', error)
        return []
    }
}

/**
 * Mark update as synced
 */
export async function markAsSynced(id: number) {
    try {
        await db.gpsQueue.update(id, { synced: true })
        console.log('[GPS-Queue] Marked as synced:', id)
    } catch (error) {
        console.error('[GPS-Queue] Failed to mark synced:', error)
    }
}

/**
 * Increment retry count
 */
export async function incrementRetries(id: number, error?: string) {
    try {
        const item = await db.gpsQueue.get(id)
        if (item) {
            await db.gpsQueue.update(id, {
                retries: item.retries + 1,
                error: error || item.error,
            })
        }
    } catch (error) {
        console.error('[GPS-Queue] Failed to increment retries:', error)
    }
}

/**
 * Sync all pending updates
 */
export async function syncPendingUpdates(endpoint: string = '/api/supplier/location/update'): Promise<{
    synced: number
    failed: number
}> {
    const pending = await getPendingUpdates()

    if (pending.length === 0) {
        console.log('[GPS-Queue] No pending updates to sync')
        return { synced: 0, failed: 0 }
    }

    console.log(`[GPS-Queue] Syncing ${pending.length} pending updates...`)

    let synced = 0
    let failed = 0

    for (const update of pending) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lat: update.lat,
                    lng: update.lng,
                    accuracy: update.accuracy,
                    speed: update.speed,
                    heading: update.heading,
                    source: update.source + '_queued',
                }),
                credentials: 'include',
            })

            if (response.ok) {
                await markAsSynced(update.id!)
                synced++
            } else {
                await incrementRetries(update.id!, `HTTP ${response.status}`)
                failed++
            }
        } catch (error: any) {
            console.error('[GPS-Queue] Sync failed for update:', update.id, error)
            await incrementRetries(update.id!, error.message)
            failed++
        }
    }

    console.log(`[GPS-Queue] Sync complete: ${synced} synced, ${failed} failed`)

    // Clean up old synced records (older than 7 days)
    await cleanupOldRecords()

    return { synced, failed }
}

/**
 * Clean up old synced records
 */
export async function cleanupOldRecords() {
    try {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
        const deleted = await db.gpsQueue
            .where('timestamp')
            .below(weekAgo)
            .and((item) => item.synced)
            .delete()

        if (deleted > 0) {
            console.log(`[GPS-Queue] Cleaned up ${deleted} old records`)
        }
    } catch (error) {
        console.error('[GPS-Queue] Cleanup failed:', error)
    }
}

/**
 * Get queue statistics
 */
export async function getQueueStats() {
    try {
        const total = await db.gpsQueue.count()
        const pending = await db.gpsQueue.where('synced').equals(false).count()
        const synced = await db.gpsQueue.where('synced').equals(true).count()

        return { total, pending, synced }
    } catch (error) {
        console.error('[GPS-Queue] Failed to get stats:', error)
        return { total: 0, pending: 0, synced: 0 }
    }
}

/**
 * Clear all queue data (for testing/reset)
 */
export async function clearQueue() {
    try {
        await db.gpsQueue.clear()
        console.log('[GPS-Queue] Queue cleared')
    } catch (error) {
        console.error('[GPS-Queue] Failed to clear queue:', error)
    }
}

export { db }
