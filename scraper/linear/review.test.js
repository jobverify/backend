import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { parse } from 'acorn'
import test from 'node:test'
import { createLinearScraper } from './native.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'

const project = fileURLToPath(new URL('../../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('./test-data/manifest.json', import.meta.url)))
const captures = Object.fromEntries(Object.entries(manifest.captures).map(([name, row]) =>
  [name, { ...row, body: gunzipSync(readFileSync(new URL('./test-data/' + row.file, import.meta.url))) }]))
const firstId = '6dd5500a-4bd4-4f57-ba09-7b07acefecf4'
const now = new Date('2026-11-01T12:00:00.000Z')

// These non-null deadline/address values are controlled future-protocol
// mutations. They are not evidence of current Linear India vacancies.
const indiaFixture = (change = () => {}) => {
  const payload = JSON.parse(captures['native-api'].body)
  const row = payload.jobs.find(row => row.id === firstId)
  row.location = 'Bengaluru, India'
  row.address = { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }
  let html = captures['native-role'].body.toString('utf8')
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  const data = scripts.find(match => match[1].includes('window.__appData'))
  const assignment = parse(data[1], { ecmaVersion: 'latest' }).body[0].expression.right
  const app = JSON.parse(data[1].slice(assignment.start, assignment.end))
  const ld = scripts.find(match => match[1].startsWith('{"@context"'))
  const schema = JSON.parse(ld[1])
  app.posting.locationName = row.location
  schema.jobLocation.address.addressCountry = 'IN'
  schema.applicantLocationRequirements.name = 'India'
  change({ app, schema, row, payload })
  html = html.replace(data[1], data[1].slice(0, assignment.start) + JSON.stringify(app) + data[1].slice(assignment.end))
  return { payload, html: html.replace(ld[1], JSON.stringify(schema)) }
}
const collect = fixture => createLinearScraper().collect({ transport: async url => {
  const capture = Object.values(captures).find(row => row.url === url)
  assert.ok(capture, 'Unexpected offline URL: ' + url)
  const body = capture === captures['native-api'] ? Buffer.from(JSON.stringify(fixture.payload))
    : capture === captures['native-role'] ? Buffer.from(fixture.html) : capture.body
  return { url, status: 200, headers: { 'content-type': capture.contentType }, body, bodyComplete: true,
    requestedAt: capture.requestedAt, completedAt: capture.completedAt }
} })

const persistedClosingDate = job => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', `
  import assert from 'node:assert/strict'
  import mongoose from 'mongoose'
  import Job from './src/models/Job.js'
  import { saveToDB } from './scraper-support/utils/saveToDB.js'
  globalThis.fetch = async () => { throw Error('No network in Linear precision regression') }
  let input = ''; for await (const chunk of process.stdin) input += chunk
  const job = JSON.parse(input), now = new Date('2026-11-01T12:00:00.000Z')
  assert.equal(mongoose.connection.readyState, 0); assert.equal(mongoose.connection.db, undefined)
  const original = Job.bulkWrite; let operations
  Job.bulkWrite = async value => { operations = value; return { upsertedCount: value.length, modifiedCount: 0 } }
  mongoose.connection.readyState = 1
  try {
    await saveToDB([job], 'linear', { now, enrichPublicExperience: false, enqueueAlerts: false,
      descriptionRewriteMode: 'off', replaceExisting: false, refreshDatasetSummary: false })
    const closing = operations[0].updateOne.update.$set.closingDate
    process.stdout.write(JSON.stringify({ closingDate: closing.toISOString(), visibleOnClosingDay: closing > now }))
  } finally { Job.bulkWrite = original; mongoose.connection.readyState = 0 }
`], { cwd: project, input: JSON.stringify(job), encoding: 'utf8', timeout: 20000 }))

test('a native application deadline survives extraction and the existing publication policy excludes elapsed deadlines', async () => {
  const result = await collect(indiaFixture(({ app }) => { app.posting.applicationDeadline = '2026-10-31T00:00:00.000Z' }))
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].closingDate, '2026-10-31T00:00:00.000Z')
  assert.equal(result.jobs[0].nativeApplicationDeadline, '2026-10-31T00:00:00.000Z')
  assert.equal(result.jobs[0].sourceClosingDateIsExact, true)
  const metrics = analyzePublishableJobs(result.jobs, { now })
  assert.equal(metrics.eligibleJobs.length, 0)
  assert.equal(metrics.filterCounts.closed, 1)
})

test('contradictory or malformed native deadline evidence produces an explicit detail failure', async () => {
  for (const change of [({ app, schema }) => {
    app.posting.applicationDeadline = '2026-10-31T00:00:00.000Z'; schema.validThrough = '2026-12-01'
  }, ({ app }) => { app.posting.applicationDeadline = 'unknown' },
  ({ app }) => { app.posting.applicationDeadline = '' },
  ({ schema }) => { schema.validThrough = '' },
  ({ app }) => { app.posting.applicationDeadline = 123 },
  ({ app }) => { app.posting.applicationDeadline = '2026-11-31T00:00:00.000Z' },
  ({ app, schema }) => {
    app.posting.applicationDeadline = '2026-11-01T13:00:00.000Z'; schema.validThrough = '2026-11-01T14:00:00.000Z'
  }]) {
    const result = await collect(indiaFixture(change))
    assert.equal(result.jobs.length, 0)
    assert.equal(result.failures.length, 1)
    assert.match(result.failures[0].reason, /deadline|expiry|date/i)
    assert.equal(result.inventoryEvidence.indiaFacetCount, null)
  }
})

test('a qualified day-only expiry persists through its full closing day with the original raw date', async () => {
  const result = await collect(indiaFixture(({ schema }) => { schema.validThrough = '2026-11-01' }))
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].closingDate, '2026-11-01')
  assert.deepEqual(persistedClosingDate(result.jobs[0]), {
    closingDate: '2026-11-02T00:00:00.000Z', visibleOnClosingDay: true,
  })
  assert.equal(result.jobs[0].sourceClosingDateIsExact, false)
})

test('an exact native deadline agreeing with a day-only schema expiry retains its exact cutoff', async () => {
  const result = await collect(indiaFixture(({ app, schema }) => {
    app.posting.applicationDeadline = '2026-11-01T13:30:00.000Z'; schema.validThrough = '2026-11-01'
  }))
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].closingDate, '2026-11-01T13:30:00.000Z')
  assert.equal(result.jobs[0].sourceClosingDateIsExact, true)
  assert.deepEqual(persistedClosingDate(result.jobs[0]), {
    closingDate: '2026-11-01T13:30:00.000Z', visibleOnClosingDay: true,
  })
  assert.equal(analyzePublishableJobs(result.jobs, { now: new Date('2026-11-01T13:30:00.000Z') }).filterCounts.closed, 1)
})

test('an offset deadline retains its publisher text and reconciles with the existing UTC closing-day policy', async () => {
  const result = await collect(indiaFixture(({ app, schema }) => {
    app.posting.applicationDeadline = '2026-11-02T00:15:00.000+05:30'; schema.validThrough = '2026-11-01'
  }))
  assert.equal(result.jobs.length, 1)
  assert.equal(result.jobs[0].closingDate, '2026-11-02T00:15:00.000+05:30')
  assert.equal(result.jobs[0].sourceClosingDateIsExact, true)
  assert.deepEqual(persistedClosingDate(result.jobs[0]), {
    closingDate: '2026-11-01T18:45:00.000Z', visibleOnClosingDay: true,
  })
  assert.equal(analyzePublishableJobs(result.jobs, { now: new Date('2026-11-01T18:45:00.000Z') }).filterCounts.closed, 1)
})

test('unselected foreign content/date failures retain an independently qualified India vacancy and report the failed row', async () => {
  for (const change of [row => { row.descriptionHtml = '' }, row => { row.publishedAt = 'unqualified-date' }]) {
    const fixture = indiaFixture(({ payload }) => change(payload.jobs[0]))
    const foreignId = fixture.payload.jobs[0].id
    assert.notEqual(foreignId, firstId)
    const result = await collect(fixture)
    assert.deepEqual(result.jobs.map(job => job.jobId), [firstId])
    assert.equal(result.failures.length, 1)
    assert.equal(result.failures[0].jobId, foreignId)
    assert.equal(result.failures[0].stage, 'native-row')
    assert.equal(result.checkedBoardIndiaCount, null)
    assert.equal(result.jobs[0].lifecycleCleanupAllowed, false)
  }
})

test('explicit foreign countries in native posting addresses cannot contradict an India feed/schema', async () => {
  for (const address of [{ addressCountry: 'Singapore', addressLocality: 'Singapore' },
    { postalAddress: { addressCountry: 'SG', addressLocality: 'Singapore' } },
    { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' }, addressCountry: 'Singapore' }]) {
    const result = await collect(indiaFixture(({ app }) => { app.posting.locationAddress = address }))
    assert.equal(result.jobs.length, 0)
    assert.equal(result.failures.length, 1)
    assert.match(result.failures[0].reason, /posting address|geography/i)
    assert.equal(result.checkedBoardIndiaCount, null)
  }
})

test('matching direct and wrapped native postal addresses preserve native geography evidence', async () => {
  for (const address of [{ addressCountry: 'India', addressLocality: 'Bengaluru' },
    { postalAddress: { addressCountry: 'IN', addressLocality: 'Bengaluru' } }]) {
    const result = await collect(indiaFixture(({ app }) => { app.posting.locationAddress = address }))
    assert.equal(result.jobs.length, 1)
    assert.deepEqual(JSON.parse(JSON.stringify(result.jobs[0].nativePostingAddress)), address)
    assert.equal(result.jobs[0].country, 'India')
    assert.equal(result.jobs[0].sourceScopeComplete, false)
    assert.equal(result.lifecycleCleanupAllowed, false)
  }
})
