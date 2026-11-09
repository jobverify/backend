import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { saveRawSourceCapture, saveRawSourceFailure } from '../scraper-support/utils/rawCapture.js'

const temporaryDirectory = async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-raw-capture-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

test('raw capture preserves unfiltered descriptions and job fields before normalization', async (t) => {
  const directory = await temporaryDirectory(t)
  const jobs = [
    { title: 'US role', country: 'USA', sourceDescription: '<p>Original &amp; complete.</p>', description: 'Different display text' },
    { title: 'Closed India role', closingDate: '2000-01-01', link: 'invalid', jobDescription: 'Employer text\nSecond line' },
  ]
  const before = JSON.stringify(jobs)
  const file = await saveRawSourceCapture(jobs, {
    directory, source: 'example.workday', dryRun: true, now: new Date('2026-10-05T01:02:03.004Z'),
  })
  const saved = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.equal(saved.source, 'example.workday')
  assert.equal(saved.capturedAt, '2026-10-05T01:02:03.004Z')
  assert.deepEqual(saved.jobs, [
    { title: 'US role', country: 'USA', sourceDescription: '<p>Original &amp; complete.</p>', description: 'Different display text' },
    { title: 'Closed India role', closingDate: '2000-01-01', link: 'invalid', jobDescription: 'Employer text\nSecond line' },
  ])
  assert.equal(JSON.stringify(jobs), before)
  assert.deepEqual((await fs.readdir(path.dirname(file))).filter(name => name.endsWith('.tmp')), [])
})

test('raw capture preserves a successful empty inventory as an empty jobs array', async (t) => {
  const directory = await temporaryDirectory(t)
  const file = await saveRawSourceCapture([], { directory, source: 'empty', dryRun: true })
  const saved = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.deepEqual(saved.jobs, [])
  assert.equal(saved.jobCount, 0)
  assert.equal(saved.type, 'capture')
})

test('raw capture has no filesystem effect without an opt-in directory', async (t) => {
  const directory = await temporaryDirectory(t)
  const previous = process.env.SCRAPER_RAW_CAPTURE_DIRECTORY
  delete process.env.SCRAPER_RAW_CAPTURE_DIRECTORY
  t.after(() => {
    if (previous === undefined) delete process.env.SCRAPER_RAW_CAPTURE_DIRECTORY
    else process.env.SCRAPER_RAW_CAPTURE_DIRECTORY = previous
  })
  assert.equal(await saveRawSourceCapture([], { source: 'example', dryRun: true }), null)
  assert.equal(await saveRawSourceCapture([], { source: 'example', dryRun: true, directory: ' ' }), null)
  assert.deepEqual(await fs.readdir(directory), [])
})

test('raw capture and failure records do not write for a live run', async (t) => {
  const directory = await temporaryDirectory(t)
  assert.equal(await saveRawSourceCapture([], { directory, source: 'example', dryRun: false }), null)
  assert.equal(await saveRawSourceFailure(new Error('network failed'), { directory, source: 'example', dryRun: false }), null)
  assert.deepEqual(await fs.readdir(directory), [])
})

test('raw capture rejects source names that could escape or corrupt the archive directory', async (t) => {
  const directory = await temporaryDirectory(t)
  for (const source of ['../escape', '..', '/absolute', 'C:\\escape', 'x/y', 'x\\y', 'con', 'nul.json', 'trailing.', ' spaced ']) {
    await assert.rejects(saveRawSourceCapture([], { directory, source, dryRun: true }), /Invalid raw capture source/)
  }
  assert.deepEqual(await fs.readdir(directory), [])
})

test('repeated captures with the same source and timestamp retain both attempts', async (t) => {
  const directory = await temporaryDirectory(t)
  const options = { directory, source: 'repeat', dryRun: true, now: new Date('2026-10-05T01:02:03.004Z') }
  const first = await saveRawSourceCapture([{ description: 'first' }], options)
  const second = await saveRawSourceCapture([{ description: 'second' }], options)
  assert.notEqual(first, second)
  assert.equal(JSON.parse(await fs.readFile(first, 'utf8')).jobs[0].description, 'first')
  assert.equal(JSON.parse(await fs.readFile(second, 'utf8')).jobs[0].description, 'second')
  assert.equal((await fs.readdir(path.dirname(first))).length, 2)
})

test('a failed scraper is recorded separately without inventing an empty inventory', async (t) => {
  const directory = await temporaryDirectory(t)
  const error = new Error('HTTP 503 from official careers')
  error.failureKind = 'upstream_outage'
  const file = await saveRawSourceFailure(error, { directory, source: 'broken', dryRun: true })
  const saved = JSON.parse(await fs.readFile(file, 'utf8'))
  assert.equal(saved.type, 'failure')
  assert.equal(saved.error.message, 'HTTP 503 from official careers')
  assert.equal(saved.error.failureKind, 'upstream_outage')
  assert.equal(Object.hasOwn(saved, 'jobs'), false)
  assert.equal(Object.hasOwn(saved, 'jobCount'), false)
})

test('unserializable provider output leaves no partial capture files', async (t) => {
  const directory = await temporaryDirectory(t)
  const job = { title: 'circular' }
  job.self = job
  await assert.rejects(saveRawSourceCapture([job], { directory, source: 'circular', dryRun: true }), /circular/i)
  assert.deepEqual(await fs.readdir(directory), [])
})

test('a source directory junction cannot redirect captures outside the archive', async (t) => {
  const directory = await temporaryDirectory(t)
  const outside = await temporaryDirectory(t)
  await fs.symlink(outside, path.join(directory, 'redirected'), process.platform === 'win32' ? 'junction' : 'dir')
  await assert.rejects(saveRawSourceCapture([], { directory, source: 'redirected', dryRun: true }), /Invalid raw capture source directory/)
  assert.deepEqual(await fs.readdir(outside), [])
})

test('a later processing failure references its immutable provider capture', async (t) => {
  const directory = await temporaryDirectory(t)
  const options = { directory, source: 'processing', dryRun: true }
  const captureFile = await saveRawSourceCapture([{ sourceDescription: 'Retain this advert even if processing fails.' }], options)
  const error = new Error('model unavailable')
  error.classificationPending = true
  const failureFile = await saveRawSourceFailure(error, { ...options, captureFile })
  const failure = JSON.parse(await fs.readFile(failureFile, 'utf8'))
  assert.equal(failure.captureFile, captureFile)
  assert.equal(failure.error.classificationPending, true)
  assert.equal(Object.hasOwn(failure, 'jobs'), false)
  assert.equal(JSON.parse(await fs.readFile(captureFile, 'utf8')).jobs[0].sourceDescription, 'Retain this advert even if processing fails.')
})

const loadDryRunRunner = async () => {
  const previousArgv = process.argv
  process.argv = [...previousArgv, '--dry-run']
  try {
    return await import('../scraper-support/runner.js?raw-capture-test')
  } finally {
    process.argv = previousArgv
  }
}

test('the dry runner captures rejected jobs before filtering and records scrape failures separately', async (t) => {
  const directory = await temporaryDirectory(t)
  const previousDirectory = process.env.SCRAPER_RAW_CAPTURE_DIRECTORY
  process.env.SCRAPER_RAW_CAPTURE_DIRECTORY = path.join(directory, 'raw')
  t.after(() => {
    if (previousDirectory === undefined) delete process.env.SCRAPER_RAW_CAPTURE_DIRECTORY
    else process.env.SCRAPER_RAW_CAPTURE_DIRECTORY = previousDirectory
  })
  const { runScraper } = await loadDryRunRunner()
  const result = await runScraper({
    name: 'filtered', dryRunFile: path.join(directory, 'filtered', 'jobs.json'),
    provider: { adapter: 'workday', dryRunEnrichPublicExperience: false },
    run: async () => [{ title: 'Outside India', country: 'USA', city: 'New York', location: 'New York, USA', description: '<p>Original US advert.</p>', link: 'https://example.com/jobs/one' }],
  })
  assert.equal(result.success, false)
  assert.equal(result.processingComplete, true)
  assert.equal(result.softFailure, true)
  assert.equal(result.failureKind, 'coverage_gap')
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(directory, 'filtered', 'jobs.json'), 'utf8')), [])
  const captureFiles = await fs.readdir(path.join(directory, 'raw', 'filtered'))
  const capture = JSON.parse(await fs.readFile(path.join(directory, 'raw', 'filtered', captureFiles[0]), 'utf8'))
  assert.equal(capture.jobs.length, 1)
  assert.equal(capture.jobs[0].description, '<p>Original US advert.</p>')

  const failed = await runScraper({
    name: 'failed', dryRunFile: path.join(directory, 'failed', 'jobs.json'),
    provider: { adapter: 'workday', dryRunEnrichPublicExperience: false },
    run: async () => { throw new Error('upstream unavailable') },
  })
  assert.equal(failed.success, false)
  const failureFiles = await fs.readdir(path.join(directory, 'raw', 'failed'))
  assert.equal(failureFiles.length, 1)
  const failure = JSON.parse(await fs.readFile(path.join(directory, 'raw', 'failed', failureFiles[0]), 'utf8'))
  assert.equal(failure.type, 'failure')
  assert.equal(Object.hasOwn(failure, 'jobs'), false)
})
