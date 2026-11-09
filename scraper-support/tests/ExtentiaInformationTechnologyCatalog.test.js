import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/extentiainformationtechnology/script.js')

const sampleHtml = `
  <section>
    <title>Exciting Career Opportunities at Extentia</title>
    <h1>Careers Opportunities</h1>
    <div class="elementor elementor-69271 e-loop-item post-73230 job-location-pune job-type-full-time">
      <div class="elementor-post-info__terms-list-item">Pune</div>
      <div class="elementor-post-info__terms-list-item">Full Time</div>
      <h2 class="elementor-heading-title"><a href="https://www.extentia.com/job/net-fullstack-developer/">.Net Fullstack Developer</a></h2>
      <a href="https://www.extentia.com/job/net-fullstack-developer/">More Details</a>
    </div>
    <div class="elementor elementor-69271 e-loop-item post-73231 job-location-bengaluru job-type-full-time">
      <div class="elementor-post-info__terms-list-item">Bengaluru</div>
      <div class="elementor-post-info__terms-list-item">Full Time</div>
      <h2 class="elementor-heading-title"><a href="https://www.extentia.com/job/senior-salesforce-developer/">Senior Salesforce Developer</a></h2>
      <a href="https://www.extentia.com/job/senior-salesforce-developer/">More Details</a>
    </div>
    <a href="https://www.extentia.com/careers/careers-opportunities/?e-page-0431873=2">Page 2</a>
  </section>
`

const loadCatalogModule = async () => import('../../scraper/extentiainformationtechnology/catalog.js')
const loadScriptModule = async () => import('../../scraper/extentiainformationtechnology/script.js')

test('Extentia Information Technology local catalog captures the verified first-party role archive', async () => {
  const { EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG)
  const module = await import(pathToFileURL(provider.modulePath).href)

  assert.equal(defaultCatalog, EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG)
  assert.equal(provider.source, 'extentiainformationtechnology')
  assert.equal(provider.companyName, 'Extentia Information Technology')
  assert.equal(provider.companyCareerPage, 'https://www.extentia.com/careers/careers-opportunities/')
  assert.equal(provider.companyDomain, 'extentia.com')
  assert.equal(provider.atsPlatform, 'official-first-party-job-links')
  assert.equal(provider.modulePath, modulePath)
  assert.equal(provider.verifiedOn, '2026-08-02')
  assert.match(provider.verifiedSurfaceSummary, /\.Net Fullstack Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Legal and Compliance Manager/i)
  assert.equal(typeof module.run, 'function')
})

test('Extentia Information Technology script extracts first-party role links and pagination', async () => {
  const { extractRoleCards, hasOfficialExtentiaCareersSignal } = await loadScriptModule()
  const jobs = extractRoleCards(sampleHtml)

  assert.equal(hasOfficialExtentiaCareersSignal(sampleHtml), true)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, '.Net Fullstack Developer')
  assert.equal(jobs[0].location, 'Pune')
  assert.equal(jobs[0].employmentType, 'Full Time')
  assert.equal(jobs[0].jobId, 'extentiainformationtechnology-net-fullstack-developer')
  assert.match(jobs[0].sourceUrl, /net-fullstack-developer/i)
})

test('Extentia Information Technology exact backlog row resolves from the local catalog', async () => {
  const { EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Extentia Information Technology\n',
    catalog: [hydrateProviderCatalogEntry(EXTENTIA_INFORMATION_TECHNOLOGY_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})
