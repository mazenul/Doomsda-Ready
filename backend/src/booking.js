// Fewest-bundles exact-sum problem (unbounded coin change), solved with dynamic programming.
// Written by hand (no libraries).

/**
 * @param {number[]} sizes distinct bundle sizes (positive integers)
 * @param {number} groupSize target number of seats
 * @returns {{possible:boolean, totalBundles:number|null, bundles:{size:number,count:number}[]}}
 */
function minBundles(sizes, groupSize) {
  // Largest first, with a strict "<" below, so ties are broken in favour of larger bundles.
  const sorted = [...sizes].sort((a, b) => b - a);

  const best = new Array(groupSize + 1).fill(Infinity); // best[t] = fewest bundles summing to t
  const lastUsed = new Array(groupSize + 1).fill(0);    // lastUsed[t] = bundle size used to reach t
  best[0] = 0;

  for (let total = 1; total <= groupSize; total++) {
    for (const size of sorted) {
      if (size > total) continue;
      const candidate = best[total - size] + 1;
      if (candidate < best[total]) {
        best[total] = candidate;
        lastUsed[total] = size;
      }
    }
  }

  if (best[groupSize] === Infinity) {
    return { possible: false, totalBundles: null, bundles: [] };
  }

  const counts = new Map();
  for (let t = groupSize; t > 0; t -= lastUsed[t]) {
    counts.set(lastUsed[t], (counts.get(lastUsed[t]) || 0) + 1);
  }
  const bundles = [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.size - a.size);

  return { possible: true, totalBundles: best[groupSize], bundles };
}

module.exports = { minBundles };
