const IEvidencePackage = require('../ports/IEvidencePackage');
class FileEvidencePackageAdapter extends IEvidencePackage {
  create({ decision, sources, confidence, reasoning, alternatives, warnings }) {
    const pkg = { id: `EVID-${Date.now()}`, timestamp: new Date().toISOString(), decision, confidence: Math.min(1, Math.max(0, confidence)), confidenceLevel: confidence >= 0.9 ? 'HIGH' : confidence >= 0.7 ? 'MEDIUM' : 'LOW', sources: sources || [], reasoning: reasoning || '', alternatives: alternatives || [], warnings: warnings || [], status: confidence >= 0.7 ? 'accepted' : 'needs_review' };
    return pkg;
  }
}
module.exports = FileEvidencePackageAdapter;