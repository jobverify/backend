import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/cambridgetechnologyenterprises/script.js')

const OFFICIAL_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Enterprise AI, Data & SaaS Applications | Cambridge Technology</title>
  </head>
  <body>
    <section>
      <h2>Cambridge Technology</h2>
      <a href="https://cambridgetechnology.freshteam.com/jobs/search?utf8=%E2%9C%93&query=&branch_id=&remote=0&remote=1&commit=Go">See Open Positions</a>
    </section>
  </body>
</html>
`

const CURRENT_OFFICIAL_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Cloud Solutions | Cambridge Technology Inc.</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/services/">Services</a>
      <a href="/careers/">Careers</a>
      <a href="https://cambridgetechnology.freshteam.com/jobs">See Open Positions</a>
    </nav>
    <h1>Unlock Hidden Opportunities with Data and AI</h1>
    <p>Become an AI-first cognitive business with Cambridge Technology.</p>
  </body>
</html>
`

const LISTING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h3>Open Positions</h3>
    <div class="job-role-list" data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_cte_1">
          <div class="role-title">
            <h5>Enterprise Applications <span>- 2 Open Roles</span></h5>
          </div>
          <div class="job-list">
            <a
              href="/jobs/2WE1ZMkfs7C8/business-analyst"
              class="heading"
              data-portal-location="Hyderabad, Telangana"
              data-portal-job-type="2"
              data-portal-remote-location="false"
            >
              <div class="job-list-info">
                <div class="job-title">Business Analyst</div>
                <div class="job-desc text">
                  We are seeking a customer-oriented, analytical Business Analyst with hands-on experience in client delivery.
                </div>
              </div>
              <div class="job-location">
                <div class="location-info">
                  Hyderabad, Telangana
                  <br/>
                  Full Time
                </div>
              </div>
            </a>
            <a
              href="/jobs/remote_only/secops-governance-engineer"
              class="heading"
              data-portal-location="Remote, India"
              data-portal-job-type="2"
              data-portal-remote-location="true"
            >
              <div class="job-list-info">
                <div class="job-title">SecOps &amp; Governance Engineer</div>
                <div class="job-desc text">
                  Secure our cloud infrastructure and governance controls across global delivery teams.
                </div>
              </div>
              <div class="job-location">
                <div class="location-info">
                  Remote, India
                  <br/>
                  Full Time
                </div>
              </div>
            </a>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const ZERO_RESULTS_LISTING_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h2>Careers</h2>
    <p>Choose Location</p>
    <label>Remote jobs only</label>
    <h3>Open Positions</h3>
    <p>No jobs found</p>
  </body>
</html>
`

const BUSINESS_ANALYST_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <div class="job-details">
      <div class="job-details-header">
        <a class="link-back"><i class="icon-arrow-left"></i>Enterprise Applications</a>
        <div class="row">
          <div class="col-xs-8">
            <h1 class="brand-color">Business Analyst</h1>
            <div class="stick-hide-in-mobile text-color">
              Hyderabad, Telangana
              <div>
                Work Type:
                Full Time
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <p>Work with enterprise clients to translate business goals into product requirements.</p>
        <ul>
          <li>Minimum 5+ years of experience in business analysis and stakeholder management.</li>
          <li>Experience with agile delivery and SaaS applications.</li>
        </ul>
      </div>
    </div>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/cambridgetechnologyenterprises/catalog.js')
  } catch {
    assert.fail(
      'Expected Cambridge Technology Enterprises catalog module at ../../scraper/cambridgetechnologyenterprises/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/cambridgetechnologyenterprises/script.js')
  } catch {
    assert.fail(
      'Expected Cambridge Technology Enterprises scraper module at ../../scraper/cambridgetechnologyenterprises/script.js',
    )
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Cambridge Technology Enterprises local catalog captures the verified first-party homepage handoff and Freshteam board', async () => {
  const { CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG, default: defaultCatalog } =
    await loadCatalogModule()
  const cambridge = await loadScriptModule()
  const provider = buildProvider(CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG)

  assert.equal(defaultCatalog, CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG)
  assert.equal(provider.source, 'cambridgetechnologyenterprises')
  assert.equal(provider.companyName, 'Cambridge Technology Enterprises')
  assert.equal(provider.officialBrandName, 'Cambridge Technology')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.ctepl.com/')
  assert.equal(provider.companyCareerPage, 'https://www.ctepl.com/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://cambridgetechnology.freshteam.com/jobs')
  assert.equal(provider.atsPlatform, 'freshteam')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-homepage-plus-first-party-careers-landing-plus-public-freshteam-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-homepage+verified-first-party-careers-landing+public-freshteam-board-or-zero-state+detail-page-apply-surface',
  )
  assert.equal(provider.companyDomain, 'ctepl.com')
  assert.equal(provider.verifiedOn, '2026-10-20')
  assert.equal(provider.verifiedPublicJobCount, 15)
  assert.equal(provider.verifiedIndiaJobCount, 15)
  assert.equal(provider.verifiedInventoryStatus, 'complete-inventory')
  assert.match(provider.verifiedSurfaceSummary, /October 20, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.ctepl\.com\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /cambridgetechnology\.freshteam\.com\/jobs/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /cambridgetechnologyenterprises[\\/]jobs\.json$/i)

  assert.equal(cambridge.PROVIDER_METADATA.source, provider.source)
  assert.equal(cambridge.LISTING_URL, provider.officialJobsBoardUrl)
})

test('Cambridge Technology Enterprises exact backlog row resolves from the local catalog without alias churn', async () => {
  const { CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Cambridge Technology Enterprises\n',
    catalog: [buildProvider(CAMBRIDGE_TECHNOLOGY_ENTERPRISES_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.totalRows, 1)
  assert.equal(report.candidateRows, 1)
  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Cambridge Technology Enterprises scraper validates the homepage handoff, parses Freshteam jobs, and decorates output', async () => {
  const cambridge = await loadScriptModule()
  const requestedUrls = []

  const jobs = await cambridge.createCambridgeTechnologyEnterprisesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cambridge.OFFICIAL_HOMEPAGE_URL) return OFFICIAL_HOMEPAGE_HTML
      if (url === cambridge.LISTING_URL) return LISTING_HTML
      if (url === 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst') {
        return BUSINESS_ANALYST_DETAIL_HTML
      }

      throw new Error(`Unexpected Cambridge Technology Enterprises URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(cambridge.hasOfficialHomepageSignal(OFFICIAL_HOMEPAGE_HTML), true)
  assert.equal(
    cambridge.extractFreshteamJobsUrl(OFFICIAL_HOMEPAGE_HTML),
    'https://cambridgetechnology.freshteam.com/jobs/search?utf8=%E2%9C%93&query=&branch_id=&remote=0&remote=1&commit=Go',
  )
  assert.equal(cambridge.hasOfficialJobsBoardSignal(LISTING_HTML), true)
  assert.deepEqual(requestedUrls, [
    cambridge.OFFICIAL_HOMEPAGE_URL,
    cambridge.LISTING_URL,
    'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Business Analyst',
      company: 'Cambridge Technology Enterprises',
      department: 'Enterprise Applications',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: '2WE1ZMkfs7C8',
      requisitionId: '2WE1ZMkfs7C8',
      sourceUrl: 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst',
      applyUrl: 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst',
      employmentType: 'Full-time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'Work with enterprise clients to translate business goals into product requirements.',
        'Minimum 5+ years of experience in business analysis and stakeholder management.',
        'Experience with agile delivery and SaaS applications.',
      ].join(' '),
      remoteStatus: 'On-site',
      source: 'cambridgetechnologyenterprises',
      sourceListingComplete: false,
      link: 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Cambridge Technology Enterprises returns [] when the verified Freshteam board is in the current zero-results state', async () => {
  const cambridge = await loadScriptModule()

  const jobs = await cambridge.createCambridgeTechnologyEnterprisesScraper().run({
    fetchText: async (url) => {
      if (url === cambridge.OFFICIAL_HOMEPAGE_URL) return OFFICIAL_HOMEPAGE_HTML
      if (url === cambridge.LISTING_URL) {
        return ZERO_RESULTS_LISTING_HTML
      }

      throw new Error(`Unexpected Cambridge Technology Enterprises URL: ${url}`)
    },
  })

  assert.equal(cambridge.hasOfficialJobsBoardSignal(ZERO_RESULTS_LISTING_HTML), true)
  assert.deepEqual(jobs, [])
})

test('Cambridge Technology Enterprises accepts the current homepage handoff and can use the direct Freshteam link without the legacy careers hop', async () => {
  const cambridge = await loadScriptModule()
  const requestedUrls = []

  const jobs = await cambridge.createCambridgeTechnologyEnterprisesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cambridge.OFFICIAL_HOMEPAGE_URL) return CURRENT_OFFICIAL_HOMEPAGE_HTML
      if (url === cambridge.LISTING_URL) return LISTING_HTML
      if (url === 'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst') {
        return BUSINESS_ANALYST_DETAIL_HTML
      }

      throw new Error(`Unexpected Cambridge Technology Enterprises URL: ${url}`)
    },
    now: () => '2026-08-18T00:00:00.000Z',
  })

  assert.equal(cambridge.hasOfficialHomepageSignal(CURRENT_OFFICIAL_HOMEPAGE_HTML), true)
  assert.equal(
    cambridge.extractFreshteamJobsUrl(CURRENT_OFFICIAL_HOMEPAGE_HTML),
    'https://cambridgetechnology.freshteam.com/jobs',
  )
  assert.deepEqual(requestedUrls, [
    cambridge.OFFICIAL_HOMEPAGE_URL,
    cambridge.LISTING_URL,
    'https://cambridgetechnology.freshteam.com/jobs/2WE1ZMkfs7C8/business-analyst',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'cambridgetechnologyenterprises')
  assert.equal(jobs[0].jobId, '2WE1ZMkfs7C8')
  assert.equal(jobs[0].scrapedAt, '2026-08-18T00:00:00.000Z')
})
