import assert from 'node:assert/strict'
import test from 'node:test'

const loadKaptureModule = async () => import('../../scraper/kapture/script.js')

test('run pins Keka endpoints, keeps India jobs, and returns runner metadata', async () => {
  const kapture = await loadKaptureModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await kapture.createKaptureScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === kapture.CAREER_PAGE_URL) return '<main>Kapture careers</main>'
      if (url === kapture.EMBED_CONFIG_URL) return 'window.khConfig = { identifier: "30315393-d861-4cad-851c-03e99c4fe979" }'
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === kapture.ACTIVE_JOBS_URL) {
        return [
          {
            id: 12345,
            title: 'Senior Backend Engineer',
            departmentId: 'engineering',
            description: '<p>Build reliable systems.</p>',
            jobLocations: [{ name: 'Bengaluru', city: 'Bengaluru', countryCode: 'IN', countryName: 'India' }],
            jobType: 2,
            publishedOn: '2026-07-09T10:00:00.000Z',
          },
          {
            id: 67890,
            title: 'US Account Executive',
            departmentId: 'sales',
            jobLocations: [{ name: 'New York', city: 'New York', countryCode: 'US', countryName: 'United States' }],
          },
        ]
      }
      if (url === kapture.DEPARTMENTS_URL) {
        return [
          { id: 'engineering', name: 'Engineering' },
          { id: 'sales', name: 'Sales' },
        ]
      }
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [kapture.CAREER_PAGE_URL, kapture.EMBED_CONFIG_URL])
  assert.deepEqual(requestedJson, [kapture.ACTIVE_JOBS_URL, kapture.DEPARTMENTS_URL])
  assert.equal(kapture.PROVIDER_METADATA.source, 'kapture')
  assert.equal(kapture.PROVIDER_METADATA.adapter, 'script')
  assert.equal(kapture.PROVIDER_METADATA.atsPlatform, 'keka-embed-api')
  assert.match(kapture.PROVIDER_METADATA.modulePath, /kapture[\\/]script\.js$/i)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Backend Engineer',
    company: 'Kapture',
    department: 'Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '12345',
    requisitionId: '12345',
    sourceUrl: 'https://kapturecrm.keka.com/careers/jobdetails/12345',
    applyUrl: 'https://kapturecrm.keka.com/careers/applyjob/12345',
    employmentType: 'Full Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Build reliable systems.',
    remoteStatus: 'On-site',
    compensation: null,
    source: 'kapture',
    link: 'https://kapturecrm.keka.com/careers/applyjob/12345',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
