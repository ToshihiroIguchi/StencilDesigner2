import { FeatureTree } from './feature';
import { ToleranceManager } from './viewport';

/**
 * Feature Editor
 * Handles atomic editing commands. Non-destructive flow requires editing the Feature tree, not graph directly.
 */

export class FeatureEditor {
    constructor(private tree: FeatureTree) {}

    /**
     * Deletes features by their IDs securely from the tree.
     */
    /**
     * Deletes features by their IDs securely from the tree.
     */
    deleteFeatures(featureIds: Set<string>): void {
        this.tree.deleteFeatures(featureIds);
    }

    /**
     * Updates a specific numerical parameter of a feature.
     */
    updateFeatureParameter(featureId: string, param: string, value: number, shouldSaveHistory: boolean = false): void {
        const feature = this.tree.features.find(f => f.id === featureId);
        if (!feature) return;

        const v = ToleranceManager.mmToUnits(value); 

        if (feature.type === 'Line') {
            const f = feature as any;
            if (param === 'length') {
                const dx = Number(f.x2 - f.x1);
                const dy = Number(f.y2 - f.y1);
                const dist = Math.hypot(dx, dy);
                if (dist > 1e-6) {
                    const dirX = dx / dist;
                    const dirY = dy / dist;
                    f.x2 = f.x1 + BigInt(Math.round(dirX * Number(v)));
                    f.y2 = f.y1 + BigInt(Math.round(dirY * Number(v)));
                }
            }
        } else if (feature.type === 'Rect') {
            const f = feature as any;
            if (param === 'width') {
                const sx = (f.x2 >= f.x1) ? 1n : -1n;
                f.x2 = f.x1 + v * sx;
            } else if (param === 'height') {
                const sy = (f.y2 >= f.y1) ? 1n : -1n;
                f.y2 = f.y1 + v * sy;
            }
        } else if (feature.type === 'Fillet') {
            const f = feature as any;
            if (param === 'radius') f.radius = v;
        }

        this.tree.rebuild();
        if (shouldSaveHistory) {
            this.tree.saveHistory();
        }
    }
}
