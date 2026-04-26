import { ModelGraph } from './graph';
import { CoordinateTransformer, ToleranceManager, ViewState } from './viewport';

/**
 * Snap Engine
 * 
 * URL: https://en.wikipedia.org/wiki/Spatial_database#Spatial_index
 * Engineering Grounding: CADにおけるスナップ（最近接探索）は要素が増えるとO(N)では遅くなるため、
 * R-treeや四分木（Quadtree）等の空間分割アルゴリズムを用いるのが一般的です。
 * 本フェーズでは実装規模に合わせて総当たり探索を行いますが、抽象インターフェースは将来の空間インデックス導入に対応可能にしています。
 */

export type SnapType = 'none' | 'grid' | 'endpoint' | 'midpoint';

export interface SnapResult {
    modelPt: { x: number, y: number };
    screenPt: { x: number, y: number };
    type: SnapType;
    vertexId?: string; // NEW: Track vertex for sticky dimensions
}

export class SnapEngine {
    constructor(
        private graph: ModelGraph,
        private transformer: CoordinateTransformer,
        private viewState: ViewState
    ) {}

    /**
     * Finds the best snap point around a given screen coordinate.
     * Evaluates in order of exactness: Endpoint > Midpoint > Grid 
     * threshold is internally translated to topological model distance.
     */
    snap(screenX: number, screenY: number, screenRadius: number = 10): SnapResult {
        const rawModelPt = this.transformer.screenToModel(screenX, screenY);
        // Conver 10px to model mm radius
        const modelRadius = screenRadius / this.viewState.zoom;
        const gridMm = ToleranceManager.getGridInterval(this.viewState.zoom);

        let bestDistEndpoint = Infinity;
        let endpointSnap: { x: number, y: number } | null = null;
        let endpointId: string | null = null;
        
        let bestDistMidpoint = Infinity;
        let midpointSnap: { x: number, y: number } | null = null;

        // 1. Endpoint Check
        for (const v of this.graph.vertices.values()) {
            const vxMm = Number(v.x) / 1000;
            const vyMm = Number(v.y) / 1000;
            const dist = Math.hypot(vxMm - rawModelPt.x, vyMm - rawModelPt.y);
            if (dist <= modelRadius && dist < bestDistEndpoint) {
                bestDistEndpoint = dist;
                endpointSnap = { x: vxMm, y: vyMm };
                endpointId = v.id;
            }
        }

        // 2. Midpoint Check
        for (const e of this.graph.edges.values()) {
            const v1 = this.graph.vertices.get(e.v1);
            const v2 = this.graph.vertices.get(e.v2);
            if (!v1 || !v2) continue;

            const mx = (Number(v1.x) / 1000 + Number(v2.x) / 1000) / 2;
            const my = (Number(v1.y) / 1000 + Number(v2.y) / 1000) / 2;

            const dist = Math.hypot(mx - rawModelPt.x, my - rawModelPt.y);
            if (dist <= modelRadius && dist < bestDistMidpoint) {
                bestDistMidpoint = dist;
                midpointSnap = { x: mx, y: my };
            }
        }

        // Target grid snap
        const gx = Math.round(rawModelPt.x / gridMm) * gridMm;
        const gy = Math.round(rawModelPt.y / gridMm) * gridMm;
        const distGrid = Math.hypot(gx - rawModelPt.x, gy - rawModelPt.y);

        let finalModelPt = { x: ToleranceManager.canonicalize(rawModelPt.x), y: ToleranceManager.canonicalize(rawModelPt.y) };
        let finalType: SnapType = 'none';
        let finalVertexId: string | undefined = undefined;

        if (endpointSnap) {
            finalModelPt = endpointSnap;
            finalType = 'endpoint';
            finalVertexId = endpointId || undefined;
        } else if (midpointSnap) {
            finalModelPt = midpointSnap;
            finalType = 'midpoint';
        } else if (distGrid <= modelRadius) {
            finalModelPt = { x: gx, y: gy };
            finalType = 'grid';
        }

        const finalScreenPt = this.transformer.modelToScreen(finalModelPt.x, finalModelPt.y);

        return {
            modelPt: finalModelPt,
            screenPt: finalScreenPt,
            type: finalType,
            vertexId: finalVertexId
        };
    }
}
