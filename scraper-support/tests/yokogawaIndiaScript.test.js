import assert from 'node:assert/strict'
import test from 'node:test'

const loadYokogawaIndiaModule = async () => {
  try {
    return await import('../../scraper/yokogawaindia.workday/script.js')
  } catch {
    assert.fail('Expected Yokogawa India scraper module at ../../scraper/yokogawaindia.workday/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities | Yokogawa India</title>
    <link rel="canonical" href="https://www.yokogawa.com/in/about/currentopenings/">
  </head>
  <body>
    <main>
      <h1>Career Opportunities</h1>
      <p>
        At Yokogawa India, we are committed to fostering a culture of excellence, innovation, and integrity.
      </p>
      <p>
        Explore current oppertunities and become part of our journey
        <a href="https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e" target="_blank">
          Click here
        </a>
        to view our vacancies.
      </p>
      <p class="copyright">Copyright © 2012-2026 Yokogawa India Ltd.</p>
    </main>
  </body>
</html>
`

const brandedWafHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title></title>
  </head>
  <body>
    <script type="text/javascript">
      window.awsWafCookieDomainList = [];
      window.gokuProps = { "context": "sample" };
    </script>
  </body>
</html>
`

const workdayBoardHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title></title>
    <meta property="og:url" content="https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site">
  </head>
  <body>
    <script>
      window.boardConfig = {
        tenant: 'wd3.myworkdaysite.com',
        path: '/en-US/recruiting/yokogawa/yokogawa-career-site'
      };
    </script>
  </body>
</html>
`

const sampleJobsPayload = {
  total: 3,
  jobPostings: [
    {
      title: 'Account Manager',
      externalPath: '/job/New-Delhi/Account-Manager_R-11798',
      locationsText: 'New Delhi',
      postedOn: 'Posted 2 Days Ago',
      bulletFields: ['R-11798'],
    },
    {
      title: 'GET/DET',
      externalPath: '/job/Bangalore/GET-DET_R-11721',
      locationsText: '2 Locations',
      postedOn: 'Posted Today',
      bulletFields: ['R-11721'],
    },
    {
      title: 'Regional Sales Director',
      externalPath: '/job/Houston/Regional-Sales-Director_R-11999',
      locationsText: 'Houston',
      postedOn: 'Posted Yesterday',
      bulletFields: ['R-11999'],
    },
  ],
}

const accountManagerDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section data-automation-id="jobPostingDescription">
      <div>Build strong customer relationships for Yokogawa automation solutions.</div>
    </section>
    <dl>
      <dt>Locations</dt>
      <dd>New Delhi</dd>
    </dl>
    <dl>
      <dt>Department</dt>
      <dd>Sales Group</dd>
    </dl>
    <dl>
      <dt>Job Requisition ID</dt>
      <dd>R-11798</dd>
    </dl>
  </body>
</html>
`

const groupedIndiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section data-automation-id="jobPostingDescription">
      <div>Kick-start your engineering career with Yokogawa India.</div>
    </section>
    <dl>
      <dt>Locations</dt>
      <dd>Bangalore</dd>
      <dd>Singapore</dd>
    </dl>
    <dl>
      <dt>Department</dt>
      <dd>Engineering Group</dd>
    </dl>
    <dl>
      <dt>Job Requisition ID</dt>
      <dd>R-11721</dd>
    </dl>
  </body>
</html>
`

const nonIndiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section data-automation-id="jobPostingDescription">
      <div>Lead sales across North America.</div>
    </section>
    <dl>
      <dt>Locations</dt>
      <dd>Houston</dd>
    </dl>
    <dl>
      <dt>Department</dt>
      <dd>Sales Group</dd>
    </dl>
    <dl>
      <dt>Job Requisition ID</dt>
      <dd>R-11999</dd>
    </dl>
  </body>
</html>
`

test('Yokogawa India validates the official careers handoff page and extracts the verified Workday board URL', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()

  assert.equal(
    yokogawaIndia.CAREERS_URL,
    'https://www.yokogawa.com/in/about/currentopenings/',
  )
  assert.equal(
    yokogawaIndia.WORKDAY_BASE_URL,
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site',
  )
  assert.equal(yokogawaIndia.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(
    yokogawaIndia.extractVerifiedWorkdayBoardUrl(officialCareersHtml),
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site?locationCountry=c4f78be1a8f14da0ab49ce1162348a5e',
  )
  assert.equal(yokogawaIndia.hasVerifiedWorkdayBoardSignal(workdayBoardHtml), true)
})

test.skip('rendered official careers fetch is retired for API-only operation', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()
  const events = []
  let contentCanResolve

  const contentReady = new Promise((resolve) => {
    contentCanResolve = resolve
  })

  const browser = {
    close: async () => {
      events.push('browser:close')
    },
  }

  const page = {
    goto: async (url, options) => {
      events.push(['goto', url, options.waitUntil])
    },
    content: async () => {
      events.push('content:start')
      await contentReady
      events.push('content:resolved')
      return officialCareersHtml
    },
  }

  const htmlPromise = yokogawaIndia.fetchRenderedOfficialCareersHtml({
    launchBrowserImpl: async () => browser,
    createOptimizedPageImpl: async () => page,
    settleDelayMs: 0,
  })

  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(events, [
    ['goto', yokogawaIndia.CAREERS_URL, 'networkidle2'],
    'content:start',
  ])

  contentCanResolve()
  assert.equal(await htmlPromise, officialCareersHtml)
  assert.deepEqual(events, [
    ['goto', yokogawaIndia.CAREERS_URL, 'networkidle2'],
    'content:start',
    'content:resolved',
    'browser:close',
  ])
})

test('run uses the official Yokogawa India careers handoff plus the public Workday jobs API', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()
  const requestedJsonBodies = []
  const requestedTextUrls = []

  const jobs = await yokogawaIndia.createYokogawaIndiaScraper({ maxPages: 1 }).run({
    fetchJson: async (url, body) => {
      assert.equal(url, yokogawaIndia.JOBS_API_URL)
      requestedJsonBodies.push(JSON.parse(body))
      return sampleJobsPayload
    },
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === yokogawaIndia.CAREERS_URL) return officialCareersHtml
      if (url === yokogawaIndia.WORKDAY_BOARD_URL) return workdayBoardHtml
      if (url.endsWith('/job/New-Delhi/Account-Manager_R-11798')) return accountManagerDetailHtml
      if (url.endsWith('/job/Bangalore/GET-DET_R-11721')) return groupedIndiaDetailHtml
      if (url.endsWith('/job/Houston/Regional-Sales-Director_R-11999')) return nonIndiaDetailHtml

      throw new Error(`Unexpected Yokogawa India fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedJsonBodies, [
    JSON.parse(yokogawaIndia.buildJobsRequestBody({ offset: 0 })),
  ])
  assert.deepEqual(requestedTextUrls, [
    yokogawaIndia.CAREERS_URL,
    yokogawaIndia.WORKDAY_BOARD_URL,
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/New-Delhi/Account-Manager_R-11798',
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/Bangalore/GET-DET_R-11721',
  ])

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      department: job.department,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      publicExperienceChecked: job.publicExperienceChecked,
      source: job.source,
      link: job.link,
    })),
    [
      {
        title: 'Account Manager',
        location: 'New Delhi',
        city: 'Delhi',
        department: 'Sales Group',
        jobId: 'R-11798',
        requisitionId: 'R-11798',
        publicExperienceChecked: true,
        source: 'yokogawaindia',
        link: 'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/New-Delhi/Account-Manager_R-11798',
      },
      {
        title: 'GET/DET',
        location: 'Bangalore',
        city: 'Bangalore',
        department: 'Engineering Group',
        jobId: 'R-11721',
        requisitionId: 'R-11721',
        publicExperienceChecked: true,
        source: 'yokogawaindia',
        link: 'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/Bangalore/GET-DET_R-11721',
      },
    ],
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.ok(jobs.every((job) => job.jobDescription))
})

test('run returns an honest zero-job result only while the verified official Yokogawa Workday surface returns zero postings', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()

  const jobs = await yokogawaIndia.createYokogawaIndiaScraper({ maxPages: 1 }).run({
    fetchJson: async () => ({ total: 0, jobPostings: [] }),
    fetchText: async (url) => {
      if (url === yokogawaIndia.CAREERS_URL) return officialCareersHtml
      if (url === yokogawaIndia.WORKDAY_BOARD_URL) return workdayBoardHtml
      throw new Error(`Unexpected Yokogawa India zero-jobs fixture URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('run bypasses the branded WAF gate when the verified Workday board and jobs API remain healthy', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()
  const requestedTextUrls = []

  const jobs = await yokogawaIndia.createYokogawaIndiaScraper({ maxPages: 1 }).run({
    fetchJson: async () => sampleJobsPayload,
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === yokogawaIndia.CAREERS_URL) return brandedWafHtml
      if (url === yokogawaIndia.WORKDAY_BOARD_URL) return workdayBoardHtml
      if (url.endsWith('/job/New-Delhi/Account-Manager_R-11798')) return accountManagerDetailHtml
      if (url.endsWith('/job/Bangalore/GET-DET_R-11721')) return groupedIndiaDetailHtml
      if (url.endsWith('/job/Houston/Regional-Sales-Director_R-11999')) return nonIndiaDetailHtml

      throw new Error(`Unexpected Yokogawa India WAF fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTextUrls, [
    yokogawaIndia.CAREERS_URL,
    yokogawaIndia.WORKDAY_BOARD_URL,
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/New-Delhi/Account-Manager_R-11798',
    'https://wd3.myworkdaysite.com/en-US/recruiting/yokogawa/yokogawa-career-site/job/Bangalore/GET-DET_R-11721',
  ])
  assert.equal(jobs.length, 2)
})

test('run fails closed when the verified Yokogawa Workday board no longer matches the known public source', async () => {
  const yokogawaIndia = await loadYokogawaIndiaModule()

  await assert.rejects(
    yokogawaIndia.createYokogawaIndiaScraper().run({
      fetchText: async (url) => {
        if (url === yokogawaIndia.CAREERS_URL) return '<html><body><h1>Join Us</h1></body></html>'
        if (url === yokogawaIndia.WORKDAY_BOARD_URL) return '<html><body>unexpected</body></html>'
        throw new Error(`Unexpected Yokogawa India changed-surface fixture URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified Workday board changed/i,
  )

  await assert.rejects(
    yokogawaIndia.createYokogawaIndiaScraper().run({
      fetchText: async (url) => {
        if (url === yokogawaIndia.CAREERS_URL) {
          return `
            <html>
              <head><title>Career Opportunities | Yokogawa India</title></head>
              <body>
                <h1>Career Opportunities</h1>
                <p>At Yokogawa India, we are committed to fostering a culture of excellence.</p>
                <a href="https://example.com/jobs">Click here</a>
              </body>
            </html>
          `
        }
        if (url === yokogawaIndia.WORKDAY_BOARD_URL) return '<html><body>unexpected</body></html>'
        throw new Error(`Unexpected Yokogawa India bad-handoff fixture URL: ${url}`)
      },
      fetchJson: async () => ({ total: 0, jobPostings: [] }),
    }),
    /verified workday handoff changed|verified Workday board changed/i,
  )
})
