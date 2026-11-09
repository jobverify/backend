import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadAmazonPayModule = async () => {
  try {
    return await import('../../scraper/amazonpay/script.js')
  } catch {
    assert.fail('Expected Amazon Pay scraper module at ../../scraper/amazonpay/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'amazonpay',
)

const verifiedSearchPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta
      property="og:url"
      content="https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&amp;normalized_country_code%5B%5D=IND"
    >
    <title>Job search | Amazon.jobs</title>
  </head>
  <body>
    <div
      data-react-class="SearchContent"
      data-react-props="{&quot;job_posting_search_request&quot;:&quot;{\\&quot;jobPostingSearchRequest\\&quot;:{\\&quot;query\\&quot;:\\&quot;Amazon Pay\\&quot;,\\&quot;filterFacets\\&quot;:[{\\&quot;name\\&quot;:\\&quot;normalizedCountryCode\\&quot;,\\&quot;values\\&quot;:[{\\&quot;name\\&quot;:\\&quot;IND\\&quot;}]}]}}&quot;}"
    ></div>
  </body>
</html>
`

const readJsonFixture = (name) => JSON.parse(
  readFileSync(path.join(fixturesDir, name), 'utf8'),
)

test('Amazon Pay scraper constants stay pinned to the verified first-party Amazon Jobs surface from July 15, 2026', async () => {
  const amazonPay = await loadAmazonPayModule()

  assert.equal(amazonPay.SOURCE, 'amazonpay')
  assert.equal(amazonPay.COMPANY, 'Amazon Pay')
  assert.equal(amazonPay.OFFICIAL_BRAND_NAME, 'Amazon Pay')
  assert.equal(amazonPay.VERIFIED_ON, '2026-07-15')
  assert.equal(
    amazonPay.SEARCH_PAGE_URL,
    'https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    amazonPay.buildSearchPageUrl(),
    'https://www.amazon.jobs/en/search?base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    amazonPay.buildSearchApiUrl(),
    'https://www.amazon.jobs/en/search.json?offset=0&result_limit=10&sort=relevant&base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.equal(
    amazonPay.buildSearchApiUrl({ offset: 20, resultLimit: 5 }),
    'https://www.amazon.jobs/en/search.json?offset=20&result_limit=5&sort=relevant&base_query=Amazon%20Pay&normalized_country_code%5B%5D=IND',
  )
  assert.match(amazonPay.VERIFIED_SURFACE_SUMMARY, /Amazon Jobs/i)
  assert.equal(amazonPay.hasVerifiedSearchPageSignal(verifiedSearchPageHtml), true)
  assert.equal(
    amazonPay.hasAmazonPaySignal({
      title: 'Senior PMT, Payment Experiences, Amazon Pay',
      description: 'Amazon Pay is redefining how customers pay.',
    }),
    true,
  )
  assert.equal(
    amazonPay.hasAmazonPaySignal({
      title: 'Program Manager, Retail',
      description: 'Build operations tooling for retail teams.',
    }),
    false,
  )
})

test('extractAmazonPayResults keeps only Amazon Pay jobs from the verified Amazon Jobs search JSON response', async () => {
  const amazonPay = await loadAmazonPayModule()
  const payload = readJsonFixture('search-india-amazon-pay-page-1.json')
  const jobs = amazonPay.extractAmazonPayResults(payload)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Business Analyst, Amazon Pay',
    company: 'Amazon Pay',
    department: 'Project/Program/Product Management--Technical',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    jobId: '10460726',
    requisitionId: 'e441ddd9-916f-41c5-89b7-18e8d42afba9',
    sourceUrl: 'https://www.amazon.jobs/en/jobs/10460726/business-analyst-amazon-pay',
    applyUrl: 'https://account.amazon.jobs/jobs/10460726/apply',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29',
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
  })
  assert.match(jobs[0].jobDescription, /customer trust/i)
  assert.doesNotMatch(jobs[0].jobDescription, /<br|<p|<li/i)
  assert.ok(jobs.every((job) => job.company === 'Amazon Pay'))
})

test('run verifies the Amazon Pay search page, paginates the Amazon Jobs search API, and decorates shared runner fields', async () => {
  const amazonPay = await loadAmazonPayModule()
  const payload = readJsonFixture('search-india-amazon-pay-page-1.json')
  const page1 = {
    ...payload,
    jobs: [payload.jobs[0], payload.jobs[1]],
  }
  const page2 = {
    ...payload,
    jobs: [payload.jobs[2], payload.jobs[0]],
  }
  const requestedPages = []
  const requestedApiUrls = []
  const scraper = amazonPay.createAmazonPayScraper({ pageSize: 2, maxPages: 2, maxJobs: 3 })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      requestedPages.push(url)
      return { status: 200, url, html: verifiedSearchPageHtml }
    },
    fetchJson: async (url) => {
      requestedApiUrls.push(url)

      if (url === amazonPay.buildSearchApiUrl({ offset: 0, resultLimit: 2 })) return page1
      if (url === amazonPay.buildSearchApiUrl({ offset: 2, resultLimit: 2 })) return page2

      throw new Error(`Unexpected Amazon Pay URL: ${url}`)
    },
    now: () => '2026-07-15T12:34:56.000Z',
  })

  assert.deepEqual(requestedPages, [amazonPay.SEARCH_PAGE_URL])
  assert.deepEqual(requestedApiUrls, [
    amazonPay.buildSearchApiUrl({ offset: 0, resultLimit: 2 }),
    amazonPay.buildSearchApiUrl({ offset: 2, resultLimit: 2 }),
  ])
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every((job) => job.source === 'amazonpay'))
  assert.ok(jobs.every((job) => job.company === 'Amazon Pay'))
  assert.ok(jobs.every((job) => job.companyCareerPage === amazonPay.SEARCH_PAGE_URL))
  assert.ok(jobs.every((job) => job.link === (job.applyUrl || job.sourceUrl)))
  assert.ok(jobs.every((job) => job.scrapedAt === '2026-07-15T12:34:56.000Z'))
})

test('Amazon Pay fails closed when the verified search page or search results drift away from the pinned Amazon Pay surface', async () => {
  const amazonPay = await loadAmazonPayModule()
  const payload = readJsonFixture('search-india-amazon-pay-page-1.json')

  await assert.rejects(
    amazonPay.createAmazonPayScraper().run({
      fetchPage: async (url) => ({
        status: 200,
        url,
        html: '<html><head><title>Job search | Amazon.jobs</title></head><body>Retail jobs</body></html>',
      }),
    }),
    /verified Amazon Jobs search page/i,
  )

  await assert.rejects(
    amazonPay.createAmazonPayScraper({ pageSize: 2, maxPages: 1 }).run({
      fetchPage: async (url) => ({ status: 200, url, html: verifiedSearchPageHtml }),
      fetchJson: async () => ({
        ...payload,
        jobs: payload.jobs.filter((job) => !amazonPay.hasAmazonPaySignal(job)),
      }),
    }),
    /no longer exposes Amazon Pay search results/i,
  )
})
