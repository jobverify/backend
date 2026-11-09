import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { saveDryRunSnapshot } from '../scraper-support/utils/saveToDB.js'

const temporaryDirectory = async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'jobverify-job-outbox-'))
  t.after(() => fs.rm(directory, { recursive: true, force: true }))
  return directory
}

const outboxWriter = async () => {
  const module = await import('../scraper-support/utils/localJobOutbox.js').catch(() => null)
  assert.equal(typeof module?.saveLocalJobOutbox, 'function', 'The opt-in local outbox writer must exist')
  return module.saveLocalJobOutbox
}

test('local outbox publishes complete immutable source batches without losing source descriptions', async t => {
  const directory = await temporaryDirectory(t)
  const save = await outboxWriter()
  const jobs = [{ title: 'Engineer', sourceDescription: '<p>Original &amp; complete.</p>', description: 'Display text', qualifications: 'Employer requirements' }]
  const original = JSON.stringify(jobs)
  const options = { source: 'example.workday', dryRun: true, directory, capturedAt: '2026-10-05T01:00:00.000Z', now: new Date('2026-10-05T01:02:03.004Z'), phase: 'enriched_description', captureFile: 'raw-provider.json' }
  const first = await save(jobs, options)
  const second = await save([{ description: 'Second attempt' }], options)
  assert.notEqual(first, second)
  const saved = JSON.parse(await fs.readFile(first, 'utf8'))
  assert.equal(saved.version, 1)
  assert.equal(saved.source, 'example.workday')
  assert.equal(saved.capturedAt, '2026-10-05T01:00:00.000Z')
  assert.equal(saved.availableAt, '2026-10-05T01:02:03.004Z')
  assert.equal(saved.phase, 'enriched_description')
  assert.equal(saved.captureFile, 'raw-provider.json')
  assert.deepEqual(saved.jobs, [{ title: 'Engineer', sourceDescription: '<p>Original &amp; complete.</p>', description: 'Display text', qualifications: 'Employer requirements' }])
  assert.equal(JSON.parse(await fs.readFile(second, 'utf8')).jobs[0].description, 'Second attempt')
  assert.equal(JSON.stringify(jobs), original)
  const files = await fs.readdir(directory)
  assert.equal(files.length, 2)
  assert.ok(files.every(file => /^2026-10-05T01-02-03-004Z-.*\.jobs\.json$/.test(file)))
})

test('local outbox does not write during live runs or without opt-in', async t => {
  const directory = await temporaryDirectory(t)
  const save = await outboxWriter()
  assert.equal(await save([], { source: 'example', dryRun: false, directory }), null)
  assert.equal(await save([], { source: 'example', dryRun: true, directory: '' }), null)
  assert.deepEqual(await fs.readdir(directory), [])
})

test('outbox serialization and persistence failures leave no partial batch and stop the pipeline', async t => {
  const directory = await temporaryDirectory(t)
  const save = await outboxWriter()
  const circular = { title: 'Circular' }
  circular.self = circular
  await assert.rejects(save([circular], { source: 'example', dryRun: true, directory }), error => error.abortPipeline === true && /outbox/i.test(error.message))
  assert.deepEqual(await fs.readdir(directory), [])
  const blocked = path.join(directory, 'occupied')
  await fs.writeFile(blocked, 'existing file')
  await assert.rejects(save([], { source: 'example', dryRun: true, directory: blocked }), error => error.abortPipeline === true && /outbox/i.test(error.message))
  assert.equal(await fs.readFile(blocked, 'utf8'), 'existing file')
})

test('dry snapshot queues public enrichment before snapshot writing and skips the model', async t => {
  await outboxWriter()
  const directory = await temporaryDirectory(t)
  const outbox = path.join(directory, 'outbox')
  const outputPath = path.join(directory, 'jobs.json')
  const stages = []
  await saveDryRunSnapshot([{ title: 'Cloud Engineer', company: 'Example', location: 'Bengaluru, India', applyUrl: 'https://example.com/jobs/cloud', sourceUrl: 'https://example.com/jobs/cloud' }], outputPath, {
    source: 'example', localJobOutboxDirectory: outbox, useBrowserFallback: false,
    classifier: { mode: 'policy', classifyJobs: async () => { throw new Error('Outbox producer must not invoke the model') } },
    fetchText: async () => '<html><body><h1>Cloud Engineer</h1><h2>Job Description</h2><p>Build cloud infrastructure and automate delivery pipelines.</p><h2>Required Experience</h2><p>5 years</p></body></html>',
    onStage: event => { if (event.status === 'done') stages.push(event.stage) },
  })
  const files = await fs.readdir(outbox)
  assert.equal(files.length, 1)
  const batch = JSON.parse(await fs.readFile(path.join(outbox, files[0]), 'utf8'))
  assert.equal(batch.phase, 'enriched_description')
  assert.equal(batch.jobs.length, 1)
  assert.match(batch.jobs[0].jobDescription || batch.jobs[0].description || batch.jobs[0].sourceDescription, /Build cloud infrastructure/)
  assert.equal(batch.jobs[0].experienceRequired, '5 years')
  assert.ok(stages.indexOf('local job outbox') < stages.indexOf('snapshot write'))
  assert.equal(JSON.parse(await fs.readFile(outputPath, 'utf8')).length, 1)
})

test('dry runner queues usable provider descriptions before the enriched batch while retaining India filtering', async t => {
  await outboxWriter()
  const directory = await temporaryDirectory(t)
  const previousArgv = process.argv
  const previousOutbox = process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY
  const previousFetch = globalThis.fetch
  const batchesBeforeFetch = []
  process.argv = [...previousArgv, '--dry-run']
  process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY = path.join(directory, 'outbox')
  t.after(() => {
    process.argv = previousArgv
    globalThis.fetch = previousFetch
    if (previousOutbox === undefined) delete process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY
    else process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY = previousOutbox
  })
  globalThis.fetch = async url => {
    const files = await fs.readdir(process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY).catch(() => [])
    batchesBeforeFetch.push(await Promise.all(files.map(file => fs.readFile(path.join(process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY, file), 'utf8').then(JSON.parse))))
    return {
      ok: true, status: 200,
      headers: { get: name => name.toLowerCase() === 'content-type' ? 'text/html' : null },
      text: async () => `<html><body><h1>${String(url).endsWith('/ready') ? 'Ready' : 'Missing description'}</h1><h2>Job Description</h2><p>Build cloud infrastructure and automate delivery pipelines for our engineering team.</p><p>Required Experience: 5 years</p></body></html>`,
    }
  }
  const { runScraper } = await import('../scraper-support/runner.js?local-outbox-test')
  const result = await runScraper({
    name: 'example', dryRunFile: path.join(directory, 'jobs.json'), provider: { adapter: 'script', dryRunEnrichPublicExperience: true },
    run: async () => [
      { title: 'Ready', location: 'Bengaluru, India', country: 'India', link: 'https://example.com/jobs/ready', sourceDescription: '<p>Employer source description.</p>' },
      { title: 'Missing description', location: 'Bengaluru, India', country: 'India', link: 'https://example.com/jobs/missing' },
      { title: 'US job', location: 'New York, USA', country: 'USA', link: 'https://example.com/jobs/us', description: 'US employer description' },
    ],
  })
  assert.equal(result.success, true)
  const files = (await fs.readdir(process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY)).sort()
  const batches = await Promise.all(files.map(file => fs.readFile(path.join(process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY, file), 'utf8').then(JSON.parse)))
  assert.equal(batches.length, 2)
  assert.equal(batches[0].phase, 'raw_provider_description')
  assert.deepEqual(batches[0].jobs.map(job => job.title), ['Ready'])
  assert.equal(batches[1].phase, 'enriched_description')
  assert.deepEqual(batches[1].jobs.map(job => job.title), ['Ready', 'Missing description'])
  assert.ok(batches[0].availableAt <= batches[1].availableAt)
  assert.ok(batchesBeforeFetch.length > 0)
  assert.ok(batchesBeforeFetch.every(before => before.length === 1 && before[0].phase === 'raw_provider_description'))
  assert.match(batches[1].jobs[1].description || batches[1].jobs[1].jobDescription || '', /Build cloud infrastructure/)
})

test('runner aborts when its opted-in outbox cannot persist instead of reporting source completion', async t => {
  const directory = await temporaryDirectory(t)
  const occupied = path.join(directory, 'occupied')
  await fs.writeFile(occupied, 'existing file')
  const previousArgv = process.argv
  const previousOutbox = process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY
  process.argv = [...previousArgv, '--dry-run']
  process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY = occupied
  t.after(() => {
    process.argv = previousArgv
    if (previousOutbox === undefined) delete process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY
    else process.env.SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY = previousOutbox
  })
  const { runScraper } = await import('../scraper-support/runner.js?local-outbox-test')
  await assert.rejects(runScraper({
    name: 'blocked-outbox', dryRunFile: path.join(directory, 'jobs.json'),
    provider: { adapter: 'script', dryRunEnrichPublicExperience: false },
    run: async () => [{ title: 'Ready', location: 'Bengaluru, India', link: 'https://example.com/jobs/ready', description: 'Employer source description' }],
  }), error => error.abortPipeline === true && /Local job outbox could not persist/.test(error.message))
  await assert.rejects(fs.stat(path.join(directory, 'jobs.json')), { code: 'ENOENT' })
})
