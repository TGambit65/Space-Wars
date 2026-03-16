export function findShortestPath(adjacencyMap, fromId, toId) {
  if (!adjacencyMap || !fromId || !toId || fromId === toId) return [];

  const queue = [[fromId]];
  const visited = new Set([fromId]);

  while (queue.length > 0) {
    const path = queue.shift();
    const current = path[path.length - 1];

    const neighbors = adjacencyMap.get(current) || [];
    for (const neighbor of neighbors) {
      if (neighbor === toId) return [...path, neighbor];
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...path, neighbor]);
      }
    }
  }
  return [];
}
