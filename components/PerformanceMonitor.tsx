// components/PerformanceMonitor.tsx
'use client';

import { useState, useEffect } from 'react';
import { Activity, Zap, TrendingUp, X } from 'lucide-react';

interface PerformanceStats {
  totalSearches: number;
  cacheHits: number;
  cacheMisses: number;
  avgCacheTime: number;
  avgDbTime: number;
  cacheHitRate: number;
}

/**
 * Performance monitoring dashboard for development
 * Shows real-time cache hit rates and performance metrics
 */
export default function PerformanceMonitor() {
  const [stats, setStats] = useState<PerformanceStats>({
    totalSearches: 0,
    cacheHits: 0,
    cacheMisses: 0,
    avgCacheTime: 0,
    avgDbTime: 0,
    cacheHitRate: 0,
  });

  const [isVisible, setIsVisible] = useState(false);

  // Load stats from localStorage on mount
  useEffect(() => {
    const savedStats = localStorage.getItem('performance_stats');
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (error) {
        console.error('Failed to parse performance stats:', error);
      }
    }
  }, []);

  // Listen for search complete events
  useEffect(() => {
    const handleSearchComplete = (event: CustomEvent) => {
      const { searchTime, source } = event.detail;
      updateStats(searchTime, source);
    };

    window.addEventListener('search-complete' as any, handleSearchComplete);

    return () => {
      window.removeEventListener('search-complete' as any, handleSearchComplete);
    };
  }, [stats]);

  const updateStats = (searchTime: number, source: 'redis_cache' | 'database') => {
    setStats(prev => {
      const isCache = source === 'redis_cache';

      const newStats = {
        totalSearches: prev.totalSearches + 1,
        cacheHits: prev.cacheHits + (isCache ? 1 : 0),
        cacheMisses: prev.cacheMisses + (isCache ? 0 : 1),
        avgCacheTime: isCache
          ? ((prev.avgCacheTime * prev.cacheHits) + searchTime) / (prev.cacheHits + 1)
          : prev.avgCacheTime,
        avgDbTime: !isCache
          ? ((prev.avgDbTime * prev.cacheMisses) + searchTime) / (prev.cacheMisses + 1)
          : prev.avgDbTime,
        cacheHitRate: 0,
      };

      newStats.cacheHitRate = newStats.totalSearches > 0
        ? (newStats.cacheHits / newStats.totalSearches) * 100
        : 0;

      // Save to localStorage
      localStorage.setItem('performance_stats', JSON.stringify(newStats));

      return newStats;
    });
  };

  const handleReset = () => {
    const resetStats = {
      totalSearches: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgCacheTime: 0,
      avgDbTime: 0,
      cacheHitRate: 0,
    };
    setStats(resetStats);
    localStorage.removeItem('performance_stats');
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 bg-gray-900 text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors z-50"
        title="Show Performance Stats"
      >
        <Activity className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-4 w-80 z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5 text-blue-600" />
          Performance Stats
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Total Searches */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Total Searches</span>
          <span className="text-lg font-bold text-gray-900">{stats.totalSearches}</span>
        </div>

        {/* Cache Hit Rate */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-gray-600 flex items-center gap-1">
              <Zap className="h-4 w-4 text-green-600" />
              Cache Hit Rate
            </span>
            <span className={`text-lg font-bold ${
              stats.cacheHitRate >= 80 ? 'text-green-600' :
              stats.cacheHitRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats.cacheHitRate.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                stats.cacheHitRate >= 80 ? 'bg-green-500' :
                stats.cacheHitRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${stats.cacheHitRate}%` }}
            />
          </div>
        </div>

        {/* Cache vs DB */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-green-50 border border-green-200 rounded p-2">
            <div className="text-xs text-green-700 mb-1">Cache Hits</div>
            <div className="text-xl font-bold text-green-900">{stats.cacheHits}</div>
            {stats.avgCacheTime > 0 && (
              <div className="text-xs text-green-600">~{stats.avgCacheTime.toFixed(0)}ms avg</div>
            )}
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs text-blue-700 mb-1">DB Queries</div>
            <div className="text-xl font-bold text-blue-900">{stats.cacheMisses}</div>
            {stats.avgDbTime > 0 && (
              <div className="text-xs text-blue-600">~{stats.avgDbTime.toFixed(0)}ms avg</div>
            )}
          </div>
        </div>

        {/* Speed Comparison */}
        {stats.avgCacheTime > 0 && stats.avgDbTime > 0 && (
          <div className="bg-purple-50 border border-purple-200 rounded p-2">
            <div className="flex items-center gap-1 text-xs text-purple-700 mb-1">
              <TrendingUp className="h-3 w-3" />
              Speed Improvement
            </div>
            <div className="text-lg font-bold text-purple-900">
              {(stats.avgDbTime / stats.avgCacheTime).toFixed(1)}x faster
            </div>
            <div className="text-xs text-purple-600">
              with cache vs database
            </div>
          </div>
        )}

        {/* Reset Button */}
        <button
          onClick={handleReset}
          className="w-full text-sm text-gray-600 hover:text-gray-900 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Reset Stats
        </button>
      </div>
    </div>
  );
}