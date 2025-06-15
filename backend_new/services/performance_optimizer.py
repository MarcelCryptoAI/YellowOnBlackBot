#!/usr/bin/env python3
"""
Performance Optimization Service - CTB Trading Bot
Advanced caching, connection pooling en async optimization
"""

import asyncio
import redis.asyncio as aioredis
import time
import json
import logging
import hashlib
import pickle
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any, Callable, Union
from dataclasses import dataclass, asdict
from collections import defaultdict, deque
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import weakref
import gc
import psutil
import inspect

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    hit_rate: float = 0.0
    total_size: int = 0
    entries: int = 0

@dataclass 
class PerformanceMetrics:
    avg_response_time: float
    requests_per_second: float
    active_connections: int
    memory_usage_mb: float
    cpu_usage_percent: float
    cache_hit_rate: float
    error_rate: float
    timestamp: datetime

class AsyncCache:
    """High-performance async cache with TTL and LRU eviction"""
    
    def __init__(self, max_size: int = 10000, default_ttl: int = 300):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.access_times: Dict[str, float] = {}
        self.lock = asyncio.Lock()
        self.stats = CacheStats()
        
        # Start cleanup task later when event loop is running
        self._cleanup_task = None
    
    async def start_cleanup(self):
        """Start the cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_expired())
    
    async def get(self, key: str) -> Optional[Any]:
        """Get item from cache"""
        async with self.lock:
            if key in self.cache:
                entry = self.cache[key]
                if entry['expires_at'] > time.time():
                    self.access_times[key] = time.time()
                    self.stats.hits += 1
                    return entry['value']
                else:
                    # Expired
                    del self.cache[key]
                    del self.access_times[key]
            
            self.stats.misses += 1
            self._update_hit_rate()
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set item in cache"""
        async with self.lock:
            ttl = ttl or self.default_ttl
            expires_at = time.time() + ttl
            
            # Evict if cache is full
            if len(self.cache) >= self.max_size and key not in self.cache:
                await self._evict_lru()
            
            self.cache[key] = {
                'value': value,
                'expires_at': expires_at,
                'created_at': time.time()
            }
            self.access_times[key] = time.time()
            self.stats.entries = len(self.cache)
    
    async def delete(self, key: str) -> bool:
        """Delete item from cache"""
        async with self.lock:
            if key in self.cache:
                del self.cache[key]
                del self.access_times[key]
                self.stats.entries = len(self.cache)
                return True
            return False
    
    async def clear(self) -> None:
        """Clear entire cache"""
        async with self.lock:
            self.cache.clear()
            self.access_times.clear()
            self.stats = CacheStats()
    
    async def _evict_lru(self) -> None:
        """Evict least recently used item"""
        if not self.access_times:
            return
        
        lru_key = min(self.access_times.keys(), key=lambda k: self.access_times[k])
        del self.cache[lru_key]
        del self.access_times[lru_key]
    
    async def _cleanup_expired(self) -> None:
        """Periodic cleanup of expired entries"""
        while True:
            try:
                await asyncio.sleep(60)  # Cleanup every minute
                async with self.lock:
                    current_time = time.time()
                    expired_keys = [
                        key for key, entry in self.cache.items()
                        if entry['expires_at'] <= current_time
                    ]
                    
                    for key in expired_keys:
                        del self.cache[key]
                        if key in self.access_times:
                            del self.access_times[key]
                    
                    self.stats.entries = len(self.cache)
                    if expired_keys:
                        logger.debug(f"Cleaned up {len(expired_keys)} expired cache entries")
                        
            except Exception as e:
                logger.error(f"Error in cache cleanup: {e}")
    
    def _update_hit_rate(self) -> None:
        """Update cache hit rate"""
        total = self.stats.hits + self.stats.misses
        self.stats.hit_rate = self.stats.hits / total if total > 0 else 0.0
    
    def get_stats(self) -> CacheStats:
        """Get cache statistics"""
        self.stats.total_size = sum(
            len(str(entry)) for entry in self.cache.values()
        )
        return self.stats

class ConnectionPool:
    """Advanced connection pool for ByBit API connections"""
    
    def __init__(self, max_connections: int = 50, max_idle_time: int = 300):
        self.max_connections = max_connections
        self.max_idle_time = max_idle_time
        self.connections: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.active_connections: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.lock = asyncio.Lock()
        self.stats = {
            'total_connections': 0,
            'active_connections': 0,
            'idle_connections': 0,
            'reused_connections': 0,
            'created_connections': 0
        }
        
        # Start cleanup task later when event loop is running
        self._cleanup_task = None
    
    async def start_cleanup(self):
        """Start the cleanup task"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_idle_connections())
    
    async def get_connection(self, connection_id: str, api_key: str, secret_key: str) -> Any:
        """Get connection from pool or create new one"""
        async with self.lock:
            # Try to get existing idle connection
            if self.connections[connection_id]:
                conn_info = self.connections[connection_id].pop()
                conn_info['last_used'] = time.time()
                self.active_connections[connection_id].append(conn_info)
                self.stats['reused_connections'] += 1
                self.stats['active_connections'] += 1
                self.stats['idle_connections'] -= 1
                return conn_info['connection']
            
            # Create new connection if under limit
            total_active = sum(len(conns) for conns in self.active_connections.values())
            if total_active < self.max_connections:
                from pybit.unified_trading import HTTP
                connection = HTTP(
                    testnet=False,
                    api_key=api_key,
                    api_secret=secret_key
                )
                
                conn_info = {
                    'connection': connection,
                    'created_at': time.time(),
                    'last_used': time.time(),
                    'api_key': api_key,
                    'secret_key': secret_key
                }
                
                self.active_connections[connection_id].append(conn_info)
                self.stats['created_connections'] += 1
                self.stats['active_connections'] += 1
                self.stats['total_connections'] += 1
                
                return connection
            else:
                raise Exception("Connection pool exhausted")
    
    async def return_connection(self, connection_id: str, connection: Any) -> None:
        """Return connection to pool"""
        async with self.lock:
            # Find and move connection from active to idle
            for i, conn_info in enumerate(self.active_connections[connection_id]):
                if conn_info['connection'] is connection:
                    conn_info = self.active_connections[connection_id].pop(i)
                    conn_info['last_used'] = time.time()
                    self.connections[connection_id].append(conn_info)
                    self.stats['active_connections'] -= 1
                    self.stats['idle_connections'] += 1
                    break
    
    async def _cleanup_idle_connections(self) -> None:
        """Cleanup idle connections that exceed max_idle_time"""
        while True:
            try:
                await asyncio.sleep(60)  # Check every minute
                async with self.lock:
                    current_time = time.time()
                    
                    for connection_id in list(self.connections.keys()):
                        idle_conns = self.connections[connection_id]
                        expired_indices = []
                        
                        for i, conn_info in enumerate(idle_conns):
                            if current_time - conn_info['last_used'] > self.max_idle_time:
                                expired_indices.append(i)
                        
                        # Remove expired connections (reverse order to maintain indices)
                        for i in reversed(expired_indices):
                            idle_conns.pop(i)
                            self.stats['idle_connections'] -= 1
                            self.stats['total_connections'] -= 1
                        
                        if not idle_conns:
                            del self.connections[connection_id]
                            
            except Exception as e:
                logger.error(f"Error in connection cleanup: {e}")
    
    def get_stats(self) -> Dict[str, Any]:
        """Get connection pool statistics"""
        return self.stats.copy()

class RequestBatcher:
    """Batch similar requests to improve efficiency"""
    
    def __init__(self, batch_size: int = 10, max_wait_time: float = 0.1):
        self.batch_size = batch_size
        self.max_wait_time = max_wait_time
        self.batches: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.timers: Dict[str, asyncio.Task] = {}
        self.lock = asyncio.Lock()
    
    async def add_request(self, batch_key: str, request_data: Dict[str, Any], 
                         callback: Callable) -> Any:
        """Add request to batch"""
        async with self.lock:
            request_info = {
                'data': request_data,
                'callback': callback,
                'future': asyncio.Future(),
                'timestamp': time.time()
            }
            
            self.batches[batch_key].append(request_info)
            
            # Process batch if size limit reached
            if len(self.batches[batch_key]) >= self.batch_size:
                await self._process_batch(batch_key)
            else:
                # Set timer for max wait time
                if batch_key not in self.timers:
                    self.timers[batch_key] = asyncio.create_task(
                        self._wait_and_process(batch_key)
                    )
            
            return await request_info['future']
    
    async def _wait_and_process(self, batch_key: str) -> None:
        """Wait for max_wait_time then process batch"""
        await asyncio.sleep(self.max_wait_time)
        async with self.lock:
            if batch_key in self.batches and self.batches[batch_key]:
                await self._process_batch(batch_key)
    
    async def _process_batch(self, batch_key: str) -> None:
        """Process batched requests"""
        if batch_key not in self.batches or not self.batches[batch_key]:
            return
        
        requests = self.batches[batch_key]
        del self.batches[batch_key]
        
        if batch_key in self.timers:
            self.timers[batch_key].cancel()
            del self.timers[batch_key]
        
        try:
            # Execute all requests
            for request_info in requests:
                try:
                    result = await request_info['callback'](request_info['data'])
                    request_info['future'].set_result(result)
                except Exception as e:
                    request_info['future'].set_exception(e)
        except Exception as e:
            for request_info in requests:
                if not request_info['future'].done():
                    request_info['future'].set_exception(e)

class PerformanceOptimizer:
    """
    Comprehensive performance optimization service
    """
    
    def __init__(self):
        self.cache = AsyncCache(max_size=50000, default_ttl=300)
        self.connection_pool = ConnectionPool(max_connections=100)
        self.request_batcher = RequestBatcher(batch_size=15, max_wait_time=0.05)
        
        # Performance monitoring
        self.request_times: deque = deque(maxlen=1000)
        self.error_count = 0
        self.request_count = 0
        self.start_time = time.time()
        
        # Memory optimization
        self.gc_threshold = 100  # MB
        self.last_gc = time.time()
        
        # Async semaphores for rate limiting
        self.api_semaphore = asyncio.Semaphore(50)  # Max 50 concurrent API calls
        self.db_semaphore = asyncio.Semaphore(20)   # Max 20 concurrent DB operations
        
        logger.info("🚀 Performance Optimizer initialized")
    
    async def cached_api_call(self, key: str, api_func: Callable, *args, 
                            ttl: int = 300, **kwargs) -> Any:
        """Execute API call with caching"""
        # Try cache first
        cached_result = await self.cache.get(key)
        if cached_result is not None:
            return cached_result
        
        # Execute API call with rate limiting
        async with self.api_semaphore:
            start_time = time.time()
            try:
                result = await api_func(*args, **kwargs)
                
                # Cache successful result
                await self.cache.set(key, result, ttl)
                
                # Record performance metrics
                execution_time = time.time() - start_time
                self.request_times.append(execution_time)
                self.request_count += 1
                
                return result
                
            except Exception as e:
                self.error_count += 1
                execution_time = time.time() - start_time
                self.request_times.append(execution_time)
                raise e
    
    async def optimized_db_operation(self, operation: Callable, *args, **kwargs) -> Any:
        """Execute database operation with optimization"""
        async with self.db_semaphore:
            start_time = time.time()
            try:
                result = await operation(*args, **kwargs)
                
                execution_time = time.time() - start_time
                if execution_time > 1.0:  # Log slow queries
                    logger.warning(f"Slow DB operation: {operation.__name__} took {execution_time:.2f}s")
                
                return result
                
            except Exception as e:
                logger.error(f"DB operation failed: {operation.__name__}: {e}")
                raise e
    
    def generate_cache_key(self, prefix: str, *args, **kwargs) -> str:
        """Generate consistent cache key"""
        key_data = {
            'prefix': prefix,
            'args': args,
            'kwargs': kwargs
        }
        key_str = json.dumps(key_data, sort_keys=True, default=str)
        return hashlib.md5(key_str.encode()).hexdigest()
    
    async def batch_requests(self, batch_key: str, request_data: Dict[str, Any],
                           processor: Callable) -> Any:
        """Add request to batch processor"""
        return await self.request_batcher.add_request(batch_key, request_data, processor)
    
    async def get_pooled_connection(self, connection_id: str, api_key: str, 
                                  secret_key: str) -> Any:
        """Get connection from pool"""
        return await self.connection_pool.get_connection(connection_id, api_key, secret_key)
    
    async def return_pooled_connection(self, connection_id: str, connection: Any) -> None:
        """Return connection to pool"""
        await self.connection_pool.return_connection(connection_id, connection)
    
    def check_memory_usage(self) -> None:
        """Check memory usage and trigger GC if needed"""
        try:
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            
            if memory_mb > self.gc_threshold and time.time() - self.last_gc > 30:
                logger.info(f"Memory usage: {memory_mb:.1f}MB - triggering garbage collection")
                gc.collect()
                self.last_gc = time.time()
                
                # Log memory after GC
                new_memory_mb = process.memory_info().rss / 1024 / 1024
                logger.info(f"Memory after GC: {new_memory_mb:.1f}MB (freed {memory_mb - new_memory_mb:.1f}MB)")
                
        except Exception as e:
            logger.error(f"Error checking memory usage: {e}")
    
    def get_performance_metrics(self) -> PerformanceMetrics:
        """Get current performance metrics"""
        try:
            # Calculate average response time
            avg_response_time = sum(self.request_times) / len(self.request_times) if self.request_times else 0
            
            # Calculate requests per second
            uptime = time.time() - self.start_time
            requests_per_second = self.request_count / uptime if uptime > 0 else 0
            
            # Get system metrics
            process = psutil.Process()
            memory_mb = process.memory_info().rss / 1024 / 1024
            cpu_percent = process.cpu_percent()
            
            # Get cache hit rate
            cache_stats = self.cache.get_stats()
            cache_hit_rate = cache_stats.hit_rate
            
            # Calculate error rate
            error_rate = self.error_count / self.request_count if self.request_count > 0 else 0
            
            # Get active connections
            pool_stats = self.connection_pool.get_stats()
            active_connections = pool_stats['active_connections']
            
            return PerformanceMetrics(
                avg_response_time=avg_response_time,
                requests_per_second=requests_per_second,
                active_connections=active_connections,
                memory_usage_mb=memory_mb,
                cpu_usage_percent=cpu_percent,
                cache_hit_rate=cache_hit_rate,
                error_rate=error_rate,
                timestamp=datetime.now(timezone.utc)
            )
            
        except Exception as e:
            logger.error(f"Error getting performance metrics: {e}")
            return PerformanceMetrics(
                avg_response_time=0, requests_per_second=0, active_connections=0,
                memory_usage_mb=0, cpu_usage_percent=0, cache_hit_rate=0,
                error_rate=0, timestamp=datetime.now(timezone.utc)
            )
    
    async def warm_up_cache(self, warm_up_tasks: List[Callable]) -> None:
        """Warm up cache with common requests"""
        logger.info("🔥 Starting cache warm-up...")
        
        try:
            for task in warm_up_tasks:
                try:
                    await task()
                except Exception as e:
                    logger.warning(f"Cache warm-up task failed: {e}")
            
            logger.info("✅ Cache warm-up completed")
            
        except Exception as e:
            logger.error(f"Error during cache warm-up: {e}")
    
    def get_optimization_report(self) -> Dict[str, Any]:
        """Get comprehensive optimization report"""
        metrics = self.get_performance_metrics()
        cache_stats = self.cache.get_stats()
        pool_stats = self.connection_pool.get_stats()
        
        return {
            'performance_metrics': asdict(metrics),
            'cache_statistics': asdict(cache_stats),
            'connection_pool_stats': pool_stats,
            'optimization_recommendations': self._get_recommendations(metrics, cache_stats, pool_stats)
        }
    
    def _get_recommendations(self, metrics: PerformanceMetrics, 
                           cache_stats: CacheStats, pool_stats: Dict[str, Any]) -> List[str]:
        """Get optimization recommendations"""
        recommendations = []
        
        if metrics.avg_response_time > 2.0:
            recommendations.append("Consider increasing cache TTL or adding more aggressive caching")
        
        if cache_stats.hit_rate < 0.8:
            recommendations.append("Cache hit rate is low - review caching strategy")
        
        if metrics.memory_usage_mb > 500:
            recommendations.append("High memory usage detected - consider implementing data cleanup")
        
        if metrics.cpu_usage_percent > 80:
            recommendations.append("High CPU usage - consider scaling or optimizing algorithms")
        
        if metrics.error_rate > 0.05:
            recommendations.append("High error rate detected - review error handling and retries")
        
        if pool_stats['active_connections'] / pool_stats['total_connections'] > 0.9:
            recommendations.append("Connection pool utilization is high - consider increasing pool size")
        
        return recommendations

# Global performance optimizer instance
performance_optimizer = PerformanceOptimizer()

# Decorator for automatic performance optimization
def optimize_performance(cache_ttl: int = 300, cache_key_prefix: str = None):
    """Decorator to automatically optimize function performance"""
    def decorator(func: Callable) -> Callable:
        async def wrapper(*args, **kwargs):
            # Generate cache key
            if cache_key_prefix:
                cache_key = performance_optimizer.generate_cache_key(cache_key_prefix, *args, **kwargs)
                return await performance_optimizer.cached_api_call(
                    cache_key, func, *args, ttl=cache_ttl, **kwargs
                )
            else:
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator