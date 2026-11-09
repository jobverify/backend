import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <title>Careers at Relanto</title>
      <link rel="canonical" href="https://www.relanto.ai/careers" />
      <meta
        name="description"
        content="Learn more about the career opportunities and current job openings at Relanto."
      />
    </head>
    <body>
      <main>
        <h1>Put your expertise and passion into delivering transformational business value.</h1>
        <a href="https://relanto.keka.com/careers/">Current Opportunities</a>
      </main>
    </body>
  </html>
`

const kekaCareersHtml = `
  <!DOCTYPE html>
  <html>
    <head>
      <script>
        window.khConfig = {
          identifier: '02b7fe40-b031-4feb-9965-e44257ddd8e5',
          domain: 'https://relanto.keka.com/careers/',
          targetContainer: '#khembedjobs'
        };
      </script>
    </head>
    <body>
      <a href="https://www.relanto.ai/">Home</a>
      <h2>Open positions</h2>
      <p>Browse all jobs</p>
      <div id="khembedjobs"></div>
    </body>
  </html>
`

const jobsPayload = [
  {
    id: 134235,
    title: 'Subject Matter Expert (SME)',
    departmentName: 'Digital Transformation',
    jobType: 2,
    jobLocations: [{ city: 'Bengaluru', state: 'KA', countryCode: 'IN', countryName: 'India' }],
    experience: '5+ Years',
    publishedOn: '2026-07-08T11:36:24.037Z',
    skillNames: ['Biometric Authentication', 'IAM'],
    description: '<div>Support product testing.</div>',
  },
  {
    id: 70179,
    title: 'Salesforce Architect (RLT1033)',
    departmentName: 'Enterprise Apps',
    jobType: 2,
    jobLocations: [{ city: 'Fremont', state: 'CA', countryCode: 'US', countryName: 'United States' }],
    experience: '10+',
    publishedOn: '2024-10-22T18:54:04.503Z',
    skillNames: [],
    description: '<div>US-only role.</div>',
  },
]

test('Relanto validates the official careers handoff and embedded Keka config', async () => {
  const relanto = await loadModule()
  assert.ok(relanto, 'Relanto scraper module should load')

  const careerConfig = relanto.extractCareerConfig(kekaCareersHtml)

  assert.equal(relanto.SOURCE, 'relanto')
  assert.equal(relanto.COMPANY, 'Relanto')
  assert.equal(relanto.CAREERS_URL, 'https://www.relanto.ai/careers')
  assert.equal(relanto.EXTERNAL_HANDOFF_URL, 'https://relanto.keka.com/careers/')
  assert.equal(relanto.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    relanto.extractExternalHandoffUrl(officialCareersHtml),
    relanto.EXTERNAL_HANDOFF_URL,
  )
  assert.equal(relanto.hasKekaCareersSignal(kekaCareersHtml), true)
  assert.deepEqual(careerConfig, {
    identifier: '02b7fe40-b031-4feb-9965-e44257ddd8e5',
    domain: 'https://relanto.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    relanto.buildActiveJobsUrl(careerConfig),
    'https://relanto.keka.com/careers/api/embedjobs/default/active/02b7fe40-b031-4feb-9965-e44257ddd8e5',
  )
})

test('Relanto run follows the official careers handoff and keeps only India jobs', async () => {
  const relanto = await loadModule()
  assert.ok(relanto, 'Relanto scraper module should load')

  const requestedUrls = []
  const jobs = await relanto.createRelantoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === relanto.CAREERS_URL) return officialCareersHtml
      if (url === relanto.EXTERNAL_HANDOFF_URL) return kekaCareersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(
        url,
        'https://relanto.keka.com/careers/api/embedjobs/default/active/02b7fe40-b031-4feb-9965-e44257ddd8e5',
      )
      return jobsPayload
    },
    now: () => '2026-07-11T05:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    relanto.CAREERS_URL,
    relanto.EXTERNAL_HANDOFF_URL,
    'https://relanto.keka.com/careers/api/embedjobs/default/active/02b7fe40-b031-4feb-9965-e44257ddd8e5',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Subject Matter Expert (SME)',
    company: 'Relanto',
    department: 'Digital Transformation',
    location: 'Bengaluru, KA, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '134235',
    requisitionId: '134235',
    sourceUrl: 'https://relanto.keka.com/careers/jobdetails/134235',
    applyUrl: 'https://relanto.keka.com/careers/applyjob/134235',
    employmentType: 'Full Time',
    experienceRequired: '5+ Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Biometric Authentication', 'IAM'],
    postingDate: '2026-07-08',
    closingDate: null,
    jobDescription: 'Support product testing.',
    source: 'relanto',
    link: 'https://relanto.keka.com/careers/applyjob/134235',
    scrapedAt: '2026-07-11T05:30:00.000Z',
  })
})

test('Relanto fails closed when the official handoff or Keka config changes', async () => {
  const relanto = await loadModule()
  assert.ok(relanto, 'Relanto scraper module should load')

  await assert.rejects(
    relanto.createRelantoScraper().run({
      fetchText: async () => officialCareersHtml.replace(
        'https://relanto.keka.com/careers/',
        'https://example.com/jobs',
      ),
    }),
    /verified first-party careers handoff/i,
  )

  await assert.rejects(
    relanto.createRelantoScraper().run({
      fetchText: async (url) => {
        if (url === relanto.CAREERS_URL) return officialCareersHtml
        if (url === relanto.EXTERNAL_HANDOFF_URL) {
          return kekaCareersHtml.replace(
            '02b7fe40-b031-4feb-9965-e44257ddd8e5',
            'changed-identifier',
          )
        }
        throw new Error(`Unexpected text URL: ${url}`)
      },
    }),
    /verified Keka job surface changed materially/i,
  )
})
