import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hestabittechnologies/script.js')

const careerHtml = `
<!doctype html>
<html>
  <head>
    <title>Web Mobile App Development Jobs in Noida | Hestabit</title>
  </head>
  <body>
    <h1>Career @ HestaBit</h1>
    <h4 class="career--heading">Senior PHP Developer</h4>
    The developer would be required to work on complex web-based applications which include custom application Development, plugin development for CMS and Frameworks, website Development, eCommerce and other MVC based projects.
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform" target="_blank">
      <span>Apply now</span>
    </a>
    <h4 class="career--heading">Associate PHP Developer</h4>
    The candidate would be required to work on complex web-based applications which include the website, eCommerce, Wordpress plugin development, Laravel and other MVC based projects.
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform" target="_blank">
      <span>Apply now</span>
    </a>
    <h4 class="career--heading">Senior Graphic Designer</h4>
    The candidate must possess great visualisation abilities and should be able to create a combination of attractiveness and usability.
    <a href="https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform" target="_blank">
      <span>Apply now</span>
    </a>
    <h2>We're hiring</h2>
    <a target="_blank" href="https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform">Apply Now</a>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hestabittechnologies/catalog.js')
  } catch {
    assert.fail('Expected Hestabit Technologies catalog module at ../../scraper/hestabittechnologies/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/hestabittechnologies/script.js')
  } catch {
    assert.fail('Expected Hestabit Technologies scraper module at ../../scraper/hestabittechnologies/script.js')
  }
}

test('Hestabit Technologies local catalog captures the verified first-party role teaser surface and Google Forms handoff', async () => {
  const { HESTABIT_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const hestabit = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(HESTABIT_TECHNOLOGIES_CATALOG)

  assert.equal(defaultCatalog, HESTABIT_TECHNOLOGIES_CATALOG)
  assert.equal(provider.source, 'hestabittechnologies')
  assert.equal(provider.companyName, 'Hestabit Technologies')
  assert.equal(provider.officialBrandName, 'HestaBit')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.hestabit.com/')
  assert.equal(provider.companyCareerPage, 'https://www.hestabit.com/career')
  assert.equal(provider.companyDomain, 'hestabit.com')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-third-party-google-forms-handoff')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-role-teasers+shared-google-forms-apply-handoff',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /hestabittechnologies[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /August 2, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /docs\.google\.com/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior PHP Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /shared Google Forms URL/i)

  assert.equal(hestabit.hasVerifiedCareersPageSignal(careerHtml), true)
  const jobs = await hestabit.run({
    fetchText: async () => careerHtml,
    now: () => '2026-08-02T00:00:00.000Z',
  })
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl, job.jobId, job.scrapedAt]),
    [
      [
        'Senior PHP Developer',
        'Noida, Uttar Pradesh, India',
        'https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform',
        'senior-php-developer',
        '2026-08-02T00:00:00.000Z',
      ],
      [
        'Associate PHP Developer',
        'Noida, Uttar Pradesh, India',
        'https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform',
        'associate-php-developer',
        '2026-08-02T00:00:00.000Z',
      ],
      [
        'Senior Graphic Designer',
        'Noida, Uttar Pradesh, India',
        'https://docs.google.com/forms/d/e/1FAIpQLSfXioSOGYzPIXMVe9as38gl_tS_ZmQM3ETDoSokRaAwOJOK_w/viewform',
        'senior-graphic-designer',
        '2026-08-02T00:00:00.000Z',
      ],
    ],
  )
})

test('Hestabit Technologies exact backlog row resolves from the local provider contract', async () => {
  const { HESTABIT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Hestabit Technologies\n',
    catalog: [hydrateProviderCatalogEntry(HESTABIT_TECHNOLOGIES_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hestabit Technologies', 'hestabittechnologies', 'Hestabit Technologies']],
  )
})

test('Hestabit Technologies hydrated local catalog stays script-runner compatible for later registry integration', async () => {
  const { HESTABIT_TECHNOLOGIES_CATALOG } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HESTABIT_TECHNOLOGIES_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.hestabit.com/career')
  assert.equal(provider.companyDomain, 'hestabit.com')
  assert.match(provider.modulePath, /hestabittechnologies[\\/]script\.js$/i)
  assert.equal(typeof module.run, 'function')
})
