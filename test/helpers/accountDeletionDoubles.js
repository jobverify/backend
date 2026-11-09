import ResumeUsage from '../../src/models/ResumeUsage.js';
import mongoose from 'mongoose';
import User from '../../src/models/User.js';
import TailoredResume from '../../src/models/TailoredResume.js';
import ResumeArtifact from '../../src/models/ResumeArtifact.js';
import ApplicationEvent from '../../src/models/ApplicationEvent.js';
import CandidateEvidence from '../../src/models/CandidateEvidence.js';
import CVRevision from '../../src/models/CVRevision.js';
import AutoApplyAttempt from '../../src/models/AutoApplyAttempt.js';

export function mockAccountDeletion(t) {
  t.mock.method(mongoose.connection, 'collection', () => ({ deleteMany: async () => ({ deletedCount: 0 }) }));
  t.mock.method(User, 'updateOne', async () => ({ matchedCount: 1 }));
  for (const Model of [ApplicationEvent, CandidateEvidence, CVRevision, ResumeUsage, TailoredResume, ResumeArtifact, AutoApplyAttempt]) {
    t.mock.method(Model, 'deleteMany', async () => ({ deletedCount: 0 }));
  }
}
