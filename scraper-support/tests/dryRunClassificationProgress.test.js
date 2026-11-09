import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { saveDryRunSnapshot } from '../utils/saveToDB.js';

test('dry-run persistence exposes classification and snapshot stages before source completion', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dry-classification-progress-'));
  const events = [];
  try {
    const jobs = await saveDryRunSnapshot([{ title: 'Engineer', company: 'Example', location: 'Bengaluru, India', country: 'India', description: 'Build software.', link: 'https://example.com/jobs/one' }],
      path.join(directory, 'jobs.json'), { source: 'example', enrichPublicExperience: false,
        classifier: { mode: 'off' }, onStage: event => events.push(event),
      });
    assert.equal(jobs.length, 1);
    assert.deepEqual(events.map(event => `${event.stage}:${event.status}`), [
      'enrichment:skipped', 'classification:deferred', 'snapshot write:start', 'snapshot write:done',
    ]);
    assert.ok(events.every(event => event.source === 'example'));
    assert.equal(JSON.parse(fs.readFileSync(path.join(directory, 'jobs.json'))).length, 1);
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
