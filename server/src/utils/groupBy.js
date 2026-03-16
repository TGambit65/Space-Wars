/**
 * Group an array of items into a Map by a given key.
 * @param {Array} items
 * @param {string} key
 * @returns {Map} key value -> array of items
 */
function groupBy(items, key) {
  const map = new Map();
  for (const item of items) {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}

module.exports = groupBy;
