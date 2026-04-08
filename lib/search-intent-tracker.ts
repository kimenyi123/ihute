/**
 * Search Intent Tracker
 * 
 * Tracks user search behavior for personalization and notifications.
 * Stores searches in localStorage for anonymous users, syncs to backend.
 */

const STORAGE_KEY = 'ihute_search_history';
const MAX_LOCAL_SEARCHES = 50;

export interface SearchRecord {
  keyword: string;
  normalizedKeyword: string;
  resultCount: number;
  clickedResult: boolean;
  clickedProductId?: string;
  clickedSupplierId?: string;
  searchContext: string;
  timestamp: number;
}

/**
 * Normalize search keyword: lowercase, trim, preserve important attributes
 */
export function normalizeSearchKeyword(keyword: string): string {
  if (!keyword) return '';
  return keyword.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Get user ID and session ID from auth store
 */
function getUserIdentifiers(): { userId: string | null; sessionId: string } {
  // Try to get from auth store
  let userId: string | null = null;
  
  try {
    // Use dynamic import to avoid SSR issues
    if (typeof window !== 'undefined') {
      const { useAuthStore } = require('@/lib/auth-store');
      const store = useAuthStore.getState();
      if (store?.user?.email) {
        userId = store.user.email;
      }
    }
  } catch (e) {
    // Fallback: try localStorage
    try {
      const stored = localStorage.getItem('ihute_user_email');
      if (stored) userId = stored;
    } catch (e2) {
      // Ignore
    }
  }
  
  // Get or create session ID
  const sessionId = getSessionId();
  
  return { userId, sessionId };
}

/**
 * Get or create session ID
 */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  
  const key = 'ihute_session_id';
  let sessionId = localStorage.getItem(key);
  
  if (!sessionId) {
    sessionId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(key, sessionId);
  }
  
  return sessionId;
}

/**
 * Record a search action
 */
export async function recordSearch(
  keyword: string,
  resultCount: number = 0,
  searchContext: string = 'global'
): Promise<void> {
  if (!keyword || keyword.trim().length < 2) return;
  
  const normalized = normalizeSearchKeyword(keyword);
  if (!normalized) return;
  
  const { userId, sessionId } = getUserIdentifiers();
  
  // Store locally for anonymous users
  if (!userId) {
    const record: SearchRecord = {
      keyword,
      normalizedKeyword: normalized,
      resultCount,
      clickedResult: false,
      searchContext,
      timestamp: Date.now(),
    };
    
    const history = getLocalSearchHistory();
    history.unshift(record);
    
    // Keep only last MAX_LOCAL_SEARCHES
    if (history.length > MAX_LOCAL_SEARCHES) {
      history.splice(MAX_LOCAL_SEARCHES);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }
  
  // Send to backend
  try {
    const response = await fetch('/api/search-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'recordSearch',
        userId: userId || '',
        sessionId,
        searchKeyword: keyword,
        resultCount,
        clickedResult: false,
        searchContext,
      }),
    });
    
    if (!response.ok) {
      console.warn('[SearchIntent] Failed to record search:', response.statusText);
    }
  } catch (error) {
    console.warn('[SearchIntent] Error recording search:', error);
  }
}

/**
 * Mark that user clicked a search result
 */
export async function markSearchClick(
  keyword: string,
  clickedProductId?: string,
  clickedSupplierId?: string
): Promise<void> {
  if (!keyword) return;
  
  const { userId, sessionId } = getUserIdentifiers();
  
  // Update local history
  if (!userId) {
    const history = getLocalSearchHistory();
    const record = history.find(
      (r) => r.normalizedKeyword === normalizeSearchKeyword(keyword)
    );
    if (record) {
      record.clickedResult = true;
      record.clickedProductId = clickedProductId;
      record.clickedSupplierId = clickedSupplierId;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    }
  }
  
  // Send to backend
  try {
    await fetch('/api/search-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'markSearchClick',
        userId: userId || '',
        sessionId,
        searchKeyword: keyword,
        clickedProductId: clickedProductId || '',
        clickedSupplierId: clickedSupplierId || '',
      }),
    });
  } catch (error) {
    console.warn('[SearchIntent] Error marking search click:', error);
  }
}

/**
 * Get top search intents for personalization
 */
export async function getTopSearchIntents(limit: number = 10): Promise<Array<{
  keyword: string;
  intentScore: number;
  decayedScore: number;
  searchCount: number;
  clickCount: number;
}>> {
  const { userId, sessionId } = getUserIdentifiers();
  
  try {
    const response = await fetch(
      `/api/search-intent?action=getTopIntents&userId=${userId || ''}&sessionId=${sessionId}&limit=${limit}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.intents) {
        return data.intents;
      }
    }
  } catch (error) {
    console.warn('[SearchIntent] Error fetching top intents:', error);
  }
  
  return [];
}

/**
 * Get recent searches for auto-suggest
 */
export async function getRecentSearches(limit: number = 10): Promise<string[]> {
  const { userId, sessionId } = getUserIdentifiers();
  
  // For anonymous users, return from localStorage
  if (!userId) {
    const history = getLocalSearchHistory();
    const unique = new Set<string>();
    for (const record of history) {
      if (record.normalizedKeyword) {
        unique.add(record.normalizedKeyword);
      }
    }
    return Array.from(unique).slice(0, limit);
  }
  
  // For logged-in users, fetch from backend
  try {
    const response = await fetch(
      `/api/search-intent?action=getRecentSearches&userId=${userId}&limit=${limit}`
    );
    
    if (response.ok) {
      const data = await response.json();
      if (data.ok && data.searches) {
        return data.searches;
      }
    }
  } catch (error) {
    console.warn('[SearchIntent] Error fetching recent searches:', error);
  }
  
  return [];
}

/**
 * Get local search history from localStorage
 */
function getLocalSearchHistory(): SearchRecord[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as SearchRecord[];
    }
  } catch (e) {
    console.warn('[SearchIntent] Error reading local history:', e);
  }
  
  return [];
}

/**
 * Sync local search history to backend (call on login)
 */
export async function syncLocalSearchHistory(): Promise<void> {
  const history = getLocalSearchHistory();
  if (history.length === 0) return;
  
  const { userId, sessionId } = getUserIdentifiers();
  if (!userId) return; // Only sync if logged in
  
  // Send each search to backend
  for (const record of history) {
    try {
      await fetch('/api/search-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recordSearch',
          userId,
          sessionId,
          searchKeyword: record.keyword,
          resultCount: record.resultCount,
          clickedResult: record.clickedResult,
          clickedProductId: record.clickedProductId || '',
          clickedSupplierId: record.clickedSupplierId || '',
          searchContext: record.searchContext,
        }),
      });
    } catch (error) {
      console.warn('[SearchIntent] Error syncing search:', error);
    }
  }
  
  // Clear local history after sync
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Clear all local search history
 */
export function clearLocalSearchHistory(): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('[SearchIntent] Local search history cleared');
  } catch (e) {
    console.warn('[SearchIntent] Error clearing local history:', e);
  }
}

/**
 * Clear all search history (local and backend)
 */
export async function clearAllSearchHistory(): Promise<boolean> {
  const { userId, sessionId } = getUserIdentifiers();
  
  // Clear local storage
  clearLocalSearchHistory();
  
  // Clear backend (if API supports it)
  try {
    const response = await fetch('/api/search-intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'clearHistory',
        userId: userId || '',
        sessionId,
      }),
    });
    
    if (response.ok) {
      console.log('[SearchIntent] Search history cleared successfully');
      return true;
    }
  } catch (error) {
    console.warn('[SearchIntent] Error clearing backend history:', error);
  }
  
  return true; // Local was cleared even if backend failed
}



