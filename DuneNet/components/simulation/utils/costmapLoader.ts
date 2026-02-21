/**
 * Costmap Loader & Generator
 * Handles JSON costmap import and procedural generation
 */

export interface CostmapData {
  width: number;
  height: number;
  data: number[][];
}

/**
 * Generate a procedural costmap with scattered obstacles and rough terrain
 */
export function generateProceduralCostmap(
  width: number = 256,
  height: number = 256,
  obstacleDensity: number = 0.04,
  roughDensity: number = 0.12,
  seed: number = 42
): CostmapData {
  // Simple seeded pseudo-random
  let s = seed;
  const rand = () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };

  const data: number[][] = [];

  for (let y = 0; y < height; y++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const r = rand();
      // Keep center area more open for spawn
      const cx = Math.abs(x - width / 2) / (width / 2);
      const cy = Math.abs(y - height / 2) / (height / 2);
      const distFromCenter = Math.sqrt(cx * cx + cy * cy);

      // Reduce obstacles near center
      const centerFactor = Math.max(0, 1 - distFromCenter * 0.5);
      const adjustedObstDensity = obstacleDensity * (1 - centerFactor * 0.8);
      const adjustedRoughDensity = roughDensity * (1 - centerFactor * 0.4);

      if (r < adjustedObstDensity) {
        row.push(10); // obstacle
      } else if (r < adjustedObstDensity + adjustedRoughDensity) {
        row.push(5); // rough
      } else {
        row.push(0); // drivable
      }
    }
    data.push(row);
  }

  // Create some obstacle clusters for realism
  for (let i = 0; i < 20; i++) {
    const cx = Math.floor(rand() * width);
    const cy = Math.floor(rand() * height);
    const radius = Math.floor(rand() * 5) + 2;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (dx * dx + dy * dy <= radius * radius) {
          if (rand() < 0.7) {
            data[ny][nx] = 10;
          }
        }
      }
    }
  }

  // Ensure start area (center) is clear
  const clearRadius = 8;
  const midX = Math.floor(width / 2);
  const midY = Math.floor(height / 2);
  for (let dy = -clearRadius; dy <= clearRadius; dy++) {
    for (let dx = -clearRadius; dx <= clearRadius; dx++) {
      const nx = midX + dx;
      const ny = midY + dy;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height) {
        data[ny][nx] = 0;
      }
    }
  }

  return { width, height, data };
}

/**
 * Parse a JSON costmap (from Python pipeline)
 */
export function parseCostmap(json: string): CostmapData {
  const parsed = JSON.parse(json);
  return {
    width: parsed.width,
    height: parsed.height,
    data: parsed.data,
  };
}

/**
 * Convert grid coordinates to world coordinates
 */
export function gridToWorld(
  gx: number,
  gy: number,
  gridWidth: number,
  gridHeight: number,
  worldSize: number = 200
): [number, number] {
  const wx = (gx / gridWidth - 0.5) * worldSize;
  const wz = (gy / gridHeight - 0.5) * worldSize;
  return [wx, wz];
}

/**
 * Convert world coordinates to grid coordinates
 */
export function worldToGrid(
  wx: number,
  wz: number,
  gridWidth: number,
  gridHeight: number,
  worldSize: number = 200
): [number, number] {
  const gx = Math.round((wx / worldSize + 0.5) * gridWidth);
  const gy = Math.round((wz / worldSize + 0.5) * gridHeight);
  return [
    Math.max(0, Math.min(gridWidth - 1, gx)),
    Math.max(0, Math.min(gridHeight - 1, gy)),
  ];
}
