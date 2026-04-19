import './style.css';
import { CanvasRenderer } from './engine/render/canvas';
import { FeatureTree } from './engine/core/feature';
import { SnapEngine } from './engine/core/snap';
import { InteractionController } from './engine/render/interaction';

window.onload = () => {
    const canvasRenderer = new CanvasRenderer('main-canvas');
    const featureTree = new FeatureTree();
    
    // We need a proxy to always provide the latest ModelGraph to SnapEngine
    const graphProvider = {
        graph: featureTree.rebuild()
    };
    canvasRenderer.updateGraph(graphProvider.graph);

    const snapEngine = new SnapEngine(
        graphProvider.graph, 
        canvasRenderer.transformer, 
        canvasRenderer.viewState
    );

    // Overriding the interaction controller's rebuild process to keep Graph fresh for SnapEngine
    const interaction = new InteractionController(canvasRenderer, featureTree, snapEngine);
    
    // Modify the method safely to hook the graph refresh
    const originalRebuild = featureTree.rebuild.bind(featureTree);
    featureTree.rebuild = () => {
        const newGraph = originalRebuild();
        graphProvider.graph = newGraph;
        // Hack: update snapEngine's reference (by redefining property)
        (snapEngine as any).graph = newGraph; 
        return newGraph;
    };

    // UI Wireup
    document.getElementById('btn-select')?.addEventListener('click', () => { interaction.activeTool = 'Select'; updateUI('Select'); });
    document.getElementById('btn-line')?.addEventListener('click', () => { interaction.activeTool = 'Line'; updateUI('Line'); });
    document.getElementById('btn-rect')?.addEventListener('click', () => { interaction.activeTool = 'Rect'; updateUI('Rect'); });

    function updateUI(active: string) {
        document.getElementById('status-text')!.innerText = `Active Tool: ${active}`;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${active.toLowerCase()}`)?.classList.add('active');
    }
    updateUI('Select');
    
    (window as any).interaction = interaction;
    (window as any).canvasRenderer = canvasRenderer;
    (window as any).featureTree = featureTree;
    
    // Debug Mode: Programmatic Drawing Test
    (window as any).testDrawRect = () => {
        console.log('[Debug] testDrawRect triggered.');
        import('./engine/core/feature').then(({ RectFeature }) => {
            featureTree.addFeature(new RectFeature('test_rect', 0, 0, 50, -50));
            const graph = featureTree.rebuild();
            canvasRenderer.updateGraph(graph);
            console.log('[Debug] Programmatic rect drawn (model bounds: 0,0 to 50,-50)');
        });
    };
};
