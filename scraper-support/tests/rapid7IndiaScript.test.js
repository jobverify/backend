import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const SEARCH_PAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Search Page</title>
  </head>
  <body>
    <main>
      <h1>Search All Roles</h1>
      <table>
        <tbody>
          <tr role="link" data-job-url="https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india">
            <td class="job-search-results-title">
              <a href="https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india">
                Senior Software Engineer - Python
              </a>
            </td>
            <td class="job-search-results-requisition-identifiers" aria-label="Requisition Identifier: R11371">R11371</td>
            <td class="job-search-results-department">
              <ul>
                <li aria-label="Department: Product &amp; Engineering">Product &amp; Engineering</li>
              </ul>
            </td>
            <td class="job-search-results-location">
              <ul>
                <li aria-label="Location: Pune, India">Pune, India</li>
              </ul>
            </td>
            <td class="job-search-results-workplace-types">Hybrid</td>
          </tr>
          <tr role="link" data-job-url="https://careers.rapid7.com/jobs/director-financial-planning-analysis-sales-and-marketing-boston-ma-united-states">
            <td class="job-search-results-title">
              <a href="https://careers.rapid7.com/jobs/director-financial-planning-analysis-sales-and-marketing-boston-ma-united-states">
                Director, Financial Planning &amp; Analysis - Sales and Marketing
              </a>
            </td>
            <td class="job-search-results-requisition-identifiers" aria-label="Requisition Identifier: R11872">R11872</td>
            <td class="job-search-results-department">
              <ul>
                <li aria-label="Department: Finance">Finance</li>
              </ul>
            </td>
            <td class="job-search-results-location">
              <ul>
                <li aria-label="Location: Boston, MA, United States">Boston, MA, United States</li>
              </ul>
            </td>
            <td class="job-search-results-workplace-types">Hybrid</td>
          </tr>
        </tbody>
      </table>
      <p>Displaying all 2 entries</p>
      <footer>
        <a href="https://www.rapid7.com/careers">Careers</a>
      </footer>
      <a id="link_candidate_details" href="/v1/candidate_details">Candidate Details</a>
      <div>Rapid7 Chatbot</div>
    </main>
  </body>
</html>
`

const PAGE_2_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Search Page</title>
  </head>
  <body>
    <main>
      <h1>Search All Roles</h1>
      <table>
        <tbody>
          <tr role="link" data-job-url="https://careers.rapid7.com/jobs/technical-support-engineer-i-pune-india">
            <td class="job-search-results-title">
              <a href="https://careers.rapid7.com/jobs/technical-support-engineer-i-pune-india">
                Technical Support Engineer-I
              </a>
            </td>
            <td class="job-search-results-requisition-identifiers" aria-label="Requisition Identifier: R11886">R11886</td>
            <td class="job-search-results-department">
              <ul>
                <li aria-label="Department: Customer Success">Customer Success</li>
              </ul>
            </td>
            <td class="job-search-results-location">
              <ul>
                <li aria-label="Location: Pune, India">Pune, India</li>
              </ul>
            </td>
            <td class="job-search-results-workplace-types">Remote</td>
          </tr>
        </tbody>
      </table>
      <p>Displaying all 1 entries</p>
      <div>Rapid7 Chatbot</div>
    </main>
  </body>
</html>
`

const EMPTY_INDIA_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Search Page</title>
  </head>
  <body>
    <main>
      <h1>Search All Roles</h1>
      <table>
        <tbody>
          <tr role="link" data-job-url="https://careers.rapid7.com/jobs/channel-account-manager-cdw-ma-united-states">
            <td class="job-search-results-title">
              <a href="https://careers.rapid7.com/jobs/channel-account-manager-cdw-ma-united-states">
                Channel Account Manager
              </a>
            </td>
            <td class="job-search-results-requisition-identifiers" aria-label="Requisition Identifier: R11723">R11723</td>
            <td class="job-search-results-department">
              <ul>
                <li aria-label="Department: Sales">Sales</li>
              </ul>
            </td>
            <td class="job-search-results-location">
              <ul>
                <li aria-label="Location: MA, United States">MA, United States</li>
              </ul>
            </td>
            <td class="job-search-results-workplace-types">Hybrid</td>
          </tr>
        </tbody>
      </table>
      <p>Displaying all 1 entries</p>
      <div>Rapid7 Chatbot</div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rapid7india/script.js')
  } catch {
    assert.fail('Expected Rapid7 India scraper module at ../../scraper/rapid7india/script.js')
  }
}

test('Rapid7 India pins the verified first-party search page contract and extracts India rows only', async () => {
  const rapid7India = await loadModule()

  assert.equal(rapid7India.SOURCE, 'rapid7india')
  assert.equal(rapid7India.COMPANY_NAME, 'Rapid7 India')
  assert.equal(rapid7India.OFFICIAL_BRAND_NAME, 'Rapid7')
  assert.equal(rapid7India.SEARCH_PAGE_URL, 'https://careers.rapid7.com/jobs/search')
  assert.equal(
    rapid7India.buildSearchPageUrl(1),
    'https://careers.rapid7.com/jobs/search',
  )
  assert.equal(
    rapid7India.buildSearchPageUrl(2),
    'https://careers.rapid7.com/jobs/search?page=2',
  )
  assert.equal(rapid7India.hasOfficialRapid7SearchPageSignal(SEARCH_PAGE_HTML), true)
  assert.deepEqual(rapid7India.extractJobCardsFromSearchPage(SEARCH_PAGE_HTML), [
    {
      title: 'Senior Software Engineer - Python',
      requisitionId: 'R11371',
      department: 'Product & Engineering',
      location: 'Pune, India',
      workplaceType: 'Hybrid',
      sourceUrl: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
      applyUrl: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
    },
    {
      title: 'Director, Financial Planning & Analysis - Sales and Marketing',
      requisitionId: 'R11872',
      department: 'Finance',
      location: 'Boston, MA, United States',
      workplaceType: 'Hybrid',
      sourceUrl:
        'https://careers.rapid7.com/jobs/director-financial-planning-analysis-sales-and-marketing-boston-ma-united-states',
      applyUrl:
        'https://careers.rapid7.com/jobs/director-financial-planning-analysis-sales-and-marketing-boston-ma-united-states',
    },
  ])
  assert.deepEqual(
    rapid7India.extractIndiaJobsFromCards(rapid7India.extractJobCardsFromSearchPage(SEARCH_PAGE_HTML), FIXED_SCRAPED_AT),
    [
      {
        title: 'Senior Software Engineer - Python',
        company: 'Rapid7 India',
        department: 'Product & Engineering',
        location: 'Pune, India',
        city: 'Pune',
        country: 'India',
        jobId: 'R11371',
        requisitionId: 'R11371',
        sourceUrl: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
        applyUrl: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: 'Hybrid',
        source: 'rapid7india',
        link: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Rapid7 India run walks first-party search pages and returns only India jobs', async () => {
  const rapid7India = await loadModule()
  const requestedUrls = []

  const jobs = await rapid7India.createRapid7IndiaScraper({
    now: () => FIXED_SCRAPED_AT,
    maxPages: 3,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === rapid7India.SEARCH_PAGE_URL) return SEARCH_PAGE_HTML
      if (url === `${rapid7India.SEARCH_PAGE_URL}?page=2`) return PAGE_2_HTML
      if (url === `${rapid7India.SEARCH_PAGE_URL}?page=3`) return '<html><body><table><tbody></tbody></table></body></html>'

      throw new Error(`Unexpected Rapid7 India URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    rapid7India.SEARCH_PAGE_URL,
    `${rapid7India.SEARCH_PAGE_URL}?page=2`,
    `${rapid7India.SEARCH_PAGE_URL}?page=3`,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      location: job.location,
      remoteStatus: job.remoteStatus,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Senior Software Engineer - Python',
        jobId: 'R11371',
        location: 'Pune, India',
        remoteStatus: 'Hybrid',
        link: 'https://careers.rapid7.com/jobs/senior-software-engineer-python-pune-india',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Technical Support Engineer-I',
        jobId: 'R11886',
        location: 'Pune, India',
        remoteStatus: 'Remote',
        link: 'https://careers.rapid7.com/jobs/technical-support-engineer-i-pune-india',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Rapid7 India returns an honest empty array when the verified official search page exposes no India rows', async () => {
  const rapid7India = await loadModule()

  const jobs = await rapid7India.createRapid7IndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === rapid7India.SEARCH_PAGE_URL) return EMPTY_INDIA_HTML
      throw new Error(`Unexpected Rapid7 India URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Rapid7 India fails closed when the verified first-party search page drifts materially', async () => {
  const rapid7India = await loadModule()

  await assert.rejects(
    rapid7India.createRapid7IndiaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified rapid7 search page/i,
  )
})
