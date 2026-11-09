import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Credgenics | Debt Collections &amp; Resolution Platform | Loan Collections Platform | Debt Recovery Software</title>
  </head>
  <body>
    <h1>Supercharge debt collections with AI-driven full-stack platform</h1>
    <p>India’s Best Selling AI-powered Loan Collections Platform - three times winner for 2022 -2024.</p>
    <section>
      <h2>Company</h2>
      <a href="/about-us">About Us</a>
      <a href="/security">Security</a>
    </section>
    <p>support@credgenics.com</p>
    <p>Copyright 2026 Analog Legalhub Technology Solutions Pvt. Ltd. All Rights Reserved.</p>
  </body>
</html>
`

const currentHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Credgenics | Debt Collections &amp; Resolution Platform | Loan Collections Platform | Debt Recovery Software</title>
  </head>
  <body>
    <h1>Supercharge debt collections with AI-driven full-stack platform</h1>
    <p>India’s Best Selling AI-powered Loan Collections Platform - three times winner for 2022 -2024.</p>
    <section>
      <h2>Company</h2>
      <a href="/about-us">About Us</a>
      <a href="https://www.linkedin.com/jobs/search/?f_C=14634991&amp;geoId=92000000">LinkedIn jobs</a>
    </section>
    <p>support@credgenics.com</p>
    <p>© 2026 Analog Legalhub Technology Solutions Pvt. Ltd. All Rights Reserved.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/credgenics/script.js')
  } catch {
    assert.fail('Expected Credgenics scraper module at ../../scraper/credgenics/script.js')
  }
}

test('Credgenics sentinel validates the verified official homepage with no public careers links', async () => {
  const credgenics = await loadModule()

  assert.equal(credgenics.SOURCE, 'credgenics')
  assert.equal(credgenics.COMPANY, 'Credgenics')
  assert.equal(credgenics.HOMEPAGE_URL, 'https://www.credgenics.com/')
  assert.equal(credgenics.LINKEDIN_COMPANY_ID, '14634991')
  assert.equal(
    credgenics.VERIFIED_LINKEDIN_JOBS_URL,
    'https://www.linkedin.com/jobs/search/?f_C=14634991&geoId=92000000',
  )
  assert.equal(credgenics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(credgenics.extractLinkedInJobsUrl(homepageHtml), null)
  assert.equal(credgenics.pageExposesFirstPartyJobsSignal(homepageHtml), false)
})

test('Credgenics sentinel accepts the current homepage punctuation and LinkedIn handoff shape', async () => {
  const credgenics = await loadModule()

  assert.equal(credgenics.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(
    credgenics.extractLinkedInJobsUrl(currentHomepageHtml),
    'https://www.linkedin.com/jobs/search/?f_C=14634991&geoId=92000000',
  )
  assert.equal(credgenics.pageExposesFirstPartyJobsSignal(currentHomepageHtml), false)
})

test('Credgenics sentinel returns no jobs while the verified homepage exposes no public jobs surface', async () => {
  const credgenics = await loadModule()
  const requestedUrls = []

  const jobs = await credgenics.createCredgenicsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return homepageHtml
    },
  })

  assert.deepEqual(requestedUrls, [credgenics.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('Credgenics sentinel fails closed if the verified homepage or first-party jobs surface drifts', async () => {
  const credgenics = await loadModule()

  await assert.rejects(
    credgenics.createCredgenicsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /Credgenics official homepage changed/i,
  )

  await assert.rejects(
    credgenics.createCredgenicsScraper().run({
      fetchText: async () => `${homepageHtml}
        <section>
          <h2>Current Openings</h2>
          <a href="/careers/customer-success-manager">Apply now</a>
        </section>`,
    }),
    /first-party public jobs surface/i,
  )
})

test('Credgenics follows its current official Zappyhire board through all job pages and details', async () => {
  const credgenics = await loadModule()
  const board = 'https://recruitcareers.zappyhire.com/en/credgenics'
  const api = 'https://credgenics.zappyhire-multitenant-be-prod.zappyhire.com/api/'
  const currentHome = `<title>Credgenics | Customer Experience Management | Debt Collections &amp; Resolution Platform</title>
    <h1>Supercharge debt collections with AI-driven full-stack platform</h1>
    <a href="${board}">Careers</a><footer>© 2026 Analog Legalhub Technology Solutions Pvt. Ltd. All Rights Reserved.</footer>`
  const job = (id, title, city) => ({
    _source: { client: 'credgenics', job: id, title, location: city, department: 'Human Resource', entity: 'CredGenics', job_type: 'Full Time' },
  })
  const details = new Map([
    [4, { id: 4, title: 'Business Analyst', location: [{ city: 'Noida-Uttar Pradesh', country_code: null }], department: 'Human Resource', job_type: 'Full Time', description: '<p>Business analysis role</p>', skills: ['analysis'], experience: 2, max_experience: 4, job_publish_date: '2026-08-04T11:23:40Z', job_board_urls: [{ name: 'Career Page', url: 'https://recruitcareers.zappyhire.com/credgenics/apply?source=1&company=1&job=4' }] }],
    [3, { id: 3, title: 'Relations Manager', location: [{ city: 'Kochi-Kerala', country_code: null }], department: 'Human Resource', job_type: 'Full Time', description: '<p>Relations role</p>', skills: [], experience: 8, max_experience: 13, job_board_urls: [{ name: 'Career Page', url: 'https://recruitcareers.zappyhire.com/credgenics/apply?source=1&company=1&job=3' }] }],
    [2, { id: 2, title: 'Asst.Manager', location: [{ city: 'Kochi-Kerala', country_code: null }], department: 'Human Resource', job_type: 'Full Time', description: '<p>Manager role</p>', skills: [], experience: 8, max_experience: 13, job_board_urls: [{ name: 'Career Page', url: 'https://recruitcareers.zappyhire.com/credgenics/apply?source=1&company=1&job=2' }] }],
  ])
  const requests = []
  const jobs = await credgenics.createCredgenicsScraper({ pageSize: 2 }).run({
    fetchText: async (url) => url === credgenics.HOMEPAGE_URL ? currentHome
      : '<title>Careers</title><base href="/en/"><app-root></app-root>',
    fetchJson: async (url) => {
      requests.push(url)
      if (url === `${api}careers/configurations/`) return { status: 1, results: { name: 'CredGenics', website: credgenics.HOMEPAGE_URL, career_text_heading: 'CredGenics Careers', other_organization_settings: { country: 'in' } } }
      if (url === `${api}careers/filter-params/`) return { status: 1, results: { locations: ['Delhi', 'Noida', 'Kochi'] } }
      if (url === `${api}jobs/jobsearch/?page=1&page_size=2`) return { status: 1, results: { total: { value: 3 }, hits: [job(4, 'Business Analyst', 'Noida'), job(3, 'Relations Manager', 'Kochi')] } }
      if (url === `${api}jobs/jobsearch/?page=2&page_size=2`) return { status: 1, results: { total: { value: 3 }, hits: [job(2, 'Asst.Manager', 'Kochi')] } }
      const id = Number(url.match(/\/careers\/jobs\/(\d+)\//)?.[1])
      if (details.has(id)) return { status: 1, results: details.get(id) }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((item) => item.title), ['Business Analyst', 'Relations Manager', 'Asst.Manager'])
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Noida')
  assert.equal(jobs[0].applyUrl, 'https://recruitcareers.zappyhire.com/credgenics/apply?source=1&company=1&job=4')
  assert.ok(requests.includes(`${api}jobs/jobsearch/?page=2&page_size=2`))
})
