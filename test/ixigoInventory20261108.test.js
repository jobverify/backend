import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { run, OPENINGS_API_URL } from '../scraper/ixigo/script.js'
import { normalizeScrapedJob } from '../scraper-support/utils/normalizeScrapedJob.js'
import * as inventory from '../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../scraper-support/utils/extractionDetailHealth.js'
import Job from '../src/models/Job.js'

globalThis.fetch = async () => { throw new Error('Offline ixigo tests prohibit network access') }
const sha = value => createHash('sha256').update(value).digest('hex')
const bytes = readFileSync(new URL('./test-data/ixigoInventory20261108/current-original-responses.json.gz', import.meta.url))
assert.equal(sha(bytes), 'ce60185771512f589a472bd508be476426def9e707511e2007b3bbca96bf0a30')
const fixture = JSON.parse(gunzipSync(bytes, { maxOutputLength: 2_000_000 }))
assert.equal(fixture.source, 'ixigo')
assert.equal(fixture.requests.length, 10)
for (const record of fixture.requests) {
  assert.equal(sha(record.text), record.bodySHA256)
  assert.equal(Buffer.byteLength(record.text), record.bodyBytes)
}
const observationKey = Symbol.for('jobverify.verified-recruitment-observations')
const original = fixture.requests
const openingOrdinal = 1, closingOrdinal = 9
const growthID = '9890108970', customerID = '12112426538'
const address = 'Second Floor, Veritas Building, Golf Course Rd, behind Ibis Hotel, Sector 53,'
const detailOrdinal = id => original.findIndex(record => record.requestedURL.endsWith('/postings/' + id))
const observations = jobs => jobs[observationKey]
const evidence = jobs => inventory.readInventoryEvidence(jobs)

// Only the original tape is an authentic recording. Every mutation below is
// explicitly synthetic and is used to challenge a boundary, never as live proof.
async function collect({ mutate = () => {}, missingClosing = false, closeError, signal } = {}) {
  const records = structuredClone(original)
  mutate(records)
  let consumed = 0, attempts = 0
  const jobs = await run({ signal, fetchPage: async url => {
    attempts++
    if (missingClosing && consumed === closingOrdinal) throw new Error('Authentic recording has no closing response')
    if (closeError && consumed === closingOrdinal) throw closeError()
    const record = records[consumed++]
    assert.ok(record, 'Closed offline tape has no network fallback')
    assert.equal(url, record.requestedURL)
    return { status: record.status, url: record.finalURL, html: record.text }
  } })
  return { jobs, consumed, attempts }
}
function changeJSON(records, ordinal, change) {
  const data = JSON.parse(records[ordinal].text)
  change(data)
  records[ordinal].text = JSON.stringify(data)
}
function assertPartial(jobs) {
  assert.equal(evidence(jobs).listingComplete, false)
  assert.equal(evidence(jobs).status, 'coverage-gap')
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
  assert.equal(observations(jobs).lifecycleCleanupAllowed, false)
}

test('ixigo earns configured completion from all original details and a separately acquired matching close', async () => {
  const { jobs, consumed, attempts } = await collect()
  assert.equal(consumed, 10)
  assert.equal(attempts, 10)
  assert.equal(jobs.length, 7)
  assert.equal(evidence(jobs).status, 'complete-inventory')
  assert.equal(evidence(jobs).listingComplete, true)
  assert.equal(evidence(jobs).pagesFetched, 10)
  assert.equal(observations(jobs).closingInventoryMatches, true)
  assert.equal(observations(jobs).accountedIndiaJobs, 7)
  assert.equal(observations(jobs).companyGlobalTotal, null)
  assert.equal(observations(jobs).companyIndiaTotal, null)
  assert.equal(observations(jobs).sourceScopeComplete, false)
  assert.equal(extractionDetailHealth(jobs).complete, true)
  for (const expected of fixture.expected.jobs) {
    const job = jobs.find(item => item.jobId === expected.jobId)
    assert.ok(job)
    assert.equal(job.title, expected.title)
    assert.equal(sha(job.sourceDescription), expected.sourceDescriptionSHA256)
    assert.equal(job.sourceListingComplete, true)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.applicationVisited, false)
  }
})

test('ixigo preserves employer taxonomy and address independently from inferred experience and location', async () => {
  const { jobs } = await collect()
  const growth = jobs.find(job => job.jobId === growthID)
  assert.equal(growth.employerExperienceLevel, 'Entry Level')
  assert.equal(growth.employerStreetAddress, address)
  assert.equal(growth.sourceEmploymentType, 'Full-time')
  const normalized = normalizeScrapedJob(growth, { source: 'ixigo' })
  assert.equal(normalized.employerExperienceLevel, 'Entry Level')
  assert.equal(normalized.employerStreetAddress, address)
  assert.equal(normalized.sourceEmploymentType, 'Full-time')
  assert.equal(normalized.sourceDescription, growth.sourceDescription)
  assert.equal(normalized.experienceProfile.minimumYears, 3)
  assert.equal(normalized.experienceProfile.maximumYears, 5)
  assert.equal(normalized.seniority, 'Manager')
  assert.equal(normalized.location.includes('Veritas'), false)
  const customer = normalizeScrapedJob(jobs.find(job => job.jobId === customerID), { source: 'ixigo' })
  assert.equal(customer.country, 'India')
  assert.equal(customer.workArrangement, 'Remote')
  assert.equal(customer.salary, 'INR 1 - 300000 per month')
})

test('optional disclosures survive the strict stored document without accepting structured or numeric values', () => {
  const base = { title: 'Manager', company: 'ixigo', location: 'Gurugram, India', country: 'India',
    applyUrl: 'https://jobs.smartrecruiters.com/ixigo/1234567890', jobDescription: 'Lead a team with 3 to 5 years of experience.' }
  const normalized = normalizeScrapedJob({ ...base, employerExperienceLevel: ' Entry Level ', employerStreetAddress: ' Veritas Building ' })
  const stored = new Job({ ...normalized, fingerprint: 'offline-only-no-save' }).toObject()
  assert.equal(stored.employerExperienceLevel, 'Entry Level')
  assert.equal(stored.employerStreetAddress, 'Veritas Building')
  const invalid = normalizeScrapedJob({ ...base, employerExperienceLevel: { label: 'Entry Level' }, employerStreetAddress: 123 })
  assert.equal(invalid.employerExperienceLevel, null)
  assert.equal(invalid.employerStreetAddress, null)
})

test('closing inventory tolerates record and object-key order without ignoring record contents', async () => {
  const { jobs } = await collect({ mutate(records) {
    changeJSON(records, closingOrdinal, data => {
      data.data.results.reverse()
      data.data.results = data.data.results.map(record => Object.fromEntries(Object.entries(record).reverse()))
    })
  } })
  assert.equal(evidence(jobs).listingComplete, true)
})

for (const [label, mutate] of [
  ['same IDs with a changed title', data => { data.data.results[0].vacancyName += ' changed' }],
  ['same IDs with changed reference', data => { data.data.results[0].refNumber += '-changed' }],
  ['same IDs with changed location', data => { data.data.results[0].location += ' changed' }],
  ['same IDs with changed remote conditions', data => { data.data.results[0].locationRemote = !data.data.results[0].locationRemote }],
  ['same IDs with an additional material field', data => { data.data.results[0].newEligibilityCondition = 'Night shift only' }],
  ['a truncated inventory', data => { data.data.results.pop() }],
  ['a changed total', data => { data.data.numFound++ }],
  ['a duplicate identity', data => { data.data.results[1] = data.data.results[0] }],
]) test('ixigo withholds completion for closing ' + label, async () => {
  const { jobs } = await collect({ mutate(records) { changeJSON(records, closingOrdinal, mutate) } })
  assert.equal(jobs.length, 7)
  assertPartial(jobs)
})

for (const [label, mutate] of [
  ['denial', record => { record.status = 403 }],
  ['changed response URL', record => { record.finalURL += '?other=true' }],
  ['invalid JSON', record => { record.text = '{' }],
]) test('ixigo retains usable rows but remains partial after closing ' + label, async () => {
  const { jobs, consumed } = await collect({ mutate(records) { mutate(records[closingOrdinal]) } })
  assert.equal(consumed, 10)
  assert.equal(jobs.length, 7)
  assertPartial(jobs)
})

test('missing authentic closing evidence causes a failed attempt without inventing a received page', async () => {
  const { jobs, consumed, attempts } = await collect({ missingClosing: true })
  assert.equal(consumed, 9)
  assert.equal(attempts, 10)
  assert.equal(evidence(jobs).pagesFetched, 9)
  assert.equal(observations(jobs).fetchAttempts, 10)
  assertPartial(jobs)
})

test('cancellation during closing is propagated instead of returning a successful partial batch', async () => {
  const controller = new AbortController()
  const reason = new Error('offline cancellation during close')
  await assert.rejects(collect({ signal: controller.signal, closeError() { controller.abort(reason); return reason } }), error => error === reason)
})

test('native denial stops further detail reads and counts four actual responses', async () => {
  const { jobs, consumed, attempts } = await collect({ mutate(records) { records[3].status = 403 } })
  assert.equal(jobs.length, 1)
  assert.equal(consumed, 4)
  assert.equal(attempts, 4)
  assert.equal(evidence(jobs).pagesFetched, 4)
  assert.equal(observations(jobs).fetchAttempts, 4)
  assertPartial(jobs)
})

for (const [label, mutate] of [
  ['an unretained extra authored section', data => { data.jobAd.sections.shiftRequirements = { text: 'Must work overnight.' } }],
  ['an unretained role attachment', data => { data.jobAd.attachments = [{ url: 'https://example.invalid/requirements.pdf' }] }],
  ['invalid published compensation', data => { data.compensation = { min: 10, max: 1, currency: 'INR', period: 'MONTHLY' } }],
  ['a malformed experience label', data => { data.experienceLevel = { id: 'entry', label: { text: 'Entry Level' } } }],
  ['a malformed address', data => { data.location.address = { street: 'Veritas' } }],
  ['conflicting employment', data => { data.typeOfEmployment = { label: 'Part-time' } }],
  ['conflicting remote conditions', data => { data.location.remote = !data.location.remote }],
  ['an additional native custom requirement', data => { data.customField.push({ fieldId: 'SHIFT', fieldLabel: 'Required shift', valueId: 'night', valueLabel: 'Night shift' }) }],
  ['an unretained structured experience requirement', data => { data.minimumYearsOfExperience = 10 }],
]) test('ixigo does not claim all published criteria for ' + label, async () => {
  const { jobs, consumed } = await collect({ mutate(records) { changeJSON(records, detailOrdinal(growthID), mutate) } })
  assert.equal(jobs.length, 7)
  assert.equal(consumed, 9)
  assert.equal(jobs.find(job => job.jobId === growthID).sourceDetailComplete, false)
  assert.equal(extractionDetailHealth(jobs).complete, false)
  assertPartial(jobs)
})

test('an identity-bound inactive role is accounted for without returning it', async () => {
  const { jobs } = await collect({ mutate(records) { changeJSON(records, detailOrdinal(growthID), data => { data.active = false }) } })
  assert.equal(jobs.length, 6)
  assert.equal(evidence(jobs).listingComplete, true)
  assert.equal(observations(jobs).accountedIndiaJobs, 7)
  assert.equal(observations(jobs).exclusions.length, 1)
})

for (const [label, mutate] of [
  ['missing active flag', detail => { delete detail.active }],
  ['missing visibility', detail => { delete detail.visibility }],
  ['unknown visibility', detail => { detail.visibility = 'UNKNOWN' }],
]) test('unknown availability is not counted as an inactive exclusion: ' + label, async () => {
  const { jobs, consumed } = await collect({ mutate(records) { changeJSON(records, detailOrdinal(growthID), mutate) } })
  assert.equal(jobs.length, 6)
  assert.equal(consumed, 9)
  assert.equal(observations(jobs).exclusions.length, 0)
  assertPartial(jobs)
})

test('a stable additional listing experience requirement does not earn completion while unretained', async () => {
  const { jobs, consumed } = await collect({ mutate(records) {
    for (const ordinal of [openingOrdinal, closingOrdinal]) changeJSON(records, ordinal, data => {
      data.data.results[0].minimumYearsOfExperience = 10
    })
  } })
  assert.equal(jobs.length, 7)
  assert.equal(consumed, 9)
  assertPartial(jobs)
})

async function collectListing(results, metadata = {}) {
  const listing = JSON.stringify({ data: { numFound: results.length, results, ...metadata } })
  let requests = 0
  const jobs = await run({ fetchPage: async url => {
    requests++
    if (requests === 1) return { status: 200, url: original[0].finalURL, html: original[0].text }
    assert.equal(url, OPENINGS_API_URL, 'No foreign role detail request is permitted')
    assert.ok(requests <= 3)
    return { status: 200, url, html: listing }
  } })
  return { jobs, requests }
}
test('only a stable genuinely empty producer inventory earns verified-empty', async () => {
  const { jobs, requests } = await collectListing([])
  assert.equal(requests, 3)
  assert.equal(jobs.length, 0)
  assert.equal(evidence(jobs).status, 'verified-empty')
  assert.equal(evidence(jobs).listingComplete, true)
})
test('a stable explicit foreign inventory earns configured completion without claiming a company zero', async () => {
  const foreign = { ...JSON.parse(original[1].text).data.results[0], countryAbbreviation: 'us', countryName: 'United States', location: 'New York',
    customFieldValues: [{ fieldId: 'COUNTRY', fieldLabel: 'Country/Region', valueId: 'us', valueLabel: 'United States' },
      { fieldId: '5f20028fee262d68c71d6715', fieldLabel: 'Brands', valueId: 'default', valueLabel: 'ixigo' }] }
  const { jobs, requests } = await collectListing([foreign])
  assert.equal(requests, 3)
  assert.equal(jobs.length, 0)
  assert.equal(evidence(jobs).status, 'complete-inventory')
  assert.equal(evidence(jobs).reportedTotal, 1)
  assert.equal(evidence(jobs).indiaFacetCount, 0)
  assert.equal(observations(jobs).companyGlobalTotal, null)
})
for (const [code, name] of [['zz', 'Unknown Region'], ['us', 'India'], ['in', 'United States'], ['us', '']]) {
  test('unknown or conflicting geography never becomes a verified India zero: ' + code + '/' + name, async () => {
    const record = { ...JSON.parse(original[1].text).data.results[0], countryAbbreviation: code, countryName: name }
    await assert.rejects(collectListing([record]), /country|geograph/i)
  })
}

test('the fifty-detail budget returns useful roles without reading a closing inventory or declaring completion', async () => {
  const template = JSON.parse(original[detailOrdinal(growthID)].text)
  const listing = JSON.parse(original[1].text).data.results[0]
  const rows = Array.from({ length: 51 }, (_, i) => ({ ...listing, jobVacancyId: String(9000000000 + i), vacancyName: 'Manager ' + i, refNumber: 'SYNTHETIC-' + i }))
  let requests = 0
  const jobs = await run({ fetchPage: async url => {
    requests++
    if (requests === 1) return { status: 200, url: original[0].finalURL, html: original[0].text }
    if (requests === 2) return { status: 200, url, html: JSON.stringify({ data: { numFound: 51, results: rows } }) }
    const row = rows[requests - 3]
    assert.equal(url, 'https://api.smartrecruiters.com/v1/companies/ixigo/postings/' + row.jobVacancyId)
    const publicURL = 'https://jobs.smartrecruiters.com/ixigo/' + (70000000000 + requests) + '-synthetic-role'
    const detail = { ...template, id: row.jobVacancyId, name: row.vacancyName, refNumber: row.refNumber, postingUrl: publicURL, applyUrl: publicURL }
    return { status: 200, url, html: JSON.stringify(detail) }
  } })
  assert.equal(jobs.length, 50)
  assert.equal(requests, 52)
  assert.equal(evidence(jobs).pagesFetched, 52)
  assertPartial(jobs)
})

test('explicit source cleanup prohibition survives configured completion, including an empty batch', async () => {
  const { jobs } = await collect()
  assert.equal(inventory.sourceLifecycleCleanupForbidden?.(jobs), true)
  const { jobs: empty } = await collectListing([])
  assert.equal(inventory.sourceLifecycleCleanupForbidden?.(empty), true)
  const mapped = inventory.mapJobsWithInventoryEvidence(empty, job => ({ ...job }))
  assert.equal(inventory.sourceLifecycleCleanupForbidden?.(mapped), true)
  assert.equal(inventory.sourceLifecycleCleanupForbidden?.([{ title: 'legacy source' }]), false)
})

test('invalid inventory evidence cannot erase an explicit lifecycle cleanup prohibition', () => {
  const jobs = inventory.attachInventoryEvidence([], { status: 'verified-empty', firstParty: false, lifecycleCleanupAllowed: false })
  assert.equal(inventory.readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(inventory.sourceLifecycleCleanupForbidden(jobs), true)
})

for (const [label, id, mutate] of [
  ['a bonus beside valid compensation', customerID, detail => { detail.compensation.bonus = 'Guaranteed joining bonus INR5000' }],
  ['a minimum beside a valid experience label', growthID, detail => { detail.experienceLevel.minimumYearsOfExperience = 10 }],
  ['a condition beside a valid employment label', growthID, detail => { detail.typeOfEmployment.contractDuration = 'Six months only' }],
  ['a requirement inside a known country field', growthID, detail => { detail.customField[0].additionalEligibility = 'Work permit required' }],
  ['a residency condition inside the location', growthID, detail => { detail.location.minimumResidencyYears = 5 }],
  ['a condition beside retained section text', growthID, detail => { detail.jobAd.sections.qualifications.minimumYearsOfExperience = 10 }],
  ['a requirement in an altered section heading', growthID, detail => { detail.jobAd.sections.qualifications.title = 'Qualifications: minimum10 years experience' }],
]) test('nested authored facts cannot disappear behind otherwise valid metadata: ' + label, async () => {
  const { jobs, consumed } = await collect({ mutate(records) { changeJSON(records, detailOrdinal(id), mutate) } })
  assert.equal(jobs.length, 7)
  assert.equal(jobs.find(job => job.jobId === id).sourceDetailComplete, false)
  if (id === customerID) assert.equal(jobs.find(job => job.jobId === id).salary, 'INR 1 - 300000 per month')
  assert.equal(consumed, 9)
  assertPartial(jobs)
})

for (const section of ['qualifications', 'additionalInformation']) {
  test('extensionless required criteria remain unresolved in ' + section, async () => {
    const { jobs, consumed } = await collect({ mutate(records) {
      changeJSON(records, detailOrdinal(customerID), detail => {
        detail.jobAd.sections[section].text += '<p>Additional mandatory eligibility: <a href="https://example.invalid/native-criteria/12112426538">Full required criteria</a></p>'
      })
    } })
    assert.equal(jobs.length, 7)
    assert.equal(jobs.find(job => job.jobId === customerID).sourceDetailComplete, false)
    assert.equal(consumed, 9, 'Required linked content is not silently certified or dereferenced')
    assertPartial(jobs)
  })
}

test('a stable nested listing requirement remains incomplete even when the country label is valid', async () => {
  const { jobs, consumed } = await collect({ mutate(records) {
    for (const ordinal of [openingOrdinal, closingOrdinal]) changeJSON(records, ordinal, data => {
      data.data.results[0].customFieldValues[0].additionalEligibility = 'Work permit required'
    })
  } })
  assert.equal(jobs.length, 7)
  assert.equal(consumed, 9)
  assertPartial(jobs)
})

for (const [label, metadata] of [
  ['a declared next page', { hasMore: true, nextPage: 'https://careers.ixigo.com/api/openings?page=2' }],
  ['a continuation without a flag', { nextPage: 'https://careers.ixigo.com/api/openings?page=2' }],
  ['nested pagination metadata', { pagination: { hasNextPage: true, nextCursor: 'synthetic-next-page' } }],
]) test('zero records do not establish empty inventory with ' + label, async () => {
  const { jobs, requests } = await collectListing([], metadata)
  assert.equal(jobs.length, 0)
  assertPartial(jobs)
  assert.equal(requests, 2, 'An unresolved opening cannot authorize a closing or next-page request')
})

test('a closing continuation keeps all usable jobs without certifying their inventory', async () => {
  const { jobs, consumed } = await collect({ mutate(records) {
    changeJSON(records, closingOrdinal, data => { data.data.hasMore = true })
  } })
  assert.equal(jobs.length, 7)
  assert.equal(consumed, 10)
  assertPartial(jobs)
})

test('explicitly absent pagination and empty unknown properties do not invent missing criteria', async () => {
  const { jobs, requests } = await collectListing([], { hasMore: false, nextPage: null, pagination: { hasNextPage: false, nextCursor: null } })
  assert.equal(requests, 3)
  assert.equal(evidence(jobs).status, 'verified-empty')
  const collected = await collect({ mutate(records) {
    changeJSON(records, detailOrdinal(customerID), detail => { detail.compensation.unpublishedEmpty = null })
  } })
  assert.equal(collected.consumed, 10)
  assert.equal(evidence(collected.jobs).listingComplete, true)
})
