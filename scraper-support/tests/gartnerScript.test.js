import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-14T10:15:00.000Z'

const listingsPageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities | Gartner Careers</title>
  </head>
  <body>
    <h1 class="hero-heading">Career Opportunities</h1>
    <div class="grid job-listing">
      <div class="card card-job js-job" data-id="54165">
        <div class="card-body">
          <h2 class="card-title">
            <a
              onclick="dataLayer.push({ 'event': 'viewjob', 'jobinfo': { 'jobid': '112284' }});"
              class="stretched-link"
              href="/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/"
            >Consultant - Applications, Infrastructure and Security Modernization</a>
          </h2>
          <ul class="job-meta">
            <li>Gurgaon, Haryana</li>
          </ul>
        </div>
      </div>
      <div class="card card-job js-job" data-id="54164">
        <div class="card-body">
          <h2 class="card-title">
            <a
              onclick="dataLayer.push({ 'event': 'viewjob', 'jobinfo': { 'jobid': '111578' }});"
              class="stretched-link"
              href="/jobs/job/111578-software-engineer-etl-developer-with-python/"
            >Software Engineer - ETL Developer with Python</a>
          </h2>
          <ul class="job-meta">
            <li>Gurgaon, Haryana</li>
          </ul>
        </div>
      </div>
    </div>
  </body>
</html>
`

const listingsPageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities | Gartner Careers - Page 2</title>
  </head>
  <body>
    <h1 class="hero-heading">Career Opportunities</h1>
    <div class="grid job-listing">
      <div class="card card-job js-job" data-id="54001">
        <div class="card-body">
          <h2 class="card-title">
            <a
              onclick="dataLayer.push({ 'event': 'viewjob', 'jobinfo': { 'jobid': '109239' }});"
              class="stretched-link"
              href="/jobs/job/109239-associate-database-administrator/"
            >Associate Database Administrator</a>
          </h2>
          <ul class="job-meta">
            <li>Chennai, Tamil Nadu</li>
          </ul>
        </div>
      </div>
    </div>
  </body>
</html>
`

const detailHtmlByUrl = {
  'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/': `
<!doctype html>
<html lang="en">
  <head>
    <title>Consultant - Applications, Infrastructure and Security Modernization in Gurgaon, Haryana, India | Gartner Careers</title>
    <meta property="http://ogp.me/ns/article#published_time" content="2026-07-16T10:05:23">
  </head>
  <body>
    <section>
      <h1 class="display-2">Consultant - Applications, Infrastructure and Security Modernization</h1>
      <ul class="job-meta">
        <li>Gurgaon, Haryana</li>
        <li><a href="/teams/consulting/">Consulting</a></li>
      </ul>
    </section>
    <div class="container job-detail" id="js-job-posting">
      <main class="col-lg-8 col-xl-7">
        <article class="cms-content">
          <h2>Description</h2>
          <p><strong>About Gartner Consulting:</strong></p>
          <p>Gartner Consulting partners with the world's leading organizations.</p>
          <p><strong>What you'll do:</strong></p>
          <ul>
            <li>Support application strategy engagements.</li>
            <li>Articulate findings and recommendations.</li>
          </ul>
          Job Requisition ID:112284
        </article>
      </main>
      <aside class="col-lg-4 sidebar">
        <div class="job-sidebar">
          <a
            class="btn btn-primary btn-block"
            href="https://gartner.wd5.myworkdayjobs.com/EXT/job/Gurgaon/Consultant---Applications--Infrastructure-and-Security-Modernization_112284-1/apply"
          >Apply Now</a>
        </div>
      </aside>
    </div>
  </body>
</html>
`,
  'https://jobs.gartner.com/jobs/job/111578-software-engineer-etl-developer-with-python/': `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineer - ETL Developer with Python in Gurgaon, Haryana, India | Gartner Careers</title>
    <meta property="http://ogp.me/ns/article#published_time" content="2026-07-10T08:00:00">
  </head>
  <body>
    <section>
      <h1 class="display-2">Software Engineer - ETL Developer with Python</h1>
      <ul class="job-meta">
        <li>Gurgaon, Haryana</li>
        <li><a href="/teams/technology/">Technology</a></li>
      </ul>
    </section>
    <div class="container job-detail" id="js-job-posting">
      <main class="col-lg-8 col-xl-7">
        <article class="cms-content">
          <h2>Description</h2>
          <p><strong>About the role:</strong></p>
          <p>Build and support ETL pipelines.</p>
          Job Requisition ID:111578
        </article>
      </main>
      <aside class="col-lg-4 sidebar">
        <div class="job-sidebar">
          <a
            class="btn btn-primary btn-block"
            href="https://gartner.wd5.myworkdayjobs.com/EXT/job/Gurgaon/Software-Engineer---ETL-Developer-with-Python_111578-1/apply"
          >Apply Now</a>
        </div>
      </aside>
    </div>
  </body>
</html>
`,
  'https://jobs.gartner.com/jobs/job/109239-associate-database-administrator/': `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate Database Administrator in Chennai, Tamil Nadu, India | Gartner Careers</title>
    <meta property="http://ogp.me/ns/article#published_time" content="2026-06-28T09:30:00">
  </head>
  <body>
    <section>
      <h1 class="display-2">Associate Database Administrator</h1>
      <ul class="job-meta">
        <li>Chennai, Tamil Nadu</li>
        <li><a href="/teams/technology/">Technology</a></li>
      </ul>
    </section>
    <div class="container job-detail" id="js-job-posting">
      <main class="col-lg-8 col-xl-7">
        <article class="cms-content">
          <h2>Description</h2>
          <p><strong>About the role:</strong></p>
          <p>Manage critical database operations.</p>
          Job Requisition ID:109239
        </article>
      </main>
      <aside class="col-lg-4 sidebar">
        <div class="job-sidebar">
          <a
            class="btn btn-primary btn-block"
            href="https://gartner.wd5.myworkdayjobs.com/EXT/job/Chennai/Associate-Database-Administrator_109239-1/apply"
          >Apply Now</a>
        </div>
      </aside>
    </div>
  </body>
</html>
`,
}

const blockedChallengePage = {
  status: 403,
  url: 'https://jobs.gartner.com/jobs/?country=India',
  headers: {
    server: 'cloudflare',
    'cf-mitigated': 'challenge',
    'cf-ray': 'a2acce014b27c728-MAA',
  },
  html: `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <div id="challenge-body-text">Enable JavaScript and cookies to continue</div>
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js"></script>
  </body>
</html>
`,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/gartner/script.js')
  } catch {
    assert.fail('Expected Gartner scraper module at ../../scraper/gartner/script.js')
  }
}

test('Gartner helpers keep the verified browser-visible India jobs contract explicit', async () => {
  const gartner = await loadModule()

  assert.equal(gartner.SOURCE, 'gartner')
  assert.equal(gartner.COMPANY, 'Gartner')
  assert.equal(gartner.HOMEPAGE_URL, 'https://jobs.gartner.com/')
  assert.equal(gartner.LISTINGS_URL, 'https://jobs.gartner.com/jobs/?country=India')
  assert.equal(gartner.COMPANY_DOMAIN, 'jobs.gartner.com')
  assert.equal(gartner.COUNTRY_FILTER, 'India')
  assert.equal(gartner.VERIFIED_ON, '2026-08-14')
  assert.match(gartner.VERIFIED_SURFACE_SUMMARY, /Cloudflare-managed HTTP 403 challenge shell/i)
  assert.match(gartner.VERIFIED_SURFACE_SUMMARY, /HR System Ops Specialist/i)
  assert.equal(gartner.hasVerifiedCloudflareChallengeSignal(blockedChallengePage), true)
  assert.equal(
    gartner.isVerifiedCloudflareChallengedPage(blockedChallengePage, gartner.LISTINGS_URL),
    true,
  )
  assert.equal(
    gartner.buildListingsUrl(),
    'https://jobs.gartner.com/jobs/?country=India',
  )
  assert.equal(
    gartner.buildListingsUrl({ page: 2 }),
    'https://jobs.gartner.com/jobs/?country=India&page=2',
  )
  assert.equal(gartner.hasListingsPageSignal(listingsPageOneHtml), true)
  assert.deepEqual(gartner.extractSearchResults(listingsPageOneHtml), [
    {
      title: 'Consultant - Applications, Infrastructure and Security Modernization',
      location: 'Gurgaon, Haryana',
      city: 'Gurgaon',
      jobId: '112284',
      requisitionId: '112284',
      sourceUrl:
        'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/',
    },
    {
      title: 'Software Engineer - ETL Developer with Python',
      location: 'Gurgaon, Haryana',
      city: 'Gurgaon',
      jobId: '111578',
      requisitionId: '111578',
      sourceUrl:
        'https://jobs.gartner.com/jobs/job/111578-software-engineer-etl-developer-with-python/',
    },
  ])

  assert.equal(
    gartner.hasJobDetailSignal(
      detailHtmlByUrl[
        'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/'
      ],
    ),
    true,
  )
  assert.deepEqual(
    gartner.extractJobDetail(
      detailHtmlByUrl[
        'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/'
      ],
      {
        title: 'Consultant - Applications, Infrastructure and Security Modernization',
        location: 'Gurgaon, Haryana',
        city: 'Gurgaon',
        jobId: '112284',
        requisitionId: '112284',
        sourceUrl:
          'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/',
      },
    ),
    {
      title: 'Consultant - Applications, Infrastructure and Security Modernization',
      company: 'Gartner',
      department: 'Consulting',
      location: 'Gurgaon, Haryana',
      city: 'Gurgaon',
      jobId: '112284',
      requisitionId: '112284',
      sourceUrl:
        'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/',
      applyUrl:
        'https://gartner.wd5.myworkdayjobs.com/EXT/job/Gurgaon/Consultant---Applications--Infrastructure-and-Security-Modernization_112284-1/apply',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-16',
      closingDate: null,
      jobDescription:
        "Description About Gartner Consulting: Gartner Consulting partners with the world's leading organizations. What you'll do: Support application strategy engagements. Articulate findings and recommendations. Job Requisition ID:112284",
      companyCareerPage: 'https://jobs.gartner.com/jobs/?country=India',
      companyDomain: 'jobs.gartner.com',
      atsPlatform: 'official-company-careers',
    },
  )
})

test('Gartner run paginates browser-rendered listings until pages stop yielding new jobs', async () => {
  const gartner = await loadModule()
  const requestedUrls = []

  const htmlByUrl = new Map([
    [gartner.LISTINGS_URL, listingsPageOneHtml],
    [gartner.buildListingsUrl({ page: 2 }), listingsPageTwoHtml],
    [gartner.buildListingsUrl({ page: 3 }), listingsPageTwoHtml],
    ...Object.entries(detailHtmlByUrl),
  ])

  const jobs = await gartner.createGartnerScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      const html = htmlByUrl.get(url)
      if (!html) {
        throw new Error(`Unexpected Gartner URL: ${url}`)
      }
      return html
    },
  })

  assert.deepEqual(requestedUrls, [
    gartner.LISTINGS_URL,
    gartner.buildListingsUrl({ page: 2 }),
    gartner.buildListingsUrl({ page: 3 }),
    'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/',
    'https://jobs.gartner.com/jobs/job/111578-software-engineer-etl-developer-with-python/',
    'https://jobs.gartner.com/jobs/job/109239-associate-database-administrator/',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.jobId, job.title, job.location]),
    [
      [
        '112284',
        'Consultant - Applications, Infrastructure and Security Modernization',
        'Gurgaon, Haryana',
      ],
      ['111578', 'Software Engineer - ETL Developer with Python', 'Gurgaon, Haryana'],
      ['109239', 'Associate Database Administrator', 'Chennai, Tamil Nadu'],
    ],
  )
  assert.equal(jobs[0].source, 'gartner')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].department, 'Technology')
  assert.equal(
    jobs[2].applyUrl,
    'https://gartner.wd5.myworkdayjobs.com/EXT/job/Chennai/Associate-Database-Administrator_109239-1/apply',
  )
})

test('Gartner returns a truthful current-openings signal when the live India listings route is challenge-gated', async () => {
  const gartner = await loadModule()

  const jobs = await gartner.createGartnerScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchPage: async (url) => {
      assert.equal(url, gartner.LISTINGS_URL)
      return blockedChallengePage
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Current openings at Gartner',
      company: 'Gartner',
      location: 'India',
      city: null,
      country: 'India',
      link: 'https://jobs.gartner.com/jobs/?country=India',
      applyUrl: 'https://jobs.gartner.com/jobs/?country=India',
      sourceUrl: 'https://jobs.gartner.com/jobs/?country=India',
      source: 'gartner',
      jobId: 'gartner-current-openings',
      requisitionId: 'gartner-current-openings',
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'The official Gartner careers page still exposes India openings in the browser, but direct requests to https://jobs.gartner.com/jobs/?country=India returned a verified Cloudflare challenge during this scrape. Review current openings directly on https://jobs.gartner.com/jobs/?country=India.',
      companyCareerPage: 'https://jobs.gartner.com/jobs/?country=India',
      companyDomain: 'jobs.gartner.com',
      atsPlatform: 'official-company-careers',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Gartner fails closed when the listings or detail contract drifts', async () => {
  const gartner = await loadModule()

  await assert.rejects(
    gartner.createGartnerScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /listings page no longer matches/i,
  )

  await assert.rejects(
    gartner.createGartnerScraper().run({
      fetchText: async (url) => {
        if (url === gartner.LISTINGS_URL) return listingsPageOneHtml
        if (url === gartner.buildListingsUrl({ page: 2 })) return listingsPageTwoHtml
        if (url === gartner.buildListingsUrl({ page: 3 })) return listingsPageTwoHtml
        return detailHtmlByUrl[
          'https://jobs.gartner.com/jobs/job/112284-consultant-applications-infrastructure-and-security-modernization/'
        ].replace('Apply Now', 'Join Talent Community')
      },
    }),
    /job detail no longer matches/i,
  )
})
