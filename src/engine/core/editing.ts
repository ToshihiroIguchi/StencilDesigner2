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
    deleteFeatures(featureIds: Set<string>): void {
        this.tree.deleteFeatures(featureIds);
    }
}
