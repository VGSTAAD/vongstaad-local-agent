const JsonlFactStore = require('./src/adapters/JsonlFactStore');
const fs = require('fs');
const path = require('path');

const FACT_FILE = path.join(__dirname, 'institution-facts.jsonl');
const INPUT_FILE = path.join(__dirname, 'bootstrap-inputs.json');

const TYPE_MAP = {
  'FOUNDER_IDENTITY': 'FOUNDER_REGISTERED',
  'MISSION_DECLARATION': 'MISSION_ESTABLISHED',
  'CONSTITUTION_DOCUMENT': 'CONSTITUTION_RATIFIED',
  'VERSION_DECLARATION': 'VERSION_1_DECLARED',
  'OFFICE_REGISTRY': 'OFFICES_CREATED',
  'SEAT_REGISTRY': 'SEATS_CREATED',
  'OCCUPANT_REGISTRY': 'OCCUPANTS_APPOINTED',
  'TECHNICAL_SPECIFICATION': 'TECHNICAL_FOUNDATION_RATIFIED',
  'TECHNOLOGY_STACK': 'TECH_STACK_REGISTERED',
  'SYSTEM_STRUCTURE': 'SYSTEM_STRUCTURE_REGISTERED',
  'FACT_TYPE_REGISTRY': 'FACT_SCHEMA_REGISTERED',
  'ARCHITECTURE_DECISION': 'DECISION_RECORDED',
  'AI_CONFIGURATION': 'AI_ADAPTER_REGISTERED',
  'EXTERNAL_ADAPTER_REGISTRY': 'ADAPTERS_REGISTERED',
  'INTERFACE_CONTRACT': 'API_CONTRACT_REGISTERED',
  'DEVELOPMENT_PROTOCOL': 'ENGINEERING_DISCIPLINE_REGISTERED',
  'SECURITY_POLICY': 'SECURITY_POLICY_REGISTERED',
  'RECOVERY_POLICY': 'RECOVERY_POLICY_REGISTERED',
  'FOUNDING_DECISION': 'INSTITUTION_OPERATION_STARTED',
  'VERSION_EVOLUTION_RULE': 'EVOLUTION_PROTOCOL_REGISTERED'
};

async function bootstrap() {
  const store = new JsonlFactStore(FACT_FILE);
  await store.init();

  // Clear existing facts
  await fs.promises.writeFile(FACT_FILE, '');

  const inputs = JSON.parse(await fs.promises.readFile(INPUT_FILE, 'utf8'));
  let seq = 0;

  for (const input of inputs) {
    const factType = TYPE_MAP[input.type];
    if (!factType) {
      console.error(`Unknown input type: ${input.type}`);
      process.exit(1);
    }
    seq++;
    const fact = {
      id: `FACT-${String(seq).padStart(6,'0')}`,
      sequence: seq,
      timestamp: new Date().toISOString(),
      type: factType,
      data: input.data,
      authority: 'FOUNDER',
      constitutionVersion: '1.0',
      parentFactId: null
    };
    await store.append(fact);
    console.log(`Bootstrapped: ${fact.id}  ${fact.type}`);
  }

  console.log(`Bootstrap complete. ${seq} facts recorded.`);
  process.exit(0);
}

bootstrap().catch(err => {
  console.error(err);
  process.exit(1);
});
