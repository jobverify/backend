import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

/** Shared identity for native reports: production prose changes invalidate resume. */
export const rewritePolicyIdentity = async ({ readFile = fs.readFile } = {}) => {
  const hash = createHash('sha256');
  for (const file of ['model.json', 'prose.js', 'proseValidation.js', 'proseBlocks.js', 'proseLayout.js', 'correctionPolicy.js', 'sharedGeneration.js', 'worker.js', 'runner.js', 'factPlan.js',
    'sectionProtocol.js', 'editProtocol.js', '../src/services/jobDescriptionPolicy.js']) {
    hash.update(file + '\0').update(await readFile(new URL(file, import.meta.url))).update('\0');
  }
  return hash.digest('hex');
};
