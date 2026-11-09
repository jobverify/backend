import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/sapconcur/script.js')

const sampleSapHtml = `
  <html>
    <head><title>Jobs in India | SAP Careers</title></head>
    <body>
      <h1>India</h1>
      <form>
        <label>Search by keyword</label>
        <label>Search by location</label>
      </form>
      <div id="searchresults">
        <p>Results 1 - 25 of 42 Page 1 of 2</p>
        <table>
          <tbody>
            <tr class="data-row">
              <td class="colTitle hidden-phone">
                <a class="jobTitle-link" href="https://jobs.sap.com/job/Bangalore-AI-Product-Manager-SAP-Concur-Spend-KA-560066/1411111111/">
                  AI Product Manager, SAP Concur Spend
                </a>
              </td>
              <td class="colLocation hidden-phone">
                <span class="jobLocation">Bangalore, IN, 560066</span>
              </td>
            </tr>
            <tr class="data-row">
              <td class="colTitle hidden-phone">
                <a class="jobTitle-link" href="https://jobs.sap.com/job/Bangalore-Development-Expert-Java-Kotlin-Go-Dot-Net-SAP-Concur-Travel-KA-562149/1412222222/">
                  Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel
                </a>
              </td>
              <td class="colLocation hidden-phone">
                <span class="jobLocation">Bangalore, KA, IN, 562149</span>
              </td>
            </tr>
            <tr class="data-row">
              <td class="colTitle hidden-phone">
                <a class="jobTitle-link" href="https://jobs.sap.com/job/Bangalore-Head-of-Engineering-Concur-Invoice-Bangalore-KA-562149/1413333333/">
                  Head of Engineering - Concur Invoice - Bangalore
                </a>
              </td>
              <td class="colLocation hidden-phone">
                <span class="jobLocation">Bangalore, KA, IN, 562149</span>
              </td>
            </tr>
            <tr class="data-row">
              <td class="colTitle hidden-phone">
                <a class="jobTitle-link" href="https://jobs.sap.com/job/Mumbai-Solution-Sales-Expert-Finance-oCFO-Cloud-ERP-Solution-IN-400051/1414444444/">
                  Solution Sales Expert - Finance (oCFO) / Cloud ERP Solution
                </a>
              </td>
              <td class="colLocation hidden-phone">
                <span class="jobLocation">Mumbai, IN, 400051</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
  </html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/sapconcur/catalog.js')
  } catch {
    assert.fail('Expected SAP-Concur catalog module at ../../scraper/sapconcur/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/sapconcur/script.js')
  } catch {
    assert.fail('Expected SAP-Concur scraper module at ../../scraper/sapconcur/script.js')
  }
}

test('SAP-Concur catalog captures the official SAP India careers surface for Concur-branded India roles', async () => {
  const { SAP_CONCUR_CATALOG, default: defaultCatalog } = await loadCatalogModule()

  assert.equal(defaultCatalog, SAP_CONCUR_CATALOG)
  assert.equal(SAP_CONCUR_CATALOG.source, 'sapconcur')
  assert.equal(SAP_CONCUR_CATALOG.companyName, 'SAP-Concur')
  assert.equal(SAP_CONCUR_CATALOG.adapter, 'script')
  assert.equal(SAP_CONCUR_CATALOG.companyCareerPage, 'https://jobs.sap.com/go/India/8807201/')
  assert.equal(SAP_CONCUR_CATALOG.companyDomain, 'jobs.sap.com')
  assert.equal(SAP_CONCUR_CATALOG.atsPlatform, 'sap-careers')
  assert.equal(SAP_CONCUR_CATALOG.countryFilter, 'India')
  assert.equal(SAP_CONCUR_CATALOG.paginationStrategy, 'sap-country-listing-pages')
  assert.equal(
    SAP_CONCUR_CATALOG.extractionStrategy,
    'verified-sap-india-listings+concur-title-filter+india-location-filter',
  )
  assert.equal(SAP_CONCUR_CATALOG.verifiedOn, '2026-07-18')
  assert.equal(SAP_CONCUR_CATALOG.modulePath, modulePath)
  assert.match(SAP_CONCUR_CATALOG.verifiedSurfaceSummary, /AI Product Manager, SAP Concur Spend/i)
  assert.match(SAP_CONCUR_CATALOG.verifiedSurfaceSummary, /Development Expert \(Java\/ Kotlin\/ Go\/ Dot Net\), SAP Concur Travel/i)
})

test('SAP-Concur scraper keeps only India Concur-branded SAP roles from the official SAP careers listings', async () => {
  const sapConcur = await loadScriptModule()

  assert.equal(sapConcur.hasOfficialSapIndiaListingsSignal(sampleSapHtml), true)

  const jobs = sapConcur.extractSapConcurJobs(sampleSapHtml)
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.city]),
    [
      ['AI Product Manager, SAP Concur Spend', 'Bangalore, IN, 560066', 'Bangalore'],
      ['Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel', 'Bangalore, KA, IN, 562149', 'Bangalore'],
      ['Head of Engineering - Concur Invoice - Bangalore', 'Bangalore, KA, IN, 562149', 'Bangalore'],
    ],
  )

  const result = await sapConcur.createSapConcurScraper().run({
    fetchPage: async () => ({
      status: 200,
      url: 'https://jobs.sap.com/go/India/8807201/',
      html: sampleSapHtml,
    }),
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(result.length, 3)
  assert.deepEqual(
    result.map((job) => [job.source, job.company, job.country]),
    [
      ['sapconcur', 'SAP-Concur', 'India'],
      ['sapconcur', 'SAP-Concur', 'India'],
      ['sapconcur', 'SAP-Concur', 'India'],
    ],
  )
})
