import assert from 'node:assert/strict'
import test from 'node:test'

const loadLionsbotModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const buildSerializedKulaHtml = (jobs) => {
  const escapedJobs = JSON.stringify(jobs).replace(/"/g, '\\"')
  return `<title>LionsBot International Pte Ltd Careers | Open Jobs</title><link rel="canonical" href="https://careers.kula.ai/lionsbot" />before {\\"jobs\\":${escapedJobs},\\"departments\\":[{\\"id\\":1,\\"name\\":\\"Research & Development (R&D)\\"}]} after`
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Start your career at LionsBot</h1>
      <p>Our Team Is In Search!</p>
      <a href="https://careers.kula.ai/lionsbot">JOIN US TODAY</a>
      <p>Fastest Growing Robotic Startup in Singapore</p>
    </main>
  </body>
</html>
`

test('Lionsbot scraper validates the official careers handoff and keeps only India roles from Kula', async () => {
  const lionsbot = await loadLionsbotModule()
  assert.ok(lionsbot, 'Expected Lionsbot scraper module at ./script.js')

  assert.equal(lionsbot.CAREER_PAGE_URL, 'https://www.lionsbot.com/careers/')
  assert.equal(lionsbot.KULA_COMPANY_URL, 'https://careers.kula.ai/lionsbot')
  assert.equal(lionsbot.KULA_JOBS_URL, 'https://careers.kula.ai/lionsbot?jobs=true')
  assert.equal(lionsbot.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    lionsbot.extractKulaCompanyUrl(officialCareersHtml),
    'https://careers.kula.ai/lionsbot',
  )

  const jobs = lionsbot.extractSearchResults(buildSerializedKulaHtml([
    {
      id: 1001,
      title: 'Robotics Software Engineer',
      ats_job: {
        employment_type: 'full_time',
        ats_department: { name: 'Research & Development (R&D)' },
        offices: [
          {
            location: 'Bengaluru, Karnataka, India',
            city: 'Bengaluru',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
    {
      id: 1002,
      title: 'Senior Embedded Firmware Engineer',
      ats_job: {
        employment_type: 'full_time',
        ats_department: { name: 'Research & Development (R&D)' },
        offices: [
          {
            location: 'Singapore, Singapore',
            city: 'Singapore',
            country: 'Singapore',
            remote: false,
          },
        ],
      },
    },
    {
      id: 1003,
      title: 'Field Applications Engineer',
      ats_job: {
        employment_type: 'contract',
        ats_department: { name: 'Customer Success' },
        offices: [
          {
            location: 'Remote',
            city: null,
            country: 'India',
            remote: true,
          },
          {
            location: 'Pune, Maharashtra, India',
            city: 'Pune',
            country: 'India',
            remote: false,
          },
        ],
      },
    },
  ]))

  assert.deepEqual(jobs, [
    {
      title: 'Field Applications Engineer',
      company: 'Lionsbot',
      department: 'Customer Success',
      location: 'Remote; Pune, Maharashtra, India',
      city: 'Remote',
      country: 'India',
      jobId: '1003',
      requisitionId: '1003',
      sourceUrl: 'https://careers.kula.ai/lionsbot/1003/?jobs=true',
      applyUrl: 'https://careers.kula.ai/lionsbot/1003/?jobs=true',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Robotics Software Engineer',
      company: 'Lionsbot',
      department: 'Research & Development (R&D)',
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '1001',
      requisitionId: '1001',
      sourceUrl: 'https://careers.kula.ai/lionsbot/1001/?jobs=true',
      applyUrl: 'https://careers.kula.ai/lionsbot/1001/?jobs=true',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('run validates the official Lionsbot careers page and returns no jobs when the live Kula board has no India openings', async () => {
  const lionsbot = await loadLionsbotModule()
  assert.ok(lionsbot, 'Expected Lionsbot scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await lionsbot.createLionsbotScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === lionsbot.CAREER_PAGE_URL) return officialCareersHtml
      if (url === lionsbot.KULA_JOBS_URL) {
        return buildSerializedKulaHtml([
          {
            id: 2001,
            title: 'Senior Embedded Firmware Engineer',
            ats_job: {
              employment_type: 'full_time',
              ats_department: { name: 'Research & Development (R&D)' },
              offices: [
                {
                  location: 'Singapore, Singapore',
                  city: 'Singapore',
                  country: 'Singapore',
                  remote: false,
                },
              ],
            },
          },
        ])
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.lionsbot.com/careers/',
    'https://careers.kula.ai/lionsbot?jobs=true',
  ])
  assert.deepEqual(jobs, [])
})

test('Lionsbot scraper fails closed when the official careers page stops linking to the verified Kula board', async () => {
  const lionsbot = await loadLionsbotModule()
  assert.ok(lionsbot, 'Expected Lionsbot scraper module at ./script.js')

  await assert.rejects(
    lionsbot.createLionsbotScraper().run({
      fetchText: async (url) => {
        if (url === lionsbot.CAREER_PAGE_URL) {
          return officialCareersHtml.replace(
            'https://careers.kula.ai/lionsbot',
            'https://boards.greenhouse.io/lionsbot',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official Kula careers surface/i,
  )
})
