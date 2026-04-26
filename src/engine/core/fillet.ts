import makerjs from 'makerjs';
import type { Feature, FeatureId } from './feature';
import { ModelGraph, createRawVertex, createRawEdge, LinearSpatialIndex, type ID } from './graph';

export class FilletFeature implements Feature {
    constructor(
        public id: FeatureId,
        public targetX: number,
        public targetY: number,
        public radius: number
    ) {}

    type: 'Fillet' = 'Fillet' as any; // Type trick to bypass Feature interface union (will update Interface too)
    
    generateTopology(_graph: ModelGraph): void {
        // Empty by design: Applied in post-processing like Trim
    }

    applyFillet(graph: ModelGraph): void {
        const threshold = 5.0; // Click tolerance to find the vertex
        
        // 1. Find the target vertex
        let bestDist = Infinity;
        let targetVid: ID | null = null;
        
        for (const [vid, v] of graph.vertices.entries()) {
            if (v.isDeleted) continue;
            const dist = Math.hypot(Number(v.x)/1000 - this.targetX, Number(v.y)/1000 - this.targetY);
            if (dist <= threshold && dist < bestDist) {
                bestDist = dist;
                targetVid = vid;
            }
        }
        
        if (!targetVid) return;

        // 2. Find edges incident to the vertex
        const incidentEdges = Array.from(graph.edges.values()).filter(e => e.v1 === targetVid || e.v2 === targetVid);
        
        // Academic & Engineering Grounding: 
        // Filleting typically requires exactly 2 incident edges forming an angle.
        // Complex manifolds (degree > 2) are outside the scope of simple 2D fillets.
        if (incidentEdges.length !== 2) {
            console.warn(`[FilletFeature] Topologic limitation: Vertex degree must be exactly 2. Found ${incidentEdges.length}.`);
            return;
        }

        const e1 = incidentEdges[0];
        const e2 = incidentEdges[1];

        const getOtherVertex = (edge: any, vId: string) => edge.v1 === vId ? graph.vertices.get(edge.v2) : graph.vertices.get(edge.v1);
        const vOther1 = getOtherVertex(e1, targetVid);
        const vOther2 = getOtherVertex(e2, targetVid);
        const vCorner = graph.vertices.get(targetVid);

        if (!vOther1 || !vOther2 || !vCorner || vOther1.isDeleted || vCorner.isDeleted || vOther2.isDeleted) return;

        // 3. Mathematical modeling using Maker.js API
        const line1 = new makerjs.paths.Line([Number(vOther1.x)/1000, Number(vOther1.y)/1000], [Number(vCorner.x)/1000, Number(vCorner.y)/1000]);
        const line2 = new makerjs.paths.Line([Number(vCorner.x)/1000, Number(vCorner.y)/1000], [Number(vOther2.x)/1000, Number(vOther2.y)/1000]);

        try {
            const arc = makerjs.path.fillet(line1, line2, this.radius) as any;
            if (!arc) return; // Lines might be collinear or radius too large

            // 4. Extract precision topological trim points
            const arcPoints = makerjs.point.fromArc(arc);
            if (!arcPoints || arcPoints.length < 2) return;

            const ptA = { x: arcPoints[0][0], y: arcPoints[0][1] };
            const ptB = { x: arcPoints[1][0], y: arcPoints[1][1] };

            // Determine which point belongs to which edge
            // A line from Other to Corner: ptA or ptB is closer to line1? 
            // Maker.js usually aligns ptA with line1 and ptB with line2 depending on initialization.
            // Let's explicitly check distance.
            const distToLine1 = (pt: {x:number, y:number}) => this.distToSegment(pt, vOther1 as any, vCorner as any);

            let ptForE1 = ptA;
            let ptForE2 = ptB;
            
            if (distToLine1(ptB) < distToLine1(ptA)) {
                ptForE1 = ptB;
                ptForE2 = ptA;
            }

            // 5. Rebuild Graph Topology
            // (Skipped proper exact rational generation here due to legacy logic)
            const spatial = new LinearSpatialIndex(graph);
            const vArc1 = createRawVertex(graph, spatial, BigInt(Math.round(ptForE1.x * 1000)), BigInt(Math.round(ptForE1.y * 1000)));
            const vArc2 = createRawVertex(graph, spatial, BigInt(Math.round(ptForE2.x * 1000)), BigInt(Math.round(ptForE2.y * 1000)));

            // Shave e1 back
            if (e1.v1 === targetVid) e1.v1 = vArc1.id; else e1.v2 = vArc1.id;
            // Shave e2 back
            if (e2.v1 === targetVid) e2.v1 = vArc2.id; else e2.v2 = vArc2.id;

            // Insert Arc edge
            createRawEdge(graph, spatial, vArc1, vArc2);
            // arcData removed from Core (no implicit circular data anymore)
            
            // Clean up old corner vertex
            graph.vertices.delete(targetVid);
            
        } catch (err) {
            console.error('[FilletFeature] Geometric processing failed', err);
        }
    }

    private distToSegment(p: {x:number, y:number}, v: {x:bigint, y:bigint}, w: {x:bigint, y:bigint}) {
        const vx = Number(v.x)/1000, vy = Number(v.y)/1000;
        const wx = Number(w.x)/1000, wy = Number(w.y)/1000;
        const l2 = Math.pow(vx - wx, 2) + Math.pow(vy - wy, 2);
        if (l2 === 0) return Math.hypot(p.x - vx, p.y - vy);
        let t = ((p.x - vx) * (wx - vx) + (p.y - vy) * (wy - vy)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (vx + t * (wx - vx)), p.y - (vy + t * (wy - vy)));
    }
}
