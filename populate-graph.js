const graph = require('./graph-engine');
const fs = require('fs');
const path = require('path');

function ensureNode(id, type, label, props = {}) {
  graph.addNode(id, type, label, props);
}

// Populate from Registry
const registryDir = path.join(__dirname, 'registry-data');
if (fs.existsSync(registryDir)) {
  for (const type of fs.readdirSync(registryDir)) {
    const typeDir = path.join(registryDir, type);
    if (!fs.statSync(typeDir).isDirectory()) continue;
    for (const file of fs.readdirSync(typeDir)) {
      if (!file.endsWith('.json')) continue;
      const record = JSON.parse(fs.readFileSync(path.join(typeDir, file), 'utf-8'));
      ensureNode(record.id, type, record.title || record.name || record.id);
      if (record.seatId) {
        graph.addEdge(record.id, record.seatId, 'occupies');
      }
    }
  }
}

// Link seats to constitution
const constitutionFile = path.join(__dirname, 'constitution.json');
if (fs.existsSync(constitutionFile)) {
  const constitution = JSON.parse(fs.readFileSync(constitutionFile, 'utf-8'));
  ensureNode('CONST-001', 'constitution', 'Vongstaad Constitution v' + (constitution.version || '1.0'));
  const seats = JSON.parse(fs.readFileSync(path.join(registryDir, 'seat', 'SEAT-001.json'), 'utf-8'));
  // Link all seats to constitution
  for (const seatType of fs.readdirSync(registryDir)) {
    const seatDir = path.join(registryDir, seatType);
    if (!fs.statSync(seatDir).isDirectory()) continue;
    if (seatType !== 'seat') continue;
    for (const file of fs.readdirSync(seatDir)) {
      if (!file.endsWith('.json')) continue;
      const seatId = file.replace('.json', '');
      graph.addEdge(seatId, 'CONST-001', 'governed_by');
    }
  }
}

console.log('Graph populated from registry.');
