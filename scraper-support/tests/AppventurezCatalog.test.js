import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/appventurez/script.js')

const CAREERS_FIXTURE = `
  <h1>From Intern to Expert: Your Growth Journey with Appventurez</h1>
  <a href="#career_form" class="animateContactBtn inlineFlex">Apply Now</a>
  <div class="rolesBanner">
    <h3>124 <span>Roles</span></h3>
    <div class="border-bottom"></div>
    <h3>16 <span>Locations</span></h3>
    <h3 class="mb-40">Be Part of a Team Shaping the Future with Cutting-Edge Technology</h3>
    <p class="font24-sans mb-20">Appventurez is a solution-driven company.</p>
    <a href="#career_form" class="animateContactBtn inlineFlex">Apply Now</a>
  </div>
  <h2>Current Openings</h2>
  <div class="w33-oneThird cardSemiBoldHead grayBackOpenJobs p-25 borderRadius20">
    <h3>UI/UX Designer</h3>
    <p>Experience : 3 Years -6 Years </p>
    <div class="flexWrap justify-between">
      <p>Location : Noida</p>
      <a href="#career_form" class="btnApply">Apply Now</a>
    </div>
  </div>
  <div class="w33-oneThird cardSemiBoldHead grayBackOpenJobs p-25 borderRadius20">
    <h3>Data Scientist</h3>
    <p>Experience : 4+ Years </p>
    <div class="flexWrap justify-between">
      <p>Location : Delhi</p>
      <a href="#career_form" class="btnApply">Apply Now</a>
    </div>
  </div>
  <!--
  <div class="w33-oneThird cardSemiBoldHead grayBackOpenJobs p-25 borderRadius20">
    <h3>Business Sales Head</h3>
    <p>Experience : 3-4 yrs </p>
    <div class="flexWrap justify-between">
      <p>Location : Noida</p>
      <a href="#career_form" class="btnApply">Apply Now</a>
    </div>
  </div>
  -->
  <div id="career_form"></div>
  <p>jobs@appventurez.com</p>
  <p>You can share your updated resume with our email address- <a href="mailto:careers@appventurez.com">careers@appventurez.com</a>.</p>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/appventurez/catalog.js')
  } catch {
    assert.fail('Expected Appventurez catalog module at ../../scraper/appventurez/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/appventurez/script.js')
  } catch {
    assert.fail('Expected Appventurez scraper module at ../../scraper/appventurez/script.js')
  }
}

const buildCatalogReadyProvider = (catalogEntry) => hydrateProviderCatalogEntry({
  ...catalogEntry,
  modulePath,
})

test('Appventurez local catalog captures the verified first-party openings page plus shared application form', async () => {
  const { APPVENTUREZ_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = buildCatalogReadyProvider(APPVENTUREZ_CATALOG)

  assert.equal(defaultCatalog, APPVENTUREZ_CATALOG)
  assert.equal(provider.source, 'appventurez')
  assert.equal(provider.companyName, 'Appventurez')
  assert.equal(provider.officialBrandName, 'Appventurez')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.appventurez.com/')
  assert.equal(provider.companyCareerPage, 'https://www.appventurez.com/careers')
  assert.equal(provider.sharedApplyFormUrl, 'https://www.appventurez.com/careers#career_form')
  assert.equal(provider.companyDomain, 'appventurez.com')
  assert.equal(provider.atsPlatform, 'official-company-careers')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(provider.extractionStrategy, 'verified-first-party-role-cards+shared-apply-form-anchor')
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/www\.appventurez\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Openings/i)
  assert.match(provider.verifiedSurfaceSummary, /jobs@appventurez\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /careers@appventurez\.com/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /appventurez[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Appventurez\n',
    catalog: [provider],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Appventurez scraper extracts role cards and ignores commented-out openings', async () => {
  const appventurez = await loadScriptModule()
  const scraper = appventurez.createAppventurezScraper({
    now: () => '2026-07-18T12:00:00.000Z',
  })

  assert.equal(appventurez.hasOfficialCareersSignals(CAREERS_FIXTURE), true)

  const jobs = await scraper.run({
    fetchText: async (url) => {
      assert.equal(url, appventurez.CAREERS_URL)
      return CAREERS_FIXTURE
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      experienceRequired: job.experienceRequired,
      sourceUrl: job.sourceUrl,
      requisitionId: job.requisitionId,
    })),
    [
      {
        title: 'UI/UX Designer',
        location: 'Noida, India',
        experienceRequired: '3 Years -6 Years',
        sourceUrl: 'https://www.appventurez.com/careers#ui-ux-designer-noida',
        requisitionId: 'ui-ux-designer-noida',
      },
      {
        title: 'Data Scientist',
        location: 'Delhi, India',
        experienceRequired: '4+ Years',
        sourceUrl: 'https://www.appventurez.com/careers#data-scientist-delhi',
        requisitionId: 'data-scientist-delhi',
      },
    ],
  )
})
