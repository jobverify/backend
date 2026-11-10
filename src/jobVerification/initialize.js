import Job from '../models/Job.js';
import Report from '../models/JobVerification.js';
import Lease from '../models/JobVerificationLease.js';
import SourceCache from '../models/VerificationSourceCache.js';
import Queue from '../models/JobVerificationQueue.js';
import { verificationEnabled } from './service.js';

export async function initializeVerification({ force = false } = {}) {
  if (!force && !verificationEnabled()) return;
  // The one-active-report guarantee requires the unique index before accepting work.
  await Promise.all([Report.createIndexes(), Lease.init(), Queue.init(), SourceCache.createIndexes()]);
  await Job.collection.createIndex({ verificationKeys: 1 }, { name: 'verification_identity' });
  await Job.collection.createIndex({ sourceUrl: 1 }, { name: 'verification_source_url' });
  await Job.collection.createIndex({ applyUrl: 1 }, { name: 'verification_apply_url' });
}
