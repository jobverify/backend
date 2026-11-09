import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AlphaGrep | Global Quantitative Trading, Market Making &amp; Investment Firm</title>
    <link rel="canonical" href="https://www.alpha-grep.com/" />
  </head>
  <body>
    <h1>AlphaGrep</h1>
    <a href="https://www.alpha-grep.com/career/">Join our Team</a>
    <a href="/career/">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Quantitative Trading Careers | Quant Research &amp; Trading Jobs at AlphaGrep</title>
    <link rel="canonical" href="https://www.alpha-grep.com/career/" />
  </head>
  <body>
    <main>
      <h1>Join our Team</h1>
      <p>Find your next role at Alphagrep</p>
      <p>Apply for open positions at our offices in</p>
      <input type="search" placeholder="search by job title" />
      <ul class="jobResults">
        <a href='https://www.alpha-grep.com/career-opportunity?jid=8452018002'><li><div><h5>Business Operations</h5></div><span class='jobLocation'>Shanghai<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=6902979002'><li><div><h5>Devops Engineer</h5></div><span class='jobLocation'>Bangalore <strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=5149170002'><li><div><h5>General Technology Submissions: Developers, Devops, Systems, FPGA</h5></div><span class='jobLocation'>Multiple Location<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=8176611002'><li><div><h5>Quantitative Developer Intern</h5></div><span class='jobLocation'>Mumbai<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=8622004002'><li><div><h5>Quantitative Trading Intern</h5></div><span class='jobLocation'>India<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=8598189002'><li><div><h5>Regional Sales Head- Chennai</h5></div><span class='jobLocation'>Chennai<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
        <a href='https://www.alpha-grep.com/career-opportunity?jid=8499795002'><li><div><h5>Relationship Manager- Mumbai </h5></div><span class='jobLocation'>India<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></li></a>
      </ul>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AlphaGrep | Global Quantitative Trading, Market Making &amp; Investment Firm</title>
    <link rel="canonical" href="/" />
  </head>
  <body>
    <h1>AlphaGrep</h1>
    <a href="/career/">Join our Team</a>
    <a href="/career/">Careers</a>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Quantitative Trading Careers | Quant Research &amp; Trading Jobs at AlphaGrep</title>
    <link rel="canonical" href="/career/" />
  </head>
  <body>
    <main>
      <h1>Join our Team</h1>
      <p>Find your next role at Alphagrep</p>
      <p>Apply for open positions at our offices in</p>
      <input type="search" placeholder="search by job title" />
      <ul class="jobResults">
        <li><a href='/career-opportunity/?jid=8642299002'><div><h5 role="heading" aria-level="3">Accountant</h5></div><span class='jobLocation'>Bangalore<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></a></li>
        <li><a href='/career-opportunity/?jid=8176611002'><div><h5 role="heading" aria-level="3">Quantitative Developer Intern</h5></div><span class='jobLocation'>Mumbai<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></a></li>
        <li><a href='/career-opportunity/?jid=8622004002'><div><h5 role="heading" aria-level="3">Quantitative Trading Intern</h5></div><span class='jobLocation'>India<strong class='symLoc'><i class='fa fa-chevron-circle-right' aria-hidden='true'></i></strong></span></a></li>
      </ul>
    </main>
  </body>
</html>
`

const devopsDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunity - AlphaGrep</title>
    <link rel="canonical" href="https://www.alpha-grep.com/career-opportunity/" />
  </head>
  <body>
    <div class="jobDet">
      <h6><i class="fa fa-angle-right" aria-hidden="true"></i> Core Engineering</h6>
      <h2>Devops Engineer</h2>
      <h6 class="location">AlphaGrep India - Bangalore, Bangalore </h6>
      <a class="eut-btn" href="#jobApply">Apply for this job</a>
    </div>
    <div class="contentJD">
      <p><strong>About the Company</strong></p>
      <p>AlphaGrep is a quantitative trading and investment firm founded in 2010.</p>
      <ul>
        <li>Demonstrate strong hands-on experience in system monitoring and production engineering support.</li>
        <li>Have in-depth knowledge of Linux internals and Python scripting.</li>
      </ul>
    </div>
    <div id="jobApply">
      <h2>Apply for this Job</h2>
      <form action="" method="post" enctype="multipart/form-data">
        <input type="text" name="first_name" />
        <input type="text" name="last_name" />
        <input type="email" name="email" />
        <input type="number" name="phone" />
        <input type="text" name="location" />
        <input type="file" name="resume" />
        <input type="submit" value="Submit Application" />
      </form>
    </div>
  </body>
</html>
`

const quantDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunity - AlphaGrep</title>
    <link rel="canonical" href="https://www.alpha-grep.com/career-opportunity/" />
  </head>
  <body>
    <div class="jobDet">
      <h6><i class="fa fa-angle-right" aria-hidden="true"></i> Quantitative Research &amp; Trading</h6>
      <h2>Quantitative Developer Intern</h2>
      <h6 class="location">AlphaGrep - India, Mumbai</h6>
      <a class="eut-btn" href="#jobApply">Apply for this job</a>
    </div>
    <div class="contentJD">
      <p>Designing, implementing, and deploying high-frequency trading algorithms.</p>
      <ul>
        <li>Exploring trading ideas by analysing market data.</li>
        <li>Creating tools to analyse data for patterns.</li>
      </ul>
    </div>
    <div id="jobApply">
      <h2>Apply for this Job</h2>
      <form action="" method="post" enctype="multipart/form-data">
        <input type="text" name="first_name" />
        <input type="file" name="resume" />
        <input type="submit" value="Submit Application" />
      </form>
    </div>
  </body>
</html>
`

const quantTradingDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunity - AlphaGrep</title>
    <link rel="canonical" href="https://www.alpha-grep.com/career-opportunity/" />
  </head>
  <body>
    <div class="jobDet">
      <h6><i class="fa fa-angle-right" aria-hidden="true"></i> On-Campus Recruiting</h6>
      <h2>Quantitative Trading Intern</h2>
      <h6 class="location">ALPHAGREP GLOBAL DATABASE, India</h6>
      <a class="eut-btn" href="#jobApply">Apply for this job</a>
    </div>
    <div class="contentJD">
      <p>Research and implement trading ideas for global markets.</p>
    </div>
    <div id="jobApply">
      <h2>Apply for this Job</h2>
      <form action="" method="post" enctype="multipart/form-data">
        <input type="text" name="first_name" />
        <input type="file" name="resume" />
        <input type="submit" value="Submit Application" />
      </form>
    </div>
  </body>
</html>
`

const currentDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunity - AlphaGrep</title>
    <link rel="canonical" href="/career-opportunity/" />
  </head>
  <body>
    <div class="jobDet">
      <h6><i class="fa fa-angle-right" aria-hidden="true"></i> Finance</h6>
      <h2>Accountant</h2>
      <h6 class="location">AlphaGrep India - Bangalore, Bangalore </h6>
      <a class="eut-btn" href="#jobApply">Apply for this job</a>
    </div>
    <div class="contentJD">
      <p>Support the accounting and reporting team.</p>
    </div>
    <div id="jobApply">
      <h2>Apply for this Job</h2>
      <form action="" method="post" enctype="multipart/form-data">
        <input type="text" name="first_name" />
        <input type="file" name="resume" />
        <input type="submit" value="Submit Application" />
      </form>
    </div>
  </body>
</html>
`

const clientRenderedDetailHtml = `
<html><head><title>Career Opportunity - AlphaGrep</title><link rel="canonical" href="/career-opportunity/" /></head>
<body>
  <div class="jobDet"><p class="eut-h6">Career Opportunity</p><p>Loading…</p><p class="location">AlphaGrep</p><a href="#jobApply">Apply for this job</a></div>
  <div class="contentJD"><p>AlphaGrep is a quantitative trading and investment firm. We are seeking a Devops Engineer for our Bangalore office to provide day-to-day operational support and stability of infrastructure. Responsibilities include production engineering, Linux systems, monitoring, and deployment workflows.</p></div>
  <div id="jobApply"><h2>Apply for this Job</h2><form enctype="multipart/form-data"><input name="resume"><input type="submit" value="Submit Application"></form></div>
</body></html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/alphagrep/script.js')
  } catch {
    assert.fail('Expected AlphaGrep scraper module at ../../scraper/alphagrep/script.js')
  }
}

test('AlphaGrep constants and parsers stay pinned to the verified first-party careers surface', async () => {
  const alphaGrep = await loadModule()

  assert.equal(alphaGrep.COMPANY_NAME, 'AlphaGrep')
  assert.equal(alphaGrep.SOURCE, 'alphagrep')
  assert.equal(alphaGrep.COUNTRY_FILTER, 'India')
  assert.equal(alphaGrep.HOMEPAGE_URL, 'https://www.alpha-grep.com/')
  assert.equal(alphaGrep.CAREERS_HOME_URL, 'https://www.alpha-grep.com/career/')
  assert.equal(
    alphaGrep.CAREER_OPPORTUNITY_BASE_URL,
    'https://www.alpha-grep.com/career-opportunity',
  )
  assert.equal(
    alphaGrep.VERIFIED_INDIA_JOB_URL,
    'https://www.alpha-grep.com/career-opportunity/?jid=6902979002',
  )
  assert.equal(alphaGrep.extractCareersUrl(homepageHtml), alphaGrep.CAREERS_HOME_URL)
  assert.equal(alphaGrep.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(alphaGrep.hasOfficialCareersPageSignal(careersHtml), true)

  const listings = alphaGrep.extractListingJobs(careersHtml)
  assert.deepEqual(listings, [
    {
      title: 'Devops Engineer',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '6902979002',
      requisitionId: '6902979002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=6902979002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=6902979002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Quantitative Developer Intern',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '8176611002',
      requisitionId: '8176611002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8176611002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8176611002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Quantitative Trading Intern',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '8622004002',
      requisitionId: '8622004002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8622004002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8622004002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Regional Sales Head- Chennai',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: '8598189002',
      requisitionId: '8598189002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8598189002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8598189002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Relationship Manager- Mumbai',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '8499795002',
      requisitionId: '8499795002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8499795002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8499795002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
  ])

  assert.equal(
    alphaGrep.hasOfficialJobDetailSignal(devopsDetailHtml, listings[0]),
    true,
  )
  assert.deepEqual(alphaGrep.extractJobDetail(devopsDetailHtml, listings[0]), {
    title: 'Devops Engineer',
    company: 'AlphaGrep',
    department: 'Core Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '6902979002',
    requisitionId: '6902979002',
    sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=6902979002',
    applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=6902979002#jobApply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the Company',
      'AlphaGrep is a quantitative trading and investment firm founded in 2010.',
      'Demonstrate strong hands-on experience in system monitoring and production engineering support.',
      'Have in-depth knowledge of Linux internals and Python scripting.',
    ].join(' '),
  })

  assert.equal(
    alphaGrep.hasOfficialJobDetailSignal(quantTradingDetailHtml, listings[2]),
    true,
  )
  assert.deepEqual(alphaGrep.extractJobDetail(quantTradingDetailHtml, listings[2]), {
    title: 'Quantitative Trading Intern',
    company: 'AlphaGrep',
    department: 'On-Campus Recruiting',
    location: 'India',
    city: null,
    country: 'India',
    jobId: '8622004002',
    requisitionId: '8622004002',
    sourceUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8622004002',
    applyUrl: 'https://www.alpha-grep.com/career-opportunity?jid=8622004002#jobApply',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Research and implement trading ideas for global markets.',
  })
})

test('AlphaGrep accepts the current relative canonical tags and li-first careers list markup', async () => {
  const alphaGrep = await loadModule()

  assert.equal(alphaGrep.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(alphaGrep.hasOfficialCareersPageSignal(currentCareersHtml), true)
  assert.deepEqual(alphaGrep.extractListingJobs(currentCareersHtml), [
    {
      title: 'Accountant',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '8642299002',
      requisitionId: '8642299002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8642299002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8642299002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Quantitative Developer Intern',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: '8176611002',
      requisitionId: '8176611002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8176611002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8176611002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
    {
      title: 'Quantitative Trading Intern',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '8622004002',
      requisitionId: '8622004002',
      sourceUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8622004002',
      applyUrl: 'https://www.alpha-grep.com/career-opportunity/?jid=8622004002#jobApply',
      employmentType: null,
      postingDate: null,
      closingDate: null,
      department: null,
      jobDescription: null,
    },
  ])
  assert.equal(
    alphaGrep.hasOfficialJobDetailSignal(currentDetailHtml, alphaGrep.extractListingJobs(currentCareersHtml)[0]),
    true,
  )
  const currentListing = alphaGrep.extractListingJobs(careersHtml)[0]
  assert.equal(alphaGrep.hasOfficialJobDetailSignal(clientRenderedDetailHtml, currentListing), true)
  assert.equal(alphaGrep.hasOfficialJobDetailSignal(clientRenderedDetailHtml.replace('Devops Engineer', 'unrelated role').replace('production engineering', 'office operations'), currentListing), false)
})

test('AlphaGrep reads current paragraph job headings and explicit Delhi locations', async () => {
  const alphaGrep = await loadModule()
  const current = currentCareersHtml
    .replaceAll('<h5 role="heading" aria-level="3">', '<p class="eut-job-title">')
    .replaceAll('</h5>', '</p>')
    .replace("jobLocation'>Bangalore", "jobLocation'>Delhi")
  const listings = alphaGrep.extractListingJobs(current)
  assert.equal(alphaGrep.hasOfficialCareersPageSignal(current), true)
  assert.equal(listings.length, 3)
  assert.equal(listings[0].title, 'Accountant')
  assert.equal(listings[0].location, 'Delhi, India')
  assert.equal(alphaGrep.extractListingJobs(current.replaceAll('class="eut-job-title"', 'class="unrelated"')).length, 0)
})

test('AlphaGrep reads the current paragraph department and location on an active detail', async () => {
  const alphaGrep = await loadModule()
  const detail = devopsDetailHtml.replace('<h6>', '<p class="eut-h6">')
    .replace('</h6>', '</p>').replace('<h6 class="location">', '<p class="location">')
    .replace('</h6>', '</p>')
  const listing = alphaGrep.extractListingJobs(careersHtml)[0]
  assert.equal(alphaGrep.hasOfficialJobDetailSignal(detail, listing), true)
  assert.equal(alphaGrep.extractJobDetail(detail, listing).department, 'Core Engineering')
  assert.equal(alphaGrep.hasOfficialJobDetailSignal(detail.replace('class="location"', 'class="unrelated"'), listing), false)
})

test('run validates the verified homepage handoff, keeps only India jobs, and decorates runner fields', async () => {
  const alphaGrep = await loadModule()
  const requestedUrls = []

  const jobs = await alphaGrep.createAlphaGrepScraper({ maxJobs: 3 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === alphaGrep.HOMEPAGE_URL) return homepageHtml
      if (url === alphaGrep.CAREERS_HOME_URL) return careersHtml
      if (url === 'https://www.alpha-grep.com/career-opportunity?jid=6902979002') {
        return devopsDetailHtml
      }
      if (url === 'https://www.alpha-grep.com/career-opportunity?jid=8176611002') {
        return quantDeveloperDetailHtml
      }
      if (url === 'https://www.alpha-grep.com/career-opportunity?jid=8622004002') {
        return quantTradingDetailHtml
      }

      throw new Error(`Unexpected AlphaGrep fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    alphaGrep.HOMEPAGE_URL,
    alphaGrep.CAREERS_HOME_URL,
    'https://www.alpha-grep.com/career-opportunity?jid=6902979002',
    'https://www.alpha-grep.com/career-opportunity?jid=8176611002',
    'https://www.alpha-grep.com/career-opportunity?jid=8622004002',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'alphagrep')
  assert.equal(jobs[0].company, 'AlphaGrep')
  assert.equal(
    jobs[0].link,
    'https://www.alpha-grep.com/career-opportunity?jid=6902979002#jobApply',
  )
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(jobs[2].location, 'India')
  assert.equal(jobs[2].scrapedAt, FIXED_SCRAPED_AT)
})

test('AlphaGrep scraper fails closed when the homepage handoff, careers list, or detail apply form drifts', async () => {
  const alphaGrep = await loadModule()

  await assert.rejects(
    alphaGrep.createAlphaGrepScraper().run({
      fetchText: async (url) => {
        if (url === alphaGrep.HOMEPAGE_URL) {
          return homepageHtml.replaceAll('/career/', '/careers/')
        }

        throw new Error(`Unexpected AlphaGrep fixture URL: ${url}`)
      },
    }),
    /verified homepage handoff/i,
  )

  await assert.rejects(
    alphaGrep.createAlphaGrepScraper().run({
      fetchText: async (url) => {
        if (url === alphaGrep.HOMEPAGE_URL) return homepageHtml
        if (url === alphaGrep.CAREERS_HOME_URL) {
          return careersHtml.replace('search by job title', 'search roles')
        }

        throw new Error(`Unexpected AlphaGrep fixture URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    alphaGrep.createAlphaGrepScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === alphaGrep.HOMEPAGE_URL) return homepageHtml
        if (url === alphaGrep.CAREERS_HOME_URL) return careersHtml
        if (url === 'https://www.alpha-grep.com/career-opportunity?jid=6902979002') {
          return devopsDetailHtml.replace('Submit Application', 'Apply Elsewhere')
        }

        throw new Error(`Unexpected AlphaGrep fixture URL: ${url}`)
      },
    }),
    /verified detail page/i,
  )
})
