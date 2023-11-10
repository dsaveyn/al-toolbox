const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 0 }); // Set a default TTL of 60 seconds

module.exports = {
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value),
    del: (key) => cache.del(key),
}