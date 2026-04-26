import './style.css';
import { CanvasRenderer } from './engine/render/canvas';
import { FeatureTree } from './engine/core/feature';
import { InteractionController } from './engine/render/interaction';
import { SelectionManager } from './engine/render/selection';
import { FeatureEditor } from './engine/core/editing';
import { FilletTool } from './engine/render/fillet_tool';
import { ArrayCopyEngine } from './engine/core/array';
import { TrimTool } from './engine/render/trim_tool';
import { DimensionTool } from './engine/render/dimension_tool';

window.onload = () => {
    const canvasRenderer = new CanvasRenderer('main-canvas');
    const featureTree = new FeatureTree();
    const selectionManager = new SelectionManager();
    const featureEditor = new FeatureEditor(featureTree);
    const trimTool = new TrimTool(canvasRenderer, featureTree);
    const filletTool = new FilletTool(canvasRenderer, featureTree);
    const dimensionTool = new DimensionTool(canvasRenderer, featureTree);
    
    (canvasRenderer as any).selectionManager = selectionManager;
    selectionManager.onSelectionChange = () => updateInspector();

    const interaction = new InteractionController(canvasRenderer, featureTree, selectionManager, trimTool, filletTool, dimensionTool);
    
    const handleRebuild = () => {
        const graph = featureTree.rebuild();
        canvasRenderer.updateGraph(graph);
    };

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            e.preventDefault();
            if (featureTree.undo()) handleRebuild();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            e.preventDefault();
            if (featureTree.redo()) handleRebuild();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectionManager.selectedFeatureIds.size > 0) {
                featureEditor.deleteFeatures(selectionManager.selectedFeatureIds);
                selectionManager.clear();
                handleRebuild();
                updateInspector();
            }
        }
    });

    function updateInspector() {
        const infoContent = document.getElementById('info-content');
        if (!infoContent) return;
        if (selectionManager.selectedFeatureIds.size === 0) {
            infoContent.innerHTML = '<p>Select an item to see properties</p>';
            return;
        }
        const selectedIds = Array.from(selectionManager.selectedFeatureIds);
        const fId = selectedIds[0];
        const feature = featureTree.features.find(f => f.id === fId);
        if (!feature) {
            infoContent.innerHTML = '';
            return;
        }
        let html = `<h4>${feature.type} Properties</h4>`;
        html += `<p>ID: ${feature.id}</p>`;

        if (feature.type === 'Line') {
            const f = feature as any;
            const len = Math.hypot(f.x2 - f.x1, f.y2 - f.y1);
            html += `<label>Length (mm): <input type="number" step="0.001" value="${len.toFixed(3)}" data-param="length"></label>`;
        } else if (feature.type === 'Rect') {
            const f = feature as any;
            const w = Math.abs(f.x2 - f.x1);
            const h = Math.abs(f.y2 - f.y1);
            html += `<label>Width (mm): <input type="number" step="0.001" value="${w.toFixed(3)}" data-param="width"></label>`;
            html += `<label>Height (mm): <input type="number" step="0.001" value="${h.toFixed(3)}" data-param="height"></label>`;
        } else if (feature.type === 'Fillet') {
            const f = feature as any;
            html += `<label>Radius (mm): <input type="number" step="0.001" value="${f.radius.toFixed(3)}" data-param="radius"></label>`;
        }
        infoContent.innerHTML = html;
        infoContent.querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', (e) => e.stopPropagation());
            input.addEventListener('input', (e) => {
                const param = (e.target as HTMLInputElement).dataset.param!;
                const val = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(val)) {
                    featureEditor.updateFeatureParameter(fId, param, val, false);
                    handleRebuild();
                }
            });
            input.addEventListener('change', (e) => {
                const param = (e.target as HTMLInputElement).dataset.param!;
                const val = parseFloat((e.target as HTMLInputElement).value);
                if (!isNaN(val)) {
                    featureEditor.updateFeatureParameter(fId, param, val, true);
                    handleRebuild();
                    updateInspector();
                }
            });
        });
    }

    document.getElementById('btn-undo')?.addEventListener('click', () => {
        if (featureTree.undo()) handleRebuild();
    });
    document.getElementById('btn-redo')?.addEventListener('click', () => {
        if (featureTree.redo()) handleRebuild();
    });
    const radiusInput = document.getElementById('fillet-radius') as HTMLInputElement;
    radiusInput.addEventListener('change', () => {
        filletTool.activeRadius = parseFloat(radiusInput.value) || 2.0;
    });

    document.getElementById('btn-array-exec')?.addEventListener('click', () => {
        if (selectionManager.selectedFeatureIds.size === 0) return;
        const rows = parseInt((document.getElementById('array-rows') as HTMLInputElement).value) || 1;
        const cols = parseInt((document.getElementById('array-cols') as HTMLInputElement).value) || 1;
        const pitchX = parseFloat((document.getElementById('array-px') as HTMLInputElement).value) || 0;
        const pitchY = parseFloat((document.getElementById('array-py') as HTMLInputElement).value) || 0;
        ArrayCopyEngine.generateFlatCopies(featureTree, selectionManager.selectedFeatureIds, rows, cols, pitchX, pitchY);
        handleRebuild();
        selectionManager.clear();
    });

    import('./engine/io/exporter').then(({ ModelExporter }) => {
        function downloadFile(content: string, filename: string, type: string) {
            const blob = new Blob([content], { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
        document.getElementById('btn-export-dxf')?.addEventListener('click', () => {
            const graph = featureTree.rebuild();
            const dxf = ModelExporter.exportToDXF(graph as any);
            downloadFile(dxf, 'stencil_design.dxf', 'text/plain');
        });
        document.getElementById('btn-export-svg')?.addEventListener('click', () => {
            const graph = featureTree.rebuild();
            const svg = ModelExporter.exportToSVG(graph as any);
            downloadFile(svg, 'stencil_design.svg', 'image/svg+xml');
        });
    });

    const tools = ['select', 'line', 'rect', 'trim', 'fillet', 'dim'];
    tools.forEach(tool => {
        document.getElementById(`btn-${tool}`)?.addEventListener('click', () => {
            const toolName = tool.charAt(0).toUpperCase() + tool.slice(1);
            interaction.activeTool = toolName as any;
            updateUI(toolName);
            if (toolName === 'Select') updateInspector();
        });
    });

    function updateUI(active: string) {
        let msg = "Ready";
        if (active === 'Trim') msg = 'Trim Mode - Click lines to remove';
        else if (active === 'Fillet') msg = 'Fillet Mode - Select a corner to round';
        else if (active === 'Line') msg = 'Draw Line - Drag to create';
        else if (active === 'Rect') msg = 'Draw Rectangle - Drag to create';
        else if (active === 'Select') msg = 'Select Tool - Click or drag to select';
        else if (active === 'Dim') msg = 'Dimension Tool - Drag between two points';
        const statusText = document.getElementById('status-text');
        if (statusText) statusText.innerText = msg;
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        document.getElementById(`btn-${active.toLowerCase()}`)?.classList.add('active');
    }
    updateUI('Select');
    updateInspector();
    
    (window as any).interaction = interaction;
    (window as any).canvasRenderer = canvasRenderer;
    (window as any).featureTree = featureTree;
    (window as any).selectionManager = selectionManager;
    handleRebuild();
};
