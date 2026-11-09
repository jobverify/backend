import assert from 'node:assert/strict'
import test from 'node:test'

const loadTekWissenModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <body>
      <p>IMPORTANT NOTE: TekWissen does not charge candidates a fee of any type at any stage of the hiring process.</p>
      <h2>Careers</h2>
      <h4>Job Openings</h4>
      <a href="https://tekwissen.com/career/india/">PAN INDIA</a>
      <h1>Build High-Performance Global Teams, On Demand</h1>
    </body>
  </html>
`

const careersLandingHtml = `
  <html>
    <body>
      <h2>Join Our Global Team</h2>
      <h1>Build Your Future At TekWissen</h1>
      <p>Region Pan India</p>
      <h2>Our Application Process Explained</h2>
    </body>
  </html>
`

const indiaCareersHtml = `
  <html>
    <head>
      <title>PAN INDIA - TekWissen.com</title>
    </head>
    <body>
      <nav>Home > Careers > PAN INDIA</nav>
      <h1>Apply for Future Roles at TekWissen</h1>
      <div id="ceipal-careers-root"></div>
      <script src="https://jobsapi.ceipal.com/APISource/widget.js"></script>
      <script>
        window.__TEKWISSEN_WIDGET__ = {
          "apiKey": "abc123",
          "careerPortalId": "portal456"
        }
      </script>
    </body>
  </html>
`

const indiaCareersHtmlWithEscapedWidgetConfig = `
  <html>
    <head>
      <title>PAN INDIA - TekWissen.com</title>
    </head>
    <body>
      <nav>Home > Careers > PAN INDIA</nav>
      <h1>Apply for Future Roles at TekWissen</h1>
      <script>
        window.__next_f.push([1,"{\\"apiKey\\":\\"abc123\\",\\"careerPortalId\\":\\"portal456\\"}"])
      </script>
    </body>
  </html>
`

const widgetHtml = `
  <html>
    <head>
      <title>.:: CEIPAL Career Portal ::.</title>
    </head>
    <body>
      <h1>CEIPAL Career Portal</h1>
      <h2>Search Jobs</h2>
      <p>2 Current Openings</p>
      <div class="job-posting">
        <a class="job-title" href="https://jobsapi.ceipal.com/jobs/senior-java-engineer">Senior Java Engineer</a>
        <div class="job-location">Hyderabad, India</div>
        <div class="job-type">Full Time</div>
      </div>
      <div class="job-posting">
        <a class="job-title" href="https://jobsapi.ceipal.com/jobs/talent-acquisition-specialist">Talent Acquisition Specialist</a>
        <div class="job-location">Bengaluru, India</div>
        <div class="job-type">Contract</div>
      </div>
    </body>
  </html>
`

test('TekWissen scraper validates the official careers landing flow and CEIPAL widget handoff', async () => {
  const tekwissen = await loadTekWissenModule()
  assert.ok(tekwissen, 'Expected scraper module at ./script.js')

  assert.equal(tekwissen.SOURCE, 'tekwissen')
  assert.equal(tekwissen.COMPANY, 'TekWissen Software Pvt Ltd')
  assert.equal(tekwissen.HOMEPAGE_URL, 'https://tekwissen.com/')
  assert.equal(tekwissen.CAREERS_PAGE_URL, 'https://tekwissen.com/career/')
  assert.equal(tekwissen.INDIA_CAREERS_URL, 'https://tekwissen.com/career/india/')
  assert.equal(tekwissen.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tekwissen.hasCareersLandingSignal(careersLandingHtml), true)
  assert.equal(tekwissen.hasIndiaCareersSignal(indiaCareersHtml), true)
  assert.deepEqual(tekwissen.extractWidgetConfig(indiaCareersHtml), {
    apiKey: 'abc123',
    careerPortalId: 'portal456',
  })
  assert.deepEqual(tekwissen.extractWidgetConfig(indiaCareersHtmlWithEscapedWidgetConfig), {
    apiKey: 'abc123',
    careerPortalId: 'portal456',
  })
  assert.equal(
    tekwissen.buildWidgetUrl({ apiKey: 'abc123', careerPortalId: 'portal456' }),
    'https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=abc123&cp_id=portal456',
  )
})

test('TekWissen scraper extracts India openings from the public CEIPAL widget', async () => {
  const tekwissen = await loadTekWissenModule()
  assert.ok(tekwissen, 'Expected scraper module at ./script.js')

  assert.equal(tekwissen.hasWidgetSignal(widgetHtml), true)
  assert.deepEqual(tekwissen.extractIndiaJobs(widgetHtml), [
    {
      title: 'Senior Java Engineer',
      company: 'TekWissen Software Pvt Ltd',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: 'senior-java-engineer',
      requisitionId: 'senior-java-engineer',
      sourceUrl: 'https://jobsapi.ceipal.com/jobs/senior-java-engineer',
      applyUrl: 'https://jobsapi.ceipal.com/jobs/senior-java-engineer',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Talent Acquisition Specialist',
      company: 'TekWissen Software Pvt Ltd',
      department: null,
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: null,
      country: 'India',
      jobId: 'talent-acquisition-specialist',
      requisitionId: 'talent-acquisition-specialist',
      sourceUrl: 'https://jobsapi.ceipal.com/jobs/talent-acquisition-specialist',
      applyUrl: 'https://jobsapi.ceipal.com/jobs/talent-acquisition-specialist',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('TekWissen run walks the official careers surface and stamps source metadata', async () => {
  const tekwissen = await loadTekWissenModule()
  assert.ok(tekwissen, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await tekwissen.createTekWissenScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tekwissen.HOMEPAGE_URL) return homepageHtml
      if (url === tekwissen.CAREERS_PAGE_URL) return careersLandingHtml
      if (url === tekwissen.INDIA_CAREERS_URL) return indiaCareersHtml
      if (url === 'https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=abc123&cp_id=portal456') {
        return widgetHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    tekwissen.HOMEPAGE_URL,
    tekwissen.CAREERS_PAGE_URL,
    tekwissen.INDIA_CAREERS_URL,
    'https://jobsapi.ceipal.com/APISource/v2/index.html?api_key=abc123&cp_id=portal456',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs.every((job) => job.source === 'tekwissen'), true)
  assert.equal(jobs.every((job) => job.scrapedAt === '2026-07-12T00:00:00.000Z'), true)
  assert.equal(jobs[0].link, 'https://jobsapi.ceipal.com/jobs/senior-java-engineer')
})

test('TekWissen fails closed when the verified public careers surface drifts', async () => {
  const tekwissen = await loadTekWissenModule()
  assert.ok(tekwissen, 'Expected scraper module at ./script.js')

  await assert.rejects(
    tekwissen.createTekWissenScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified official TekWissen homepage/i,
  )

  await assert.rejects(
    tekwissen.createTekWissenScraper().run({
      fetchText: async (url) => {
        if (url === tekwissen.HOMEPAGE_URL) return homepageHtml
        if (url === tekwissen.CAREERS_PAGE_URL) return careersLandingHtml
        if (url === tekwissen.INDIA_CAREERS_URL) return '<html><body><h1>Apply for Future Roles at TekWissen</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified TekWissen India careers page/i,
  )
})
