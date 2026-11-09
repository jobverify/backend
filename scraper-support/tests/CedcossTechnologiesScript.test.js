import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers | CEDCOSS Technologies</title>
  </head>
  <body>
    <p>Available positions</p>
    <h2>Open roles</h2>
    <a class="group flex items-center justify-between px-6 py-5 transition-colors duration-150" href="/careers/sales-executive">
      <div><div class="text-sm font-dm-sans font-medium">Sales Executive</div><div class="text-xs font-dm-sans mt-0.5">Full-time ? Remote (Night Shift)</div></div>
    </a>
    <a class="group flex items-center justify-between px-6 py-5 transition-colors duration-150" href="/careers/performance-marketing-executive">
      <div><div class="text-sm font-dm-sans font-medium">Performance Marketing Executive</div><div class="text-xs font-dm-sans mt-0.5">Full-time ? Lucknow</div></div>
    </a>
  </body>
</html>
`

const SALES_DETAIL_HTML = `
<!doctype html>
<html>
  <head>
    <link rel="canonical" href="https://cedcoss.com/careers/sales-executive" />
  </head>
  <body>
    <script>self.__next_f.push([1,"25:[\\"$\\",\\"$L2f\\",null,{\\"job\\":{\\"id\\":\\"1\\",\\"slug\\":\\"sales-executive\\",\\"title\\":\\"Sales Executive\\",\\"subtitle\\":\\"Build the future of eCommerce at scale\\",\\"brandId\\":\\"cedcoss\\",\\"brandName\\":\\"CEDCOSS\\",\\"team\\":\\"Sales\\",\\"type\\":\\"Full-time\\",\\"location\\":\\"Remote (Night Shift)\\",\\"status\\":\\"active\\",\\"postedAt\\":\\"2026-07-14T07:50:33.795Z\\",\\"tags\\":[\\"CRM\\",\\"Lead Generation\\"],\\"techStack\\":[\\"HubSpot CRM\\"],\\"applyEmail\\":\\"careers@cedcoss.com\\",\\"whyThisRole\\":{\\"body\\":\\"You will work on global ecommerce products.\\",\\"quote\\":\\"Shape the future of ecommerce.\\"},\\"sections\\":[{\\"title\\":\\"Responsibilities\\",\\"content\\":\\"\\\\u003cul\\\\u003e\\\\u003cli\\\\u003eConnect with potential customers.\\\\u003c/li\\\\u003e\\\\u003cli\\\\u003eFollow up with leads.\\\\u003c/li\\\\u003e\\\\u003c/ul\\\\u003e\\"},{\\"title\\":\\"Requirements\\",\\"content\\":\\"\\\\u003cul\\\\u003e\\\\u003cli\\\\u003eBachelor's degree.\\\\u003c/li\\\\u003e\\\\u003cli\\\\u003eGood communication skills.\\\\u003c/li\\\\u003e\\\\u003c/ul\\\\u003e\\"}],\\"traits\\":[{\\"label\\":\\"Ownership\\"}],\\"snapshot\\":[{\\"label\\":\\"Experience\\",\\"value\\":\\"Freshers\\"},{\\"label\\":\\"Compensation\\",\\"value\\":\\"As per industry standards\\"}]}}]")</script>
  </body>
</html>
`

const PM_DETAIL_HTML = `
<!doctype html>
<html>
  <head>
    <link rel="canonical" href="https://cedcoss.com/careers/performance-marketing-executive" />
  </head>
  <body>
    <script>self.__next_f.push([1,"25:[\\"$\\",\\"$L2f\\",null,{\\"job\\":{\\"id\\":\\"2\\",\\"slug\\":\\"performance-marketing-executive\\",\\"title\\":\\"Performance Marketing Executive\\",\\"subtitle\\":\\"Own paid and growth execution\\",\\"brandId\\":\\"cedcoss\\",\\"brandName\\":\\"CEDCOSS\\",\\"team\\":\\"Marketing\\",\\"type\\":\\"Full-time\\",\\"location\\":\\"Lucknow\\",\\"status\\":\\"active\\",\\"postedAt\\":\\"2026-07-01T10:00:00.000Z\\",\\"tags\\":[\\"SEO\\",\\"Paid Ads\\"],\\"techStack\\":[\\"Google Ads\\"],\\"applyEmail\\":\\"careers@cedcoss.com\\",\\"whyThisRole\\":{\\"body\\":\\"Drive measurable growth.\\",\\"quote\\":\\"Own performance marketing.\\"},\\"sections\\":[{\\"title\\":\\"Responsibilities\\",\\"content\\":\\"\\\\u003cul\\\\u003e\\\\u003cli\\\\u003eRun campaigns.\\\\u003c/li\\\\u003e\\\\u003cli\\\\u003eOptimize conversions.\\\\u003c/li\\\\u003e\\\\u003c/ul\\\\u003e\\"}],\\"traits\\":[{\\"label\\":\\"Speed\\"}],\\"snapshot\\":[{\\"label\\":\\"Experience\\",\\"value\\":\\"2-4 years\\"},{\\"label\\":\\"Compensation\\",\\"value\\":\\"As per industry standards\\"}]}}]")</script>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cedcosstechnologies/script.js')
  } catch {
    assert.fail('Expected Cedcoss Technologies scraper module at ../../scraper/cedcosstechnologies/script.js')
  }
}

test('Cedcoss Technologies parses trusted first-party listing cards and detail payloads', async () => {
  const cedcoss = await loadScriptModule()
  const listings = cedcoss.extractListings(CAREERS_PAGE_HTML)
  const sales = cedcoss.extractJobDetail(SALES_DETAIL_HTML, listings[0])

  assert.equal(cedcoss.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.equal(listings.length, 2)
  assert.equal(sales.title, 'Sales Executive')
  assert.equal(sales.department, 'Sales')
  assert.equal(sales.experienceRequired, 'Freshers')
  assert.deepEqual(sales.requiredSkills, ['CRM', 'Lead Generation'])
})

test('Cedcoss Technologies returns normalized jobs from the first-party listing plus detail pages', async () => {
  const cedcoss = await loadScriptModule()
  const requestedUrls = []

  const jobs = await cedcoss.createCedcossTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cedcoss.CAREERS_URL) return CAREERS_PAGE_HTML
      if (url === 'https://cedcoss.com/careers/sales-executive') return SALES_DETAIL_HTML
      if (url === 'https://cedcoss.com/careers/performance-marketing-executive') return PM_DETAIL_HTML
      throw new Error(`Unexpected Cedcoss URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://cedcoss.com/careers',
    'https://cedcoss.com/careers/sales-executive',
    'https://cedcoss.com/careers/performance-marketing-executive',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Cedcoss Technologies')
  assert.equal(jobs[0].source, 'cedcosstechnologies')
  assert.equal(jobs[0].companyDomain, 'cedcoss.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
