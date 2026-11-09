import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI-powered E-commerce Analytics for Digital Commerce | DataWeave</title>
  </head>
  <body>
    <footer>
      <a href="https://dataweave.com/us/careers">Careers</a>
    </footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Wish to change the world of eCommerce | Join us @DataWeave</title>
  </head>
  <body>
    <main>
      <h1>Lead the Global Online Data Revolution</h1>
      <h2>Current Openings</h2>
      <p>To apply for any other roles of your interest, please write in to us at hr@dataweave.com, along with your resume.</p>
      <h4>Product Engineering , 1 Open Position</h4>
      <h4>Open Positions</h4>
      <ul>
        <li>
          <a href="https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R">
            Technical Architect in Bangalore We are looking for a Technical Architect to lead the design and evolution of large-scale analytics and data-driven SaaS platforms. Apply for 1 Open
          </a>
        </li>
      </ul>
    </main>
  </body>
</html>
`

const DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>DataWeave - Technical Architect</title>
  </head>
  <body>
    <main>
      <h1>Technical Architect</h1>
      <h2>Product Engineering @DataWeave</h2>
      <p>We build data products that provide timely insights that are readily consumable and actionable, at scale.</p>
      <h2>Roles & Responsibilities</h2>
      <p>Lead the design and evolution of large-scale analytics and data-driven SaaS platforms.</p>
      <h2>Skills & Requirements</h2>
      <ul>
        <li>Strong experience in distributed systems and SaaS system design.</li>
        <li>Strong hands-on experience with AWS.</li>
      </ul>
      <p>Job Location:</p>
      <p>Bangalore, India</p>
      <p>Address:</p>
      <p>InfoWeave Analytics Pvt Ltd, Bannerghatta Rd, Bengaluru</p>
      <h2>Apply Now</h2>
      <form>
        <input name="name" />
        <input name="email" />
        <input name="resume" />
      </form>
    </main>
  </body>
</html>
`

const loadDataWeaveModule = async () => {
  try {
    return await import('../../scraper/dataweave/script.js')
  } catch {
    assert.fail('Expected DataWeave scraper module at ../../scraper/dataweave/script.js')
  }
}

test('DataWeave helpers keep the verified homepage handoff and same-domain job detail URL stable', async () => {
  const {
    CAREERS_URL,
    HOMEPAGE_URL,
    extractCareersUrl,
    hasOfficialCareersSignal,
    hasOfficialHomepageSignal,
  } = await loadDataWeaveModule()

  assert.equal(HOMEPAGE_URL, 'https://dataweave.com/')
  assert.equal(CAREERS_URL, 'https://dataweave.com/us/careers')
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(extractCareersUrl(HOMEPAGE_HTML), CAREERS_URL)
})

test('extractListings parses the visible DataWeave current opening into a first-party detail listing', async () => {
  const dataWeave = await loadDataWeaveModule()
  const jobs = dataWeave.extractListings(CAREERS_HTML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Technical Architect',
    company: 'DataWeave',
    department: 'Product Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: '05-202605141139-R',
    requisitionId: '05-202605141139-R',
    sourceUrl: 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R',
    applyUrl: 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
})

test('extractJobDetail lifts DataWeave detail content and keeps the inline apply form on the same detail route', async () => {
  const dataWeave = await loadDataWeaveModule()
  const listing = dataWeave.extractListings(CAREERS_HTML)[0]
  const job = dataWeave.extractJobDetail(DETAIL_HTML, listing)

  assert.equal(job.title, 'Technical Architect')
  assert.equal(job.applyUrl, 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R')
  assert.equal(job.location, 'Bangalore, India')
  assert.equal(job.city, 'Bangalore')
  assert.equal(job.minimumQualification, 'Strong experience in distributed systems and SaaS system design.')
  assert.equal(job.preferredQualification, 'Strong hands-on experience with AWS.')
  assert.deepEqual(job.requiredSkills, [
    'Strong experience in distributed systems and SaaS system design.',
    'Strong hands-on experience with AWS.',
  ])
  assert.match(job.jobDescription, /Lead the design and evolution/i)
  assert.match(job.jobDescription, /Apply Now/i)
})

test('run validates the DataWeave homepage handoff, careers page, and first-party detail page', async () => {
  const dataWeave = await loadDataWeaveModule()
  const requestedUrls = []

  const jobs = await dataWeave.createDataWeaveScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://dataweave.com/') return HOMEPAGE_HTML
      if (url === 'https://dataweave.com/us/careers') return CAREERS_HTML
      if (url === 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R') return DETAIL_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://dataweave.com/',
    'https://dataweave.com/us/careers',
    'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'dataweave')
  assert.equal(jobs[0].link, 'https://dataweave.com/jobs/09-202209210914-J/05-202605141139-R')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
})

test('run fails closed when the verified DataWeave homepage handoff or careers surface changes materially', async () => {
  const dataWeave = await loadDataWeaveModule()

  await assert.rejects(
    dataWeave.createDataWeaveScraper().run({
      fetchText: async () => '<html><body>No openings here</body></html>',
    }),
    /verified DataWeave/i,
  )
})
