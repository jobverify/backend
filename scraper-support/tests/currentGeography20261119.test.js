import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as mobicule from '../../scraper/mobiculetechnologies/script.js'
import * as panacea from '../../scraper/panaceamedicaltechnologiespvtltd/script.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../utils/inventoryEvidence.js'

const fixtures = source => JSON.parse(gunzipSync(fs.readFileSync(new URL(`./test-data/current-geography-20261119/${source}.json.gz`, import.meta.url))))
const replay = (source, mutate = row => row.body) => {
  const packets = fixtures(source)
  for (const row of packets) {
    assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
    assert.equal(Buffer.byteLength(row.body), row.bytes)
  }
  const fetchText = async url => {
    const row = packets.find(item => item.requestedUrl === url)
    assert.ok(row, 'Uncaptured native request: ' + url)
    return mutate(row)
  }
  return { fetchText, fetchJson: async url => JSON.parse(await fetchText(url)) }
}

test('Mobicule retains the five current published jobs with fully matched India location labels and details', async () => {
  const jobs = await mobicule.run(replay('mobiculetechnologies'))
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].location, 'Mumbai, Nipani, Chennai, India')
  assert.equal(jobs[4].location, 'Mumbai, Pune, India')
  assert.equal(jobs[0].country, 'India')
  assert.ok(jobs.every(job => job.jobDescription.length >= 500))
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.nativeInventory.data.length, 5)
  assert.equal(jobs.nativeCollectionEvidence.nativeDetails.length, 5)
})

for (const label of ['Nipani, United States', 'Chennai / Singapore', 'NipaniRemote', 'Unknown', '']) {
  test('Mobicule rejects unqualified complete native location label ' + JSON.stringify(label), async () => {
    const reader = replay('mobiculetechnologies', row => {
      if (row.requestedUrl !== mobicule.FILTERS_API_URL) return row.body
      const value = JSON.parse(row.body)
      value.category[0].values.find(item => item.id === '30').name = label
      return JSON.stringify(value)
    })
    await assert.rejects(mobicule.run(reader), /geography is unverified|location filter/)
  })
}

test('Mobicule never hides detail identity or location ID mismatches behind the broader city allowlist', async () => {
  const reader = replay('mobiculetechnologies', row => {
    if (!row.requestedUrl.includes('/get_job/telecaller/')) return row.body
    const value = JSON.parse(row.body)
    value.job.locations = ['1']
    return JSON.stringify(value)
  })
  await assert.rejects(mobicule.run(reader), /detail changed/)
})

test('Panacea retains all twelve current details and the original Malur_Karnataka label with scope held', async () => {
  const jobs = await panacea.run(replay('panaceamedicaltechnologiespvtltd'))
  assert.equal(jobs.length, 12)
  assert.equal(jobs[0].jobId, '7003')
  assert.equal(jobs[0].location, 'Malur_Karnataka')
  assert.equal(jobs[0].city, 'Malur')
  assert.equal(jobs[0].state, 'Karnataka')
  assert.equal(jobs[0].country, 'India')
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(jobs.nativeCollectionEvidence.nativeOpeningSummaries.length, 12)
  assert.equal(jobs.nativeCollectionEvidence.nativeDetails.length, 12)
})

test('Panacea rejects a conflicting listing country even when the detail still has a valid India location', async () => {
  const reader = replay('panaceamedicaltechnologiespvtltd', row => row.requestedUrl === panacea.CAREERS_URL
    ? row.body.replaceAll('Malur_Karnataka', 'Malur_Karnataka, Canada') : row.body)
  await assert.rejects(panacea.run(reader), /unverified India job location scope/)
})

for (const label of ['Malur_Karnataka, Canada', 'Malur_KarnatakaRemote', 'Malur_Karnataka/Unknown', 'Malur_Karnataka, USA']) {
  test('Panacea rejects a foreign or unexplained suffix after ' + label, async () => {
    const reader = replay('panaceamedicaltechnologiespvtltd', row => row.body.replaceAll('Malur_Karnataka', label))
    await assert.rejects(panacea.run(reader), /unverified India job location scope/)
  })
}
