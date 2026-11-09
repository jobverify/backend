import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const finacusModulePath = path.resolve(currentDir, '../../scraper/finacussolutions/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Finacus Solutions</title>
  </head>
  <body>
    <h2>Current Openings</h2>
    <div class="roles">
      <a data-id="233" class="btn-ca positionget" data-career-position="Sales Coordinator  ">Apply</a>
      <a data-id="234" class="btn-ca positionget" data-career-position="React. JS Developer">Apply</a>
    </div>
    <h3>Apply Now</h3>
    <footer>Finacus Solutions Private Limited</footer>
  </body>
</html>
`

const detailHtml = `
<h3>Sales Coordinator</h3>
<div class="career-posttop"></div>
<div class="career-offset-content bullet-list singlepostcontent">
  <ul>
    <li><strong>Department</strong> : Sales</li>
    <li><strong>Designation</strong> : Sales Coordinator</li>
    <li><strong>Open Positions</strong> : 2 Position</li>
    <li><strong>Location</strong> : Mumbai</li>
    <li><strong>Gender</strong> : Female/ Male</li>
    <li><strong>Work Experience</strong> : 2+ years</li>
  </ul>
  <h5>Key Skills</h5>
  <ul>
    <li>Strong organizational and multitasking abilities.</li>
    <li>Excellent communication and interpersonal skills.</li>
  </ul>
  <h4>Role &amp; Responsibility</h4>
  <ol>
    <li>Coordinate and follow up with clients on sales leads.</li>
    <li>Prepare and present detailed and accurate sales reports.</li>
  </ol>
</div>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/finacussolutions/catalog.js')
  } catch {
    assert.fail('Expected Finacus Solutions catalog module at ../../scraper/finacussolutions/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/finacussolutions/script.js')
  } catch {
    assert.fail('Expected Finacus Solutions scraper module at ../../scraper/finacussolutions/script.js')
  }
}

test('Finacus Solutions local catalog captures the verified first-party careers page', async () => {
  const { FINACUS_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const finacus = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(FINACUS_SOLUTIONS_CATALOG)

  assert.equal(defaultCatalog, FINACUS_SOLUTIONS_CATALOG)
  assert.equal(provider.source, 'finacussolutions')
  assert.equal(provider.companyName, 'Finacus Solutions')
  assert.equal(provider.officialBrandName, 'Finacus Solutions Private Limited')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.finacus.co.in/')
  assert.equal(provider.companyCareerPage, 'https://www.finacus.co.in/careers/')
  assert.equal(provider.companyDomain, 'finacus.co.in')
  assert.equal(provider.atsPlatform, 'official-company-careers-page')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'stable-current-visible-cards-global-total-unavailable')
  assert.equal(
    provider.extractionStrategy,
    'current-public-GET-details+original-native-models+unknown-country-without-own-country-field+incomplete-source-scope',
  )
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.modulePath, finacusModulePath)
  assert.match(provider.verifiedSurfaceSummary, /inventory remains partial/i)
  assert.equal(finacus.PROVIDER_METADATA.source, FINACUS_SOLUTIONS_CATALOG.source)

  const report = generateCompanyCoverageReport({
    csvText: 'Finacus Solutions\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Finacus Solutions run validates the first-party careers page and maps inline role cards', async () => {
  const finacus = await loadScriptModule()

  assert.equal(finacus.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(finacus.extractSearchResults(careersHtml), [
    {
      title: 'Sales Coordinator',
      company: 'Finacus Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: '233',
      requisitionId: '233',
      sourceUrl: 'https://www.finacus.co.in/careers/',
      applyUrl: 'https://www.finacus.co.in/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
    {
      title: 'React. JS Developer',
      company: 'Finacus Solutions',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: '234',
      requisitionId: '234',
      sourceUrl: 'https://www.finacus.co.in/careers/',
      applyUrl: 'https://www.finacus.co.in/careers/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: null,
    },
  ])
  assert.deepEqual(finacus.extractJobDetail(detailHtml, {
    title: 'Sales Coordinator',
    company: 'Finacus Solutions',
    department: null,
    location: 'India',
    city: null,
    state: null,
    country: 'India',
    jobId: '233',
    requisitionId: '233',
    sourceUrl: 'https://www.finacus.co.in/careers/',
    applyUrl: 'https://www.finacus.co.in/careers/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  }), {
    title: 'Sales Coordinator',
    company: 'Finacus Solutions',
    department: 'Sales',
    location: 'Mumbai',
    city: 'Mumbai',
    state: null,
    country: 'India',
    jobId: '233',
    requisitionId: '233',
    sourceUrl: 'https://www.finacus.co.in/careers/',
    applyUrl: 'https://www.finacus.co.in/careers/',
    employmentType: null,
    experienceRequired: '2+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Department : Sales Designation : Sales Coordinator Open Positions : 2 Position Location : Mumbai Gender : Female/ Male Work Experience : 2+ years Key Skills Strong organizational and multitasking abilities. Excellent communication and interpersonal skills. Role & Responsibility Coordinate and follow up with clients on sales leads. Prepare and present detailed and accurate sales reports.',
    remoteStatus: null,
    description:
      'Department : Sales Designation : Sales Coordinator Open Positions : 2 Position Location : Mumbai Gender : Female/ Male Work Experience : 2+ years Key Skills Strong organizational and multitasking abilities. Excellent communication and interpersonal skills. Role & Responsibility Coordinate and follow up with clients on sales leads. Prepare and present detailed and accurate sales reports.',
    publicExperienceChecked: true,
  })

  const jobs = await finacus.createFinacusSolutionsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, finacus.CAREERS_PAGE_URL)
      return careersHtml
    },
    fetchDetailText: async (jobId) => {
      assert.equal(jobId, '233')
      return detailHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'finacussolutions')
  assert.equal(jobs[0].link, 'https://www.finacus.co.in/careers/')
  assert.equal(jobs[0].department, 'Sales')
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[0].nativeLocation, 'Mumbai')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].sourceDetailFailureKind, 'native-country-unqualified-legacy')
  assert.equal(jobs[0].experienceRequired, '2+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Finacus Solutions fails closed when the verified careers page drifts', async () => {
  const finacus = await loadScriptModule()

  await assert.rejects(
    finacus.createFinacusSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Placeholder</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
