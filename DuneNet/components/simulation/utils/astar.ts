/**
 * A* Pathfinding Algorithm
 * Grid-based cost-aware path planner for UGV navigation
 */

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: Node | null;
}

export interface PathPoint {
  x: number;
  y: number;
}

/**
 * A* pathfinding on a 2D cost grid.
 * cost values:  0 = drivable,  5 = rough,  10 = obstacle (impassable)
 */
export function astar(
  grid: number[][],
  start: PathPoint,
  end: PathPoint,
  obstacleThreshold = 10
): PathPoint[] {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return [];

  const key = (x: number, y: number) => `${x},${y}`;

  const heuristic = (a: PathPoint, b: PathPoint) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y); // Manhattan

  const startNode: Node = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };

  const openSet = new Map<string, Node>();
  const closedSet = new Set<string>();
  openSet.set(key(start.x, start.y), startNode);

  const directions = [
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: 0, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ];

  while (openSet.size > 0) {
    // Find node with lowest f in open set
    let current: Node | null = null;
    for (const node of openSet.values()) {
      if (!current || node.f < current.f) current = node;
    }
    if (!current) break;

    // Reached goal
    if (current.x === end.x && current.y === end.y) {
      const path: PathPoint[] = [];
      let n: Node | null = current;
      while (n) {
        path.unshift({ x: n.x, y: n.y });
        n = n.parent;
      }
      return path;
    }

    openSet.delete(key(current.x, current.y));
    closedSet.add(key(current.x, current.y));

    for (const dir of directions) {
      const nx = current.x + dir.dx;
      const ny = current.y + dir.dy;

      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (closedSet.has(key(nx, ny))) continue;

      const cellCost = grid[ny]?.[nx] ?? 0;
      if (cellCost >= obstacleThreshold) continue; // impassable

      const isDiagonal = dir.dx !== 0 && dir.dy !== 0;
      const moveCost = isDiagonal ? 1.414 : 1;
      // Add terrain cost penalty: rough terrain (cost ~5) is penalized
      const terrainPenalty = cellCost * 0.5;
      const tentativeG = current.g + moveCost + terrainPenalty;

      const existingKey = key(nx, ny);
      const existing = openSet.get(existingKey);

      if (existing && tentativeG >= existing.g) continue;

      const node: Node = {
        x: nx,
        y: ny,
        g: tentativeG,
        h: heuristic({ x: nx, y: ny }, end),
        f: tentativeG + heuristic({ x: nx, y: ny }, end),
        parent: current,
      };

      openSet.set(existingKey, node);
    }
  }

  return []; // No path found
}

/**
 * Smooth a path by averaging adjacent points
 */
export function smoothPath(path: PathPoint[], iterations = 2, weight = 0.3): PathPoint[] {
  if (path.length < 3) return path;

  let smoothed = [...path.map((p) => ({ ...p }))];

  for (let iter = 0; iter < iterations; iter++) {
    const next = smoothed.map((p) => ({ ...p }));
    for (let i = 1; i < smoothed.length - 1; i++) {
      next[i].x += weight * (smoothed[i - 1].x + smoothed[i + 1].x - 2 * smoothed[i].x);
      next[i].y += weight * (smoothed[i - 1].y + smoothed[i + 1].y - 2 * smoothed[i].y);
    }
    smoothed = next;
  }

  return smoothed;
}
