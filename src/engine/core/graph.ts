export type ID = string;
export const uid = () => Math.random().toString(36).substring(2, 9);
export const MERGE_TOLERANCE_UM = 5n;

export interface SpatialIndex {
    insertEdge(edgeId: ID): void;
    removeEdge(edgeId: ID): void;
    insertVertex(vertexId: ID): void;
    removeVertex(vertexId: ID): void;
    queryAABB(minX: bigint, minY: bigint, maxX: bigint, maxY: bigint): ID[];
    queryVerticesAABB(minX: bigint, minY: bigint, maxX: bigint, maxY: bigint): ID[];
}

export interface Vertex {
    id: ID;
    x: bigint;
    y: bigint;
    orderedEdges: ID[];
    isDeleted: boolean;
}

export interface Edge {
    id: ID;
    v1: ID;
    v2: ID;
}

export class ModelGraph {
    public vertices = new Map<ID, Vertex>();
    public edges = new Map<ID, Edge>();
}

export interface RationalT {
    num: bigint;
    den: bigint;
}

export class LinearSpatialIndex implements SpatialIndex {
    public vertexIds = new Set<ID>();
    public edgeIds = new Set<ID>();

    constructor(private graph: ModelGraph) {}
    
    insertEdge(edgeId: ID): void { this.edgeIds.add(edgeId); }
    removeEdge(edgeId: ID): void { this.edgeIds.delete(edgeId); }
    insertVertex(vertexId: ID): void { this.vertexIds.add(vertexId); }
    removeVertex(vertexId: ID): void { this.vertexIds.delete(vertexId); }
    
    queryAABB(minX: bigint, minY: bigint, maxX: bigint, maxY: bigint): ID[] {
        const results: ID[] = [];
        for (const id of this.edgeIds) {
            const edge = this.graph.edges.get(id);
            if (!edge) continue;
            const v1 = this.graph.vertices.get(edge.v1);
            const v2 = this.graph.vertices.get(edge.v2);
            if (!v1 || !v2 || v1.isDeleted || v2.isDeleted) continue;
            
            const eMinX = v1.x < v2.x ? v1.x : v2.x;
            const eMaxX = v1.x > v2.x ? v1.x : v2.x;
            const eMinY = v1.y < v2.y ? v1.y : v2.y;
            const eMaxY = v1.y > v2.y ? v1.y : v2.y;
            
            if (eMaxX < minX || eMinX > maxX || eMaxY < minY || eMinY > maxY) continue;
            results.push(id);
        }
        return results;
    }

    queryVerticesAABB(minX: bigint, minY: bigint, maxX: bigint, maxY: bigint): ID[] {
        const results: ID[] = [];
        for (const id of this.vertexIds) {
            const v = this.graph.vertices.get(id);
            if (!v || v.isDeleted) continue;
            if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) {
                results.push(id);
            }
        }
        return results;
    }
}

export function roundHalfEven(num: bigint, den: bigint): bigint {
    const isNegative = (num < 0n) !== (den < 0n);
    let absNum = num < 0n ? -num : num;
    let absDen = den < 0n ? -den : den;
    if (absDen === 0n) return 0n;

    let quotient = absNum / absDen;
    let remainder = absNum % absDen;
    let doubledRemainder = remainder * 2n;

    if (doubledRemainder > absDen || (doubledRemainder === absDen && (quotient % 2n) !== 0n)) {
        quotient += 1n;
    }
    return isNegative ? -quotient : quotient;
}

export function projectToUm(num: bigint, den: bigint): bigint {
    return roundHalfEven(num, den);
}

export function gridSnap(x: bigint, pitch: bigint): bigint {
    if (pitch <= 0n) return x;
    const half = pitch / 2n;
    if (x >= 0n) return ((x + half) / pitch) * pitch;
    return ((x - half) / pitch) * pitch;
}

export function ccw(ax: bigint, ay: bigint, bx: bigint, by: bigint, cx: bigint, cy: bigint): bigint {
    return (cx - ax) * (by - ay) - (cy - ay) * (bx - ax);
}

export function computeSegmentIntersectionT(
    ax: bigint, ay: bigint, bx: bigint, by: bigint,
    cx: bigint, cy: bigint, dx: bigint, dy: bigint
): { t1: RationalT, t2: RationalT } | null {
    const vx = bx - ax; const vy = by - ay;
    const wx = dx - cx; const wy = dy - cy;
    const ux = ax - cx; const uy = ay - cy;

    const det = vx * wy - vy * wx;
    if (det === 0n) return null;

    let t1Num = wy * ux - wx * uy;
    let t2Num = vy * ux - vx * uy;
    let den = det;

    if (den < 0n) {
        den = -den;
        t1Num = -t1Num;
        t2Num = -t2Num;
    }

    if (t1Num > 0n && t1Num < den && t2Num > 0n && t2Num < den) {
        return { t1: { num: t1Num, den }, t2: { num: t2Num, den } };
    }
    return null;
}

export function getPointPenetrationT(ax: bigint, ay: bigint, bx: bigint, by: bigint, px: bigint, py: bigint): RationalT | null {
    if (ccw(ax, ay, bx, by, px, py) !== 0n) return null;
    
    // Dot product for exact bounds check
    const ABx = bx - ax; const ABy = by - ay;
    const APx = px - ax; const APy = py - ay;
    
    const num = APx * ABx + APy * ABy;
    const den = ABx * ABx + ABy * ABy;
    
    if (num > 0n && num < den) return { num, den };
    return null;
}

export function createRawVertex(graph: ModelGraph, spatial: SpatialIndex, x: bigint, y: bigint): Vertex {
    // 3. raw vertex の最小一意性保証 "完全一致は事前統合"
    const candidates = spatial.queryVerticesAABB(x, y, x, y);
    for (const cid of candidates) {
        const v = graph.vertices.get(cid);
        if (v && !v.isDeleted && v.x === x && v.y === y) {
            return v;
        }
    }

    const newV: Vertex = { id: uid(), x, y, orderedEdges: [], isDeleted: false };
    graph.vertices.set(newV.id, newV);
    spatial.insertVertex(newV.id);
    return newV;
}

export function createRawEdge(graph: ModelGraph, spatial: SpatialIndex, v1: Vertex, v2: Vertex): Edge {
    const edge: Edge = { id: uid(), v1: v1.id, v2: v2.id };
    graph.edges.set(edge.id, edge);
    spatial.insertEdge(edge.id);

    if (!v1.orderedEdges.includes(edge.id)) v1.orderedEdges.push(edge.id);
    if (!v2.orderedEdges.includes(edge.id)) v2.orderedEdges.push(edge.id);

    return edge;
}

export function angle(v: Vertex, other: Vertex): number {
    return Math.atan2(Number(other.y - v.y), Number(other.x - v.x));
}

export function rebuildEdgeOrder(graph: ModelGraph, vertex: Vertex): void {
    vertex.orderedEdges.sort((edgeIdA, edgeIdB) => {
        const edgeA = graph.edges.get(edgeIdA);
        const edgeB = graph.edges.get(edgeIdB);
        if (!edgeA || !edgeB) return 0;
        const otherAId = edgeA.v1 === vertex.id ? edgeA.v2 : edgeA.v1;
        const otherBId = edgeB.v1 === vertex.id ? edgeB.v2 : edgeB.v1;
        const otherA = graph.vertices.get(otherAId);
        const otherB = graph.vertices.get(otherBId);
        if (!otherA || !otherB || otherA.isDeleted || otherB.isDeleted) return 0;
        return angle(vertex, otherA) - angle(vertex, otherB);
    });
}

function dedupeRationals(tList: RationalT[]): RationalT[] {
    const unique: RationalT[] = [];
    for (const t of tList) {
        if (!unique.some(u => u.num * t.den === t.num * u.den)) {
            unique.push(t);
        }
    }
    return unique.sort((a, b) => {
        const diff = a.num * b.den - b.num * a.den;
        return diff < 0n ? -1 : (diff > 0n ? 1 : 0);
    });
}

export function areVerticesConnected(graph: ModelGraph, vA: ID, vB: ID): boolean {
    const v1 = graph.vertices.get(vA);
    if (!v1) return false;
    for (const eid of v1.orderedEdges) {
        const e = graph.edges.get(eid);
        if (e && ((e.v1 === vA && e.v2 === vB) || (e.v1 === vB && e.v2 === vA))) {
            return true;
        }
    }
    return false;
}

function executeAtomicSplits(graph: ModelGraph, spatial: SpatialIndex, edgeId: ID, tList: RationalT[]): void {
    const edge = graph.edges.get(edgeId);
    if (!edge) return;
    
    const uniqueT = dedupeRationals(tList);
    if (uniqueT.length === 0) return;

    const vStart = graph.vertices.get(edge.v1)!;
    const vEnd = graph.vertices.get(edge.v2)!;

    graph.edges.delete(edgeId);
    spatial.removeEdge(edgeId);
    vStart.orderedEdges = vStart.orderedEdges.filter(id => id !== edgeId);
    vEnd.orderedEdges = vEnd.orderedEdges.filter(id => id !== edgeId);

    let prevV = vStart;
    for (const t of uniqueT) {
        const px = projectToUm(vStart.x * t.den + (vEnd.x - vStart.x) * t.num, t.den);
        const py = projectToUm(vStart.y * t.den + (vEnd.y - vStart.y) * t.num, t.den);
        
        const newV = createRawVertex(graph, spatial, px, py);
        createRawEdge(graph, spatial, prevV, newV);
        prevV = newV;
    }
    createRawEdge(graph, spatial, prevV, vEnd);
}

export function applyGeometryGridMerge(
    graph: ModelGraph, 
    spatial: SpatialIndex, 
    minX: bigint, minY: bigint, maxX: bigint, maxY: bigint
): void {
    const gridMap = new Map<string, ID[]>();
    
    const searchMinX = minX - MERGE_TOLERANCE_UM;
    const searchMaxX = maxX + MERGE_TOLERANCE_UM;
    const searchMinY = minY - MERGE_TOLERANCE_UM;
    const searchMaxY = maxY + MERGE_TOLERANCE_UM;

    const candidateVertices = spatial.queryVerticesAABB(searchMinX, searchMinY, searchMaxX, searchMaxY);

    for (const vid of candidateVertices) {
        const v = graph.vertices.get(vid);
        if (!v || v.isDeleted) continue;
        const gx = gridSnap(v.x, MERGE_TOLERANCE_UM);
        const gy = gridSnap(v.y, MERGE_TOLERANCE_UM);
        const key = `${gx},${gy}`;
        
        if (!gridMap.has(key)) gridMap.set(key, []);
        gridMap.get(key)!.push(v.id);
    }

    // 1. Merge rule enforcement: DO NOT merge vertices sharing an edge segment.
    for (const vids of gridMap.values()) {
        if (vids.length <= 1) continue;
        vids.sort(); // Dedupe order non-dependency
        
        const mergedSets: ID[][] = [];
        for (const vid of vids) {
            let placed = false;
            for (const set of mergedSets) {
                let connected = false;
                for (const memberId of set) {
                    if (areVerticesConnected(graph, vid, memberId)) {
                        connected = true; break;
                    }
                }
                if (!connected) {
                    set.push(vid);
                    placed = true;
                    break;
                }
            }
            if (!placed) {
                mergedSets.push([vid]);
            }
        }

        for (const set of mergedSets) {
            if (set.length <= 1) continue;
            set.sort();
            const repId = set[0];
            const repV = graph.vertices.get(repId)!;

            for (let i = 1; i < set.length; i++) {
                const deadId = set[i];
                const deadV = graph.vertices.get(deadId)!;
                deadV.isDeleted = true;
                spatial.removeVertex(deadId);
                graph.vertices.delete(deadId);

                for (const eid of deadV.orderedEdges) {
                    const edge = graph.edges.get(eid);
                    if (!edge) continue;
                    let changed = false;
                    if (edge.v1 === deadId) { edge.v1 = repId; changed = true; }
                    if (edge.v2 === deadId) { edge.v2 = repId; changed = true; }
                    if (changed && !repV.orderedEdges.includes(eid)) {
                        repV.orderedEdges.push(eid);
                    }
                }
            }
            rebuildEdgeOrder(graph, repV);
        }
    }

    const edgesToDelete = new Set<ID>();
    const seenPairs = new Set<string>();

    const candidateEdges = spatial.queryAABB(searchMinX, searchMinY, searchMaxX, searchMaxY);
    for (const eid of candidateEdges) {
        const edge = graph.edges.get(eid);
        if (!edge) continue;
        if (edge.v1 === edge.v2) {
            edgesToDelete.add(eid);
        } else {
            const pair = [edge.v1, edge.v2].sort().join('-');
            if (seenPairs.has(pair)) {
                edgesToDelete.add(eid);
            } else {
                seenPairs.add(pair);
            }
        }
    }

    for (const eid of edgesToDelete) {
        const edge = graph.edges.get(eid);
        if (!edge) continue;
        graph.edges.delete(eid);
        spatial.removeEdge(eid);
        
        const v1 = graph.vertices.get(edge.v1);
        if (v1) { v1.orderedEdges = v1.orderedEdges.filter(e => e !== eid); rebuildEdgeOrder(graph, v1); }
        const v2 = graph.vertices.get(edge.v2);
        if (v2) { v2.orderedEdges = v2.orderedEdges.filter(e => e !== eid); rebuildEdgeOrder(graph, v2); }
    }

    for (const vid of candidateVertices) {
        const v = graph.vertices.get(vid);
        if (v && v.orderedEdges.length === 0) {
            v.isDeleted = true;
            graph.vertices.delete(vid);
            spatial.removeVertex(vid);
        }
    }
}

export function normalizeLocal(
    graph: ModelGraph, 
    spatial: SpatialIndex, 
    minX: bigint, minY: bigint, maxX: bigint, maxY: bigint
): void {
    const candidateEdges = spatial.queryAABB(minX, minY, maxX, maxY);
    const candidateVertices = spatial.queryVerticesAABB(minX, minY, maxX, maxY);

    const splitPlans = new Map<ID, RationalT[]>();

    for (let i = 0; i < candidateEdges.length; i++) {
        const e1 = graph.edges.get(candidateEdges[i]);
        if (!e1) continue;
        const vA = graph.vertices.get(e1.v1);
        const vB = graph.vertices.get(e1.v2);
        if (!vA || !vB || vA.isDeleted || vB.isDeleted) continue;

        for (let j = i + 1; j < candidateEdges.length; j++) {
            const e2 = graph.edges.get(candidateEdges[j]);
            if (!e2) continue;
            const vC = graph.vertices.get(e2.v1);
            const vD = graph.vertices.get(e2.v2);
            if (!vC || !vD || vC.isDeleted || vD.isDeleted) continue;

            const ints = computeSegmentIntersectionT(vA.x, vA.y, vB.x, vB.y, vC.x, vC.y, vD.x, vD.y);
            if (ints) {
                if (!splitPlans.has(e1.id)) splitPlans.set(e1.id, []);
                splitPlans.get(e1.id)!.push(ints.t1);
                if (!splitPlans.has(e2.id)) splitPlans.set(e2.id, []);
                splitPlans.get(e2.id)!.push(ints.t2);
            }
        }

        for (const vid of candidateVertices) {
            if (vid === vA.id || vid === vB.id) continue;
            const v = graph.vertices.get(vid);
            if (!v || v.isDeleted) continue;

            const pt = getPointPenetrationT(vA.x, vA.y, vB.x, vB.y, v.x, v.y);
            if (pt) {
                if (!splitPlans.has(e1.id)) splitPlans.set(e1.id, []);
                splitPlans.get(e1.id)!.push(pt);
            }
        }
    }

    for (const [eId, tList] of splitPlans) {
        executeAtomicSplits(graph, spatial, eId, tList);
    }
}

export function insertLine(graph: ModelGraph, spatial: SpatialIndex, ax: bigint, ay: bigint, bx: bigint, by: bigint): void {
    if (ax === bx && ay === by) return;

    // 1. Create pure exact initial segment for the insertion
    const vStart = createRawVertex(graph, spatial, ax, ay);
    const vEnd = createRawVertex(graph, spatial, bx, by);
    createRawEdge(graph, spatial, vStart, vEnd);

    // 2. Affected region
    const r = MERGE_TOLERANCE_UM;
    const minX = (ax < bx ? ax : bx) - r;
    const maxX = (ax > bx ? ax : bx) + r;
    const minY = (ay < by ? ay : by) - r;
    const maxY = (ay > by ? ay : by) + r;

    // 3. Local Normalization (finds all intersections including the highly overlapping ones, and new line ones)
    normalizeLocal(graph, spatial, minX, minY, maxX, maxY);

    // 4. Geometry Grid Merge (resolve local merges and clean up local disconnected points)
    applyGeometryGridMerge(graph, spatial, minX, minY, maxX, maxY);
}
