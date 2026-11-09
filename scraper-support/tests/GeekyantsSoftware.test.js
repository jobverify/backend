import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/geekyantssoftware/script.js')

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Join Us in India - GeekyAnts</title>
  </head>
  <body>
    <h1>Join GeekyAnts</h1>
    <p>If you love pushing the boundaries of technology and collaborating with brilliant minds on bold experiments, you'll fit right in.</p>
    <p>Showing 8 results</p>
    <section class="opening-card">
      <a href="https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996">
        <h2>Senior Backend Engineer</h2>
        <p>Bengaluru</p>
        <p>We are looking for a Senior Backend Engineer who can design, build, and evolve complex backend systems.</p>
      </a>
    </section>
    <section class="opening-card">
      <a href="https://topgeek.io/company/geekyants-india-pvt-ltd/openings/legal-associate-dbe6">
        <h2>Legal Associate</h2>
        <p>Bengaluru</p>
        <p>We are looking for a detail-oriented and proactive Legal Associate to join our team at GeekyAnts.</p>
      </a>
    </section>
  </body>
</html>
`

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Join Us in India - GeekyAnts</title>
  </head>
  <body>
    <h1>Join GeekyAnts</h1>
    <p>Build purposeful digital experiences with a team that ships bold products.</p>
    <section class="opening-card">
      <a href="https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-learning--development-specialist-7996">
        <h2>Senior Learning &amp; Development Specialist</h2>
        <p>Bengaluru</p>
        <p>Design and scale learning programs for a growing engineering organization.</p>
      </a>
    </section>
    <section class="opening-card">
      <a href="https://topgeek.io/company/geekyants-india-pvt-ltd/openings/legal-associate--8b45">
        <h2>Legal Associate</h2>
        <p>Bengaluru</p>
        <p>Support contracts, compliance, and cross-functional legal operations.</p>
      </a>
    </section>
  </body>
</html>
`

const BACKEND_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Senior Backend Engineer</h1>
    <p>GeekyAnts India Pvt Ltd</p>
    <p>Posted 6 months ago</p>
    <button>Apply Now</button>
    <div>Salary</div>
    <div>Not Disclosed</div>
    <div>Experience</div>
    <div>6 Years</div>
    <div>Location</div>
    <div>Bengaluru, Karnataka</div>
    <h2>Job Description</h2>
    <p>We are looking for a Senior Backend Engineer who can design, build, and evolve complex backend systems for large-scale applications.</p>
    <ul>
      <li>Build backend systems using Node.js and TypeScript.</li>
      <li>Strong understanding of backend architecture and system design.</li>
    </ul>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/geekyantssoftware/catalog.js')
  } catch {
    assert.fail('Expected Geekyants Software catalog module at ../../scraper/geekyantssoftware/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/geekyantssoftware/script.js')
  } catch {
    assert.fail('Expected Geekyants Software scraper module at ../../scraper/geekyantssoftware/script.js')
  }
}

const buildProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Geekyants Software local catalog captures the verified first-party join page and public topgeek detail pages', async () => {
  const { GEEKYANTS_SOFTWARE_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const geekyants = await loadScriptModule()
  const provider = buildProvider(GEEKYANTS_SOFTWARE_CATALOG)

  assert.equal(defaultCatalog, GEEKYANTS_SOFTWARE_CATALOG)
  assert.equal(provider.source, 'geekyantssoftware')
  assert.equal(provider.companyName, 'Geekyants Software')
  assert.equal(provider.officialBrandName, 'GeekyAnts')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://geekyants.com/en-in')
  assert.equal(provider.companyCareerPage, 'https://geekyants.com/en-in/join-geekyants')
  assert.equal(provider.companyJobsHost, 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings')
  assert.equal(provider.companyDomain, 'geekyants.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-plus-topgeek-detail-pages')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-join-page-plus-topgeek-detail-pages')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-join-page+public-topgeek-opening-detail-pages',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 8)
  assert.match(provider.verifiedSurfaceSummary, /Showing 8 results/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Backend Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Legal Associate/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /geekyantssoftware[\\/]jobs\.json$/i)

  assert.equal(geekyants.PROVIDER_METADATA.source, provider.source)
  assert.equal(geekyants.OFFICIAL_CAREERS_URL, provider.companyCareerPage)
})

test('Geekyants Software exact backlog row resolves from the local catalog without aliases', async () => {
  const { GEEKYANTS_SOFTWARE_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Geekyants Software\n',
    catalog: [buildProvider(GEEKYANTS_SOFTWARE_CATALOG)],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Geekyants Software scraper validates the first-party careers page and normalizes topgeek job details', async () => {
  const geekyants = await loadScriptModule()
  const requestedUrls = []

  const jobs = await geekyants.createGeekyantsSoftwareScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === geekyants.OFFICIAL_CAREERS_URL) return CAREERS_HTML
      if (url === 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996') {
        return BACKEND_DETAIL_HTML
      }

      throw new Error(`Unexpected Geekyants Software URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(geekyants.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(requestedUrls, [
    geekyants.OFFICIAL_CAREERS_URL,
    'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Backend Engineer',
      company: 'Geekyants Software',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: 'senior-backend-engineer-7996',
      requisitionId: 'senior-backend-engineer-7996',
      sourceUrl: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996',
      applyUrl: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996',
      employmentType: null,
      experienceRequired: '6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'We are looking for a Senior Backend Engineer who can design, build, and evolve complex backend systems for large-scale applications.',
        'Build backend systems using Node.js and TypeScript.',
        'Strong understanding of backend architecture and system design.',
      ].join(' '),
      remoteStatus: 'On-site',
      source: 'geekyantssoftware',
      link: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-backend-engineer-7996',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('Geekyants Software accepts the current first-party join page without the legacy exact results copy', async () => {
  const geekyants = await loadScriptModule()

  assert.equal(geekyants.hasOfficialCareersSignal(CURRENT_CAREERS_HTML), true)
  assert.deepEqual(geekyants.extractListingJobs(CURRENT_CAREERS_HTML), [
    {
      title: 'Senior Learning & Development Specialist',
      detailUrl: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/senior-learning--development-specialist-7996',
      jobId: 'senior-learning--development-specialist-7996',
      requisitionId: 'senior-learning--development-specialist-7996',
      locationText: 'Bengaluru',
      summary: 'Design and scale learning programs for a growing engineering organization.',
      department: null,
    },
    {
      title: 'Legal Associate',
      detailUrl: 'https://topgeek.io/company/geekyants-india-pvt-ltd/openings/legal-associate--8b45',
      jobId: 'legal-associate--8b45',
      requisitionId: 'legal-associate--8b45',
      locationText: 'Bengaluru',
      summary: 'Support contracts, compliance, and cross-functional legal operations.',
      department: null,
    },
  ])
})
