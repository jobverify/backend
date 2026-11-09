import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hostbooks/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Hostbooks Career | New Job Opening | Work Culture - Hostbooks Limited.</title>
  </head>
  <body>
    <main>
      <h3>Current Opening</h3>
      <table>
        <tbody>
          <tr>
            <td>Java Developer</td>
            <td>14 Nov, 2022</td>
            <td>4 years</td>
            <td>View Job</td>
          </tr>
          <tr>
            <td>Finance Manager</td>
            <td>14 Nov, 2022</td>
            <td>4 years</td>
            <td>View Job</td>
          </tr>
          <tr>
            <td>Channel Sales - Channel Partner Manager</td>
            <td>14 Nov, 2022</td>
            <td>4 years</td>
            <td>View Job</td>
          </tr>
        </tbody>
      </table>
      <h5>Java Developer</h5>
      <p>Work Location:Gurugram</p>
      <p>Division/Department: Development</p>
      <p>Requirement Severity: Immediate</p>
      <p>Technical Skills & Behavioral Skills:</p>
      <ul>
        <li>Core Java, Knowledge of SQL, MySQL, or any other database</li>
        <li>Spring Boot, Hibernate, JPA, Web-services (SOAP/Rest)</li>
      </ul>
      <p>Education and/or Work Experience Requirements:</p>
      <ul>
        <li>4 years of Core Java Development experience</li>
        <li>Immediate joiner will be preferred</li>
      </ul>
      <h5>Finance Manager</h5>
      <p>Work Location:Gurugram</p>
      <p>Division/Department: Finance</p>
      <p>Requirement Severity: Immediate</p>
      <p>Candidate should lead accounting operations and financial reporting.</p>
      <h5>Channel Sales - Channel Partner Manager</h5>
      <p>Location:Pan India Location (All Metro / Tier 1 / Tier 2 Locations)</p>
      <p>Experience : 3 - 5 Years of relevant Channel experiences</p>
      <p>Reporting To: Channel Sales Head</p>
      <p>Candidate MUST have Channel Sales & Channel Management experience.</p>
      <h3>Submit Your Resume</h3>
    </main>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hostbooks/catalog.js')
  } catch {
    assert.fail('Expected HostBooks catalog module at ../../scraper/hostbooks/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hostbooks/script.js')
  } catch {
    assert.fail('Expected HostBooks scraper module at ../../scraper/hostbooks/script.js')
  }
}

test('HostBooks local catalog captures the verified first-party current-opening careers page', async () => {
  const { HOSTBOOKS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HOSTBOOKS_CATALOG)

  assert.equal(defaultCatalog, HOSTBOOKS_CATALOG)
  assert.equal(provider.source, 'hostbooks')
  assert.equal(provider.companyName, 'HostBooks')
  assert.equal(provider.officialBrandName, 'HostBooks')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://www.hostbooks.com/')
  assert.equal(provider.companyCareerPage, 'https://www.hostbooks.com/in/hb/career/')
  assert.equal(provider.companyDomain, 'hostbooks.com')
  assert.equal(provider.atsPlatform, 'official-first-party-current-opening-table')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-first-party-careers-page')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-current-opening-table+inline-role-sections+shared-resume-form',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.dryRunFile, /hostbooks[\\/]jobs\.json$/i)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Current Opening/i)
  assert.match(provider.verifiedSurfaceSummary, /Java Developer/i)
  assert.match(provider.verifiedSurfaceSummary, /Channel Sales - Channel Partner Manager/i)

  const report = generateCompanyCoverageReport({
    csvText: 'HostBooks\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('HostBooks scraper parses the verified current-opening table and inline role sections', async () => {
  const hostBooks = await loadScriptModule()

  assert.equal(hostBooks.SOURCE, 'hostbooks')
  assert.equal(hostBooks.COMPANY, 'HostBooks')
  assert.equal(hostBooks.CAREERS_URL, 'https://www.hostbooks.com/in/hb/career/')
  assert.equal(hostBooks.VERIFIED_ON, '2026-07-18')
  assert.equal(hostBooks.hasOfficialCareersSignal(careersHtml), true)

  const summaryRows = hostBooks.extractOpeningSummaryRows(careersHtml)
  assert.deepEqual(summaryRows.get('Java Developer'), {
    postingDate: '2022-11-14',
    experienceRequired: '4 years',
  })

  const sections = hostBooks.extractOpeningSections(careersHtml)
  assert.equal(sections.length, 3)
  assert.equal(sections[0].title, 'Java Developer')
  assert.equal(sections[0].location, 'Gurugram')
  assert.equal(sections[0].department, 'Development')
  assert.equal(sections[0].experienceRequired, '4 years')

  const jobs = await hostBooks.createHostBooksScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, hostBooks.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.postingDate]),
    [
      ['Java Developer', 'Gurugram', 'Development', '2022-11-14'],
      ['Finance Manager', 'Gurugram', 'Finance', '2022-11-14'],
      ['Channel Sales - Channel Partner Manager', 'Pan India Location (All Metro / Tier 1 / Tier 2 Locations)', null, '2022-11-14'],
    ],
  )
  assert.equal(jobs[0].source, 'hostbooks')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].sourceUrl, hostBooks.CAREERS_URL)
  assert.equal(jobs[0].applyUrl, hostBooks.CAREERS_URL)
})

test('HostBooks fails closed when the verified careers surface drifts', async () => {
  const hostBooks = await loadScriptModule()

  await assert.rejects(
    hostBooks.createHostBooksScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified hostbooks careers page/i,
  )
})
