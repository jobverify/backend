import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {buildScrapers} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../scraper-support/utils/extractionDetailHealth.js'
import {analyzePublishableJobs} from '../scraper-support/utils/publishableJobMetrics.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/lever-current-section-lists-20261112.json.gz', import.meta.url))))
const replay = async (t, source, mutate) => {
  const row = fixture.responses.find(row => row.requestedUrl.includes('/postings/' + source + '?'))
  assert.equal(createHash('sha256').update(row.body).digest('hex'), row.hash)
  const records = JSON.parse(row.body)
  mutate?.(records)
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), row.requestedUrl)
    return Response.json(records)
  })
  return buildScrapers().find(scraper => scraper.name === source).run()
}

for (const [source, count, missingIds] of [
  ['cred', 14, ['aa98a938-af3a-45f5-851d-966b2b5bad33', 'b3fdba2a-802c-4e03-b445-5284c5e3c157', '224c14b0-0317-4512-b380-60c8acb2d4c2', '84aa0489-b7e1-4670-bfa9-7a9654197cc3']],
  ['meesho', 48, ['82bbfe26-92b4-4c45-a909-563b5a9db6be', '494d8ba6-22b6-467f-837b-8af9c1aee377']],
]) test('registered ' + source + ' retains all native duties and qualifications, including roles with empty plain bodies', async t => {
  const jobs = await replay(t, source)
  assert.equal(jobs.length, count)
  const records = JSON.parse(fixture.responses.find(row => row.requestedUrl.includes('/postings/' + source + '?')).body)
  for (const record of records) {
    const job = jobs.find(job => job.jobId === record.id)
    assert.ok(job)
    for (const section of record.lists) if (section.content.trim()) assert.ok(job.jobDescription?.includes(section.content.trim()), record.id + ' lost a native criteria section')
  }
  for (const id of missingIds) assert.ok(jobs.find(job => job.jobId === id).jobDescription.length > 200)
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 0)
  if (source === 'cred') assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  else {
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
    assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
  }
})

test('missing every native criteria section still prevents CRED completeness', async t => {
  const jobs = await replay(t, 'cred', records => {
    const record = records.find(record => record.id === 'aa98a938-af3a-45f5-851d-966b2b5bad33')
    for (const key of ['description', 'descriptionPlain', 'descriptionBody', 'descriptionBodyPlain', 'additional', 'additionalPlain']) record[key] = ''
    record.lists = []
  })
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(extractionDetailHealth(jobs).missingDescriptions, 1)
})

test('a native primary country conflicting with India still fails rather than borrowing another role country', async t => {
  await assert.rejects(replay(t, 'cred', records => {records[0].country = 'US'}), /contradictory country/)
})


test('CRED honors an explicit foreign primary country instead of the provider default India', async t => {
  const id = 'aa98a938-af3a-45f5-851d-966b2b5bad33'
  const jobs = await replay(t, 'cred', records => {
    const record = records.find(record => record.id === id)
    record.country = 'US'
    record.categories.location = 'San Mateo'
    record.categories.allLocations = ['San Mateo']
  })
  assert.ok(analyzePublishableJobs(jobs).indiaJobs.every(job => job.jobId !== id))
  assert.equal(jobs.find(job => job.jobId === id).country, 'US')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('CRED retains an explicit India secondary worksite without borrowing its foreign primary country', async t => {
  const id = 'aa98a938-af3a-45f5-851d-966b2b5bad33'
  const jobs = await replay(t, 'cred', records => {
    const record = records.find(record => record.id === id)
    record.country = 'US'
    record.categories.location = 'San Mateo, United States'
    record.categories.allLocations = ['San Mateo, United States', 'Bengaluru, India']
  })
  const job = analyzePublishableJobs(jobs).indiaJobs.find(job => job.jobId === id)
  assert.ok(job)
  assert.equal(job.location, 'Bengaluru, India')
  assert.equal(job.country, 'India')
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})
