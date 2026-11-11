import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, CAREER_PAGE_URL } from './script.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import { normalizePublicWorkArrangement } from '../../src/utils/publicWorkArrangement.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const bytes = readFileSync(new URL('./test-data-20261111/native-mode-actual25.json.gz', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('./test-data-20261111/native-mode-actual25.manifest.json', import.meta.url)))
assert.equal(sha(bytes), manifest.fixtureSHA256)
const capture = JSON.parse(gunzipSync(bytes))
const key = Symbol.for('jobverify.epam-native-inventory')
const provider = { source: 'epam', company: 'EPAM', companyCareerPage: CAREER_PAGE_URL, companyDomain: 'epam.com', countryFilter: 'India' }
const hybridID = manifest.knownHybridIDs[0]

test.beforeEach(t => t.mock.method(globalThis, 'fetch', async () => assert.fail('Unrecorded network in EPAM native mode replay')))

async function replay(mutate, selectedID = hybridID, stages = ['opening-primary', 'opening', 'closing', 'closing-primary']) {
  let index = 0
  const mutations = []
  const jobs = await run({ transport: async (url, init) => {
    const row = capture.responses[index++]
    assert.ok(row, 'No missing fixture response may masquerade as a safe source hold')
    assert.equal(url, row.url); assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'manual')
    let body = Buffer.from(row.rawBodyBase64, 'base64')
    assert.equal(body.length, row.bodyBytes); assert.equal(sha(body), row.bodySHA256)
    if (mutate && stages.includes(row.stage)) {
      const change = record => {
        if (record?.unique_id !== selectedID) return
        const before = sha(JSON.stringify(record)); mutate(record)
        const after = sha(JSON.stringify(record)); assert.notEqual(after, before, 'A negative control must really change its acquired row')
        mutations.push({ stage: row.stage, id: selectedID, before, after })
      }
      const original = body.toString('utf8')
      if (row.contentType.split(';')[0] === 'application/json') {
        const payload = JSON.parse(original); payload.data.jobs.forEach(change)
        if (mutations.at(-1)?.stage === row.stage) body = Buffer.from(JSON.stringify(payload))
      } else if (row.contentType.split(';')[0] === 'text/html') {
        const match = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(original)
        assert.ok(match)
        const parsed = JSON.parse(match[1]), beforeCount = mutations.length
        parsed.props.pageProps.jobs.jobs.forEach(change)
        parsed.props.pageProps.initialJobs.jobs.forEach(change)
        if (mutations.length > beforeCount) body = Buffer.from(original.replace(match[1], JSON.stringify(parsed)))
      }
    }
    return { url: row.finalUrl, status: row.status, headers: { 'content-type': row.contentType }, body, provenance: 'exact-actual-registered-25-acquired-packet-replay' }
  } })
  assert.equal(index, 15, 'This fixture must exercise the uncapped complete native opening and closing transaction')
  assert.equal(jobs.length, 255)
  if (mutate) {
    assert.ok(mutations.some(row => row.stage === 'opening') || !stages.includes('opening'))
    assert.ok(mutations.some(row => row.stage === 'closing') || !stages.includes('closing'))
  }
  return { jobs, audit: jobs[key], mutations }
}

function assertInterpreted(job, expected) {
  const normalized = normalizeScrapedJob(job, provider)
  assert.equal(normalized.remoteStatus, expected)
  assert.equal(normalized.workArrangement, expected)
  assert.equal(job.sourceRemoteStatusUnresolved, true)
  assert.equal(job.remoteStatus, expected)
  const signals = extractJobFilterSignals(normalized)
  assert.equal(signals.workArrangement, expected)
  assert.equal(signals.filterSignals.confidence.workArrangement, expected == null ? 'low' : 'high')
  assert.equal(normalizePublicWorkArrangement('On-site', normalized), expected)
  return normalized
}

function assertStableOtherModes(jobs, changedID) {
  const stable = jobs.filter(job => job.nativeUniqueId !== changedID)
  for (const job of stable) {
    assert.equal(job.remoteStatus, job.nativeRecord.vacancy_type === 'Hybrid' ? 'Hybrid' : 'On-site')
    assert.equal(job.sourceRemoteStatusUnresolved, true)
  }
  for (const label of ['Office', 'Hybrid']) {
    const job = stable.find(value => value.nativeRecord.vacancy_type === label)
    assert.ok(job); assertInterpreted(job, label === 'Hybrid' ? 'Hybrid' : 'On-site')
  }
}

test('actual EPAM25 packets retain both original Hybrid rows and all complete raw body digests', () => {
  assert.equal(capture.responses.length, 15); assert.equal(capture.expected.length, 255)
  for (const row of capture.responses) {
    const body = Buffer.from(row.rawBodyBase64, 'base64')
    assert.equal(sha(body), row.bodySHA256); assert.equal(body.length, row.bodyBytes)
  }
  assert.deepEqual(capture.expected.filter(row => row.vacancyType === 'Hybrid').map(row => row.id), manifest.knownHybridIDs)
  assert.ok(capture.expected.filter(row => row.vacancyType === 'Hybrid').every(row => row.previousRemoteStatus === 'On-site'))
  const controller = Buffer.from(capture.responses[1].rawBodyBase64, 'base64').toString('utf8')
  assert.equal(sha(controller), manifest.modeContract.currentControllerSHA256)
  assert.ok(controller.includes(manifest.modeContract.exactCurrentBranch))
  assert.ok(manifest.modeContract.exactCurrentBranch.includes('"Office"===e.vacancy_type'))
  assert.ok(manifest.modeContract.exactCurrentBranch.includes('"Hybrid"===e.vacancy_type'))
})

test('uncapped actual255 EPAM roles preserve typed Hybrid2 and Office253 through normalization and public interpretation', async () => {
  const { jobs, audit } = await replay()
  assert.equal(audit.complete, true); assert.equal(audit.closingMatches, true); assert.equal(audit.requests, 15)
  assert.equal(audit.failures.length, 0); assert.equal(audit.bodyGaps.length, 0)
  const expected = new Map(capture.expected.map(row => [row.id, row]))
  const original = new Map(capture.responses.filter(row => row.stage === 'opening')
    .flatMap(row => JSON.parse(Buffer.from(row.rawBodyBase64, 'base64')).data.jobs).map(record => [record.unique_id, record]))
  const hybridFirst = [...jobs.filter(job => job.nativeRecord.vacancy_type === 'Hybrid'), ...jobs.filter(job => job.nativeRecord.vacancy_type !== 'Hybrid')]
  for (const job of hybridFirst) {
    const before = expected.get(job.nativeUniqueId)
    assert.ok(before); assert.deepEqual(job.nativeRecord, original.get(job.nativeUniqueId))
    const normalized = assertInterpreted(job, before.vacancyType === 'Hybrid' ? 'Hybrid' : 'On-site')
    assert.equal(normalized.sourceDescription, before.sourceDescription)
    assert.equal(normalized.postingDate.toISOString(), before.postingDate)
    assert.equal(normalized.closingDate, before.closingDate)
    assert.equal(normalized.country, before.country); assert.equal(normalized.location, before.location)
    assert.equal(normalized.originalTitle, before.title); assert.equal(normalized.jobId, before.jobId)
    assert.equal(job.employmentType, null); assert.equal(normalized.sourceEmploymentType, null)
    assert.equal(job.sourceScopeComplete, true); assert.equal(job.lifecycleCleanupAllowed, true)
  }
})

for (const [name, mutate] of [
  ['missing typed value', record => { delete record.vacancy_type }],
  ['unreviewed value', record => { record.vacancy_type = 'Flexible' }],
  ['object typed value', record => { record.vacancy_type = { title: 'Hybrid' } }],
  ['array typed value', record => { record.vacancy_type = ['Hybrid'] }],
  ['metadata disagreement', record => { record.metadata.vacancy_type[0].title = 'Office' }],
  ['metadata additional conflicting row', record => { record.metadata.vacancy_type.push({ title: 'Remote', locale: 'en-us' }) }],
  ['malformed metadata value', record => { record.metadata.vacancy_type = 'Hybrid' }],
  ['missing metadata value', record => { delete record.metadata.vacancy_type }],
  ['unreviewed metadata locale', record => { record.metadata.vacancy_type[0].locale = 'de-de' }],
  ['additional typed workplace declaration', record => { record.remote_office = true }],
  ['additional metadata workplace declaration', record => { record.metadata.work_arrangement = 'Remote' }],
]) test(`EPAM ${name} stays null/low while the complete original role remains preserved`, async () => {
  const { jobs, audit, mutations } = await replay(mutate)
  assert.equal(audit.complete, true); assert.equal(audit.closingMatches, true)
  const job = jobs.find(value => value.nativeUniqueId === hybridID)
  assert.ok(job); assert.ok(mutations.length >= 2)
  const normalized = assertInterpreted(job, null)
  assert.equal(normalized.sourceDescription, capture.expected.find(row => row.id === hybridID).sourceDescription)
  assert.equal(normalized.country, 'India'); assert.equal(job.employmentType, null)
})

test('the reviewed exact Remote renderer enum survives without inventing employment type', async () => {
  const { jobs, audit } = await replay(record => {
    record.vacancy_type = 'Remote'; record.metadata.vacancy_type[0].title = 'Remote'
  })
  assert.equal(audit.complete, true)
  const job = jobs.find(value => value.nativeUniqueId === hybridID)
  assertInterpreted(job, 'Remote'); assert.equal(job.employmentType, null)
})

test('changing typed workplace at closing still prevents complete inventory and cleanup', async () => {
  const { jobs, audit } = await replay(record => {
    record.vacancy_type = 'Office'; record.metadata.vacancy_type[0].title = 'Office'
  }, hybridID, ['closing', 'closing-primary'])
  assert.equal(audit.complete, false); assert.equal(audit.closingMatches, false); assert.equal(audit.cleanupAllowed, false)
  assert.ok(audit.failures.some(row => row.code === 'native-closing-inventory-changed'))
  const changed = jobs.find(value => value.nativeUniqueId === hybridID)
  assert.equal(changed.nativeRecord.vacancy_type, 'Hybrid')
  assertInterpreted(changed, null)
  assertStableOtherModes(jobs, hybridID)
  for (const job of jobs) { assert.equal(job.sourceScopeComplete, false); assert.equal(job.lifecycleCleanupAllowed, false) }
})

for (const [name, mutate] of [
  ['missing workplace value', record => { delete record.vacancy_type }],
  ['contradictory localized workplace value', record => { record.metadata.vacancy_type[0].title = 'Office' }],
  ['role no longer publicly available', record => { record.is_hidden = true }],
]) test(`a closing ${name} clears only that role's current mode`, async () => {
  const { jobs, audit } = await replay(mutate, hybridID, ['closing', 'closing-primary'])
  assert.equal(audit.complete, false); assert.equal(audit.cleanupAllowed, false)
  const changed = jobs.find(value => value.nativeUniqueId === hybridID)
  assertInterpreted(changed, null)
  assert.equal(changed.nativeRecord.vacancy_type, 'Hybrid')
  assertStableOtherModes(jobs, hybridID)
})

test('existing unflagged city-only normalization remains unchanged', () => {
  const normalized = normalizeScrapedJob({ title: 'Software Engineer', company: 'EPAM', location: 'Hyderabad, India',
    country: 'India', jobId: 'legacy-city-only', applyUrl: CAREER_PAGE_URL, jobDescription: 'Published duties and qualifications.' }, provider)
  assert.equal(normalized.remoteStatus, 'On-site'); assert.equal(normalized.workArrangement, 'On-site')
})
