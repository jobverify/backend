import assert from 'node:assert/strict'
import test from 'node:test'

const companyHtml = '<html>Loyal Wingman Technologies Private Limited (Loyalwingtech) urn:li:organization:96646029</html>'
const emptyJobsHtml = '<button data-tracking-control-name="public_jobs_f_C">Loyal Wingman Technologies Private Limited (Loyalwingtech)</button><a href="?f_C=96646029">Jobs</a>'
const jobsHtml = `${emptyJobsHtml}<div class="base-card" data-entity-urn="urn:li:jobPosting:1234567890"><a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/1234567890"></a><h3 class="base-search-card__title"> Electronics Design Intern </h3><h4 class="base-search-card__subtitle"><a>Loyal Wingman Technologies Private Limited (Loyalwingtech)</a></h4><span class="job-search-card__location">Hosur, Tamil Nadu, India</span><time datetime="2026-08-03"></time></div>`

test('Loyal Wingman Technologies validates its LinkedIn public jobs contract', async () => {
  const scraper = await import('./script.js')

  assert.equal(scraper.LINKEDIN_COMPANY_ID, '96646029')
  assert.equal(scraper.pageIndicatesLoyalWingmanCompany(companyHtml), true)
  assert.equal(scraper.pageIndicatesLoyalWingmanIndiaJobsSearch(emptyJobsHtml), true)
})

test('Loyal Wingman Technologies returns zero only for the verified empty company search', async () => {
  const scraper = await import('./script.js')
  const jobs = await scraper.createLoyalWingmanTechnologiesScraper().run({
    fetchText: async (url) => url === scraper.LINKEDIN_COMPANY_PAGE_URL ? companyHtml : emptyJobsHtml,
  })

  assert.deepEqual(jobs, [])
})

test('Loyal Wingman Technologies captures public India job cards and fails closed on contract drift', async () => {
  const scraper = await import('./script.js')
  const jobs = await scraper.createLoyalWingmanTechnologiesScraper().run({
    fetchText: async (url) => url === scraper.LINKEDIN_COMPANY_PAGE_URL ? companyHtml : jobsHtml,
    now: () => '2026-08-03T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Electronics Design Intern')
  assert.equal(jobs[0].country, 'India')

  await assert.rejects(
    scraper.createLoyalWingmanTechnologiesScraper().run({
      fetchText: async (url) => url === scraper.LINKEDIN_COMPANY_PAGE_URL ? companyHtml : '<html>unrelated</html>',
    }),
    /jobs search no longer matches/i,
  )
})
