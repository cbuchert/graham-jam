const MARKER_START = "// @scene-editor:start";
const MARKER_END = "// @scene-editor:end";

export interface SceneData {
  tiles: number[][];
  spawnPoints: Record<string, { x: number; y: number }>;
}

function extractBlock(content: string): string | null {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) return null;
  return content.slice(startIdx + MARKER_START.length, endIdx);
}

/**
 * Parse tiles and spawn points from between the @scene-editor markers.
 * Returns null if markers are absent.
 */
export function parseSceneFile(content: string): SceneData | null {
  const block = extractBlock(content);
  if (block === null) return null;

  // Match the JSON initializer before the `as` type cast — e.g. TILES = [[...]] as number[][]
  const tilesMatch = block.match(/TILES\s*=\s*(\[[\s\S]*?\])\s*as/);
  const spawnMatch = block.match(/SPAWN_POINTS\s*=\s*(\{[\s\S]*?\})\s*as/);
  if (!tilesMatch || !spawnMatch) return null;

  return {
    tiles: JSON.parse(tilesMatch[1]) as number[][],
    spawnPoints: JSON.parse(spawnMatch[1]) as Record<
      string,
      { x: number; y: number }
    >,
  };
}

/**
 * Serialize scene data into the TypeScript lines that go between the markers.
 * The output is valid TypeScript and round-trips cleanly through parseSceneFile.
 */
export function serializeSceneBlock(data: SceneData): string {
  const tilesJson = JSON.stringify(data.tiles);
  const spawnJson = JSON.stringify(data.spawnPoints);
  return [
    "",
    `export const TILES = ${tilesJson} as number[][];`,
    `export const SPAWN_POINTS = ${spawnJson} as Record<string, { x: number; y: number }>;`,
    "",
  ].join("\n");
}

/**
 * Replace the block between the markers with newBlock.
 * Content outside the markers is preserved exactly.
 * Returns null if markers are absent.
 */
export function replaceMarkerBlock(
  content: string,
  newBlock: string,
): string | null {
  const startIdx = content.indexOf(MARKER_START);
  const endIdx = content.indexOf(MARKER_END);
  if (startIdx === -1 || endIdx === -1) return null;
  return (
    content.slice(0, startIdx + MARKER_START.length) +
    newBlock +
    content.slice(endIdx)
  );
}

/**
 * Extract the list of scene names from the SCENE_NAMES array in worldGraph.ts.
 * Returns an empty array if the array is not found.
 */
export function parseSceneNames(content: string): string[] {
  const match = content.match(/SCENE_NAMES\s*=\s*\[([^\]]*)\]/);
  if (!match) return [];
  return [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}
