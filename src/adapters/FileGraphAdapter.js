const IGraph = require('../ports/IGraph');
const fs = require('fs');
const path = require('path');
class FileGraphAdapter extends IGraph {
  constructor() { super(); this.GRAPH_FILE = path.join(__dirname, '../../institution-graph.json'); if (!fs.existsSync(this.GRAPH_FILE)) fs.writeFileSync(this.GRAPH_FILE, JSON.stringify({ nodes: [], edges: [] }, null, 2)); }
  addNode(id, type, label, props = {}) { const g = JSON.parse(fs.readFileSync(this.GRAPH_FILE, 'utf-8')); if (g.nodes.find(n => n.id === id)) return g; g.nodes.push({ id, type, label, properties: props, createdAt: new Date().toISOString() }); fs.writeFileSync(this.GRAPH_FILE, JSON.stringify(g, null, 2)); return g; }
  addEdge(source, target, relationship, props = {}) { const g = JSON.parse(fs.readFileSync(this.GRAPH_FILE, 'utf-8')); const key = `${source}→${target}→${relationship}`; if (g.edges.find(e => `${e.source}→${e.target}→${e.relationship}` === key)) return g; g.edges.push({ source, target, relationship, properties: props, createdAt: new Date().toISOString() }); fs.writeFileSync(this.GRAPH_FILE, JSON.stringify(g, null, 2)); return g; }
  getNeighbors(nodeId) { const g = JSON.parse(fs.readFileSync(this.GRAPH_FILE, 'utf-8')); const node = g.nodes.find(n => n.id === nodeId); if (!node) return null; const out = g.edges.filter(e => e.source === nodeId).map(e => ({ direction: 'outgoing', relationship: e.relationship, node: g.nodes.find(n => n.id === e.target) || { id: e.target, label: e.target } })); const inc = g.edges.filter(e => e.target === nodeId).map(e => ({ direction: 'incoming', relationship: e.relationship, node: g.nodes.find(n => n.id === e.source) || { id: e.source, label: e.source } })); return { node, outgoing: out, incoming: inc }; }
  query(type = null, props = {}) { const g = JSON.parse(fs.readFileSync(this.GRAPH_FILE, 'utf-8')); let nodes = g.nodes; if (type) nodes = nodes.filter(n => n.type === type); for (const [k, v] of Object.entries(props)) nodes = nodes.filter(n => n.properties[k] === v); return nodes; }
  getGraph() { return JSON.parse(fs.readFileSync(this.GRAPH_FILE, 'utf-8')); }
}
module.exports = FileGraphAdapter;