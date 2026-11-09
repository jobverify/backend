import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <html>
    <head>
      <title>IT consulting and technology services | Custom software development company</title>
      <meta
        name="description"
        content="Enhance business productivity with NashTech's IT services and technology solutions."
      />
    </head>
    <body>
      <p>
        NashTech is a global IT consulting and technology services partner, helping organisations
        solve complex challenges through custom software development, AI and cloud solutions and
        digital transformation services that deliver real, measurable value, fast.
      </p>
      <a href="https://careers.nashtechglobal.com/">Careers</a>
    </body>
  </html>
`

const verifiedCareersHtml = `
  <html>
    <head>
      <title>NashTech Careers: Explore Opportunities in Tech</title>
      <meta name="description" content="Nashtech Careers" />
    </head>
    <body>
      <h2>Where technology meets excellence</h2>
      <h2>Featured jobs</h2>
      <a href="/jobs-finder/">Open positions</a>
      <a href="https://www.nashtechglobal.com/">Official website</a>
      <p>Ready for a new journey with us?</p>
    </body>
  </html>
`

const verifiedJobsFinderHtml = `
  <html>
    <head>
      <title>Job offers - Careers</title>
      <link rel="canonical" href="https://careers.nashtechglobal.com/jobs-finder/" />
    </head>
    <body>
      <noscript>You need to enable JavaScript to run this app.</noscript>
      <div id="root"></div>
      <script>
        var reactPress = {
          "api": {
            "rest_url": "https://careers.nashtechglobal.com/wp-json/",
            "graphql_url": "https://careers.nashtechglobal.com/graphql"
          }
        };
      </script>
      <script
        id="rp-react-app-asset-0-0"
        type="module"
        crossorigin
        src="https://careers.nashtechglobal.com/wp-content/reactpress/apps/job-finder/build/static/js/main.adf907c8.js?ver=1"
      ></script>
    </body>
  </html>
`

const verifiedBundleJs = `
  fetch("/wp-json/ntc/taxonomy/get", {
    method: "POST",
    body: JSON.stringify({ slug: ["department", "location", "job-type", "workplace-type", "experience"] }),
  });
  fetch("/wp-json/ntc/job/get/v2", { method: "POST" });
  window.history.pushState(null, null, window.location.pathname + "?keywords=data");
  const banner = "Find Authentic Jobs in NashTech";
  const title = "Open jobs";
`

const currentBundleJs = verifiedBundleJs.replace(
  'Find Authentic Jobs in NashTech',
  'Find your dream job in NashTech',
)

const sampleJobsApiResponse = [
  {
    post_title: 'Senior Data Engineer',
    post_date: '2026-07-05 08:10:22',
    post_permalink: 'https://careers.nashtechglobal.com/job/senior-data-engineer-noida/',
    meta_data: { hot_job: true, override_url: '' },
    taxonomy: [
      { taxonomy: 'department', name: 'Data' },
      { taxonomy: 'location', name: 'Noida - India' },
      { taxonomy: 'workplace-type', name: 'Hybrid' },
      { taxonomy: 'experience', name: 'Experienced' },
      { taxonomy: 'qualification', name: 'Bachelor Degree' },
      { taxonomy: 'job-type', name: 'Full time' },
      { taxonomy: 'competency', name: 'Data Engineering' },
      { taxonomy: 'tag', name: 'Python' },
    ],
    post_content: '<h2>Job description</h2><p>Build data platforms.</p><p>Mentor engineers.</p>',
  },
  {
    post_title: 'Data Platform Architect',
    post_date: '2026-07-01 10:30:00',
    post_permalink: 'https://careers.nashtechglobal.com/job/data-platform-architect-bengaluru/',
    meta_data: {
      hot_job: false,
      override_url: 'https://careers.nashtechglobal.com/job/data-platform-architect-bengaluru/apply/',
    },
    taxonomy: [
      { taxonomy: 'department', name: 'Data' },
      { taxonomy: 'location', name: 'Bengaluru - India' },
      { taxonomy: 'workplace-type', name: 'Remote' },
      { taxonomy: 'experience', name: 'Experienced' },
      { taxonomy: 'qualification', name: 'Master Degree' },
      { taxonomy: 'job-type', name: 'Full time' },
      { taxonomy: 'tag', name: 'Snowflake' },
    ],
    post_content: '<p>Lead platform architecture.</p>',
  },
  {
    post_title: 'Technical Lead - NodeJS',
    post_date: '2026-05-20 09:15:00',
    post_permalink: 'https://careers.nashtechglobal.com/job/technical-lead-nodejs/',
    meta_data: { hot_job: true, override_url: '' },
    taxonomy: [
      { taxonomy: 'department', name: 'Software Development' },
      { taxonomy: 'location', name: 'Ho Chi Minh - Vietnam' },
      { taxonomy: 'workplace-type', name: 'Onsite' },
      { taxonomy: 'experience', name: 'Experienced' },
      { taxonomy: 'qualification', name: 'Bachelor Degree' },
      { taxonomy: 'job-type', name: 'Full time' },
    ],
    post_content: '<p>Vietnam-only role.</p>',
  },
]

const loadModule = async () => {
  try {
    return await import('../../scraper/knoldus/script.js')
  } catch {
    assert.fail('Expected Knoldus scraper module at ../../scraper/knoldus/script.js')
  }
}

test('Knoldus validates the verified legacy-domain redirect, NashTech careers handoff, ReactPress jobs shell, and bundle contract', async () => {
  const knoldus = await loadModule()

  assert.equal(knoldus.SOURCE, 'knoldus')
  assert.equal(knoldus.COMPANY, 'Knoldus Inc')
  assert.equal(knoldus.LEGACY_HOMEPAGE_URL, 'https://knoldus.com/')
  assert.equal(knoldus.HOMEPAGE_REDIRECT_URL, 'https://www.nashtechglobal.com/')
  assert.equal(knoldus.CAREERS_HANDOFF_URL, 'https://www.nashtechglobal.com/careers/')
  assert.equal(knoldus.CAREERS_URL, 'https://careers.nashtechglobal.com/')
  assert.equal(knoldus.JOBS_FINDER_URL, 'https://careers.nashtechglobal.com/jobs-finder/')
  assert.equal(knoldus.JOBS_API_URL, 'https://careers.nashtechglobal.com/wp-json/ntc/job/get/v2')
  assert.equal(knoldus.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(knoldus.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(knoldus.hasJobsFinderShellSignal(verifiedJobsFinderHtml), true)
  assert.equal(
    knoldus.extractJobsFinderBundleUrl(verifiedJobsFinderHtml),
    'https://careers.nashtechglobal.com/wp-content/reactpress/apps/job-finder/build/static/js/main.adf907c8.js?ver=1',
  )
  assert.equal(knoldus.hasVerifiedJobsBundleSignal(verifiedBundleJs), true)
  assert.equal(knoldus.hasVerifiedJobsBundleSignal(currentBundleJs), true)
})

test('Knoldus extracts only India jobs from NashTech first-party jobs API and preserves apply surfaces', async () => {
  const knoldus = await loadModule()
  const requestedPages = []
  const requestedText = []
  const requestedJson = []

  const jobs = await knoldus.createKnoldusScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === knoldus.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: knoldus.HOMEPAGE_REDIRECT_URL,
          html: verifiedHomepageHtml,
        }
      }

      if (url === knoldus.CAREERS_HANDOFF_URL) {
        return {
          status: 200,
          url: knoldus.CAREERS_URL,
          html: verifiedCareersHtml,
        }
      }

      if (url === knoldus.JOBS_FINDER_URL) {
        return {
          status: 200,
          url,
          html: verifiedJobsFinderHtml,
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedText.push(url)

      if (url === 'https://careers.nashtechglobal.com/wp-content/reactpress/apps/job-finder/build/static/js/main.adf907c8.js?ver=1') {
        return verifiedBundleJs
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === knoldus.JOBS_API_URL) {
        return sampleJobsApiResponse
      }

      throw new Error(`Unexpected json URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    knoldus.LEGACY_HOMEPAGE_URL,
    knoldus.CAREERS_HANDOFF_URL,
    knoldus.JOBS_FINDER_URL,
  ])
  assert.deepEqual(requestedText, [
    'https://careers.nashtechglobal.com/wp-content/reactpress/apps/job-finder/build/static/js/main.adf907c8.js?ver=1',
  ])
  assert.deepEqual(requestedJson, [knoldus.JOBS_API_URL])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl]),
    [
      [
        'Senior Data Engineer',
        'Noida - India / Hybrid',
        'https://careers.nashtechglobal.com/job/senior-data-engineer-noida/',
      ],
      [
        'Data Platform Architect',
        'Bengaluru - India / Remote',
        'https://careers.nashtechglobal.com/job/data-platform-architect-bengaluru/apply/',
      ],
    ],
  )
  assert.equal(jobs[0].source, 'knoldus')
  assert.equal(jobs[0].company, 'Knoldus Inc')
  assert.equal(jobs[0].city, 'Noida')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].department, 'Data')
  assert.equal(jobs[0].employmentType, 'Full time')
  assert.equal(jobs[0].experienceRequired, 'Experienced')
  assert.equal(jobs[0].minimumQualification, 'Bachelor Degree')
  assert.deepEqual(jobs[0].requiredSkills, ['Data Engineering', 'Python'])
  assert.equal(jobs[0].jobId, 'knoldus-senior-data-engineer-noida')
  assert.equal(jobs[0].requisitionId, 'knoldus-senior-data-engineer-noida')
  assert.equal(jobs[0].postingDate, '2026-07-05')
  assert.equal(jobs[0].closingDate, null)
  assert.match(jobs[0].jobDescription, /Build data platforms/i)
  assert.match(jobs[0].jobDescription, /Mentor engineers/i)
  assert.equal(jobs[0].companyCareerPage, 'https://www.nashtechglobal.com/careers/')
  assert.equal(jobs[0].companyDomain, 'nashtechglobal.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('Knoldus returns no jobs when the verified NashTech API has no India roles', async () => {
  const knoldus = await loadModule()

  const jobs = await knoldus.createKnoldusScraper().run({
    fetchPage: async (url) => {
      if (url === knoldus.LEGACY_HOMEPAGE_URL) {
        return { status: 200, url: knoldus.HOMEPAGE_REDIRECT_URL, html: verifiedHomepageHtml }
      }

      if (url === knoldus.CAREERS_HANDOFF_URL) {
        return { status: 200, url: knoldus.CAREERS_URL, html: verifiedCareersHtml }
      }

      if (url === knoldus.JOBS_FINDER_URL) {
        return { status: 200, url, html: verifiedJobsFinderHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async () => verifiedBundleJs,
    fetchJson: async () => [
      {
        post_title: 'Technical Lead - NodeJS',
        post_date: '2026-05-20 09:15:00',
        post_permalink: 'https://careers.nashtechglobal.com/job/technical-lead-nodejs/',
        meta_data: { hot_job: true, override_url: '' },
        taxonomy: [
          { taxonomy: 'location', name: 'Ho Chi Minh - Vietnam' },
          { taxonomy: 'workplace-type', name: 'Onsite' },
        ],
        post_content: '<p>Vietnam-only role.</p>',
      },
    ],
  })

  assert.deepEqual(jobs, [])
})

test('Knoldus fails closed when the redirect target, careers handoff, jobs shell, bundle contract, or jobs API shape changes', async () => {
  const knoldus = await loadModule()

  await assert.rejects(
    knoldus.createKnoldusScraper().run({
      fetchPage: async (url) => {
        if (url === knoldus.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: 'https://knoldus.com/',
            html: verifiedHomepageHtml,
          }
        }

        return { status: 200, url, html: verifiedCareersHtml }
      },
      fetchText: async () => verifiedBundleJs,
      fetchJson: async () => sampleJobsApiResponse,
    }),
    /legacy homepage redirect/i,
  )

  await assert.rejects(
    knoldus.createKnoldusScraper().run({
      fetchPage: async (url) => {
        if (url === knoldus.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: knoldus.HOMEPAGE_REDIRECT_URL,
            html: verifiedHomepageHtml,
          }
        }

        if (url === knoldus.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Other careers page</h1></body></html>',
          }
        }

        return { status: 200, url, html: verifiedJobsFinderHtml }
      },
      fetchText: async () => verifiedBundleJs,
      fetchJson: async () => sampleJobsApiResponse,
    }),
    /careers handoff/i,
  )

  await assert.rejects(
    knoldus.createKnoldusScraper().run({
      fetchPage: async (url) => {
        if (url === knoldus.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: knoldus.HOMEPAGE_REDIRECT_URL,
            html: verifiedHomepageHtml,
          }
        }

        if (url === knoldus.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: knoldus.CAREERS_URL,
            html: verifiedCareersHtml,
          }
        }

        return {
          status: 200,
          url,
          html: '<html><head><title>Job offers - Careers</title></head><body><div id="root"></div></body></html>',
        }
      },
      fetchText: async () => verifiedBundleJs,
      fetchJson: async () => sampleJobsApiResponse,
    }),
    /jobs finder shell/i,
  )

  await assert.rejects(
    knoldus.createKnoldusScraper().run({
      fetchPage: async (url) => {
        if (url === knoldus.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: knoldus.HOMEPAGE_REDIRECT_URL,
            html: verifiedHomepageHtml,
          }
        }

        if (url === knoldus.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: knoldus.CAREERS_URL,
            html: verifiedCareersHtml,
          }
        }

        return {
          status: 200,
          url,
          html: verifiedJobsFinderHtml,
        }
      },
      fetchText: async () => 'fetch("/wp-json/something-else",{method:"POST"})',
      fetchJson: async () => sampleJobsApiResponse,
    }),
    /bundle contract/i,
  )

  await assert.rejects(
    knoldus.createKnoldusScraper().run({
      fetchPage: async (url) => {
        if (url === knoldus.LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: knoldus.HOMEPAGE_REDIRECT_URL,
            html: verifiedHomepageHtml,
          }
        }

        if (url === knoldus.CAREERS_HANDOFF_URL) {
          return {
            status: 200,
            url: knoldus.CAREERS_URL,
            html: verifiedCareersHtml,
          }
        }

        return {
          status: 200,
          url,
          html: verifiedJobsFinderHtml,
        }
      },
      fetchText: async () => verifiedBundleJs,
      fetchJson: async () => ({ jobs: sampleJobsApiResponse }),
    }),
    /jobs api/i,
  )
})
