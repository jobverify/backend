import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildJobsRequestBody,
  extractJobsFromPayload,
} from '../../scraper/tripcom/script.js'

const payload = (jobs, total = jobs.length) => ({
  retCode: '201',
  retValue: { total, recruitJobAdList: jobs },
})

const sampleJob = {
  id: '29110001',
  fromId: 'MJ003700',
  jobId: 'job-1',
  jobTitle: 'Software Engineer(MJ003700)',
  publishDate: '2026-07-25',
  cityName: 'Bengaluru',
  requirements: '<p>Build Trip.com travel experiences.</p>',
  jobFamilyGroupName: 'Software development',
  buName: 'Trip.com',
  kind: 'Regular',
  kindName: 'Regular ',
  atsApiType: 'Moka_Overseas',
}

test('Trip.com native discovery preserves first-party identity and unknown country/employer', () => {
  const jobs = extractJobsFromPayload(payload([sampleJob]))

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, null)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].sourceUrl, 'https://careers.trip.com/#/job-detail?fromId=MJ003700&atsApiType=Moka_Overseas')
  assert.equal(jobs[0].jobDescription, 'Build Trip.com travel experiences.')
})

test('Trip.com requests the unfiltered current official native inventory', () => {
  const body=JSON.parse(buildJobsRequestBody(2))
  assert.deepEqual(body.condition.country, [])
  assert.deepEqual(body.pager,{index:'2',size:'20'})
  assert.equal(body.head.language,'en-US')
})

test('Trip.com fails closed when the official API contract drifts', () => {
  assert.throws(() => extractJobsFromPayload({ retCode: '201', retValue: {} }), /response contract changed/i)
  assert.equal(JSON.parse(buildJobsRequestBody(1)).head.language, 'en-US')
})
