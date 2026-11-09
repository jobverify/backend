import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/pagination-20261109.json.gz', import.meta.url))))
const fetchPage = async url => {
  const page = fixture.pages.find(page => page.url === url)
  assert.ok(page)
  return { status: page.status, url: page.finalUrl, html: page.body }
}
const records = (start = 100000) => Array.from({ length: 100 }, (_, i) => {
  const row = structuredClone(fixture.records[0]), data = row.data, id = String(start + i)
  data.req_id = data.slug = id
  data.apply_url = data.apply_url.replace(/\/jobs\/\d+\//, '/jobs/' + id + '/')
  data.meta_data.canonical_url = data.meta_data.canonical_url.replace(/\/jobs\/\d+/, '/jobs/' + id)
  return row
})

test('Rivian uses native posting dates rather than unstable relevance ordering', async () => {
  const jobs = await run({ fetchPage, fetchJson: async url => {
    assert.equal(new URL(url).searchParams.get('sortBy'), 'posted_date')
    assert.equal(new URL(url).searchParams.get('descending'), 'true')
    return { jobs: [], count: 0, totalCount: 0 }
  } })
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
})

for (const issue of ['total-change', 'page-overlap']) {
  test(`Rivian retains observed records on ${issue} while withholding inventory completeness`, async () => {
    const first = records()
    const india = first[0].data
    Object.assign(india, { country: 'India', country_code: 'IN', city: 'Bengaluru', state: 'Karnataka',
      full_location: 'Bengaluru, Karnataka, India', short_location: 'Bengaluru, Karnataka, India',
      location_name: 'Bengaluru (Karnataka)', multipleLocations: false })
    india.meta_data.googlejobs.derivedInfo.locations = [{ postalAddress: {
      regionCode: 'IN', locality: 'Bengaluru', administrativeArea: 'Karnataka',
    } }]
    let calls = 0
    const jobs = await run({ fetchPage, fetchJson: async () => ++calls === 1
      ? { jobs: first, count: 101, totalCount: 101 }
      : issue === 'total-change' ? { jobs: [], count: 100, totalCount: 100 }
        : { jobs: [structuredClone(first[0])], count: 101, totalCount: 101 } })
    assert.equal(calls, 2)
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, '100000')
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
    assert.match(readInventoryEvidence(jobs).reason, /changed|overlap/)
    assert.equal(readSourceObservationEvidence(jobs, 'rivian').observedVacancyCount, 100)
    assert.equal(readSourceObservationEvidence(jobs, 'rivian').sourceScopeComplete, false)
  })
}

test('Rivian rejects duplicate identities within one page', async () => {
  const row = structuredClone(fixture.records[0])
  await assert.rejects(run({ fetchPage, fetchJson: async () => ({ jobs: [row, row], count: 2, totalCount: 2 }) }), /duplicate/)
})

for (const issue of ['overlap', 'total-change']) {
  test(`Rivian retains every new identity on a page with ${issue}`, async () => {
    const first = records(), later = records(200000)
    const india = later[0].data
    Object.assign(india, { country: 'India', country_code: 'IN', city: 'Bengaluru', state: 'Karnataka',
      full_location: 'Bengaluru, Karnataka, India', short_location: 'Bengaluru, Karnataka, India',
      location_name: 'Bengaluru (Karnataka)', multipleLocations: false })
    india.meta_data.googlejobs.derivedInfo.locations = [{ postalAddress: {
      regionCode: 'IN', locality: 'Bengaluru', administrativeArea: 'Karnataka',
    } }]
    let calls = 0
    const jobs = await run({ fetchPage, fetchJson: async () => ++calls === 1
      ? { jobs: first, count: 200, totalCount: 200 }
      : issue === 'overlap' ? { jobs: [first[0], ...later.slice(0, 99)], count: 200, totalCount: 200 }
        : { jobs: later, count: 201, totalCount: 201 } })
    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].jobId, '200000')
    assert.equal(jobs[0].lifecycleCleanupAllowed, false)
    assert.equal(readSourceObservationEvidence(jobs, 'rivian').observedVacancyCount, issue === 'overlap' ? 199 : 200)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  })
}
