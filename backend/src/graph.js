// Graph logic for movies. Written by hand (no graph libraries).
// A movie is a node; each prerequisite is an edge  movie -> prerequisite.

/**
 * Would giving `movieId` the prerequisites `newPrereqIds` create a cycle?
 * A cycle appears if `movieId` is itself a prerequisite (directly or transitively)
 * of any of the new prerequisites, or is one of them.
 *
 * @param {Map<number, {prerequisites:number[]}>} byId current movies
 * @param {number} movieId
 * @param {number[]} newPrereqIds
 */
function wouldCreateCycle(byId, movieId, newPrereqIds) {
  if (newPrereqIds.includes(movieId)) return true;

  const visited = new Set();
  const stack = [...newPrereqIds];
  while (stack.length > 0) {
    const current = stack.pop();
    if (current === movieId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const movie = byId.get(current);
    if (!movie) continue;
    for (const p of movie.prerequisites) stack.push(p);
  }
  return false;
}

/**
 * All transitive prerequisites of `targetId`, each exactly once, ordered so that
 * every movie appears after all of its own prerequisites. Target excluded.
 * Iterative post-order DFS (no recursion, so deep chains cannot overflow the stack).
 * Prerequisites are visited in the order they were listed, making output deterministic.
 */
function rewatchOrder(byId, targetId) {
  const order = [];
  const visited = new Set([targetId]);
  const stack = [{ id: targetId, next: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const prereqs = byId.get(frame.id).prerequisites;

    if (frame.next < prereqs.length) {
      const child = prereqs[frame.next++];
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, next: 0 });
      }
    } else {
      stack.pop();
      // All prerequisites of this movie are already in `order` at this point.
      if (frame.id !== targetId) order.push(frame.id);
    }
  }
  return order;
}

module.exports = { wouldCreateCycle, rewatchOrder };
