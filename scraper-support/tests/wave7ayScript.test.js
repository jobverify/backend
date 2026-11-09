import assert from 'node:assert/strict'
import test from 'node:test'

const ZEBRA_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Zebra</title>
    <meta
      name="description"
      content="Explore careers at Zebra and help shape a smarter, more connected world. Join a global team driving innovation in AI, technology, and intelligent solutions."
    />
  </head>
  <body>
    <h1>Welcome to Zebra, where we make the world Better Every Day</h1>
    <h2>Join the Herd and increase our impact</h2>
    <a href="https://zebra.wd501.myworkdayjobs.com/Zebra_careers">View Openings</a>
    <a href="https://zebra.wd501.myworkdayjobs.com/en-US/Zebra_careers/jobs?jobFamilyGroup=281a47809d0e100122c06ac3b01a0000">
      Search AI, Engineering &amp; Technology Solutions Jobs
    </a>
    <a href="https://zebra.wd501.myworkdayjobs.com/en-US/Zebra_careers?workerSubType=2e88c140a2411000e8503b59f9a80000">
      Search Corporate Jobs
    </a>
  </body>
</html>
`

const AVANTHA_HOMEPAGE_HTML = `
<!doctype html>
<html>
  <head>
    <script>window.onload=function(){window.location.href="/lander"}</script>
  </head>
</html>
`

const AVANTHA_LANDER_HTML = `
<!doctype html>
<html>
  <head>
    <script>window.LANDER_SYSTEM="PW"</script>
    <script async src="https://img1.wsimg.com/signals/js/clients/scc-c2/scc-c2.min.js"></script>
    <script defer src="https://img1.wsimg.com/parking-lander/static/js/main.3ff36aae.js"></script>
    <link href="https://img1.wsimg.com/parking-lander/static/css/main.edaa2d7d.css" rel="stylesheet" />
  </head>
  <body><div id="root"></div></body>
</html>
`

const SYSTECH_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Systech – Data, AI &amp; Analytics Roles – Systech Solutions</title>
  </head>
  <body>
    <div class="qfx-psub">Open positions &amp; life at Systech</div>
    <p>Own the work. Shape what's next.</p>
    <p>Chennai, India</p>
    <a href="#open-positions" class="sticky-cta">See open roles</a>
    <a class="jb-btn" href="https://systechusa.com/careers-us/">US Job Openings</a>
    <script>
      fetch("https://prod-171.westus.logic.azure.com:443/workflows/67e48103c49d4bb78d575f18cebb36c1/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=0AvRedg1d2FnScRDeHgN_FJM9mUgKuZaInXLg5Fy_Lc", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
      fetch("https://prod-125.westus.logic.azure.com:443/workflows/9c049c250c2b4aed831092094d3c61f0/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=O_necFuH-pBhqeGk6KKpYwNEP1f0ax4lxGEPWbZ1kBA", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      })
    </script>
  </body>
</html>
`

const NEWAGE_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Careers | Newage</title></head>
  <body>
    <h1>Learn and Grow With Us</h1>
    <h2>Join Newage and be part of a global team driving innovation in cloud technology, where your ideas are valued and your growth is supported.</h2>

    <div role="listitem" class="w-dyn-item">
      <a href="/careers/product-manager---finance-with-ff-domain" class="card group v2 w-inline-block">
        <div class="card--body v2">
          <h3 class="text-23">Product Manager ? Finance with FF Domain </h3>
          <div class="font-bold text--graphite">Mumbai (Preferred) or Chennai </div>
        </div>
      </a>
      <div class="source-modal-content">
        <h4>Product Manager ? Finance with FF Domain </h4>
        <div class="font-bold text--graphite">Mumbai (Preferred) or Chennai </div>
        <div class="rt--careers-page w-richtext">
          <p><strong>About Newage</strong></p>
          <p>Newage Software is a leading provider of freight forwarding software and digitized back-office services.</p>
          <p><strong>Required Qualifications</strong></p>
          <ul role="list">
            <li>12+ years of overall experience with at least 5+ years in Product Management.</li>
          </ul>
        </div>
        <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now"><div>APPLY NOW</div></a></div>
      </div>
    </div>

    <div role="listitem" class="w-dyn-item">
      <a href="/careers/enterprise-account-management---freight-forwarding-saas" class="card group v2 w-inline-block">
        <div class="card--body v2">
          <h3 class="text-23">Enterprise Account Management ? Freight Forwarding SaaS</h3>
          <div class="font-bold text--graphite">UAE, Dubai</div>
        </div>
      </a>
      <div class="source-modal-content">
        <h4>Enterprise Account Management ? Freight Forwarding SaaS</h4>
        <div class="font-bold text--graphite">UAE, Dubai</div>
        <div class="rt--careers-page w-richtext">
          <p><strong>About Newage</strong></p>
          <p>Drive strategic customer acquisition and long-term customer success.</p>
        </div>
        <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now"><div>APPLY NOW</div></a></div>
      </div>
    </div>

    <div role="listitem" class="w-dyn-item">
      <a href="/careers/senior-associate" class="card group v2 w-inline-block">
        <div class="card--body v2">
          <h3 class="text-23">Senior Associate </h3>
          <div class="font-bold text--graphite">Chennai, India</div>
        </div>
      </a>
      <div class="source-modal-content">
        <h4>Senior Associate </h4>
        <div class="font-bold text--graphite">Chennai, India</div>
        <div class="rt--careers-page w-richtext">
          <p><strong>Job Title: </strong>Senior Associate <br/><strong>Experience: </strong>2 to 4 years <br/><strong>Location: </strong>Chennai</p>
          <p><strong>Key Accountabilities: </strong></p>
          <p>Shipping Documentation: Handle end-to-end shipping import/export documentation back-office process.</p>
          <p>Client Coordination: Maintain current knowledge of client scope requirements and processes.</p>
        </div>
        <div class="flex"><a href="/apply-now" class="btn secondary w-inline-block apply-now"><div>APPLY NOW</div></a></div>
      </div>
    </div>
  </body>
</html>
`

const MAINTEC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Job Openings - Maintec</title></head>
  <body>
    <h1>Job Openings</h1>
    <article class="awsm-job-item">
      <h2>CICS System programmer</h2>
      <a href="https://maintec.com/jobs/cics-system-programmer/">More Details</a>
    </article>
    <article class="awsm-job-item">
      <h2>Associate Engineers (Mechanical or Electrical)</h2>
      <a href="https://maintec.com/jobs/associate-engineers-mechanical-or-electrical/">More Details</a>
    </article>
    <article class="awsm-job-item">
      <h2>DB2 System programmer</h2>
    </article>
    <article class="awsm-job-item">
      <h2>Mainframe DB2 DBA</h2>
    </article>
    <div>India Office</div>
    <div>Bengaluru, Karnataka - 560043</div>
  </body>
</html>
`

const MAINTEC_CICS_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head><title>CICS System programmer - Maintec</title></head>
  <body>
    <h1>CICS System programmer</h1>
    <p>Work mode- #WFH<br>Work Hours- US Eastern hours<br>Experience- 7+ years</p>
    <h5>Job Summary:</h5>
    <p>We are seeking an experienced CICS System Programmer.</p>
    <h5>Work Environment:</h5>
    <ul><li>Must be available during US Eastern Time Zone business hours.</li></ul>
    <h2>Apply for this position</h2>
  </body>
</html>
`

const MAINTEC_EXPIRED_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Associate Engineers (Mechanical or Electrical) - Maintec</title></head>
  <body>
    <h1>Associate Engineers (Mechanical or Electrical)</h1>
    <p><strong>This role is no longer available.</strong></p>
    <div>Sorry! This job has expired.</div>
  </body>
</html>
`

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

test('Zebra Technologies verifies the first-party careers handoff and delegates to the shared Workday runner', async () => {
  const zebra = await loadModule('../../scraper/zebratechnologies.workday/script.js')
  const requestedUrls = []

  assert.equal(zebra.SOURCE, 'zebratechnologies')
  assert.equal(zebra.COMPANY_NAME, 'Zebra Technologies')
  assert.equal(zebra.OFFICIAL_BRAND_NAME, 'Zebra')
  assert.equal(zebra.VERIFIED_ON, '2026-08-01')
  assert.equal(zebra.CAREERS_URL, 'https://www.zebra.com/us/en/about-zebra/careers.html')
  assert.equal(zebra.WORKDAY_BASE_URL, 'https://zebra.wd501.myworkdayjobs.com/Zebra_careers')
  assert.equal(zebra.INDIA_LOCATION_COUNTRY, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(zebra.hasOfficialCareersSignal(ZEBRA_CAREERS_HTML), true)
  assert.equal(zebra.extractVerifiedWorkdayHandoffUrl(ZEBRA_CAREERS_HTML), zebra.WORKDAY_BASE_URL)

  const jobs = await zebra.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === zebra.CAREERS_URL) return ZEBRA_CAREERS_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
    workdayRunner: async (options) => [
      {
        title: 'Application Engineer',
        location: 'Bengaluru, India',
        company: zebra.COMPANY_NAME,
        source: zebra.SOURCE,
        runnerOptions: options,
      },
      {
        title: 'L2 UX Researcher',
        location: 'Bengaluru, India',
        company: zebra.COMPANY_NAME,
        source: zebra.SOURCE,
        runnerOptions: options,
      },
    ],
  })

  assert.deepEqual(requestedUrls, [zebra.CAREERS_URL])
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Application Engineer', 'L2 UX Researcher'],
  )
  assert.deepEqual(jobs[0].runnerOptions, zebra.buildScraperOptions())
})

test('Avantha Technologies stays fail-closed while the exact-name domain only redirects to a parked lander', async () => {
  const avantha = await loadModule('../../scraper/avanthatechnologies/script.js')
  const requestedUrls = []

  assert.equal(avantha.hasHomepageRedirectSignal(AVANTHA_HOMEPAGE_HTML), true)
  assert.equal(avantha.hasParkedLanderSignal(AVANTHA_LANDER_HTML), true)

  const jobs = await avantha.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === avantha.HOMEPAGE_URL) return AVANTHA_HOMEPAGE_HTML
      if (url === avantha.PARKED_LANDER_URL) return AVANTHA_LANDER_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [avantha.HOMEPAGE_URL, avantha.PARKED_LANDER_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    avantha.run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /root javascript redirect/i,
  )
})

test('Systech Solutions stays fail-closed while the verified embedded jobs API remains empty', async () => {
  const systech = await loadModule('../../scraper/systechsolutions/script.js')
  const requestedUrls = []
  const requestedApis = []

  assert.equal(systech.hasOfficialCareersSignal(SYSTECH_CAREERS_HTML), true)
  assert.equal(
    systech.extractEmbeddedJobsListApiUrl(SYSTECH_CAREERS_HTML),
    systech.JOBS_LIST_API_URL,
  )
  assert.equal(
    systech.extractEmbeddedJobsDetailApiUrl(SYSTECH_CAREERS_HTML),
    systech.JOBS_DETAIL_API_URL,
  )

  const jobs = await systech.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, systech.CAREERS_URL)
      return SYSTECH_CAREERS_HTML
    },
    fetchJson: async (url) => {
      requestedApis.push(url)
      assert.equal(url, systech.JOBS_LIST_API_URL)
      return []
    },
  })

  assert.deepEqual(requestedUrls, [systech.CAREERS_URL])
  assert.deepEqual(requestedApis, [systech.JOBS_LIST_API_URL])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    systech.run({
      fetchText: async () => SYSTECH_CAREERS_HTML,
      fetchJson: async () => [{ cr21b_id: '25995', cr21b_jobname: 'Data Engineer' }],
    }),
    /incomplete structured jobs payload/i,
  )
})

test('NewAge Software & Solutions extracts India role cards and filters out non-India listings from the verified first-party careers page', async () => {
  const newage = await loadModule('../../scraper/newagesoftwareandsolutions/script.js')

  assert.equal(newage.hasOfficialCareersSignal(NEWAGE_CAREERS_HTML), true)
  assert.equal(newage.extractRoleCards(NEWAGE_CAREERS_HTML).length, 3)

  const jobs = await newage.run({
    fetchText: async (url) => {
      assert.equal(url, newage.CAREERS_URL)
      return NEWAGE_CAREERS_HTML
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Product Manager - Finance with FF Domain',
        location: 'Mumbai (Preferred) or Chennai',
        jobId: 'product-manager-finance-with-ff-domain',
        applyUrl: 'https://www.newage-global.com/apply-now',
      },
      {
        title: 'Senior Associate',
        location: 'Chennai, India',
        jobId: 'senior-associate',
        applyUrl: 'https://www.newage-global.com/apply-now',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Product Management/i)
  assert.match(jobs[1].jobDescription, /Shipping Documentation/i)
})

test('Maintec Technologies stays fail-closed while the verified jobs archive only exposes non-India or expired representative detail pages', async () => {
  const maintec = await loadModule('../../scraper/maintectechnologies/script.js')
  const requestedUrls = []

  assert.equal(maintec.hasOfficialJobsArchiveSignal(MAINTEC_JOBS_HTML), true)
  assert.deepEqual(maintec.extractJobLinks(MAINTEC_JOBS_HTML), [
    'https://maintec.com/jobs/cics-system-programmer/',
    'https://maintec.com/jobs/associate-engineers-mechanical-or-electrical/',
  ])

  const jobs = await maintec.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === maintec.CAREERS_URL) return MAINTEC_JOBS_HTML
      if (url === 'https://maintec.com/jobs/cics-system-programmer/') return MAINTEC_CICS_DETAIL_HTML
      if (url === 'https://maintec.com/jobs/associate-engineers-mechanical-or-electrical/') {
        return MAINTEC_EXPIRED_DETAIL_HTML
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    maintec.CAREERS_URL,
    'https://maintec.com/jobs/cics-system-programmer/',
    'https://maintec.com/jobs/associate-engineers-mechanical-or-electrical/',
  ])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    maintec.run({
      fetchText: async (url) => {
        if (url === maintec.CAREERS_URL) return MAINTEC_JOBS_HTML
        return `
          <html><body>
            <h1>Senior Engineer</h1>
            <p>Location: Bengaluru, India</p>
            <h2>Apply for this position</h2>
          </body></html>
        `
      },
    }),
    /trustworthy india job metadata/i,
  )
})
