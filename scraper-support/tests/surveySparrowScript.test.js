import assert from 'node:assert/strict'
import test from 'node:test'

const loadSurveySparrowModule = async () => {
  try {
    return await import('../../scraper/surveysparrow/script.js')
  } catch {
    return null
  }
}

const careerPageWithConfigHtml = `
<!DOCTYPE html>
<html>
  <body>
    <script>
      window.khConfig = {
        identifier: 'dynamic-surveysparrow-identifier',
        domain: 'https://surveysparrow.keka.com/careers/'
      };
    </script>
    <div id="kh-jobs-section"></div>
  </body>
</html>
`

const careerPageWithoutConfigHtml = `
<!DOCTYPE html>
<html>
  <body>
    <main>
      <h1>SurveySparrow Careers</h1>
      <div id="kh-jobs-section"></div>
    </main>
  </body>
</html>
`

test('extractCareerConfig prefers the SurveySparrow khConfig identifier and exposes the active jobs URL', async () => {
  const surveysparrow = await loadSurveySparrowModule()
  assert.ok(surveysparrow)

  const config = surveysparrow.extractCareerConfig(careerPageWithConfigHtml)

  assert.deepEqual(config, {
    identifier: 'dynamic-surveysparrow-identifier',
    domain: 'https://surveysparrow.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    surveysparrow.buildActiveJobsUrl(config),
    'https://surveysparrow.keka.com/careers/api/embedjobs/default/active/dynamic-surveysparrow-identifier',
  )
})

test('run falls back to the verified SurveySparrow Keka identifier and returns India jobs in the shared contract', async () => {
  const surveysparrow = await loadSurveySparrowModule()
  assert.ok(surveysparrow)

  const requestedTexts = []
  const requestedJson = []
  const scraper = surveysparrow.createSurveySparrowScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === surveysparrow.CAREER_PAGE_URL) return careerPageWithoutConfigHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)
      if (url === 'https://surveysparrow.keka.com/careers/api/embedjobs/default/active/ffab7c1d-4cc3-4518-b0a7-7e0b9ebb461e') {
        return [
          {
            id: 424242,
            title: 'Customer Success Executive',
            description: '<div>Support customers from the Chennai office.</div>',
            departmentName: 'Customer Success',
            jobLocations: [
              {
                id: 1,
                name: 'Chennai, India',
                city: 'Chennai',
                countryCode: 'IN',
                countryName: 'India',
              },
            ],
            jobType: 2,
            experience: '2-4 Yrs',
            salaryRangeFormat: '',
            publishedOn: '2026-07-09T10:00:00.000Z',
            skillNames: ['Customer Support', 'CRM'],
          },
          {
            id: 555555,
            title: 'US Sales Representative',
            description: '<div>Based in Austin.</div>',
            departmentName: 'Sales',
            jobLocations: [
              {
                id: 2,
                name: 'Austin, United States',
                city: 'Austin',
                countryCode: 'US',
                countryName: 'United States',
              },
            ],
            jobType: 2,
            experience: '3-5 Yrs',
            salaryRangeFormat: '',
            publishedOn: '2026-07-09T10:00:00.000Z',
            skillNames: [],
          },
        ]
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [surveysparrow.CAREER_PAGE_URL])
  assert.deepEqual(requestedJson, [
    'https://surveysparrow.keka.com/careers/api/embedjobs/default/active/ffab7c1d-4cc3-4518-b0a7-7e0b9ebb461e',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Customer Success Executive',
    company: 'SurveySparrow',
    department: 'Customer Success',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: '424242',
    requisitionId: '424242',
    sourceUrl: 'https://surveysparrow.keka.com/careers/jobdetails/424242',
    applyUrl: 'https://surveysparrow.keka.com/careers/applyjob/424242',
    employmentType: 'Full Time',
    experienceRequired: '2-4 Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Customer Support', 'CRM'],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Support customers from the Chennai office.',
    remoteStatus: 'On-site',
    compensation: null,
    source: 'surveysparrow',
    link: 'https://surveysparrow.keka.com/careers/applyjob/424242',
    scrapedAt: jobs[0].scrapedAt,
  })
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
