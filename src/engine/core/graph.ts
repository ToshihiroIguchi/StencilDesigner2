export type VertexId = string;
export type EdgeId = string;

export interface Vertex {
  id: VertexId;
  x?: number;
  y?: number;
}

export interface Edge {
  id: EdgeId;
  u: VertexId;
  v: VertexId;
}

export class ModelGraph {
  public vertices: Map<VertexId, Vertex> = new Map();
  public edges: Map<EdgeId, Edge> = new Map();

  addVertex(id: VertexId, x?: number, y?: number): void {
    if (this.vertices.has(id)) {
      throw new Error(`Vertex ${id} already exists.`);
    }
    this.vertices.set(id, { id, x, y });
  }

  addEdge(id: EdgeId, u: VertexId, v: VertexId): void {
    if (this.edges.has(id)) {
      throw new Error(`Edge ${id} already exists.`);
    }
    if (!this.vertices.has(u) || !this.vertices.has(v)) {
      throw new Error("Edge vertices must exist in the graph.");
    }
    this.edges.set(id, { id, u, v });
  }

  getAdjacentVertices(vertexId: VertexId): VertexId[] {
    const adj: VertexId[] = [];
    for (const edge of this.edges.values()) {
      if (edge.u === vertexId) adj.push(edge.v);
      else if (edge.v === vertexId) adj.push(edge.u);
    }
    return adj;
  }
}
