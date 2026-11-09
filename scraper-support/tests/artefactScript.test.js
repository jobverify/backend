import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Artefact is a global data and AI consulting company</title>
    <link rel="canonical" href="https://www.artefact.com/" />
  </head>
  <body>
    <a href="https://www.artefact.com/careers/explore-our-jobs/">Careers</a>
    <a href="https://www.artefact.com/careers/explore-our-jobs/">Explore our Jobs</a>
    <a href="https://www.artefact.com/careers/working-at-artefact/">Working at Artefact</a>
    <p>Artefact is a global leader in data and AI consulting services.</p>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers: Explore our job offers - Artefact</title>
    <link rel="canonical" href="https://www.artefact.com/careers/explore-our-jobs/" />
  </head>
  <body>
    <h1>Explore our jobs</h1>
    <h2>Join our teams of game-changers in data and marketing</h2>
    <p>Filter by: All Departments Data Analytics Data Engineering South Asia India</p>
    <div class="ds_flex_item">
      <h3 class="ds_h3">Data Analyst</h3>
      <h4 class="ds_h4">Data Analytics</h4>
      <h4 class="ds_h4">Lebanon</h4>
      <div class="ds_secondary_button"><a href="https://www.artefact.com/job/data-analyst/">View Job</a></div>
      <div class="ds_submit"><a href="https://job-boards.greenhouse.io/artefact/jobs/8042693002">Apply Now</a></div>
    </div>
    <div class="ds_flex_item">
      <h3 class="ds_h3">Data Analyst - India (2026)</h3>
      <h4 class="ds_h4">Data Analytics</h4>
      <h4 class="ds_h4">India</h4>
      <div class="ds_secondary_button"><a href="https://www.artefact.com/job/data-analyst-india-2026/">View Job</a></div>
      <div class="ds_submit"><a href="https://job-boards.greenhouse.io/artefact/jobs/8360407002">Apply Now</a></div>
    </div>
    <nav class="pagination">
      <a href="https://www.artefact.com/careers/explore-our-jobs/page/2/">2</a>
    </nav>
  </body>
</html>
`

const careersPage2Html = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers: Explore our job offers - Artefact</title>
    <link rel="canonical" href="https://www.artefact.com/careers/explore-our-jobs/page/2/" />
  </head>
  <body>
    <h1>Explore our jobs</h1>
    <p>Filter by: All Departments Data Analytics Data Engineering South Asia India</p>
    <div class="ds_flex_item">
      <h3>Data Architect</h3>
      <h4>Data Engineering</h4>
      <h4>India</h4>
      <a href="https://www.artefact.com/job/data-architect/">View Job</a>
      <a href="https://job-boards.greenhouse.io/artefact/jobs/7884340002">Apply Now</a>
    </div>
    <div class="ds_flex_item">
      <h3>Consulting Manager</h3>
      <h4>Consulting</h4>
      <h4>Brussels</h4>
      <a href="https://www.artefact.com/job/consulting-manager-brussels/">View Job</a>
      <a href="https://job-boards.greenhouse.io/artefact/jobs/9999999999">Apply Now</a>
    </div>
  </body>
</html>
`

const careersPage3Html = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers: Explore our job offers - Artefact</title>
    <link rel="canonical" href="https://www.artefact.com/careers/explore-our-jobs/page/3/" />
  </head>
  <body>
    <h1>Explore our jobs</h1>
    <p>Filter by: All Departments Data Analytics Data Engineering South Asia India</p>
    <div class="ds_flex_item">
      <h3>ML Engineer India</h3>
      <h4>Data Science</h4>
      <h4>India</h4>
      <a href="https://www.artefact.com/job/ml-engineer-india/">View Job</a>
      <a href="https://job-boards.greenhouse.io/artefact/jobs/7000000003">Apply Now</a>
    </div>
  </body>
</html>
`

const dataAnalystDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Data Analyst - India (2026) - Artefact</title>
  </head>
  <body>
    <h1>Data Analyst - India (2026)</h1>
    <p>Job Description - Data Analyst</p>
    <p>Artefact is a new generation of data service providers specialising in data consulting and data-driven digital marketing.</p>
    <p>1. What you will be doing?</p>
    <ul>
      <li>Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.</li>
      <li>Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.</li>
    </ul>
    <p>2. What we are looking for?</p>
    <p>Technical Expertise:</p>
    <ul>
      <li>Proficiency in Python, SQL, and data manipulation for analysis purposes.</li>
      <li>Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.</li>
    </ul>
    <p>Attitude & Soft Skills:</p>
    <ul>
      <li>Excellent communication skills to collaborate effectively within teams and with stakeholders.</li>
    </ul>
    <a href="https://job-boards.greenhouse.io/artefact/jobs/8360407002">APPLY NOW</a>
  </body>
</html>
`

const dataArchitectDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Data Architect - Artefact</title>
  </head>
  <body>
    <h1>Data Architect</h1>
    <h3>Key Responsibilities</h3>
    <ul>
      <li>Design and optimize both logical and physical data models to support enterprise-wide systems.</li>
      <li>Architect data warehousing solutions and oversee the integration of data from multiple sources.</li>
    </ul>
    <h3>Required Qualifications</h3>
    <ul>
      <li>Bachelor’s or Master’s degree in Computer Science, Information Systems, Data Science, or a related field.</li>
      <li>10+ years of experience in data architecture, data engineering, or related roles.</li>
      <li>Expertise in data modeling, data warehousing, and database design.</li>
      <li>Hands-on experience with cloud data platforms and modern data processing frameworks.</li>
    </ul>
    <a href="https://job-boards.greenhouse.io/artefact/jobs/7884340002">APPLY NOW</a>
  </body>
</html>
`

const mlEngineerDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>ML Engineer India - Artefact</title>
  </head>
  <body>
    <h1>ML Engineer India</h1>
    <p>Job Description</p>
    <ul>
      <li>Build machine learning services with Python and SQL.</li>
      <li>Partner with analytics teams to productionize models.</li>
    </ul>
    <a href="https://job-boards.greenhouse.io/artefact/jobs/7000000003">APPLY NOW</a>
  </body>
</html>
`

const botDetectionHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Bot Detection</title>
  </head>
  <body>
    <h1>Please wait while we check if you are a Human</h1>
    <p>This website is protected with BunkerWeb.</p>
  </body>
</html>
`

const greenhouseBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Artefact</title>
    <link rel="canonical" href="http://job-boards.greenhouse.io/artefact">
    <meta property="og:title" content="Artefact">
  </head>
  <body>
    <h1>Artefact</h1>
  </body>
</html>
`

const greenhousePayload = {
  jobs: [
    {
      id: 8360407002,
      title: 'Data Analyst - India (2026)',
      company_name: 'Artefact',
      absolute_url: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
      location: { name: 'Pune, Maharashtra, India' },
      departments: [{ name: 'Data Analytics ' }],
      requisition_id: '2313',
      updated_at: '2026-04-21T10:37:14-04:00',
      content:
        '<p>Job Description - Data Analyst</p>'
        + '<p>Artefact is a new generation of data service providers specialising in data consulting and data-driven digital marketing.</p>'
        + '<p>1. What you will be doing?</p>'
        + '<p>Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.</p>'
        + '<p>Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.</p>'
        + '<p>2. What we are looking for?</p>'
        + '<p>Technical Expertise:</p>'
        + '<ul>'
        + '<li>Proficiency in Python, SQL, and data manipulation for analysis purposes.</li>'
        + '<li>Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.</li>'
        + '</ul>'
        + '<p>Attitude &amp; Soft Skills:</p>'
        + '<p>Excellent communication skills to collaborate effectively within teams and with stakeholders.</p>',
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
      ],
    },
    {
      id: 7884340002,
      title: 'Data Architect',
      company_name: 'Artefact',
      absolute_url: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
      location: { name: 'Pune, Maharashtra, India' },
      departments: [{ name: 'Data Engineering' }],
      requisition_id: '1997',
      updated_at: '2026-04-21T10:37:14-04:00',
      content:
        '<h3><strong>Key Responsibilities</strong></h3>'
        + '<ul>'
        + '<li>Design and optimize both logical and physical data models to support enterprise-wide systems.</li>'
        + '<li>Architect data warehousing solutions and oversee the integration of data from multiple sources.</li>'
        + '</ul>'
        + '<h3><strong>Required Qualifications</strong></h3>'
        + '<ul>'
        + '<li>Bachelor’s or Master’s degree in Computer Science, Information Systems, Data Science, or a related field.</li>'
        + '<li>10+ years of experience in data architecture, data engineering, or related roles.</li>'
        + '<li>Expertise in data modeling, data warehousing, and database design.</li>'
        + '<li>Hands-on experience with cloud data platforms and modern data processing frameworks.</li>'
        + '</ul>',
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
      ],
    },
    {
      id: 8634715002,
      title: 'Account Director - Programmatic & Ad Tech',
      company_name: 'Artefact',
      absolute_url: 'https://job-boards.greenhouse.io/artefact/jobs/8634715002',
      location: { name: 'London, United Kingdom' },
      departments: [{ name: 'Consulting' }],
      requisition_id: '2529',
      updated_at: '2026-07-15T12:31:07-04:00',
      content: '<p>Non-India role.</p>',
      metadata: [
        { name: 'Employment Type', value: 'Full-time' },
      ],
    },
  ],
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/artefact/script.js')
  } catch {
    assert.fail('Expected Artefact scraper module at ../../scraper/artefact/script.js')
  }
}

test('Artefact scraper constants stay pinned to the verified first-party careers pages and India job detail URLs', async () => {
  const artefact = await loadScriptModule()

  assert.equal(artefact.SOURCE, 'artefact')
  assert.equal(artefact.COMPANY, 'Artefact')
  assert.equal(artefact.HOMEPAGE_URL, 'https://www.artefact.com/')
  assert.equal(artefact.CAREERS_URL, 'https://www.artefact.com/careers/')
  assert.equal(artefact.GREENHOUSE_BOARD_URL, 'https://job-boards.greenhouse.io/artefact')
  assert.equal(artefact.GREENHOUSE_JOBS_API_URL, 'https://boards-api.greenhouse.io/v1/boards/artefact/jobs?content=true')
  assert.equal(artefact.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(artefact.hasOfficialCareersPageSignal(careersPageHtml), true)
  assert.equal(artefact.hasBunkerWebBotDetectionSignal(botDetectionHtml), true)
  assert.equal(artefact.hasOfficialGreenhouseBoardSignal(greenhouseBoardHtml), true)
  assert.equal(artefact.hasOfficialDetailPageSignal(dataAnalystDetailHtml), true)
  assert.equal(artefact.hasOfficialDetailPageSignal(dataArchitectDetailHtml), true)
  assert.deepEqual(artefact.extractPaginationUrls(careersPageHtml), [
    'https://www.artefact.com/careers/explore-our-jobs/page/2/',
  ])
  assert.deepEqual(artefact.extractListingCards(careersPageHtml), [
    {
      title: 'Data Analyst',
      department: 'Data Analytics',
      location: 'Lebanon',
      sourceUrl: 'https://www.artefact.com/job/data-analyst/',
      applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8042693002',
    },
    {
      title: 'Data Analyst - India (2026)',
      department: 'Data Analytics',
      location: 'India',
      sourceUrl: 'https://www.artefact.com/job/data-analyst-india-2026/',
      applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
    },
  ])
  assert.deepEqual(artefact.filterIndiaListings([
    ...artefact.extractListingCards(careersPageHtml),
    ...artefact.extractListingCards(careersPage2Html),
    {
      title: 'Consulting Manager',
      department: 'Consulting',
      location: 'Brussels',
      sourceUrl: 'https://www.artefact.com/job/consulting-manager-brussels/',
      applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/9999999999',
    },
  ]), [
    {
      title: 'Data Analyst - India (2026)',
      department: 'Data Analytics',
      location: 'India',
      sourceUrl: 'https://www.artefact.com/job/data-analyst-india-2026/',
      applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
    },
    {
      title: 'Data Architect',
      department: 'Data Engineering',
      location: 'India',
      sourceUrl: 'https://www.artefact.com/job/data-architect/',
      applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
    },
  ])
  assert.equal(
    artefact.extractApplyUrlFromDetailPage(dataAnalystDetailHtml),
    'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
  )
  assert.equal(
    artefact.extractApplyUrlFromDetailPage(dataArchitectDetailHtml),
    'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
  )
  assert.deepEqual(
    artefact.extractIndiaJobsFromGreenhousePayload(greenhousePayload, {
      scrapedAt: '2026-08-13T18:00:00.000Z',
    }),
    [
      {
        title: 'Data Analyst - India (2026)',
        company: 'Artefact',
        department: 'Data Analytics',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        jobId: '8360407002',
        requisitionId: '2313',
        sourceUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
        applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [
          'Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.',
          'Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.',
          'Proficiency in Python, SQL, and data manipulation for analysis purposes.',
          'Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.',
          'Excellent communication skills to collaborate effectively within teams and with stakeholders.',
        ],
        postingDate: '2026-04-21T10:37:14-04:00',
        closingDate: null,
        jobDescription: [
          'Job Description - Data Analyst',
          'Artefact is a new generation of data service providers specialising in data consulting and data-driven digital marketing.',
          '1. What you will be doing?',
          'Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.',
          'Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.',
          '2. What we are looking for?',
          'Technical Expertise:',
          'Proficiency in Python, SQL, and data manipulation for analysis purposes.',
          'Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.',
          'Attitude & Soft Skills:',
          'Excellent communication skills to collaborate effectively within teams and with stakeholders.',
        ].join('\n'),
        link: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
        source: 'artefact',
        scrapedAt: '2026-08-13T18:00:00.000Z',
      },
      {
        title: 'Data Architect',
        company: 'Artefact',
        department: 'Data Engineering',
        location: 'Pune, Maharashtra, India',
        city: 'Pune',
        country: 'India',
        jobId: '7884340002',
        requisitionId: '1997',
        sourceUrl: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
        applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
        employmentType: 'Full-time',
        experienceRequired: '10+ years of experience in data architecture, data engineering, or related roles.',
        minimumQualification: 'Bachelor’s or Master’s degree in Computer Science, Information Systems, Data Science, or a related field.',
        preferredQualification: null,
        requiredSkills: [
          'Design and optimize both logical and physical data models to support enterprise-wide systems.',
          'Architect data warehousing solutions and oversee the integration of data from multiple sources.',
          'Expertise in data modeling, data warehousing, and database design.',
          'Hands-on experience with cloud data platforms and modern data processing frameworks.',
        ],
        postingDate: '2026-04-21T10:37:14-04:00',
        closingDate: null,
        jobDescription: [
          'Key Responsibilities',
          'Design and optimize both logical and physical data models to support enterprise-wide systems.',
          'Architect data warehousing solutions and oversee the integration of data from multiple sources.',
          'Required Qualifications',
          'Bachelor’s or Master’s degree in Computer Science, Information Systems, Data Science, or a related field.',
          '10+ years of experience in data architecture, data engineering, or related roles.',
          'Expertise in data modeling, data warehousing, and database design.',
          'Hands-on experience with cloud data platforms and modern data processing frameworks.',
        ].join('\n'),
        link: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
        source: 'artefact',
        scrapedAt: '2026-08-13T18:00:00.000Z',
      },
    ],
  )
})

test('Artefact maps first-party India detail pages into normalized jobs', async () => {
  const artefact = await loadScriptModule()

  const analystJob = artefact.extractJobFromDetailPage(dataAnalystDetailHtml, {
    title: 'Data Analyst - India (2026)',
    department: 'Data Analytics',
    location: 'India',
    sourceUrl: 'https://www.artefact.com/job/data-analyst-india-2026/',
    applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
  })

  assert.deepEqual(analystJob, {
    title: 'Data Analyst - India (2026)',
    company: 'Artefact',
    department: 'Data Analytics',
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'artefact-data-analyst-india-2026',
    requisitionId: 'artefact-data-analyst-india-2026',
    sourceUrl: 'https://www.artefact.com/job/data-analyst-india-2026/',
    applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.',
      'Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.',
      'Proficiency in Python, SQL, and data manipulation for analysis purposes.',
      'Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.',
      'Excellent communication skills to collaborate effectively within teams and with stakeholders.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Job Description - Data Analyst',
      'Artefact is a new generation of data service providers specialising in data consulting and data-driven digital marketing.',
      '1. What you will be doing?',
      'Data Analysis: Employing Python and SQL to extract, clean, and analyze data to derive actionable insights.',
      'Visualization Techniques: Using Tableau, PowerBI, and Web Applications to create intuitive and insightful visual representations of data.',
      '2. What we are looking for?',
      'Technical Expertise:',
      'Proficiency in Python, SQL, and data manipulation for analysis purposes.',
      'Experience in data visualization tools such as Tableau, PowerBI, and Web Applications.',
      'Attitude & Soft Skills:',
      'Excellent communication skills to collaborate effectively within teams and with stakeholders.',
    ].join('\n'),
  })

  const architectJob = artefact.extractJobFromDetailPage(dataArchitectDetailHtml, {
    title: 'Data Architect',
    department: 'Data Engineering',
    location: 'India',
    sourceUrl: 'https://www.artefact.com/job/data-architect/',
    applyUrl: 'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
  })

  assert.equal(architectJob.title, 'Data Architect')
  assert.equal(architectJob.department, 'Data Engineering')
  assert.equal(architectJob.location, 'India')
  assert.equal(architectJob.country, 'India')
  assert.equal(architectJob.jobId, 'artefact-data-architect')
  assert.equal(architectJob.experienceRequired, '10+ years of experience in data architecture, data engineering, or related roles.')
  assert.equal(
    architectJob.minimumQualification,
    'Bachelor’s or Master’s degree in Computer Science, Information Systems, Data Science, or a related field.',
  )
  assert.deepEqual(architectJob.requiredSkills, [
    'Design and optimize both logical and physical data models to support enterprise-wide systems.',
    'Architect data warehousing solutions and oversee the integration of data from multiple sources.',
    'Expertise in data modeling, data warehousing, and database design.',
    'Hands-on experience with cloud data platforms and modern data processing frameworks.',
  ])
  assert.match(architectJob.jobDescription, /Key Responsibilities/)
  assert.match(architectJob.jobDescription, /Required Qualifications/)
})

test('Artefact run validates the verified first-party careers flow, follows pagination, and deduplicates India jobs', async () => {
  const artefact = await loadScriptModule()
  const requestedUrls = []

  const jobs = await artefact.createArtefactScraper({
    now: () => '2026-07-15T09:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === artefact.HOMEPAGE_URL) return homepageHtml
      if (url === artefact.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html
      if (url === 'https://www.artefact.com/job/data-analyst-india-2026/') return dataAnalystDetailHtml
      if (url === 'https://www.artefact.com/job/data-architect/') return dataArchitectDetailHtml

      throw new Error(`Unexpected Artefact URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    artefact.HOMEPAGE_URL,
    artefact.CAREERS_URL,
    'https://www.artefact.com/careers/explore-our-jobs/page/2/',
    'https://www.artefact.com/job/data-analyst-india-2026/',
    'https://www.artefact.com/job/data-architect/',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Data Analyst - India (2026)',
    'Data Architect',
  ])
  assert.deepEqual(jobs.map((job) => job.source), ['artefact', 'artefact'])
  assert.deepEqual(jobs.map((job) => job.link), [
    'https://job-boards.greenhouse.io/artefact/jobs/8360407002',
    'https://job-boards.greenhouse.io/artefact/jobs/7884340002',
  ])
  assert.equal(jobs[0].scrapedAt, '2026-07-15T09:00:00.000Z')
})

test('Artefact run forwards the runner abort signal into every page and detail fetch', async () => {
  const artefact = await loadScriptModule()
  const controller = new AbortController()
  const seenSignals = []

  const jobs = await artefact.createArtefactScraper().run({
    signal: controller.signal,
    fetchText: async (url, options = {}) => {
      seenSignals.push(options.signal)

      if (url === artefact.HOMEPAGE_URL) return homepageHtml
      if (url === artefact.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html
      if (url === 'https://www.artefact.com/job/data-analyst-india-2026/') return dataAnalystDetailHtml
      if (url === 'https://www.artefact.com/job/data-architect/') return dataArchitectDetailHtml

      throw new Error(`Unexpected Artefact URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(seenSignals.length, 5)
  assert.equal(seenSignals.every((signal) => signal === controller.signal), true)
})

test('Artefact fetches pagination and India detail pages concurrently so slow listings do not consume the full scraper timeout budget', async () => {
  const artefact = await loadScriptModule()
  const multiPageCareersHtml = careersPageHtml.replace(
    '</nav>',
    '      <a href="https://www.artefact.com/careers/explore-our-jobs/page/3/">3</a>\n    </nav>',
  )
  let activeRequests = 0
  let maxActiveRequests = 0

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  const jobs = await artefact.createArtefactScraper({
    now: () => '2026-08-12T18:45:00.000Z',
  }).run({
    fetchText: async (url) => {
      activeRequests += 1
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests)

      try {
        await wait(20)

        if (url === artefact.HOMEPAGE_URL) return homepageHtml
        if (url === artefact.CAREERS_URL) return multiPageCareersHtml
        if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html
        if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/3/') return careersPage3Html
        if (url === 'https://www.artefact.com/job/data-analyst-india-2026/') return dataAnalystDetailHtml
        if (url === 'https://www.artefact.com/job/data-architect/') return dataArchitectDetailHtml
        if (url === 'https://www.artefact.com/job/ml-engineer-india/') return mlEngineerDetailHtml

        throw new Error(`Unexpected Artefact URL: ${url}`)
      } finally {
        activeRequests -= 1
      }
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Data Analyst - India (2026)',
    'Data Architect',
    'ML Engineer India',
  ])
  assert.equal(maxActiveRequests >= 2, true)
})

test('Artefact falls back to the verified Greenhouse board and API when the first-party site is currently BunkerWeb-blocked', async () => {
  const artefact = await loadScriptModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await artefact.createArtefactScraper({
    now: () => '2026-08-13T18:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === artefact.HOMEPAGE_URL || url === artefact.CAREERS_URL) {
        return botDetectionHtml
      }

      if (url === artefact.GREENHOUSE_BOARD_URL) {
        return greenhouseBoardHtml
      }

      throw new Error(`Unexpected Artefact text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      assert.equal(url, artefact.GREENHOUSE_JOBS_API_URL)
      return greenhousePayload
    },
  })

  assert.deepEqual(requestedTextUrls, [
    artefact.HOMEPAGE_URL,
    artefact.CAREERS_URL,
    artefact.GREENHOUSE_BOARD_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [artefact.GREENHOUSE_JOBS_API_URL])
  assert.deepEqual(jobs.map((job) => job.title), [
    'Data Analyst - India (2026)',
    'Data Architect',
  ])
  assert.deepEqual(jobs.map((job) => job.location), [
    'Pune, Maharashtra, India',
    'Pune, Maharashtra, India',
  ])
  assert.equal(jobs.every((job) => job.source === 'artefact'), true)
})

test('Artefact recovers India roles from its verified board when public HTML pages omit them', async () => {
  const artefact = await loadScriptModule()
  const jobs = await artefact.run({
    fetchText: async (url) => {
      if (url === artefact.HOMEPAGE_URL) return homepageHtml
      if (url === artefact.CAREERS_URL) return careersPageHtml.replaceAll('India', 'France')
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html.replaceAll('India', 'France')
      if (url === artefact.GREENHOUSE_BOARD_URL) return greenhouseBoardHtml
      throw new Error(`Unexpected Artefact text URL: ${url}`)
    },
    fetchJson: async (url) => {
      assert.equal(url, artefact.GREENHOUSE_JOBS_API_URL)
      return greenhousePayload
    },
  })
  assert.deepEqual(jobs.map((job) => job.title), ['Data Analyst - India (2026)', 'Data Architect'])
  assert.equal(jobs.every((job) => job.location === 'Pune, Maharashtra, India'), true)
})

test('Artefact rejects an unrelated fallback board when public HTML omits India roles', async () => {
  const artefact = await loadScriptModule()
  await assert.rejects(artefact.run({
    fetchText: async (url) => {
      if (url === artefact.HOMEPAGE_URL) return homepageHtml
      if (url === artefact.CAREERS_URL) return careersPageHtml.replaceAll('India', 'France')
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html.replaceAll('India', 'France')
      if (url === artefact.GREENHOUSE_BOARD_URL) return '<title>Unrelated employer</title>'
      throw new Error(`Unexpected Artefact text URL: ${url}`)
    },
    fetchJson: async () => { throw new Error('Untrusted board must not be queried') },
  }), /verified public Greenhouse board/)
})

test('Artefact follows the official careers landing handoff to the verified job list', async () => {
  const artefact = await loadScriptModule()
  const requested = []
  const landing = '<title>Careers - Artefact</title><h1>Careers</h1>'
    + '<a href="https://www.artefact.com/careers/explore-our-jobs/">Explore our Jobs</a>'
    + '<a href="https://www.artefact.com/careers/working-at-artefact/">Working at Artefact</a>'
  const jobs = await artefact.createArtefactScraper().run({
    fetchText: async url => {
      requested.push(url)
      if (url === artefact.HOMEPAGE_URL) return homepageHtml
      if (url === artefact.CAREERS_URL) return landing
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/') return careersPageHtml.replaceAll('India', 'France')
      if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html.replaceAll('India', 'France')
      if (url === artefact.GREENHOUSE_BOARD_URL) return greenhouseBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchJson: async () => greenhousePayload,
  })
  assert.ok(requested.includes('https://www.artefact.com/careers/explore-our-jobs/'))
  assert.ok(jobs.length > 0)
  assert.ok(jobs.every(job => /India/i.test(job.location)))
})

test('Artefact fails closed when the verified homepage, careers page, listing cards, or detail pages drift', async () => {
  const artefact = await loadScriptModule()

  await assert.rejects(
    artefact.createArtefactScraper().run({
      fetchText: async (url) => {
        if (url === artefact.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected Artefact URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    artefact.createArtefactScraper().run({
      fetchText: async (url) => {
        if (url === artefact.HOMEPAGE_URL) return homepageHtml
        if (url === artefact.CAREERS_URL) {
          return careersPageHtml.replace(/https:\/\/job-boards\.greenhouse\.io\/artefact\/jobs\/\d+/g, 'https://example.com/apply')
        }
        throw new Error(`Unexpected Artefact URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    artefact.createArtefactScraper().run({
      fetchText: async (url) => {
        if (url === artefact.HOMEPAGE_URL) return homepageHtml
        if (url === artefact.CAREERS_URL) {
          return careersPageHtml.replace('Filter by:', 'Sort by:')
        }
        throw new Error(`Unexpected Artefact URL: ${url}`)
      },
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    artefact.createArtefactScraper().run({
      fetchText: async (url) => {
        if (url === artefact.HOMEPAGE_URL) return homepageHtml
        if (url === artefact.CAREERS_URL) return careersPageHtml
        if (url === 'https://www.artefact.com/careers/explore-our-jobs/page/2/') return careersPage2Html
        if (url === 'https://www.artefact.com/job/data-analyst-india-2026/') return '<html><title>Broken</title></html>'
        if (url === 'https://www.artefact.com/job/data-architect/') return dataArchitectDetailHtml
        throw new Error(`Unexpected Artefact URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
