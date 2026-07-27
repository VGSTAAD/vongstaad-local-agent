const fs = require('fs');
const path = require('path');

const GRAPH_FILE = path.join(__dirname, 'institution-graph.json');

class GraphEngine {
  constructor() {
    if (!fs.existsSync(GRAPH_FILE)) {
      fs.writeFileSync(GRAPH_FILE, JSON.stringify({ nodes: [], edges: [] }, null, 2));
    }
  }

  _load() {
    return JSON.parse(fs.readFileSync(GRAPH_FILE, 'utf-8'));
  }

  _save(graph) {
    fs.writeFileSync(GRAPH_FILE, JSON.stringify(graph, null, 2));
  }

  addNode(id, type, label, properties = {}) {
    const graph = this._load();
    if (graph.nodes.find(n => n.id === id)) return graph; // already exists
    graph.nodes.push({ id, type, label, properties, createdAt: new Date().toISOString() });
    this._save(graph);
    return graph;
  }

  addEdge(sourceId, targetId, relationship, properties = {}) {
    const graph = this._load();
    const key = `${sourceId}→${targetId}→${relationship}`;
    if (graph.edges.find(e => `${e.source}→${e.target}→${e.relationship}` === key)) return graph;
    graph.edges.push({ source: sourceId, target: targetId, relationship, properties, createdAt: new Date().toISOString() });
    this._save(graph);
    return graph;
  }

  getNeighbors(nodeId) {
    const graph = this._load();
    const node = graph.nodes.find(n => n.id === nodeId);
    if (!node) return null;

    const outgoing = graph.edges.filter(e => e.source === nodeId).map(e => ({
      direction: 'outgoing',
      relationship: e.relationship,
      node: graph.nodes.find(n => n.id === e.target) || { id: e.target, label: e.target }
    }));

    const incoming = graph.edges.filter(e => e.target === nodeId).map(e => ({
      direction: 'incoming',
      relationship: e.relationship,
      node: graph.nodes.find(n => n.id === e.source) || { id: e.source, label: e.source }
    }));

    return { node, outgoing, incoming };
  }

  query(type = null, properties = {}) {
    const graph = this._load();
    let nodes = graph.nodes;
    if (type) nodes = nodes.filter(n => n.type === type);
    for (const [key, value] of Object.entries(properties)) {
      nodes = nodes.filter(n => n.properties[key] === value);
    }
    return nodes;
  }

  getGraph() {
    return this._load();
  }
}

module.exports = new GraphEngine();
