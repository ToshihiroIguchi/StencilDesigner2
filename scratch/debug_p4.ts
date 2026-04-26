import { FeatureTree, LineFeature } from './src/engine/core/feature';
import { FeatureEditor } from './src/engine/core/editing';

const tree = new FeatureTree();
const editor = new FeatureEditor(tree);
const fId = 'f_1';

tree.addFeature(new LineFeature(fId, -4, 0, 0, 0));
console.log("Initial Line:", tree.features[0]);

editor.updateFeatureParameter(fId, 'length', 50);
console.log("Updated Line:", tree.features[0]);

const graph = tree.rebuild();
const v1 = graph.vertices.get('f_1_v0');
const v2 = graph.vertices.get('f_1_v1');

console.log("Graph Vertex 1:", v1);
console.log("Graph Vertex 2:", v2);

const edge = Array.from(graph.edges.values())[0];
console.log("Edge:", edge);
