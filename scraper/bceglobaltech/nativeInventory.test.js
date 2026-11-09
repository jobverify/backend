import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractActiveDescription } from '../../scraper-support/utils/activeNativeHtml.js'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261026.json.gz', import.meta.url))))
const options = (data, mutate = () => {}) => {
  const calls = [], counts = new Map()
  const load = async (url, init = {}) => {
    init.signal?.throwIfAborted()
    calls.push(String(url))
    const packets = data.packets.filter(p => p.url === String(url)), index = counts.get(String(url)) || 0
    assert.ok(packets[index], `Unexpected native request: ${url}`)
    counts.set(String(url), index + 1)
    const packet = structuredClone(packets[index])
    mutate(packet, index)
    return packet
  }
  return { calls, now: () => data.runAt, detailConcurrency: 2,
    fetchPage: async (url, init) => { const p = await load(url, init); return { status: p.status, url: p.finalUrl, contentType: p.contentType, html: p.body } },
    fetchText: async (url, init) => (await load(url, init)).body,
    fetchJson: async (url, init) => JSON.parse((await load(url, init)).body),
  }
}
const transformJson = (packet, transform) => { const d = JSON.parse(packet.body); transform(d); packet.body = JSON.stringify(d) }

test('registered BCE runtime recovers every active native India role from the real nested corporate contract', async () => {
  const data = fixture(), settings = options(data)
  for (const p of data.packets) assert.equal(createHash('sha256').update(p.body).digest('hex'), p.sha256)
  const scraper = createCatalogScraper(getScraperCatalog().find(p => p.source === 'bceglobaltech'))
  const jobs = await scraper.run(settings)
  assert.equal(jobs.length, 45)
  assert.equal(new Set(jobs.map(j => j.jobId)).size, 45)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 52)
  assert.doesNotMatch(readInventoryEvidence(jobs).reason, /native-board-api-state-not-reconciled/,
    'The embedded ISO dates and public API display dates represent the same native dates')
  for (const job of jobs) {
    const receipt = data.packets.find(p => p.url.includes(`/Job_Openings/${job.jobId}?`))
    const native = JSON.parse(receipt.body).data[0]
    assert.equal(job.company, 'BCE Global Tech')
    assert.equal(job.nativeLegalEmployer, 'BCE GLOBAL TECHNOLOGY CENTRE PRIVATE LIMITED')
    assert.equal(job.country, 'India')
    assert.equal(job.sourceDescription, extractActiveDescription(native.Job_Description))
    assert.equal(job.postingDate, native.Date_Opened)
    assert.equal(job.applyUrl, native.$appy_url)
    assert.equal(job.closingDate, null)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
})

for (const [label, mutate] of [
  ['foreign organization', p => { if (/\/jobs\/Careers$/.test(p.url)) p.body = p.body.replaceAll('147575000000304516', '147575000000304599') }],
  ['foreign board page', p => { if (/\/jobs\/Careers$/.test(p.url)) p.body = p.body.replaceAll('147575000000304666', '147575000000304699') }],
  ['foreign native application', p => { if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].$appy_url = d.data[0].$appy_url.replace('bceglobaltech.zohorecruit.in', 'foreign.zohorecruit.in') }) }],
  ['foreign native role identity', p => { if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].id = '147575000038656799' }) }],
  ['malformed API envelope', p => { if (p.url.includes('amazonaws.com/prod/joblist')) transformJson(p, d => { d.statusCode = 503 }) }],
  ['unbound corporate API', p => { if (p.url.endsWith('.js')) p.body = p.body.replaceAll('/prod/joblist', '/prod/retired-joblist') }],
  ['missing India office country', p => { if (p.url.endsWith('.js')) p.body = p.body.replaceAll('Karnataka, India, 560100', 'Unverified office address') }],
]) test(`BCE rejects ${label}`, async () => { await assert.rejects(run(options(fixture(), mutate))) })

test('BCE never promotes an untyped remote secondary office to India', async () => {
  const jobs = await run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].Location = 'Remote' })
  }))
  assert.equal(jobs.length, 44)
  assert.ok(!jobs.some(j => j.jobId === '147575000038656789'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('BCE does not override an explicit foreign country with its India office', async () => {
  const jobs = await run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].Country = 'Canada' })
  }))
  assert.equal(jobs.length, 44)
  assert.ok(!jobs.some(j => j.jobId === '147575000038656789'))
})

test('BCE excludes unavailable full descriptions while retaining healthy roles', async () => {
  const jobs = await run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].Job_Description = '<div hidden>Draft only</div>' })
  }))
  assert.equal(jobs.length, 44)
  assert.ok(jobs.every(j => j.sourceDescription && j.lifecycleCleanupAllowed === false))
})

test('BCE preserves current detail dates and does not invent expiry from effective-window metadata', async () => {
  const jobs = await run(options(fixture()))
  assert.ok(jobs.some(j => j.nativeEffectiveTo && j.nativeEffectiveTo < '2026-10-26'))
  assert.ok(jobs.every(j => j.closingDate === null))
})

test('BCE honors registered limits and cancellation without authorizing inventory cleanup', async () => {
  const data = fixture(), jobs = await run({ ...options(data), maxJobs: 2 })
  assert.equal(jobs.length, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  await assert.rejects(run({ ...options(fixture()), signal: AbortSignal.abort() }))
})

test('BCE closing inventory drift cannot certify complete coverage', async () => {
  const jobs = await run(options(fixture(), (p, index) => {
    if (p.url.endsWith('Job_Openings?source=CareerSite&pagename=Careers') && index === 1) transformJson(p, d => { d.data.pop() })
  }))
  assert.ok(jobs.length > 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

for (const [label, field, value] of [
  ['non-string country', 'Country', { descriptor: 'Canada' }],
  ['ambiguous remote flag', 'Remote_Job', 'Yes'],
  ['malformed additional locations', 'additionalLocations', { city: 'Toronto' }],
]) test(`BCE rejects ${label} rather than treating it as absent`, async () => {
  await assert.rejects(run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0][field] = value })
  })))
})

test('BCE retains an explicit native India office outside its corporate Bangalore address', async () => {
  const jobs = await run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].Country = 'India'; d.data[0].Location = 'Chennai' })
  }))
  const job = jobs.find(j => j.jobId === '147575000038656789')
  assert.ok(job)
  assert.equal(job.city, 'Chennai')
  assert.equal(job.state, null)
  assert.equal(job.countryEvidence.field, 'Country')
})

test('BCE does not attribute a newly declared foreign legal entity to the board owner', async () => {
  const jobs = await run(options(fixture(), p => {
    if (p.url.includes('/Job_Openings/147575000038656789?')) transformJson(p, d => { d.data[0].Entity = 'Other Employer' })
  }))
  assert.equal(jobs.length, 44)
  assert.ok(!jobs.some(j => j.jobId === '147575000038656789'))
})

test('BCE rejects a native success payload that also declares errors', async () => {
  await assert.rejects(run(options(fixture(), p => {
    if (p.url.endsWith('Job_Openings?source=CareerSite&pagename=Careers')) transformJson(p, d => { d.errors = { message: 'incomplete response' } })
  })))
})

for (const props of ['hidden:true,', 'inert:true,', 'style:{display:"none"},', 'style:{opacity:0},']) {
  test(`BCE cannot prove India scope from hidden client office markup: ${props}`, async () => {
    await assert.rejects(run(options(fixture(), p => {
      if (p.url.endsWith('.js')) p.body = p.body.replace('className:"footer-info-location",', `className:"footer-info-location",${props}`)
    })), /office country\/address/)
  })
}

test('BCE drops a role whose closing native geography changed to Canada', async () => {
  const jobs = await run(options(fixture(), (p, index) => {
    if (p.url.endsWith('Job_Openings?source=CareerSite&pagename=Careers') && index === 1) transformJson(p, d => {
      const role = d.data.find(j => j.id === '147575000038656789')
      role.Location = 'Toronto'; role.Country = 'Canada'
    })
  }))
  assert.equal(jobs.length, 44)
  assert.ok(!jobs.some(j => j.jobId === '147575000038656789'))
  assert.match(readInventoryEvidence(jobs).reason, /closing/)
})
