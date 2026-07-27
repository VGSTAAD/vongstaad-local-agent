const fs = require('fs');
const path = require('path');

const ONTOLOGY_FILE = path.join(__dirname, 'ontology-definition.json');

class Ontology {
  constructor() {
    if (!fs.existsSync(ONTOLOGY_FILE)) {
      const definition = {
        version: '1.0',
        primitives: {
          Entity: {
            description: 'Any identifiable thing that exists within the institution',
            attributes: ['id', 'type', 'label', 'createdAt', 'properties'],
            validTypes: ['seat', 'appointment', 'constitution', 'precedent', 'certification', 'knowledge-pack', 'prompt', 'identity-link']
          },
          Relationship: {
            description: 'A directed connection between two entities',
            attributes: ['source', 'target', 'relationship', 'createdAt', 'properties'],
            validRelationships: ['occupies', 'governed_by', 'derived_from', 'links_wallet', 'produced', 'evaluated_by', 'ratified_by', 'simulated_for', 'appointed_to', 'certified_by']
          },
          Event: {
            description: 'Something that happened at a point in time',
            attributes: ['id', 'type', 'timestamp', 'properties'],
            validTypes: ['SEAT_CREATED', 'APPOINTMENT_CREATED', 'CODE_REVIEW', 'STATE_CAPTURED', 'OBSERVER_REPORT', 'PROPOSAL_CREATED', 'PROPOSAL_RATIFIED', 'SIMULATION_STARTED', 'CERTIFICATION_ISSUED']
          },
          Artifact: {
            description: 'A durable product of institutional activity',
            attributes: ['id', 'type', 'createdAt', 'content'],
            validTypes: ['dcp', 'precedent', 'knowledge-pack', 'prompt', 'constitution', 'observer-report', 'simulation-report']
          },
          State: {
            description: 'A frozen snapshot of the institution at a moment in time',
            attributes: ['id', 'timestamp', 'label', 'constitution', 'registry', 'ledger', 'hash'],
            validTypes: ['state', 'snapshot']
          }
        },
        governance: {
          entityCreation: 'Must pass through Registry',
          relationshipCreation: 'Must reference existing entities',
          eventRecording: 'Must be appended to Ledger, never modified',
          artifactGeneration: 'Must carry provenance (creator, timestamp, DCP reference)',
          stateCapture: 'Must be triggered by authorized events only'
        }
      };
      fs.writeFileSync(ONTOLOGY_FILE, JSON.stringify(definition, null, 2));
    }
  }

  getDefinition() {
    return JSON.parse(fs.readFileSync(ONTOLOGY_FILE, 'utf-8'));
  }

  validateNode(type, nodeType) {
    const def = this.getDefinition();
    const primitive = def.primitives[type];
    if (!primitive) return { valid: false, error: `Unknown primitive type: ${type}` };
    if (type === 'Entity' && !primitive.validTypes.includes(nodeType)) {
      return { valid: false, error: `Invalid entity type: ${nodeType}. Valid types: ${primitive.validTypes.join(', ')}` };
    }
    return { valid: true };
  }

  validateRelationship(relationship) {
    const def = this.getDefinition();
    const relDef = def.primitives.Relationship;
    if (!relDef.validRelationships.includes(relationship)) {
      return { valid: false, error: `Invalid relationship: ${relationship}. Valid: ${relDef.validRelationships.join(', ')}` };
    }
    return { valid: true };
  }

  validateEvent(eventType) {
    const def = this.getDefinition();
    const eventDef = def.primitives.Event;
    if (!eventDef.validTypes.includes(eventType)) {
      return { valid: false, error: `Invalid event type: ${eventType}` };
    }
    return { valid: true };
  }

  getStats() {
    const def = this.getDefinition();
    return {
      version: def.version,
      entityTypes: def.primitives.Entity.validTypes.length,
      relationshipTypes: def.primitives.Relationship.validRelationships.length,
      eventTypes: def.primitives.Event.validTypes.length,
      artifactTypes: def.primitives.Artifact.validTypes.length,
      governanceRules: Object.keys(def.governance).length
    };
  }
}

module.exports = new Ontology();
