import assert from 'node:assert/strict'
import test from 'node:test'

const loadImpactAnalyticsModule = async () => import('../../scraper/impactanalytics/script.js')

const careerPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>Impact Analytics Careers</h1>
    </main>
  </body>
</html>
`

test('run falls back to the verified Impact Analytics Keka configuration and returns India jobs in the shared contract', async () => {
  const impactanalytics = await loadImpactAnalyticsModule()

  const requestedTexts = []
  const requestedJson = []
  const scraper = impactanalytics.createImpactAnalyticsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === impactanalytics.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://impactanalytics.keka.com/careers/api/embedjobs/default/active/e4db400e-3d3b-41de-9f1e-647fc202838b') {
        return [
          {
            id: 91357,
            title: 'Senior Data Engineer',
            description: '<div>Build analytics pipelines for retail AI products.</div>',
            departmentName: 'Engineering',
            jobLocations: [
              {
                id: 1,
                name: 'Bengaluru, India',
                city: 'Bengaluru',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '4-7 Yrs',
            salaryRangeFormat: '',
            publishedOn: '2026-07-09T10:00:00.000Z',
            skillNames: ['Python', 'Spark', 'AWS'],
          },
          {
            id: 91358,
            title: 'Account Executive',
            description: '<div>Own US enterprise pipeline.</div>',
            departmentName: 'Sales',
            jobLocations: [
              {
                id: 2,
                name: 'New York, United States',
                city: 'New York',
                countryCode: 'US',
                countryName: 'United States',
              },
            ],
            jobType: 2,
            experience: '5-8 Yrs',
            salaryRangeFormat: '',
            publishedOn: '2026-07-09T10:00:00.000Z',
            skillNames: ['Salesforce'],
          },
        ]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [impactanalytics.CAREER_PAGE_URL])
  assert.deepEqual(requestedJson, [
    'https://impactanalytics.keka.com/careers/api/embedjobs/default/active/e4db400e-3d3b-41de-9f1e-647fc202838b',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Senior Data Engineer',
    company: 'Impact Analytics',
    department: 'Engineering',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '91357',
    requisitionId: '91357',
    sourceUrl: 'https://impactanalytics.keka.com/careers/jobdetails/91357',
    applyUrl: 'https://impactanalytics.keka.com/careers/applyjob/91357',
    employmentType: 'Full Time',
    experienceRequired: '4-7 Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Python', 'Spark', 'AWS'],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Build analytics pipelines for retail AI products.',
    remoteStatus: 'On-site',
    compensation: null,
    source: 'impactanalytics',
    link: 'https://impactanalytics.keka.com/careers/applyjob/91357',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
