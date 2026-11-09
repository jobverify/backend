import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/proprofs/catalog.js')
  } catch {
    assert.fail('Expected ProProfs catalog module at ../../scraper/proprofs/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/proprofs/script.js')
  } catch {
    assert.fail('Expected ProProfs scraper module at ../../scraper/proprofs/script.js')
  }
}

test('ProProfs local catalog captures the exact-name blocked-careers contract', async () => {
  const { PROPROFS_CATALOG } = await loadCatalogModule()
  const proprofs = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(PROPROFS_CATALOG)

  assert.equal(provider.source, 'proprofs')
  assert.equal(provider.companyName, 'ProProfs')
  assert.equal(provider.companyCareerPage, 'https://www.proprofs.com/about/')
  assert.equal(provider.blockedCareersUrl, 'https://www.proprofs.com/careers')
  assert.equal(provider.blockedJobsUrl, 'https://www.proprofs.com/jobs')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.match(provider.verifiedSurfaceSummary, /Delhi-NCR/i)
  assert.equal(proprofs.PROVIDER_METADATA.source, provider.source)
})

test('ProProfs exact backlog row resolves from the local catalog object', async () => {
  const { PROPROFS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'ProProfs\n',
    catalog: [hydrateProviderCatalogEntry(PROPROFS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('ProProfs fail-closed scraper returns [] only while the verified about page remains live and public careers routes stay blocked', async () => {
  const proprofs = await loadScraperModule()

  const jobs = await proprofs.createProProfsScraper().run({
    fetchPage: async (url) => {
      if (url === proprofs.ABOUT_URL) {
        return {
          status: 200,
          url,
          html: `
            <html>
              <head><title>ProProfs - Delightfully Smart Tools</title></head>
              <body>
                <p>Santa Monica and Delhi-NCR</p>
                <p>build extraordinary careers for our employees</p>
              </body>
            </html>
          `,
        }
      }

      return {
        status: 0,
        url,
        html: '',
        error: 'socket hang up',
      }
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    proprofs.createProProfsScraper().run({
      fetchPage: async () => ({ status: 200, html: '<html><body>Unexpected</body></html>' }),
    }),
    /verified exact-name about page/i,
  )
})
