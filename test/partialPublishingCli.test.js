import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { loadPartialTrialEntries } from '../scripts/partialPublishingGapEvidence.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
function fixture(t) {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'partial-manifest-'))
  t.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }))
  const directory = path.join(fixtureRoot, 'bundle')
  fs.mkdirSync(directory)
  fs.mkdirSync(path.join(directory, 'release'))
  const bytes = Buffer.from(JSON.stringify({ source: 'mindsprint', jobs: [] }))
  const file = path.join(directory, 'release/mindsprint.json')
  fs.writeFileSync(file, bytes)
  fs.writeFileSync(path.join(fixtureRoot, 'outside.json'), bytes)
  const manifest = { sources: [{ source: 'mindsprint', file: 'release/mindsprint.json', trialByteHash: hash(bytes) }] }
  const write = () => fs.writeFileSync(path.join(directory, 'manifest.json'), JSON.stringify(manifest))
  write()
  return { directory, bytes, file, manifest, write }
}

test('partial command inputs load one trial or exact hashed manifest entries for batches', t => {
  const f = fixture(t)
  const entries = loadPartialTrialEntries({ trialsDirectory: f.directory })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].trial.source, 'mindsprint')
  assert.ok(entries[0].bytes.equals(f.bytes))
  assert.ok(loadPartialTrialEntries({ trialFile: f.file })[0].bytes.equals(f.bytes))
  assert.ok(loadPartialTrialEntries({ trialsDirectory: path.join(f.directory, 'manifest.json') })[0].bytes.equals(f.bytes))
})

test('partial manifest refuses changed bytes, mismatched identities, duplicate sources and escaping paths', t => {
  const f = fixture(t)
  const original = structuredClone(f.manifest)
  for (const mutate of [
    m => { m.sources[0].trialByteHash = '0'.repeat(64) },
    m => { m.sources[0].source = 'other' },
    m => { m.sources.push({ ...m.sources[0] }) },
    m => { m.sources[0].file = '../outside.json' },
    m => { m.sources[0].file = f.file },
    m => { m.sources = [] },
  ]) {
    f.manifest.sources = structuredClone(original.sources)
    mutate(f.manifest); f.write()
    assert.throws(() => loadPartialTrialEntries({ trialsDirectory: f.directory }))
  }
  assert.throws(() => loadPartialTrialEntries({ trialFile: f.file, trialsDirectory: f.directory }))
  assert.throws(() => loadPartialTrialEntries({}))
})

test('manifest confinement rejects an existing outside file and directory junction; source count is bounded', t => {
  const f = fixture(t)
  f.manifest.sources[0].file = '../outside.json'; f.write()
  assert.throws(() => loadPartialTrialEntries({ trialsDirectory: f.directory }), /escapes manifest/)
  f.manifest.sources = Array.from({ length: 101 }, (_, i) => ({ source: `source${i}`, file: 'release/mindsprint.json', trialByteHash: hash(f.bytes) }))
  f.write()
  assert.throws(() => loadPartialTrialEntries({ trialsDirectory: f.directory }), /one to 100/)
  const external = path.join(path.dirname(f.directory), 'external')
  fs.mkdirSync(external)
  fs.writeFileSync(path.join(external, 'mindsprint.json'), f.bytes)
  try { fs.symlinkSync(external, path.join(f.directory, 'junction'), process.platform === 'win32' ? 'junction' : 'dir') }
  catch (error) { if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) return; throw error }
  f.manifest.sources = [{ source: 'mindsprint', file: 'junction/mindsprint.json', trialByteHash: hash(f.bytes) }]; f.write()
  assert.throws(() => loadPartialTrialEntries({ trialsDirectory: f.directory }), /escapes manifest/)
})
