import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const officialCareersHtml = `
  <html>
    <head><title>Careers | Teradata</title></head>
    <body>
      <h1>Careers at Teradata</h1>
      <a href="https://careers.teradata.com/jobs">Explore careers</a>
    </body>
  </html>
`

const payload = {
  data: {
    searchJobs: {
      results: {
        nodes: [
          {
            key: '220387',
            number: '220387',
            title: 'Senior Applied Data Scientist',
            descriptionHTML: '<p>Build applied AI systems.</p>',
            workplaceType: 'HYBRID',
            postedOn: '2026-07-17T00:00:00Z',
            positionType: { name: 'Full Time' },
            primaryLocation: 'Bengaluru, India',
            places: [{ name: 'Bengaluru, India' }],
          },
          {
            key: '220500',
            number: '220500',
            title: 'US Role',
            descriptionHTML: '<p>Outside India.</p>',
            workplaceType: 'REMOTE',
            postedOn: '2026-07-17T00:00:00Z',
            positionType: { name: 'Full Time' },
            primaryLocation: 'San Diego, CA',
            places: [{ name: 'San Diego, CA' }],
          },
        ],
      },
    },
  },
}

test('Teradata recognizes the verified careers handoff and maps India jobs from GraphQL results', async () => {
  const teradata = await import('../../scraper/teradata/script.js')

  assert.equal(teradata.hasOfficialTeradataCareersSignals(officialCareersHtml), true)
  assert.equal(teradata.buildSearchJobsRequestBody().operationName, 'searchJobs')
  assert.equal(teradata.buildSearchJobsRequestBody().extensions.trustedDocument.id, 'search-jobs')
  assert.deepEqual(teradata.extractJobs(payload), [
    {
      title: 'Senior Applied Data Scientist',
      company: 'Teradata',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '220387',
      requisitionId: '220387',
      sourceUrl: 'https://careers.teradata.com/jobs/220387/senior-applied-data-scientist',
      applyUrl: 'https://careers.teradata.com/jobs/220387/senior-applied-data-scientist',
      employmentType: 'Full Time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-17',
      closingDate: null,
      jobDescription: 'Build applied AI systems.',
      workplaceType: 'HYBRID',
    },
  ])
})

test('Teradata scraper uses the current native connection and preserves complete India models', async () => {
  const teradata = await import('../../scraper/teradata/script.js')
  const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/teradata-native-quality.json.gz', import.meta.url))))
  const jobs = await teradata.createTeradataScraper({
    now: () => '2026-11-05T08:00:00.000Z',
  }).run({
    minIntervalMs: 0,
    fetchImpl: async (url, init = {}) => {
      const original = capture.packets.find(p => p.requestedURL === url && (!init.body || p.method === 'POST' && JSON.parse(p.body).variables.start === JSON.parse(init.body).variables.start))
      assert.ok(original, 'Uncaptured current native request: ' + url)
      const response = new Response(original.bodyText, {status: original.status, headers: {'content-type': original.contentType}})
      Object.defineProperty(response, 'url', {value: original.finalURL})
      return response
    },
  })

  assert.equal(jobs.length, 86)
  assert.equal(jobs[0].source, 'teradata')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(jobs.every(j => j.nativeRoleClosingReconciled && j.nativeSourceRecord.posting && j.sourceScopeComplete === false && j.lifecycleCleanupAllowed === false))
})
