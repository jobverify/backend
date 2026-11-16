import test from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { isFatalProcessingError } from '../src/pipeline/processingErrors.js';

for (const mode of ['malformed-json', 'model-error', 'process-exit', 'host-memory', 'allocation-error', 'empty-error', 'pipe-error']) {
  test(`GLiClass distinguishes ${mode} from application execution failures`, async t => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'gliclass-failure-'));
    t.after(async () => { t.mock.restoreAll(); syncBuiltinESMExports(); await fs.rm(directory, { recursive: true, force: true }); });
    t.mock.method(childProcess, 'spawn', () => {
      const child = new EventEmitter();
      child.exitCode = null;
      child.stdout = new PassThrough();
      const finish = code => { child.exitCode = code; child.emit('exit', code, code === 137 ? 'SIGKILL' : null); child.stdout.end(); };
      child.stdin = new Writable({
        write(data, _encoding, done) {
          const request = JSON.parse(data.toString());
          setImmediate(() => {
            if (mode === 'process-exit') finish(137);
            else if (mode === 'pipe-error') child.stdin.emit('error', Object.assign(new Error('broken pipe'), { code: 'EPIPE' }));
            else {
              const error = mode === 'host-memory' ? 'Host memory exceeded 90%; retry this job later'
                : mode === 'allocation-error' ? 'DefaultCPUAllocator: not enough memory: cannot allocate memory'
                  : mode === 'empty-error' ? '' : 'No prediction for this input';
              child.stdout.write(mode === 'malformed-json' ? '{\n' : JSON.stringify({ id: request.id, error }) + '\n');
            }
          });
          done();
        },
        final(done) { setImmediate(() => finish(0)); done(); },
      });
      child.kill = () => finish(137);
      setImmediate(() => child.stdout.write('{"ready":true}\n'));
      return child;
    });
    syncBuiltinESMExports();
    const { startGliclassWorker } = await import('../scripts/gliclassWorker.js');
    const worker = await startGliclassWorker({ modelDirectory: directory, logFile: path.join(directory, 'worker.log') });
    try {
      await assert.rejects(worker.classify({ inputHash: 'fixture', title: 'Engineer', body: 'Employer text' }), error => {
        assert.equal(isFatalProcessingError(error), !['malformed-json','model-error'].includes(mode));
        return true;
      });
    } finally { await worker.stop(); }
    if (mode === 'model-error') {
      // A normal timeout deliberately stops its worker; remaining items must
      // retain that soft outcome instead of reporting a fresh process crash.
      await assert.rejects(worker.classify({ inputHash: 'after-stop' }), error => {
        assert.equal(isFatalProcessingError(error), false);
        return true;
      });
    }
  });
}
