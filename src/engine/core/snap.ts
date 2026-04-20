import { ModelGraph } from './graph';
import { CoordinateTransformer, ToleranceManager, ViewState } from './viewport';
import type { ModelUnits } from './viewport';

/**
 * Snap Engine - Optimized for BigInt-Core
 */

export type SnapType = 'none' | 'grid' | 'endpoint' | 'midpoint';

export interface SnapResultUnits {
    modelPt: { x: ModelUnits, y: ModelUnits };
    type: SnapType;
    vertexId?: string;
}

export interface SnapResultScreen {
    rawModelPt: { x: number, y: number };     // High-fidelity float (from cursor)
    snappedModelPt: { x: number, y: number }; // Converted from units (for marker display)
    modelUnits: { x: ModelUnits, y: ModelUnits }; // The truth (BigInt)
    screenPt: { x: number, y: number };      // Screen position of snapped units
    type: SnapType;
    vertexId?: string;
}

export class SnapEngine {
    constructor(
        private graph: ModelGraph,
        private transformer: CoordinateTransformer,
        private viewState: ViewState
    ) {}

    /**
     * Core snapping logic in BigInt space
     */
    snapUnits(ux: ModelUnits, uy: ModelUnits, radiusUnits: ModelUnits): SnapResultUnits {
        const gridUnits = ToleranceManager.getGridIntervalUnits(this.viewState.zoom);

        let bestDistSqEndpoint: bigint | null = null;
        let endpointSnap: { x: ModelUnits, y: ModelUnits } | null = null;
        let endpointId: string | null = null;
        
        let bestDistSqMidpoint: bigint | null = null;
        let midpointSnap: { x: ModelUnits, y: ModelUnits } | null = null;

        const radSq = radiusUnits * radiusUnits;

        // 1. Endpoint Check
        for (const v of this.graph.vertices.values()) {
            if (v.x === undefined || v.y === undefined) continue;
            const dx = v.x - ux;
            const dy = v.y - uy;
            const distSq = dx * dx + dy * dy;
            
            if (distSq <= radSq && (bestDistSqEndpoint === null || distSq < bestDistSqEndpoint)) {
                bestDistSqEndpoint = distSq;
                endpointSnap = { x: v.x, y: v.y };
                endpointId = v.id;
            }
        }

        // 2. Midpoint Check
        for (const e of this.graph.edges.values()) {
            const v1 = this.graph.vertices.get(e.u);
            const v2 = this.graph.vertices.get(e.v);
            if (!v1 || !v2 || v1.x === undefined || v1.y === undefined || v2.x === undefined || v2.y === undefined) continue;

            const mx = (v1.x + v2.x) / 2n;
            const my = (v1.y + v2.y) / 2n;

            const dx = mx - ux;
            const dy = my - uy;
            const distSq = dx * dx + dy * dy;

            if (distSq <= radSq && (bestDistSqMidpoint === null || distSq < bestDistSqMidpoint)) {
                bestDistSqMidpoint = distSq;
                midpointSnap = { x: mx, y: my };
            }
        }

        // 3. Grid Snap
        // x = round(u / grid) * grid
        // In integer: (u + grid/2) / grid * grid? 
        // No, let's be careful with negative numbers.
        const snapToGrid = (val: bigint, step: bigint) => {
            const half = step / 2n;
            const remainder = val % step;
            if (val >= 0n) {
                return (remainder >= half) ? val + (step - remainder) : val - remainder;
            } else {
                // val is negative, e.g. -15 % 10 = -5
                return (remainder <= -half) ? val - (step + remainder) : val - remainder;
            }
        };

        const gX = snapToGrid(ux, gridUnits);
        const gY = snapToGrid(uy, gridUnits);
        const dxG = gX - ux;
        const dyG = gY - uy;
        const distSqGrid = dxG * dxG + dyG * dyG;

        if (endpointSnap) {
            return { modelPt: endpointSnap, type: 'endpoint', vertexId: endpointId || undefined };
        } else if (midpointSnap) {
            return { modelPt: midpointSnap, type: 'midpoint' };
        } else if (distSqGrid <= radSq) {
            return { modelPt: { x: gX, y: gY }, type: 'grid' };
        }

        // FALLBACK: Always return a stable grid point, but with type 'none' to allow smooth visuals
        return { modelPt: { x: gX, y: gY }, type: 'none' };
    }

    /**
     * Screen-space API for UI interaction (Float bounded)
     */
    snapScreen(screenX: number, screenY: number, screenRadius: number = 15): SnapResultScreen {
        const inputMm = this.transformer.screenToModel(screenX, screenY);
        const inputUnits = {
            x: ToleranceManager.mmToUnits(inputMm.x),
            y: ToleranceManager.mmToUnits(inputMm.y)
        };
        
        const radiusUnits = ToleranceManager.mmToUnits(screenRadius / this.viewState.zoom);
        
        const result = this.snapUnits(inputUnits.x, inputUnits.y, radiusUnits);
        
        const screenPt = this.transformer.modelUnitsToScreen(result.modelPt.x, result.modelPt.y);
        
        return {
            rawModelPt: inputMm,
            snappedModelPt: {
                x: ToleranceManager.unitsToMm(result.modelPt.x),
                y: ToleranceManager.unitsToMm(result.modelPt.y)
            },
            modelUnits: result.modelPt,
            screenPt: screenPt,
            type: result.type,
            vertexId: result.vertexId
        };
    }

    /**
     * Legacy API for tests
     */
    snap(screenX: number, screenY: number, screenRadius: number = 15): SnapResultScreen {
        return this.snapScreen(screenX, screenY, screenRadius);
    }
}
