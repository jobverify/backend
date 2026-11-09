import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/zimetricstechnologies/script.js')

const careersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at Zimetrics | Build Data, AI and Digital Systems</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>We are Hiring!</h2>
    <section class="job-card">
      <p class="elementor-heading-title elementor-size-default">Full Stack Engineer (Node &amp; React) | Immediate Joiner</p>
      <p class="elementor-heading-title elementor-size-default">| Pune |</p>
      <p class="elementor-heading-title elementor-size-default">Apply Now</p>
    </section>
    <section class="job-card">
      <p class="elementor-heading-title elementor-size-default">Full Stack Engineer (Node &amp; React) | Immediate Joiner</p>
      <p class="elementor-heading-title elementor-size-default">| Pune |</p>
      <p class="elementor-heading-title elementor-size-default">Apply Now</p>
    </section>
    <section class="job-card">
      <p class="elementor-heading-title elementor-size-default">Full Stack Engineer (Node &amp; React) | Immediate Joiner</p>
      <p class="elementor-heading-title elementor-size-default">| Pune |</p>
      <p class="elementor-heading-title elementor-size-default">Apply Now</p>
    </section>
    <h2>Join A Community Where You Can Thrive</h2>
    <form id="frmsub" aria-label="Career Form"></form>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/zimetricstechnologies/catalog.js')
  } catch {
    assert.fail(
      'Expected Zimetrics Technologies catalog module at ../../scraper/zimetricstechnologies/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/zimetricstechnologies/script.js')
  } catch {
    assert.fail(
      'Expected Zimetrics Technologies scraper module at ../../scraper/zimetricstechnologies/script.js',
    )
  }
}

test('Zimetrics Technologies local catalog captures the verified inline role-card careers surface', async () => {
  const { ZIMETRICS_TECHNOLOGIES_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(defaultCatalog, ZIMETRICS_TECHNOLOGIES_CATALOG)
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.source, 'zimetricstechnologies')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.companyName, 'Zimetrics Technologies')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.officialBrandName, 'Zimetrics')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.adapter, 'script')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.companyCareerPage, 'https://zimetrics.com/career/')
  assert.equal(
    ZIMETRICS_TECHNOLOGIES_CATALOG.atsPlatform,
    'official-company-careers-form-handoff',
  )
  assert.equal(
    ZIMETRICS_TECHNOLOGIES_CATALOG.paginationStrategy,
    'single-careers-page-inline-role-cards',
  )
  assert.equal(
    ZIMETRICS_TECHNOLOGIES_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+inline-role-cards+form-anchor-apply-handoff+dedupe-identical-cards',
  )
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.companyDomain, 'zimetrics.com')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.verifiedOn, '2026-08-01')
  assert.equal(ZIMETRICS_TECHNOLOGIES_CATALOG.modulePath, modulePath)
  assert.match(ZIMETRICS_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /We are Hiring!/i)
  assert.match(ZIMETRICS_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /Full Stack Engineer/i)
  assert.match(ZIMETRICS_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /#frmsub/i)
  assert.match(ZIMETRICS_TECHNOLOGIES_CATALOG.verifiedSurfaceSummary, /responsive/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, ZIMETRICS_TECHNOLOGIES_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'Zimetrics Technologies\n',
    catalog: [ZIMETRICS_TECHNOLOGIES_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Zimetrics Technologies dedupes identical inline role cards and preserves the apply-anchor handoff', async () => {
  const zimetrics = await loadScriptModule()

  assert.equal(zimetrics.hasOfficialCareersPageSignal(careersHtml), true)
  const extractedJobs = zimetrics.extractJobsFromHtml(careersHtml)

  assert.deepEqual(extractedJobs, [
    {
      title: 'Full Stack Engineer (Node & React)',
      company: 'Zimetrics Technologies',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'full-stack-engineer-node-react__pune',
      requisitionId: 'full-stack-engineer-node-react__pune',
      sourceUrl: 'https://zimetrics.com/career/#frmsub',
      applyUrl: 'https://zimetrics.com/career/#frmsub',
      employmentType: null,
      experienceRequired: 'Immediate Joiner',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])

  const jobs = await zimetrics.createZimetricsTechnologiesScraper().run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'zimetricstechnologies')
  assert.equal(jobs[0].link, 'https://zimetrics.com/career/#frmsub')
})

test('Zimetrics Technologies never captures preceding navigation across paragraph boundaries as a job title', async () => {
  const zimetrics = await loadScriptModule()
  const page = '<p class="elementor-heading-title elementor-size-default">Industries Services About Contact</p>'
    + '<div>' + 'navigation '.repeat(100) + '</div>' + careersHtml
  const jobs = zimetrics.extractJobsFromHtml(page)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full Stack Engineer (Node & React)')
  assert.equal(jobs[0].jobId, 'full-stack-engineer-node-react__pune')
})

test('Zimetrics Technologies fails closed when the verified inline role-card surface disappears', async () => {
  const zimetrics = await loadScriptModule()

  await assert.rejects(
    zimetrics.createZimetricsTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>No hiring cards.</p></body></html>',
    }),
    /verified first-party careers page/i,
  )
})
