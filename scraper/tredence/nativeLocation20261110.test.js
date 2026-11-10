import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractionDetailHealth } from '../../scraper-support/utils/extractionDetailHealth.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261110.json.gz', import.meta.url))))
const positiveIds = ['902890', '881695']
const replay = (mutate = value => value) => {
  const responses = new Map()
  for (const row of fixture.requests) {
    const key = JSON.stringify([row.method, row.url, row.requestBody])
    let value = JSON.parse(row.body)
    value = mutate(value, new URL(row.url)) || value
    const bodies = responses.get(key) || []
    bodies.push(JSON.stringify(value))
    responses.set(key, bodies)
  }
  return { fetchText: async (url, options = {}) => {
    const key = JSON.stringify([options.method || 'GET', String(url), options.body == null ? null : String(options.body)])
    const body = responses.get(key)?.shift()
    assert.ok(body, 'Request must match an actually captured native public request')
    return body
  } }
}
const noOtherIndia = (value, url) => {
  if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '881695') value.jobVO.jobDesc = value.jobVO.jobDesc.replace('Bangalore, India (Hybrid)', 'Bangalore (Hybrid)')
  return value
}

test('registered Tredence recovers both current full India roles from their own explicit Location headers', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'tredence')
  const jobs = await createCatalogScraper(provider).run(replay())
  assert.deepEqual(jobs.map(job => job.jobId).sort(), [...positiveIds].sort())
  for (const job of jobs) {
    const original = JSON.parse(fixture.requests.find(row => new URL(row.url).searchParams.get('jobSeq') === job.jobId).body)
    assert.equal(job.sourceDescriptionHtml, original.jobVO.jobDesc)
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.country, 'India')
    assert.match(job.nativeCountryRelation, /^native-own-role-location-(?:table|header):/)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
  // The catalog decorator retains row collection evidence; the native adapter
  // also exposes the full preprojection inventory on its source-local array.
  const native = (await run(replay())).nativeInventory
  assert.equal(native.queryReportedTotal, 57)
  assert.equal(native.queryDetailedCount, 57)
  assert.equal(native.queryDetailFailureCount, 13)
  assert.equal(native.queryClosedCount, 3)
  assert.equal(native.queryUnknownCountryCount, 54)
  assert.equal(native.companyIndiaTotal, null)
  assert.equal(native.closingStable, true)
  assert.equal(native.nativeRoles.find(job => job.jobId === '918464').country, null)
  assert.equal(native.nativeRoles.find(job => job.jobId === '908037').sourceDetailComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  const health = extractionDetailHealth(jobs)
  assert.equal(health.complete, false)
  assert.equal(health.nativeCollections[0].unextractedDetailFailures, 13)
  assert.equal(health.nativeCollections[0].countsReconciled, true)
})

for (const [label, change] of [
  ['city and numeric country ID alone', html => html.replace('Bengaluru, India', 'Bengaluru')],
  ['requirements prose mentioning India', html => html.replace('Bengaluru, India', 'Bengaluru') + '<p>Requirements: support customers in India.</p>'],
  ['hidden Location field', html => html.replace('<tr style="mso-yfti-irow: 1;">', '<tr hidden style="mso-yfti-irow: 1;">')],
  ['commented Location field', html => html.replace('<tr style="mso-yfti-irow: 1;">', '<!-- <tr style="mso-yfti-irow: 1;">').replace('Bengaluru, India</span></p>\r\n</td>\r\n</tr>', 'Bengaluru, India</span></p>\r\n</td>\r\n</tr> -->')],
  ['template Location field', html => html.replace('<tr style="mso-yfti-irow: 1;">', '<template><tr style="mso-yfti-irow: 1;">').replace('Bengaluru, India</span></p>\r\n</td>\r\n</tr>', 'Bengaluru, India</span></p>\r\n</td>\r\n</tr></template>')],
  ['unbound title before Location table', html => html.replace('Assistant Manager – Commercial Finance, Deal Governance & Pricing', 'Another employer role')],
]) test(`Tredence does not derive India from ${label}`, async () => {
  await assert.rejects(run(replay((value, url) => {
    noOtherIndia(value, url)
    if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '902890') value.jobVO.jobDesc = change(value.jobVO.jobDesc)
    return value
  })), error => {
    assert.equal(error.failureKind, 'coverage_gap')
    assert.equal(error.nativeInventory.nativeRoles.find(job => job.jobId === '902890').country, null)
    return true
  })
})

for (const [label, change] of [
  ['duplicate Location headers', value => { value.jobVO.jobDesc += '<table><tr><td>Location</td><td>Bengaluru, India</td></tr></table>' }],
  ['malformed duplicate Location row', value => { value.jobVO.jobDesc += '<table><tr><td>Location</td><td>London</td><td>United Kingdom</td></tr></table>' }],
  ['contradictory Location headers', value => { value.jobVO.jobDesc += '<table><tr><td>Location</td><td>London, United Kingdom</td></tr></table>' }],
  ['listing foreign country', (value, url) => { if (url.pathname.endsWith('candidatejobsearch')) value.jobVoList.find(row => row.jobSeq === '902890')?.jobSeq && (value.jobVoList.find(row => row.jobSeq === '902890').jobLocation = 'United States') }],
  ['native detail country contradiction', value => { value.jobVO.jobLocation = 'United States' }],
  ['native detail workplace contradiction', value => { value.jobVO.locations = 'Toronto, Canada' }],
  ['native workplace schema uncertainty', value => { value.jobVO.locations = { country: 'Canada' } }],
  ['foreign native employer', value => { value.companyVO.parentCompanyMstrSeq = '999' }],
]) test(`Tredence rejects ${label} without accepting other partial roles`, async () => {
  await assert.rejects(run(replay((value, url) => {
    if (label === 'listing foreign country') change(value, url)
    else if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '902890') change(value, url)
    return value
  })), error => error.failureKind === 'coverage_gap' && /contradict|ambig|employer/i.test(error.message))
})

test('Tredence cannot replace a contradictory listing workplace with its own India header', async () => {
  await assert.rejects(run(replay((value, url) => {
    if (url.pathname.endsWith('candidatejobsearch')) {
      const row = value.jobVoList.find(row => row.jobSeq === '902890')
      if (row) row.locations = 'London, United Kingdom'
    }
    return value
  })), error => error.failureKind === 'coverage_gap' && /contradict|ambig/i.test(error.message))
})

test('Tredence own plaintext Location proof cannot come from a second role or duplicated field', async () => {
  for (const transform of [
    html => html.replace('Job Title: Architect - Full Stack', 'Job Title: Another role'),
    html => html.replace('Location: Bangalore, India (Hybrid)', 'Requirements: experience serving India'),
  ]) await assert.rejects(run(replay((value, url) => {
    if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '902890') value.jobVO.jobDesc = value.jobVO.jobDesc.replace('Bengaluru, India', 'Bengaluru')
    if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '881695') value.jobVO.jobDesc = transform(value.jobVO.jobDesc)
    return value
  })), error => error.failureKind === 'coverage_gap')
  await assert.rejects(run(replay((value, url) => {
    if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '881695') value.jobVO.jobDesc += '\nLocation: London, United Kingdom'
    return value
  })), error => error.failureKind === 'coverage_gap' && /contradict|ambig/i.test(error.message))
  await assert.rejects(run(replay((value, url) => {
    if (url.pathname === '/candidate/candidatejobdetail' && value.jobSeq === '881695') value.jobVO.jobDesc += '\nLocation:'
    return value
  })), error => error.failureKind === 'coverage_gap' && /contradict|ambig/i.test(error.message))
})
