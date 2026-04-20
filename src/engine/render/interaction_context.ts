import { ToleranceManager } from '../core/viewport';
import type { ModelUnits } from '../core/viewport';
import type { SnapResultScreen, SnapType } from '../core/snap';

export enum InteractionState {
    IDLE = 'IDLE',
    HOVER = 'HOVER',
    DRAG = 'DRAG',
    COMMIT = 'COMMIT'
}

export interface InteractionPoint {
    rawMm: { x: number, y: number };
    logicalUnits: { x: ModelUnits, y: ModelUnits };
    visualMm: { x: number, y: number };
    snapType: SnapType;
    vertexId?: string;
}

/**
 * InteractionContext - The Single Source of Truth for CAD Interaction.
 * Manages the transition from raw mouse input to constrained geometric intent.
 */
export class InteractionContext {
    private _rawMm: { x: number, y: number } = { x: 0, y: 0 };
    private _state: InteractionState = InteractionState.IDLE;
    
    private lockedSnap: SnapResultScreen | null = null;
    private snapRadiusMm: number = 1.5; // Default 15px at 10x zoom (~1.5mm)
    private hysteresisMarginMm: number = 0.5;

    constructor() {}

    /**
     * SSoT Update: Set the absolute raw model coordinate.
     */
    updateRaw(mm: { x: number, y: number }, zoom: number) {
        this._rawMm = mm;
        this.snapRadiusMm = 15 / zoom;
        this.hysteresisMarginMm = 5 / zoom;
    }

    setState(state: InteractionState) {
        this._state = state;
        if (state === InteractionState.IDLE || state === InteractionState.COMMIT) {
            this.lockedSnap = null;
        }
    }

    get state() { return this._state; }
    get rawMm() { return this._rawMm; }

    /**
     * Constraint Layer: Apply snaps and hysteresis to the SSoT.
     */
    getPoint(snapSource: (x: number, y: number) => SnapResultScreen): InteractionPoint {
        const raw = this._rawMm;
        
        // 1. Hysteresis Check (Target-Centered)
        if (this.lockedSnap) {
            // Calculate distance between RAW cursor and the SNAPPED TARGET
            const dx = raw.x - this.lockedSnap.snappedModelPt.x;
            const dy = raw.y - this.lockedSnap.snappedModelPt.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist <= this.snapRadiusMm + this.hysteresisMarginMm) {
                // Stay locked to the geometric centroid of the target
                return {
                    rawMm: raw,
                    logicalUnits: this.lockedSnap.modelUnits,
                    visualMm: this.lockedSnap.snappedModelPt,
                    snapType: this.lockedSnap.type,
                    vertexId: this.lockedSnap.vertexId
                };
            } else {
                // Break the lock
                this.lockedSnap = null;
            }
        }

        // 2. Fresh Snap Calculation
        const snap = snapSource(raw.x, raw.y);
        
        if (snap.type !== 'none') {
            // Visual Magnet Active (Vertex/Midpoint/Grid Magnet)
            this.lockedSnap = snap;
            return {
                rawMm: raw,
                logicalUnits: snap.modelUnits,
                visualMm: snap.snappedModelPt, // Snap visual jump
                snapType: snap.type,
                vertexId: snap.vertexId
            };
        }

        // 3. Fallback: Atomic Normalization
        // Even when no snap is active, the Visual position must exactly match
        // the Logical commitment to ensure truth in the viewport.
        const logicalUnits = snap.modelUnits;
        const visualMm = {
            x: ToleranceManager.unitsToMm(logicalUnits.x),
            y: ToleranceManager.unitsToMm(logicalUnits.y)
        };

        return {
            rawMm: raw,
            logicalUnits: logicalUnits,
            visualMm: visualMm, // Atomic jump to µm grid
            snapType: 'none'
        };
    }
}
