const NodeCache = require('node-cache');

// Cache instance with a standard TTL (Time To Live) of 1 hour (3600 seconds)
// This can be adjusted based on performance needs and data freshness requirements.
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

/**
 * Sets a value in the cache.
 * @param {string} key The cache key.
 * @param {*} value The value to store.
 * @param {number} [ttl] Optional TTL in seconds. Defaults to global TTL.
 * @returns {boolean} True if the value was set, false otherwise.
 */
function set(key, value, ttl) {
    return cache.set(key, value, ttl);
}

/**
 * Gets a value from the cache.
 * @param {string} key The cache key.
 * @returns {*} The cached value or undefined if not found.
 */
function get(key) {
    return cache.get(key);
}

/**
 * Deletes a key from the cache.
 * @param {string} key The cache key.
 * @returns {number} The number of deleted keys (0 or 1).
 */
function del(key) {
    return cache.del(key);
}

/**
 * Generates a cache key from a request object.
 * @param {Object} req The Express request object.
 * @returns {string} The generated cache key.
 */
function generateCacheKey(req) {
    // Use the request path and query parameters to create a unique key
    const path = req.path;
    const query = JSON.stringify(req.body || req.query);
    return `${path}:${query}`;
}

module.exports = {
    set,
    get,
    del,
    generateCacheKey
};
