import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const officialCareersHtml = `
  <html>
    <head>
      <link rel="canonical" href="https://leena.ai/careers">
      <title>Careers at Leena AI | Join Our Team in Agentic AI Innovation</title>
      <meta
        name="description"
        content="Explore careers at Leena AI, a leader in enterprise Agentic AI. Join our team to innovate in AI automation, work with top talent, and build the future of work. Check current openings and grow your career with us."
      >
    </head>
    <body>
      <h1>Join our team where people power AI</h1>
      <button>See open roles</button>
      <div>Explore jobs</div>
      <div id="open-roles-section">OPEN ROLES</div>
    </body>
  </html>
`

const careersBundleUrl = 'https://leena.ai/_next/static/chunks/pages/careers-dc4b1af244aa93dd.js'

const officialCareersHtmlWithBundle = officialCareersHtml.replace(
  '</body>',
  '  <script defer="" src="/_next/static/chunks/pages/careers-dc4b1af244aa93dd.js"></script>\n    </body>',
)

const careersBundleJs = `
  var nQ=[
    {id:1,title:"Technical Program Manager",location:"Gurgaon, India",locationKey:"Gurgaon India",department:"Engineering",link:"https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680",isHighlighted:!1},
    {id:2,title:"Account Executive",location:"New York, United States",locationKey:"USA",department:"Business Development",link:"https://jobs.pyjamahr.com/leena-ai/account-executive?source=JOB_LINK&shared_at=1780988670186",isHighlighted:!1},
    {id:3,title:"AI Engineer",location:"Gurgaon, India",locationKey:"Gurgaon India",department:"Engineering",link:"https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705",isHighlighted:!1}
  ],n0=e=>null;
`

const technicalProgramManagerDetailHtml = `
  <html>
    <head>
      <title>Technical Program Manager | Apply now</title>
    </head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "jobDetails": {
                "id": 365199,
                "title": "Technical Program Manager",
                "job_type": "FULLTIME",
                "description": "<p>Required Qualifications</p><ul><li>2-4 years of experience in a technical coordination or program support role</li><li>Hands-on experience with JIRA / JIRA Service Management</li></ul>",
                "max_experience": 4,
                "min_experience": 2,
                "skill": ["scrum", "jira"],
                "education": [],
                "country": "India",
                "location": "Gurugram, Haryana, India",
                "department_name": "Engineering",
                "workplace_type": "ON_SITE",
                "created_at": "2026-06-08T11:24:41.060262-05:00",
                "valid_through": "2026-08-07T11:24:41.060262-05:00"
              }
            }
          }
        }
      </script>
    </body>
  </html>
`

const aiEngineerDetailHtml = `
  <html>
    <head>
      <title>AI Engineer | Apply now</title>
    </head>
    <body>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "jobDetails": {
                "id": 365200,
                "title": "AI Engineer",
                "job_type": "FULLTIME",
                "description": "<p>Role overview</p><ul><li>4+ years of experience with applied AI systems</li></ul>",
                "min_experience": 4,
                "max_experience": null,
                "skill": ["python", "llmops"],
                "education": ["B.Tech"],
                "country": "India",
                "location": "Gurugram, Haryana, India",
                "department_name": "Engineering",
                "workplace_type": "ON_SITE",
                "created_at": "2026-06-10T09:00:00.000Z",
                "valid_through": "2026-08-20T09:00:00.000Z"
              }
            }
          }
        }
      </script>
    </body>
  </html>
`

const pyjamaHrDetailHtmlWithoutStructuredJobData = `
  <html>
    <head>
      <title>Leena Ai</title>
    </head>
    <body>
      <div id="__next">
        <section>
          <h4>Careers at Leena Ai</h4>
          <p>Loading jobs...</p>
        </section>
      </div>
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "companyDetails": {
                "name": "Leena Ai",
                "slug": "leena-ai"
              }
            }
          },
          "query": {
            "job_uuid": "senior-sales-development-representative-sdr-europe-1",
            "company": "leena-ai"
          }
        }
      </script>
    </body>
  </html>
`

const openRoleCards = [
  {
    title: 'Technical Program Manager',
    location: 'Gurgaon, India',
  },
  {
    title: 'Sales Development Representative (SDR) - North America',
    location: 'Bangalore, India',
  },
  {
    title: 'Account Executive',
    location: 'New York, United States',
  },
]

const loadLeenaAiModule = async () => {
  try {
    return await import('../../scraper/leenaai/script.js')
  } catch {
    assert.fail('Expected Leena AI scraper module at ../../scraper/leenaai/script.js')
  }
}

test('Leena AI scraper keeps the verified first-party Explore Jobs surface explicit and fails closed on drift', async () => {
  const leenaAi = await loadLeenaAiModule()

  assert.equal(leenaAi.SOURCE, 'leenaai')
  assert.equal(leenaAi.COMPANY_NAME, 'Leena AI')
  assert.equal(leenaAi.HOMEPAGE_URL, 'https://leena.ai/')
  assert.equal(leenaAi.CAREERS_URL, 'https://leena.ai/careers')
  assert.equal(leenaAi.OPEN_ROLES_TAB_URL, 'https://leena.ai/careers?tab=explore-jobs')
  assert.equal(leenaAi.OPEN_ROLES_SECTION_ID, 'open-roles-section')
  assert.equal(leenaAi.VERIFIED_ON, '2026-07-19')
  assert.equal(leenaAi.hasOfficialLeenaAiCareersSignals(officialCareersHtml), true)
  assert.equal(
    leenaAi.hasOfficialLeenaAiCareersSignals(
      officialCareersHtml.replace('See open roles', 'Browse careers'),
    ),
    false,
  )

  const scraper = leenaAi.createLeenaAiScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  await assert.rejects(
    scraper.run({
      fetchText: async () => officialCareersHtml.replace('See open roles', 'Browse careers'),
      loadOpenRoles: async () => openRoleCards,
    }),
    /verified official careers page no longer matches the verified public surface/i,
  )
})

test('run maps verified Leena AI role cards into Jobverify jobs and keeps only India roles', async () => {
  const { createLeenaAiScraper } = await loadLeenaAiModule()
  const scraper = createLeenaAiScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedUrls = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    loadOpenRoles: async () => openRoleCards,
  })

  assert.deepEqual(requestedUrls, ['https://leena.ai/careers'])
  assert.deepEqual(jobs, [
    {
      title: 'Technical Program Manager',
      company: 'Leena AI',
      department: null,
      location: 'Gurgaon, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'technical-program-manager-gurgaon-india',
      requisitionId: 'technical-program-manager-gurgaon-india',
      sourceUrl: 'https://leena.ai/careers?tab=explore-jobs',
      applyUrl: 'https://leena.ai/careers?tab=explore-jobs',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'leenaai',
      link: 'https://leena.ai/careers?tab=explore-jobs',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Sales Development Representative (SDR) - North America',
      company: 'Leena AI',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'sales-development-representative-sdr-north-america-bangalore-india',
      requisitionId: 'sales-development-representative-sdr-north-america-bangalore-india',
      sourceUrl: 'https://leena.ai/careers?tab=explore-jobs',
      applyUrl: 'https://leena.ai/careers?tab=explore-jobs',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
      source: 'leenaai',
      link: 'https://leena.ai/careers?tab=explore-jobs',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run maps Leena AI roles from the first-party careers bundle without browser rendering', async () => {
  const leenaAi = await loadLeenaAiModule()
  const scraper = leenaAi.createLeenaAiScraper({
    now: () => FIXED_SCRAPED_AT,
  })
  const requestedUrls = []

  assert.equal(leenaAi.extractOpenRolesBundleUrl(officialCareersHtmlWithBundle), careersBundleUrl)
  assert.deepEqual(
    leenaAi.extractOpenRolesFromCareersBundle(careersBundleJs),
    [
      {
        title: 'Technical Program Manager',
        location: 'Gurgaon, India',
        department: 'Engineering',
        link: 'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
      },
      {
        title: 'Account Executive',
        location: 'New York, United States',
        department: 'Business Development',
        link: 'https://jobs.pyjamahr.com/leena-ai/account-executive?source=JOB_LINK&shared_at=1780988670186',
      },
      {
        title: 'AI Engineer',
        location: 'Gurgaon, India',
        department: 'Engineering',
        link: 'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
      },
    ],
  )

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === leenaAi.CAREERS_URL) return officialCareersHtmlWithBundle
      if (url === careersBundleUrl) return careersBundleJs
      if (url === 'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680') {
        return technicalProgramManagerDetailHtml
      }
      if (url === 'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705') {
        return aiEngineerDetailHtml
      }
      throw new Error(`Unexpected Leena AI fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    leenaAi.CAREERS_URL,
    careersBundleUrl,
    'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
    'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
  ])
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.department,
      job.experienceRequired,
      job.sourceUrl,
      job.applyUrl,
      job.requiredSkills,
    ]),
    [
      [
        'Technical Program Manager',
        'Engineering',
        '2 - 4 years',
        'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
        'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
        ['scrum', 'jira'],
      ],
      [
        'AI Engineer',
        'Engineering',
        '4+ years',
        'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
        'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
        ['python', 'llmops'],
      ],
    ],
  )
})

test('run reports an API-only migration error when the Leena AI careers request is blocked', async () => {
  const leenaAi = await loadLeenaAiModule()

  await assert.rejects(
    leenaAi.createLeenaAiScraper().run({
      fetchText: async () => { throw new Error('HTTP 403') },
    }),
    /leena ai API-only migration.*HTTP 403/i,
  )
})

test('run keeps Leena AI bundle-discovered jobs when PyjamaHR detail pages stop embedding structured job data', async () => {
  const leenaAi = await loadLeenaAiModule()
  const scraper = leenaAi.createLeenaAiScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === leenaAi.CAREERS_URL) return officialCareersHtmlWithBundle
      if (url === careersBundleUrl) return careersBundleJs
      if (url.includes('jobs.pyjamahr.com/leena-ai/')) {
        return pyjamaHrDetailHtmlWithoutStructuredJobData
      }

      throw new Error(`Unexpected Leena AI fixture URL: ${url}`)
    },
  })

  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.department,
      job.location,
      job.sourceUrl,
      job.applyUrl,
      job.experienceRequired,
      job.publicExperienceChecked,
    ]),
    [
      [
        'Technical Program Manager',
        'Engineering',
        'Gurgaon, India',
        'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
        'https://jobs.pyjamahr.com/leena-ai/technical-program-manager?source=JOB_LINK&shared_at=1780988641680',
        null,
        true,
      ],
      [
        'AI Engineer',
        'Engineering',
        'Gurgaon, India',
        'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
        'https://jobs.pyjamahr.com/leena-ai/ai-engineer?source=JOB_LINK&shared_at=1783485938705',
        null,
        true,
      ],
    ],
  )
})
