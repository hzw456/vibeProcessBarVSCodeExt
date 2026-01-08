"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StatusCache = void 0;
class StatusCache {
    constructor(context) {
        this.context = context;
    }
    async add(status) {
        const cached = await this.getAll();
        // Remove if already exists
        const filtered = cached.filter(s => s.id !== status.id);
        // Add to beginning
        filtered.unshift(status);
        // Keep only the most recent statuses
        const limited = filtered.slice(0, StatusCache.MAX_CACHE_SIZE);
        await this.context.globalState.update(StatusCache.CACHE_KEY, limited);
    }
    async remove(id) {
        const cached = await this.getAll();
        const filtered = cached.filter(s => s.id !== id);
        await this.context.globalState.update(StatusCache.CACHE_KEY, filtered);
    }
    async getAll() {
        const cached = this.context.globalState.get(StatusCache.CACHE_KEY, []);
        return cached.map(status => ({
            ...status,
            timestamp: new Date(status.timestamp)
        }));
    }
    async clear() {
        await this.context.globalState.update(StatusCache.CACHE_KEY, []);
    }
    async getCount() {
        const cached = await this.getAll();
        return cached.length;
    }
    isCacheFull() {
        // This is a sync method that returns cached count from global state
        const cached = this.context.globalState.get(StatusCache.CACHE_KEY, []);
        return cached.length >= StatusCache.MAX_CACHE_SIZE;
    }
}
exports.StatusCache = StatusCache;
StatusCache.CACHE_KEY = 'cachedStatuses';
StatusCache.MAX_CACHE_SIZE = 50;
//# sourceMappingURL=statusCache.js.map