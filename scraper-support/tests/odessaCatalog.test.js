import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/odessa/catalog.js')
  } catch {
    assert.fail('Expected Odessa catalog module at ../../scraper/odessa/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/odessa/script.js')
  } catch {
    assert.fail('Expected Odessa scraper module at ../../scraper/odessa/script.js')
  }
}

test('Odessa local catalog captures the credential-blocked first-party jobs endpoint contract', async () => {
  const { ODESSA_CATALOG } = await loadCatalogModule()
  const odessa = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(ODESSA_CATALOG)

  assert.equal(provider.source, 'odessa')
  assert.equal(provider.companyName, 'Odessa')
  assert.equal(provider.companyCareerPage, 'https://www.odessainc.com/careers/')
  assert.equal(provider.jobsApiUrl, 'https://www.odessainc.com/wp-content/themes/odessa/components/jobs.php')
  assert.equal(provider.atsPlatform, 'official-company-site-no-public-careers')
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.match(provider.verifiedSurfaceSummary, /HTTP 401/i)
  assert.equal(odessa.PROVIDER_METADATA.source, provider.source)
})

test('Odessa exact backlog row resolves from the local catalog object', async () => {
  const { ODESSA_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Odessa\n',
    catalog: [hydrateProviderCatalogEntry(ODESSA_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Odessa fail-closed scraper returns [] only while the careers page and blocked jobs endpoint still match the verified contract', async () => {
  const odessa = await loadScraperModule()

  const jobs = await odessa.createOdessaScraper().run({
    fetchText: async () => `
      <html>
        <head><title>Careers | All Job Openings | Odessa</title></head>
        <body>
          <script id="darwinbox-careers-js-extra">var career_ajax = {"ajax_url":"https://www.odessainc.com/wp-admin/admin-ajax.php"};</script>
        </body>
      </html>
    `,
    fetchJson: async () => ({
      error: 'Darwinbox API returned HTTP 401',
      raw: '{"status":0,"message":"Invalid Credentials"}',
    }),
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    odessa.createOdessaScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
      fetchJson: async () => ({}),
    }),
    /verified official careers surface/i,
  )
})
