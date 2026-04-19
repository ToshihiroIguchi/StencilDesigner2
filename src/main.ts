import './style.css';
import { CanvasRenderer } from './engine/render/canvas';
import { FeatureTree } from './engine/core/feature';
import { SnapEngine } from './engine/core/snap';
import { InteractionController } from './engine/render/interaction';

import { SelectionManager } from './engine/render/selection';
import { FeatureEditor } from './engine/core/editing';

import { TrimTool } from './engine/render/trim_tool';

window.onload = () => {
    const canvasRenderer = new CanvasRenderer('main-canvas');
    const featureTree = new FeatureTree();
    const selectionManager = new SelectionManager();
    const featureEditor = new FeatureEditor(featureTree);
    const trimTool = new TrimTool(canvasRenderer, featureTree, selectionManager);
    
    // Inject dependencies into Renderer
    (canvasRenderer as any).selectionManager = selectionManager;

    const graphProvider = {
        graph: featureTree.rebuild()
    };
    canvasRenderer.updateGraph(graphProvider.graph);

    const snapEngine = new SnapEngine(
        graphProvider.graph, 
        canvasRenderer.transformer, 
        canvasRenderer.viewState
    );

    const interaction = new InteractionController(canvasRenderer, featureTree, snapEngine, selectionManager, trimTool);
    
    const originalRebuild = featureTree.rebuild.bind(featureTree);
    featureTree.rebuild = () => {
        const newGraph = originalRebuild();
        graphProvider.graph = newGraph;
        (snapEngine as any).graph = newGraph; 
        return newGraph;
    };

    // Keyboard Hook for Delete Command
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace' || e.key === 'Del') {
            if (selectionManager.selectedFeatureIds.size > 0) {
                featureEditor.deleteFeatures(selectionManager.selectedFeatureIds);
                selectionManager.clear();
                
                const graph = featureTree.rebuild();
                canvasRenderer.updateGraph(graph);
                console.log('[App] Deleted selection and rebuilt graph.');
            }
        }
    });

    // UI Wireup
    document.getElementById('btn-select')?.addEventListener('click', () => { interaction.activeTool = 'Select'; updateUI('Select'); });
    document.getElementById('btn-line')?.addEventListener('click', () => { interaction.activeTool = 'Line'; updateUI('Line'); });
    document.getElementById('btn-rect')?.addEventListener('click', () => { interaction.activeTool = 'Rect'; updateUI('Rect'); });
    document.getElementById('btn-trim')?.addEventListener('click', () => { interaction.activeTool = 'Trim'; updateUI('Trim'); });

    function updateUI(active: string) {
        if (active === 'Trim') {
            document.getElementById('status-text')!.innerText = `Active Tool: ${active} - Click to trim segment`;
        } else {
            document.getElementById('status-text')!.innerText = `Active Tool: ${active}`;
        }
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${active.toLowerCase()}`)?.classList.add('active');
    }
    updateUI('Select');
    
    (window as any).interaction = interaction;
    (window as any).canvasRenderer = canvasRenderer;
    (window as any).featureTree = featureTree;
    (window as any).selectionManager = selectionManager;
    
    (window as any).testDrawRect = () => {
        import('./engine/core/feature').then(({ RectFeature }) => {
            featureTree.addFeature(new RectFeature('test_rect', 0, 0, 50, -50));
            const graph = featureTree.rebuild();
            canvasRenderer.updateGraph(graph);
            console.log('[Debug] Programmatic rect drawn.');
        });
    };
};
