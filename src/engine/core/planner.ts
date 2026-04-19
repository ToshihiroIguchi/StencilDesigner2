import { ModelGraph } from './graph';
import type { VertexId, EdgeId } from './graph';

/**
 * Hoffmann, C. M., & Joan-Arinyo, R. (2005). A brief on constraint solving. Computer-Aided Design and Applications, 2(5), 655-663.
 * URL: https://doi.org/10.1080/16864360.2005.10738330
 * 日本語要約: 幾何拘束充足問題（Geometric Constraint Solving）に関する概観的論文。
 * グラフ理論的アプローチにおいて拘束関係をグラフで表現し、分解と再結合により系全体を解く手法を解説。
 * 本実装では過拘束/不足拘束やグラフの剛体判定としてのDOF解析の基礎理論として参照。
 */

/**
 * Gao, X. S., & Lin, Q. (1998). "MMP/Geometer: A software package for automated geometry reasoning."
 * URL: https://ci.nii.ac.jp/naid/10014761404 など（同等の文献に基づく）
 * 日本語要約: 自動幾何推論と幾何拘束充足に関するアルゴリズムの研究。
 * 特に、グラフの分解アルゴリズムを用いた拘束系の解法を強調。本実装における回路抽出からの剛体クラスタ同定手法の土台となる。
 */

/**
 * Owen, J. C. (1991). Algebraic Solution for Geometry from Dimensional Constraints.
 * URL: https://doi.org/10.1145/112515.112565
 * 日本語要約: 寸法拘束から幾何図形を代数的に解く手法の先駆的論文。
 * 拘束グラフを小さな剛体部分（3連結成分など）に分解し、再構成する分解-再結合アプローチ(Decomposition-Recombination)を提案。
 * DLSTや基本回路に基づき剛体を扱う本設計に直接的な影響を与えている。
 */

// DLST (Deterministic Lexicographical Spanning Tree)
export function computeDLST(graph: ModelGraph): Set<EdgeId> {
  const treeEdges = new Set<EdgeId>();
  if (graph.vertices.size === 0) return treeEdges;

  const sortedVertexIds = Array.from(graph.vertices.keys()).sort();
  const startNode = sortedVertexIds[0];

  const visited = new Set<VertexId>();
  visited.add(startNode);

  const edges = Array.from(graph.edges.values());

  while (visited.size < graph.vertices.size) {
    const candidateEdges = edges.filter(e => {
      if (treeEdges.has(e.id)) return false;
      const uIn = visited.has(e.u);
      const vIn = visited.has(e.v);
      return (uIn && !vIn) || (!uIn && vIn);
    });

    if (candidateEdges.length === 0) break;

    candidateEdges.sort((a, b) => a.id.localeCompare(b.id));
    
    const chosen = candidateEdges[0];
    treeEdges.add(chosen.id);
    visited.add(visited.has(chosen.u) ? chosen.v : chosen.u);
  }

  return treeEdges;
}

// Fundamental Circuit Extraction (基本回路抽出)
export function extractFundamentalCircuits(graph: ModelGraph, treeEdges: Set<EdgeId>): VertexId[][] {
  const circuits: VertexId[][] = [];
  
  for (const edge of graph.edges.values()) {
    if (!treeEdges.has(edge.id)) {
      const path = findPathInTree(graph, treeEdges, edge.u, edge.v);
      if (path && path.length > 0) {
        circuits.push(path);
      }
    }
  }
  return circuits;
}

function findPathInTree(graph: ModelGraph, treeEdges: Set<EdgeId>, start: VertexId, end: VertexId): VertexId[] | null {
  const queue: { current: VertexId; path: VertexId[] }[] = [{ current: start, path: [start] }];
  const visited = new Set<VertexId>([start]);

  while (queue.length > 0) {
    const { current, path } = queue.shift()!;
    if (current === end) return path;

    for (const edge of graph.edges.values()) {
      if (!treeEdges.has(edge.id)) continue;
      
      let next: VertexId | null = null;
      if (edge.u === current) next = edge.v;
      else if (edge.v === current) next = edge.u;

      if (next && !visited.has(next)) {
        visited.add(next);
        queue.push({ current: next, path: [...path, next] });
      }
    }
  }
  return null;
}

// DOF Analyzer
export function analyzeDOF(graph: ModelGraph): { dof: number, isOverConstrained: boolean, isUnderConstrained: boolean, isWellConstrained: boolean } {
  const v = graph.vertices.size;
  const c = graph.edges.size;
  
  if (v === 0) return { dof: 0, isOverConstrained: false, isUnderConstrained: false, isWellConstrained: true };

  const dof = 2 * v - c;
  const requiredConstraints = 2 * v - 3;
  
  const isOverConstrained = c > requiredConstraints || hasOverconstrainedSubgraph(graph);
  const isUnderConstrained = c < requiredConstraints && !isOverConstrained;
  const isWellConstrained = c === requiredConstraints && validateLamanGraph(graph);

  return { dof, isOverConstrained, isUnderConstrained, isWellConstrained };
}

function hasOverconstrainedSubgraph(graph: ModelGraph): boolean {
  const v = graph.vertices.size;
  if (v <= 2) return false;
  const vertices = Array.from(graph.vertices.keys());
  const edges = Array.from(graph.edges.values());

  for (let subset = 1; subset < (1 << v); subset++) {
    let vCount = 0;
    const subsetVertices = new Set<string>();
    for (let i = 0; i < v; i++) {
        if ((subset & (1 << i)) !== 0) {
            subsetVertices.add(vertices[i]);
            vCount++;
        }
    }
    if (vCount < 2) continue;

    let eCount = 0;
    for (const edge of edges) {
        if (subsetVertices.has(edge.u) && subsetVertices.has(edge.v)) {
            eCount++;
        }
    }
    if (eCount > 2 * vCount - 3) return true;
  }
  return false;
}

export function validateLamanGraph(graph: ModelGraph): boolean {
  const v = graph.vertices.size;
  const c = graph.edges.size;
  if (v === 0) return true;
  if (v === 1 && c === 0) return true;
  if (c !== 2 * v - 3) return false;
  
  return !hasOverconstrainedSubgraph(graph);
}
