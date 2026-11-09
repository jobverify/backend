import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head><title>Career</title></head>
    <body>
      <h1>Let’s start something big together!</h1>
      <h2>Join Our Team</h2>
      <a href="https://cardekho.darwinbox.in/ms/candidate/606876f7e2c79/careers">View Openings</a>
    </body>
  </html>
`

const loadCarDekhoModule = async () => {
  try {
    return await import('../../scraper/cardekho/script.js')
  } catch {
    assert.fail('Expected CarDekho scraper module at ../../scraper/scraper/cardekho/script.js')
  }
}

test('CarDekho verifies the official careers handoff and targets the Darwinbox tenant routes', async () => {
  const cardekho = await loadCarDekhoModule()

  assert.equal(cardekho.OFFICIAL_CAREERS_URL, 'https://careers.cardekho.com/')
  assert.equal(cardekho.DARWINBOX_ORIGIN, 'https://cardekho.darwinbox.in')
  assert.equal(cardekho.DARWINBOX_COMPANY_ID, '606876f7e2c79')
  assert.equal(
    cardekho.extractDarwinboxCareersUrl(careersHtml),
    'https://cardekho.darwinbox.in/ms/candidate/606876f7e2c79/careers',
  )
  assert.equal(cardekho.hasOfficialCarDekhoCareersSignals(careersHtml), true)
})

test('run keeps CarDekho jobs on the hosted Darwinbox routes and decorates the shared runner fields', async () => {
  const cardekho = await loadCarDekhoModule()
  const scraper = cardekho.createCarDekhoScraper()
  const requestedPages = []

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, cardekho.OFFICIAL_CAREERS_URL)
      return careersHtml
    },
    fetchListingPage: async ({ page }) => {
      requestedPages.push(page)

      return {
        status: 'success',
        data: [
          {
            id: 'dk-001',
            title: 'Senior Product Analyst',
            department_name: 'Product',
            locations: 'Gurugram, Haryana, India',
            country: 'India',
            emp_type_name: 'FULL_TIME',
            experience: '4 - 6 Years',
            posted_on: '12-Jul-2026',
            jd: '<p>Drive marketplace analytics and product insights.</p>',
          },
        ],
        job_counts: 1,
      }
    },
  })

  assert.deepEqual(requestedPages, [1])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'CarDekho')
  assert.equal(jobs[0].source, 'cardekho')
  assert.equal(
    jobs[0].applyUrl,
    'https://cardekho.darwinbox.in/ms/candidatev2/606876f7e2c79/careers/jobDetails/dk-001',
  )
  assert.equal(
    jobs[0].link,
    'https://cardekho.darwinbox.in/ms/candidatev2/606876f7e2c79/careers/jobDetails/dk-001',
  )
})
