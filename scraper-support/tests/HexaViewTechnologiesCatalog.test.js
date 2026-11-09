import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hexaviewtechnologies/script.js')

const LANDING_FIXTURE = `
  <title>Careers | Join Hexaview Technologies Team</title>
  <h1>Join Team of Innovators</h1>
  <h2>Build the Best Work of Your Life</h2>
  <a href="/job-listing" class="button-primary w-button">Join Our Team</a>
`

const LISTING_PAGE_ONE_FIXTURE = `
  <title>Job Openings | Hexaview Technologies</title>
  <div role="listitem" class="job-list-item w-dyn-item">
    <div class="job-list-box">
      <div class="job-list-top-wrap">
        <div class="job-list-left-wrap">
          <div class="job-list-column">
            <h2 fs-cmsfilter-field="name" class="title-semibold-h6">Automation QA Engineer</h2>
            <div fs-cmsfilter-field="company-name" class="job-company-name">Hexaview Technologies</div>
          </div>
          <div class="job-list-column">
            <div class="job-list-info-flex">
              <div class="job-list-gray-tag">Fulltime</div>
              <div class="job-list-gray-tag">Hybrid</div>
            </div>
          </div>
          <div class="job-list-column-last">
            <div fs-cmsfilter-field="location" class="job-location">Noida/Bangalore</div>
          </div>
        </div>
        <div class="job-list-right-wrap">
          <a href="/job-openings/automation-qa-engineer-noida" class="job-apply-button w-button">Apply Now</a>
        </div>
      </div>
      <div class="job-list-body">
        <div class="job-body-content">
          <div class="job-body-rich-text w-richtext">
            <p><strong>What you'll do:</strong></p>
            <ul role="list"><li>Design automated test plans.</li></ul>
          </div>
        </div>
      </div>
    </div>
    <div class="job-category-hide w-dyn-list">
      <div role="list" class="w-dyn-items">
        <div role="listitem" class="w-dyn-item"><div fs-cmsfilter-field="category">Quality Assurance</div></div>
      </div>
    </div>
  </div>
  <div role="navigation" aria-label="List" class="w-pagination-wrapper blog-pagination-wrap">
    <a fs-cmsload-mode="load-under" href="?08138489_page=2" aria-label="Next Page" class="w-pagination-next button-secondary blog-pagination">
      <div class="w-inline-block">Load More Opportunities</div>
    </a>
  </div>
`

const LISTING_PAGE_TWO_FIXTURE = `
  <title>Job Openings | Hexaview Technologies</title>
  <div role="listitem" class="job-list-item w-dyn-item">
    <div class="job-list-box">
      <div class="job-list-top-wrap">
        <div class="job-list-left-wrap">
          <div class="job-list-column">
            <h2 fs-cmsfilter-field="name" class="title-semibold-h6">Full Stack Developer</h2>
            <div fs-cmsfilter-field="company-name" class="job-company-name">Hexaview Technologies</div>
          </div>
          <div class="job-list-column">
            <div class="job-list-info-flex">
              <div class="job-list-gray-tag">Fulltime</div>
              <div class="job-list-gray-tag">Hybrid</div>
            </div>
          </div>
          <div class="job-list-column-last">
            <div fs-cmsfilter-field="location" class="job-location">Bangalore</div>
          </div>
        </div>
        <div class="job-list-right-wrap">
          <a href="/job-openings/full-stack-developer" class="job-apply-button w-button">Apply Now</a>
        </div>
      </div>
      <div class="job-list-body">
        <div class="job-body-content">
          <div class="job-body-rich-text w-richtext">
            <p><strong>Key Responsibilities:</strong></p>
            <ul role="list"><li>Build scalable web applications.</li></ul>
          </div>
        </div>
      </div>
    </div>
    <div class="job-category-hide w-dyn-list">
      <div role="list" class="w-dyn-items">
        <div role="listitem" class="w-dyn-item"><div fs-cmsfilter-field="category">Engineering &amp; Development</div></div>
      </div>
    </div>
  </div>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hexaviewtechnologies/catalog.js')
  } catch {
    assert.fail('Expected HexaView Technologies catalog module at ../../scraper/hexaviewtechnologies/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hexaviewtechnologies/script.js')
  } catch {
    assert.fail('Expected HexaView Technologies scraper module at ../../scraper/hexaviewtechnologies/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('HexaView Technologies local catalog captures the verified first-party careers landing and paginated jobs surface', async () => {
  const { HEXAVIEW_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(HEXAVIEW_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, HEXAVIEW_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'hexaviewtechnologies')
  assert.equal(provider.companyName, 'HexaView Technologies')
  assert.equal(provider.officialBrandName, 'Hexaview Technologies')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.hexaviewtech.com/')
  assert.equal(provider.companyCareerPage, 'https://www.hexaviewtech.com/corporate-overview/careers')
  assert.equal(provider.jobListingUrl, 'https://www.hexaviewtech.com/job-listing')
  assert.equal(provider.companyDomain, 'hexaviewtech.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'finsweet-cms-load-more-pagination')
  assert.equal(provider.extractionStrategy, 'verified-first-party-webflow-jobs-page+relative-apply-links')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.hexaviewtech\.com\/corporate-overview\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.hexaviewtech\.com\/job-listing/i)
  assert.match(provider.verifiedSurfaceSummary, /Automation QA Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Load More Opportunities/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /hexaviewtechnologies[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'HexaView Technologies\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('HexaView Technologies scraper follows the verified jobs pagination and extracts first-party role details', async () => {
  const hexaview = await loadScriptModule()
  const scraper = hexaview.createHexaViewTechnologiesScraper({
    now: () => '2026-07-18T12:00:00.000Z',
  })

  assert.equal(hexaview.hasOfficialCareersLandingSignal(LANDING_FIXTURE), true)
  assert.equal(hexaview.hasOfficialJobListingSignal(LISTING_PAGE_ONE_FIXTURE), true)
  assert.equal(hexaview.extractNextPagePath(LISTING_PAGE_ONE_FIXTURE), '?08138489_page=2')

  const visited = []
  const jobs = await scraper.run({
    fetchText: async (url) => {
      visited.push(url)
      if (url === hexaview.CAREERS_URL) return LANDING_FIXTURE
      if (url === hexaview.JOB_LISTING_URL) return LISTING_PAGE_ONE_FIXTURE
      if (url === 'https://www.hexaviewtech.com/job-listing?08138489_page=2') return LISTING_PAGE_TWO_FIXTURE
      assert.fail(`Unexpected URL requested by HexaView scraper: ${url}`)
    },
  })

  assert.deepEqual(visited, [
    'https://www.hexaviewtech.com/corporate-overview/careers',
    'https://www.hexaviewtech.com/job-listing',
    'https://www.hexaviewtech.com/job-listing?08138489_page=2',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      applyUrl: job.applyUrl,
      employmentType: job.employmentType,
      remoteStatus: job.remoteStatus,
      city: job.city,
      locations: job.locations,
    })),
    [
      {
        title: 'Automation QA Engineer',
        location: 'Noida/Bangalore, India',
        applyUrl: 'https://www.hexaviewtech.com/job-openings/automation-qa-engineer-noida',
        employmentType: 'Full-time',
        remoteStatus: 'Hybrid',
        city: 'Noida',
        locations: ['Noida', 'Bangalore'],
      },
      {
        title: 'Full Stack Developer',
        location: 'Bangalore, India',
        applyUrl: 'https://www.hexaviewtech.com/job-openings/full-stack-developer',
        employmentType: 'Full-time',
        remoteStatus: 'Hybrid',
        city: 'Bangalore',
        locations: ['Bangalore'],
      },
    ],
  )
})

test('Hexaview current button styling preserves distinct native role identities', async () => {
  const scraper = await loadScriptModule()
  const jobs = await scraper.run({ fetchText: async url => url === scraper.CAREERS_URL ? LANDING_FIXTURE
    : url.includes('page=2') ? LISTING_PAGE_TWO_FIXTURE.replace('job-apply-button', 'button-primary')
      : LISTING_PAGE_ONE_FIXTURE.replace('job-apply-button', 'button-primary') })
  assert.equal(jobs.length, 2)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 2)
  assert.ok(jobs.every(job => !job.sourceUrl.includes('undefined') && job.sourceUrl.includes('/job-openings/')))
})

test('Hexaview missing or foreign role links fail instead of inventing an undefined URL', async () => {
  const scraper = await loadScriptModule()
  for (const replacement of ['', 'href="https://unrelated.example/job-openings/automation-qa-engineer-noida"']) {
    const listing = LISTING_PAGE_ONE_FIXTURE.replace('href="/job-openings/automation-qa-engineer-noida"', replacement)
      + '<a href="/job-openings/another-native-role">Another opening</a>'
    await assert.rejects(scraper.run({ fetchText: async url => url === scraper.CAREERS_URL ? LANDING_FIXTURE : listing }), /verified native Apply Now link/)
  }
})
