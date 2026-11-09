import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const molModulePath = path.resolve(currentDir, '../../scraper/molinformationprocessingservicesindia/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at MOL-IT</title>
  </head>
  <body>
    <h2>Careers at MOL-IT</h2>
    <h3>Join Our Team</h3>
    <h2>Current Vacancies</h2>
    <p>Find your next role and grow with us.</p>
    <script>
      $('#_explore').on('click', function () {
        var win = window.open('https://molit.darwinbox.in/ms/candidate/careers', '_blank');
      })
    </script>
  </body>
</html>
`

const listingPayload = {
  job_counts: 2,
  data: [
    {
      id: 'a688b4768abf8a',
      title: 'Associate Manager - Project Delivery',
      department_name: 'Digital Platform Specialists (MIT-IN_DPS)',
      locations: 'Sec - V, Salt Lake, Kolkata, West Bengal , India',
      country: 'India',
      emp_type_name: 'Full Time Employee',
      experience: '8 - 12 Years',
      posted_on: '09-Jul-2026',
      jd: '<p>Lead cross-functional project delivery.</p>',
    },
    {
      id: 'a662b791875092',
      title: 'Data Analyst',
      department_name: 'AI and Data Science/Engineering (MIT-IN_AID)',
      locations: 'Sec - V, Salt Lake, Kolkata, West Bengal , India',
      country: 'India',
      emp_type_name: 'Full Time Employee',
      experience: '3 - 6 Years',
      posted_on: '17-Jun-2026',
      jd: '<p>Analyze platform and operations data.</p>',
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/molinformationprocessingservicesindia/catalog.js')
  } catch {
    assert.fail('Expected Mol Information Processing Services India catalog module at ../../scraper/molinformationprocessingservicesindia/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/molinformationprocessingservicesindia/script.js')
  } catch {
    assert.fail('Expected Mol Information Processing Services India scraper module at ../../scraper/molinformationprocessingservicesindia/script.js')
  }
}

test('Mol Information Processing Services India catalog captures the verified Darwinbox handoff', async () => {
  const {
    MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG,
    default: defaultCatalog,
  } = await loadCatalogModule()
  const mol = await loadScriptModule()
  const provider = hydrateProviderCatalogEntry(MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG)

  assert.equal(defaultCatalog, MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG)
  assert.equal(provider.source, 'molinformationprocessingservicesindia')
  assert.equal(provider.companyName, 'Mol Information Processing Services India')
  assert.equal(provider.officialBrandName, 'MOL-IT')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.mol-it.com/')
  assert.equal(provider.companyCareerPage, 'https://www.mol-it.com/careers/')
  assert.equal(
    provider.officialCareersHandoffUrl,
    'https://molit.darwinbox.in/ms/candidate/careers',
  )
  assert.equal(provider.darwinboxOrigin, 'https://molit.darwinbox.in')
  assert.equal(provider.darwinboxCompanyId, 'main')
  assert.equal(provider.companyDomain, 'mol-it.com')
  assert.equal(provider.atsPlatform, 'darwinbox')
  assert.equal(provider.paginationStrategy, 'browser-session-darwinbox-pagination')
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page-button-handoff+darwinbox-listing-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.verifiedPublicJobCount, 3)
  assert.equal(provider.modulePath, molModulePath)
  assert.match(provider.verifiedSurfaceSummary, /Associate Manager - Project Delivery/i)
  assert.equal(mol.PROVIDER_METADATA.source, MOL_INFORMATION_PROCESSING_SERVICES_INDIA_CATALOG.source)

  const report = generateCompanyCoverageReport({
    csvText: 'Mol Information Processing Services India\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Mol Information Processing Services India validates the first-party handoff and maps Darwinbox jobs', async () => {
  const mol = await loadScriptModule()

  assert.equal(mol.extractOfficialDarwinboxUrl(officialCareersHtml), mol.OFFICIAL_CAREERS_HANDOFF_URL)
  assert.equal(mol.hasOfficialMolItCareersSignals(officialCareersHtml), true)

  const requestedPages = []
  const jobs = await mol.createMolInformationProcessingServicesIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedPages.push(url)
      return officialCareersHtml
    },
    fetchListingPage: async ({ page }) => {
      assert.equal(page, 1)
      return listingPayload
    },
  })

  assert.deepEqual(requestedPages, ['https://www.mol-it.com/careers/'])
  assert.deepEqual(jobs, [
    {
      title: 'Associate Manager - Project Delivery',
      company: 'Mol Information Processing Services India',
      department: 'Digital Platform Specialists (MIT-IN_DPS)',
      location: 'Kolkata, West Bengal, India',
      city: 'Kolkata',
      jobId: 'a688b4768abf8a',
      requisitionId: null,
      sourceUrl: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a688b4768abf8a',
      applyUrl: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a688b4768abf8a',
      employmentType: 'Full Time Employee',
      experienceRequired: '8 - 12 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '09-Jul-2026',
      closingDate: null,
      jobDescription: '<p>Lead cross-functional project delivery.</p>',
      source: 'molinformationprocessingservicesindia',
      link: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a688b4768abf8a',
      scrapedAt: FIXED_SCRAPED_AT,
      state: 'West Bengal',
      country: 'India',
    },
    {
      title: 'Data Analyst',
      company: 'Mol Information Processing Services India',
      department: 'AI and Data Science/Engineering (MIT-IN_AID)',
      location: 'Kolkata, West Bengal, India',
      city: 'Kolkata',
      jobId: 'a662b791875092',
      requisitionId: null,
      sourceUrl: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a662b791875092',
      applyUrl: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a662b791875092',
      employmentType: 'Full Time Employee',
      experienceRequired: '3 - 6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '17-Jun-2026',
      closingDate: null,
      jobDescription: '<p>Analyze platform and operations data.</p>',
      source: 'molinformationprocessingservicesindia',
      link: 'https://molit.darwinbox.in/ms/candidatev2/main/careers/jobDetails/a662b791875092',
      scrapedAt: FIXED_SCRAPED_AT,
      state: 'West Bengal',
      country: 'India',
    },
  ])
})

test('Mol Information Processing Services India fails closed when the verified careers handoff drifts', async () => {
  const mol = await loadScriptModule()

  await assert.rejects(
    mol.createMolInformationProcessingServicesIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Broken</h1></body></html>',
      fetchListingPage: async () => listingPayload,
    }),
    /verified official careers page/i,
  )
})
