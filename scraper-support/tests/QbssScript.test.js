import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const FIXED_SCRAPED_AT = '2026-08-13T00:00:00.000Z'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/qbss/script.js')

const VERIFIED_LISTING_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Grow professionally. Contribute meaningfully. Succeed together.</h1>
      <section>JOBS AT CONTINUSERVE</section>
      <section>JOBS AT OUR CLIENTS</section>
      <h2>JOB OPENINGS</h2>
      <p>View our open positions</p>
      <a href="https://continuserve.com/careers/sr-network-engineer/">Sr. Network Engineer</a>
      <a href="https://continuserve.com/careers/sr-network-engineer/">Sr. Network Engineer</a>
      <a href="https://continuserve.com/careers/senior-associate-record-to-report/">Senior Associate- Record to Report</a>
      <a href="https://continuserve.com/careers/senior-manager-human-resources-and-operations/">Senior Manager, Human Resources and Operations</a>
      <a href="https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/">Director of Accounting - Not-For-Profit</a>
      <a href="http://continuserve.com/careers/?career_type=internal&country=#career-listings">Jobs at Continuserve</a>
      <a href="http://continuserve.com/careers/">IT Support Services Provider Careers</a>
    </main>
  </body>
</html>
`

const INTERNAL_INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sr. Network Engineer - ContinuServe</title>
  </head>
  <body>
    <main>
      <h1>Sr. Network Engineer</h1>
      <p>Required Experience: 9 to 15 years</p>
      <p>Work Mode: Remote (Work from Home)</p>
      <p>Shift: 24×7 Shift Support</p>
      <div class="entry-content">
        <p>Provide L2/L3 network support for global customers.</p>
        <p>Maintain firewalls and routing platforms.</p>
      </div>
      <h2>DETAILS</h2>
      <div class="hart-career-details">
        <table>
          <tbody>
            <tr><th>Company</th><td>ContinuServe</td></tr>
            <tr><th>Division</th><td>Technology</td></tr>
            <tr><th>Country</th><td>India</td></tr>
            <tr><th>Type</th><td>Jobs at ContinuServe</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button">Apply Now</button>
    </main>
  </body>
</html>
`

const SECOND_INTERNAL_INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Associate- Record to Report - ContinuServe</title>
  </head>
  <body>
    <main>
      <h1>Senior Associate- Record to Report</h1>
      <div class="entry-content">
        <p>The role will apply principles of accounting to analyze financial information and prepare financial reports.</p>
      </div>
      <h2>DETAILS</h2>
      <div class="hart-career-details">
        <table>
          <tbody>
            <tr><th>Company</th><td>ContinuServe</td></tr>
            <tr><th>Division</th><td>MME ( Mid Market Enterprise)</td></tr>
            <tr><th>Country</th><td>India</td></tr>
            <tr><th>Type</th><td>Jobs at ContinuServe</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button">Apply Now</button>
    </main>
  </body>
</html>
`

const USA_INTERNAL_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Director of Accounting - Not-For-Profit - ContinuServe Talent Network - ContinuServe</title>
  </head>
  <body>
    <main>
      <h1>Director of Accounting - Not-For-Profit - ContinuServe Talent Network</h1>
      <div class="entry-content">
        <p>Lead accounting operations for the nonprofit division.</p>
      </div>
      <h2>DETAILS</h2>
      <div class="hart-career-details">
        <table>
          <tbody>
            <tr><th>Company</th><td>ContinuServe</td></tr>
            <tr><th>Division</th><td>Nonprofit</td></tr>
            <tr><th>Country</th><td>USA</td></tr>
            <tr><th>Type</th><td>Jobs at ContinuServe</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button">Apply Now</button>
    </main>
  </body>
</html>
`

const CLIENT_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Manager, Human Resources and Operations - ContinuServe</title>
  </head>
  <body>
    <main>
      <h1>Senior Manager, Human Resources and Operations</h1>
      <div class="entry-content">
        <p>Support a strategic human resources engagement for a nonprofit client.</p>
      </div>
      <h2>DETAILS</h2>
      <div class="hart-career-details">
        <table>
          <tbody>
            <tr><th>Company</th><td>Ralph C. Wilson, Jr. Foundation</td></tr>
            <tr><th>Country</th><td>USA</td></tr>
            <tr><th>Type</th><td>Jobs at our clients</td></tr>
          </tbody>
        </table>
      </div>
      <button type="button">Apply Now</button>
    </main>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/qbss/catalog.js')
  } catch {
    assert.fail('Expected Qbss catalog module at ../../scraper/qbss/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/qbss/script.js')
  } catch {
    assert.fail('Expected Qbss scraper module at ../../scraper/qbss/script.js')
  }
}

test('Qbss local catalog captures the verified ContinuServe rebrand careers contract', async () => {
  const { QBSS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(QBSS_CATALOG)

  assert.equal(defaultCatalog, QBSS_CATALOG)
  assert.equal(provider.source, 'qbss')
  assert.equal(provider.companyName, 'Qbss')
  assert.equal(provider.officialBrandName, 'ContinuServe')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://continuserve.com/careers/')
  assert.equal(provider.legacyCareerPage, 'https://www.quatrrobss.com/careers/')
  assert.equal(provider.workingAtUrl, 'https://www.quatrrobss.com/working-at-quatrro/')
  assert.equal(provider.companyDomain, 'continuserve.com')
  assert.equal(provider.atsPlatform, 'verified-rebrand-continuserve-careers-wordpress')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-continuserve-listing-page-plus-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-qbss-legacy-redirects+continuserve-detail-links+india-internal-detail-table-filter',
  )
  assert.equal(provider.verifiedOn, '2026-08-13')
  assert.equal(provider.verifiedPublicJobCount, 17)
  assert.equal(provider.verifiedIndiaJobCount, 6)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /ContinuServe/i)
  assert.match(provider.verifiedSurfaceSummary, /17/i)
  assert.match(provider.verifiedSurfaceSummary, /6 India/i)
})

test('Qbss extracts unique ContinuServe detail URLs from the verified careers listing', async () => {
  const qbss = await loadScriptModule()

  assert.equal(typeof qbss.extractContinuServeDetailUrls, 'function')
  assert.deepEqual(qbss.extractContinuServeDetailUrls(VERIFIED_LISTING_HTML), [
    'https://continuserve.com/careers/sr-network-engineer/',
    'https://continuserve.com/careers/senior-associate-record-to-report/',
    'https://continuserve.com/careers/senior-manager-human-resources-and-operations/',
    'https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/',
  ])
})

test('Qbss maps verified India internal detail pages into jobs and filters out non-India or client roles', async () => {
  const qbss = await loadScriptModule()

  assert.equal(typeof qbss.extractContinuServeJob, 'function')

  assert.deepEqual(qbss.extractContinuServeJob({
    url: 'https://continuserve.com/careers/sr-network-engineer/',
    html: INTERNAL_INDIA_DETAIL_HTML,
    scrapedAt: FIXED_SCRAPED_AT,
  }), {
    title: 'Sr. Network Engineer',
    company: 'Qbss',
    department: 'Technology',
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'sr-network-engineer',
    requisitionId: 'sr-network-engineer',
    sourceUrl: 'https://continuserve.com/careers/sr-network-engineer/',
    applyUrl: 'https://continuserve.com/careers/sr-network-engineer/',
    employmentType: null,
    experienceRequired: '9 to 15 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Provide L2/L3 network support for global customers. Maintain firewalls and routing platforms.',
    remoteStatus: 'Remote',
    source: 'qbss',
    link: 'https://continuserve.com/careers/sr-network-engineer/',
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.equal(qbss.extractContinuServeJob({
    url: 'https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/',
    html: USA_INTERNAL_DETAIL_HTML,
    scrapedAt: FIXED_SCRAPED_AT,
  }), null)

  assert.equal(qbss.extractContinuServeJob({
    url: 'https://continuserve.com/careers/senior-manager-human-resources-and-operations/',
    html: CLIENT_DETAIL_HTML,
    scrapedAt: FIXED_SCRAPED_AT,
  }), null)
})

test('Qbss returns only India internal ContinuServe roles from the verified rebrand careers contract', async () => {
  const qbss = await loadScriptModule()
  const scraper = qbss.createQbssScraper({
    now: () => FIXED_SCRAPED_AT,
  })

  const jobs = await scraper.run({
    loadLiveCareersContract: async () => ({
      listingUrl: 'https://continuserve.com/careers/',
      listingHtml: VERIFIED_LISTING_HTML,
      detailPages: [
        {
          url: 'https://continuserve.com/careers/sr-network-engineer/',
          html: INTERNAL_INDIA_DETAIL_HTML,
        },
        {
          url: 'https://continuserve.com/careers/senior-associate-record-to-report/',
          html: SECOND_INTERNAL_INDIA_DETAIL_HTML,
        },
        {
          url: 'https://continuserve.com/careers/senior-manager-human-resources-and-operations/',
          html: CLIENT_DETAIL_HTML,
        },
        {
          url: 'https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/',
          html: USA_INTERNAL_DETAIL_HTML,
        },
      ],
    }),
  })

  assert.deepEqual(jobs, [
    {
      title: 'Sr. Network Engineer',
      company: 'Qbss',
      department: 'Technology',
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'sr-network-engineer',
      requisitionId: 'sr-network-engineer',
      sourceUrl: 'https://continuserve.com/careers/sr-network-engineer/',
      applyUrl: 'https://continuserve.com/careers/sr-network-engineer/',
      employmentType: null,
      experienceRequired: '9 to 15 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Provide L2/L3 network support for global customers. Maintain firewalls and routing platforms.',
      remoteStatus: 'Remote',
      source: 'qbss',
      link: 'https://continuserve.com/careers/sr-network-engineer/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Senior Associate- Record to Report',
      company: 'Qbss',
      department: 'MME ( Mid Market Enterprise)',
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'senior-associate-record-to-report',
      requisitionId: 'senior-associate-record-to-report',
      sourceUrl: 'https://continuserve.com/careers/senior-associate-record-to-report/',
      applyUrl: 'https://continuserve.com/careers/senior-associate-record-to-report/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'The role will apply principles of accounting to analyze financial information and prepare financial reports.',
      remoteStatus: null,
      source: 'qbss',
      link: 'https://continuserve.com/careers/senior-associate-record-to-report/',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Qbss exposes a live HTTP loader that preserves the verified careers contract shape', async () => {
  const qbss = await loadScriptModule()

  const contract = await qbss.loadLiveCareersContractFromHttp({
    fetchText: async (url) => {
      if (url === qbss.CAREERS_URL) {
        return VERIFIED_LISTING_HTML
      }

      const htmlByUrl = new Map([
        ['https://continuserve.com/careers/sr-network-engineer/', INTERNAL_INDIA_DETAIL_HTML],
        ['https://continuserve.com/careers/senior-associate-record-to-report/', SECOND_INTERNAL_INDIA_DETAIL_HTML],
        ['https://continuserve.com/careers/senior-manager-human-resources-and-operations/', CLIENT_DETAIL_HTML],
        ['https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/', USA_INTERNAL_DETAIL_HTML],
      ])

      const html = htmlByUrl.get(url)
      if (!html) {
        assert.fail(`Unexpected QBSS detail URL: ${url}`)
      }

      return html
    },
  })

  assert.equal(contract.listingUrl, qbss.CAREERS_URL)
  assert.equal(contract.listingHtml, VERIFIED_LISTING_HTML)
  assert.equal(contract.detailPages.length, 4)
  assert.deepEqual(
    contract.detailPages.map((page) => page.url),
    [
      'https://continuserve.com/careers/sr-network-engineer/',
      'https://continuserve.com/careers/senior-associate-record-to-report/',
      'https://continuserve.com/careers/senior-manager-human-resources-and-operations/',
      'https://continuserve.com/careers/director-of-accounting-not-for-profit-continuserve-talent-network/',
    ],
  )
})
