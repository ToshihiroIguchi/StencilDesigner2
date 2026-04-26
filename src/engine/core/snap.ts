import { ModelGraph, gridSnap } from './graph';

export type SnapType = 'none' | 'grid' | 'endpoint' | 'midpoint';

export interface SnapProposal {
    type: SnapType;
    worldX: bigint;
    worldY: bigint;
    vertexId?: string;
}

/**
 * Geometry Layer: Snap Resolution
 * 
 * 確定処理は Geometry 層で行う。「ワールド空間内でのトレランス（μm）」内で
 * トポロジーを検索し、確定したSnapProposalを返すのみとする。
 * 
 * ピクセルやズームに依存してはいけない（変換はすべてView層の責務となる）。
 */
export function resolveSnapToVertex(
    graph: ModelGraph, 
    searchX: bigint, 
    searchY: bigint, 
    toleranceUm: bigint,
    gridPitchUm: bigint
): SnapProposal {
    
    let bestDistEndpoint = toleranceUm;
    let endpointSnap: { x: bigint, y: bigint } | null = null;
    let endpointId: string | null = null;

    let bestDistMidpoint = toleranceUm;
    let midpointSnap: { x: bigint, y: bigint } | null = null;

    // 1. Endpoint Check
    for (const v of graph.vertices.values()) {
        if (v.isDeleted) continue;
        const dx = v.x > searchX ? v.x - searchX : searchX - v.x;
        const dy = v.y > searchY ? v.y - searchY : searchY - v.y;
        
        // Use Manhattan distance for fast filtering, Euclidean squared for exact
        if (dx > toleranceUm || dy > toleranceUm) continue;

        const distSq = dx * dx + dy * dy;
        const tolSq = toleranceUm * toleranceUm;
        // Approximation logic for hierarchy strict ranking
        const maxDist = dx > dy ? dx : dy;
        
        if (distSq <= tolSq && maxDist < bestDistEndpoint) {
            bestDistEndpoint = maxDist;
            endpointSnap = { x: v.x, y: v.y };
            endpointId = v.id;
        }
    }

    // 2. Midpoint Check
    for (const e of graph.edges.values()) {
        const v1 = graph.vertices.get(e.v1);
        const v2 = graph.vertices.get(e.v2);
        if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;

        const mx = (v1.x + v2.x) / 2n;
        const my = (v1.y + v2.y) / 2n;

        const dx = mx > searchX ? mx - searchX : searchX - mx;
        const dy = my > searchY ? my - searchY : searchY - my;

        if (dx > toleranceUm || dy > toleranceUm) continue;

        const distSq = dx * dx + dy * dy;
        const tolSq = toleranceUm * toleranceUm;
        const maxDist = dx > dy ? dx : dy;

        if (distSq <= tolSq && maxDist < bestDistMidpoint) {
            bestDistMidpoint = maxDist;
            midpointSnap = { x: mx, y: my };
        }
    }

    // 3. Target grid snap
    const gx = gridSnap(searchX, gridPitchUm);
    const gy = gridSnap(searchY, gridPitchUm);
    const dx = gx > searchX ? gx - searchX : searchX - gx;
    const dy = gy > searchY ? gy - searchY : searchY - gy;
    const distGridSq = dx * dx + dy * dy;
    const tolSq = toleranceUm * toleranceUm;

    let finalType: SnapType = 'none';
    let finalWorldX = searchX;
    let finalWorldY = searchY;
    let finalVertexId: string | undefined = undefined;

    if (endpointSnap) {
        finalWorldX = endpointSnap.x;
        finalWorldY = endpointSnap.y;
        finalType = 'endpoint';
        finalVertexId = endpointId || undefined;
    } else if (midpointSnap) {
        finalWorldX = midpointSnap.x;
        finalWorldY = midpointSnap.y;
        finalType = 'midpoint';
    } else if (distGridSq <= tolSq) {
        finalWorldX = gx;
        finalWorldY = gy;
        finalType = 'grid';
    }

    return { type: finalType, worldX: finalWorldX, worldY: finalWorldY, vertexId: finalVertexId };
}
