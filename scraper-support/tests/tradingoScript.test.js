import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'
const SHARED_APPLY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities at Tradingo</title>
  </head>
  <body>
    <main>
      <h1>Work with us !</h1>
      <p>Be a part of the tribe</p>
      <h2>Job Opportunities</h2>
      <h3>Sales</h3>

      <article class="job-card">
        <h4>Customer Acquisition Manager</h4>
        <p>Experience required : 3 - 5 years</p>
        <p>Qualification : Any Bachelor's/Graduation degree</p>
        <a href="${SHARED_APPLY_URL}">APPLY</a>
      </article>

      <article class="job-card">
        <h4>Relationship Manager</h4>
        <p>Experience required : 3 - 5 years</p>
        <p>Qualification : Any Bachelor's/Graduation degree</p>
        <a href="${SHARED_APPLY_URL}">APPLY</a>
      </article>

      <footer>
        <p>4th Floor Dwarka Tower 17, MY Hospital Rd, Jaora Compound, Indore, Madhya Pradesh 452001</p>
      </footer>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/tradingo/script.js')
  } catch {
    assert.fail('Expected Tradingo scraper module at ../../scraper/tradingo/script.js')
  }
}

test('Tradingo helpers stay pinned to the verified same-page public role cards', async () => {
  const tradingo = await loadModule()

  assert.equal(tradingo.SOURCE, 'tradingo')
  assert.equal(tradingo.COMPANY, 'Tradingo')
  assert.equal(tradingo.OFFICIAL_BRAND_NAME, 'Tradingo')
  assert.equal(tradingo.VERIFIED_ON, '2026-07-17')
  assert.equal(tradingo.CAREERS_URL, 'https://www.gotradingo.com/careers')
  assert.equal(tradingo.SHARED_APPLY_URL, SHARED_APPLY_URL)
  assert.equal(tradingo.hasOfficialCareersSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(
    tradingo.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'),
    false,
  )
  assert.equal(
    tradingo.extractSharedApplyUrl(VERIFIED_CAREERS_HTML),
    SHARED_APPLY_URL,
  )

  const jobs = tradingo.extractRoleCards(VERIFIED_CAREERS_HTML)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Customer Acquisition Manager',
    company: 'Tradingo',
    department: 'Sales',
    location: null,
    city: null,
    country: null,
    jobId: 'customer-acquisition-manager',
    requisitionId: null,
    sourceUrl: 'https://www.gotradingo.com/careers#customer-acquisition-manager',
    applyUrl: SHARED_APPLY_URL,
    employmentType: null,
    experienceRequired: '3 - 5 years',
    minimumQualification: "Any Bachelor's/Graduation degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: "Experience required: 3 - 5 years Qualification: Any Bachelor's/Graduation degree",
  })
  assert.equal(jobs[1].title, 'Relationship Manager')
  assert.equal(jobs[1].location, null)
  assert.equal(jobs[1].city, null)
  assert.equal(jobs[1].country, null)
})

test('Tradingo run validates the official careers page and returns the public same-page roles', async () => {
  const tradingo = await loadModule()
  const requestedUrls = []

  const jobs = await tradingo.createTradingoScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return VERIFIED_CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [tradingo.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'tradingo')
  assert.equal(jobs[0].company, 'Tradingo')
  assert.equal(jobs[0].link, 'https://www.gotradingo.com/careers#customer-acquisition-manager')
  assert.equal(jobs[0].applyUrl, SHARED_APPLY_URL)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Tradingo fails closed when the verified first-party careers structure drifts materially', async () => {
  const tradingo = await loadModule()

  await assert.rejects(
    tradingo.createTradingoScraper().run({
      fetchText: async () => VERIFIED_CAREERS_HTML.replace('Job Opportunities', 'Open Roles'),
    }),
    /verified official careers page/i,
  )
})
