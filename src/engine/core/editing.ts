import { FeatureTree } from './feature';

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

        const v = value; 

        if (feature.type === 'Line') {
            const f = feature as any;
            if (param === 'length') {
                const dx = f.x2 - f.x1;
                const dy = f.y2 - f.y1;
                const dist = Math.hypot(dx, dy);
                if (dist > 1e-9) {
                    f.x2 = f.x1 + (dx / dist) * v;
                    f.y2 = f.y1 + (dy / dist) * v;
                }
            }
        } else if (feature.type === 'Rect') {
            const f = feature as any;
            if (param === 'width') {
                f.x2 = f.x1 + v * Math.sign(f.x2 - f.x1 || 1);
            } else if (param === 'height') {
                f.y2 = f.y1 + v * Math.sign(f.y2 - f.y1 || 1);
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
