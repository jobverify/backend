import assert from 'node:assert/strict'
import test from 'node:test'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Aziro Careers | Join Our Team of Innovators Driving Technology Forward</title>
    <meta name="description" content="Work with the best talent at Aziro (formerly MSys Technologies)." />
  </head>
  <body>
    <h4>Current Openings</h4>
    <table>
      <tbody>
        <tr class="cursor-pointer">
          <td>Senior full stack engineer</td>
          <td>5+yrs</td>
          <td>Any Location</td>
        </tr>
        <tr class="cursor-pointer">
          <td>Senior SDET Engineer</td>
          <td>5+yrs</td>
          <td>Aziro Bangalore</td>
        </tr>
        <tr class="cursor-pointer">
          <td>Senior QA Engineer</td>
          <td>4+yrs</td>
          <td>Aziro Bangalore</td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/aziro/catalog.js')
  } catch {
    assert.fail('Expected Aziro catalog module at ../../scraper/aziro/catalog.js')
  }
}

const loadScraperModule = async () => {
  try {
    return await import('../../scraper/aziro/script.js')
  } catch {
    assert.fail('Expected Aziro scraper module at ../../scraper/aziro/script.js')
  }
}

test('Aziro local catalog captures the visible first-party careers table contract', async () => {
  const { AZIRO_CATALOG } = await loadCatalogModule()
  const aziro = await loadScraperModule()
  const provider = hydrateProviderCatalogEntry(AZIRO_CATALOG)

  assert.equal(provider.source, 'aziro')
  assert.equal(provider.companyName, 'Aziro')
  assert.equal(provider.companyCareerPage, 'https://www.aziro.com/en/careers')
  assert.equal(provider.verifiedPublicJobCount, 5)
  assert.equal(provider.verifiedIndiaJobCount, 3)
  assert.match(provider.verifiedSurfaceSummary, /formerly MSys Technologies/i)
  assert.equal(aziro.PROVIDER_METADATA.source, provider.source)
})

test('Aziro exact backlog row resolves from the local catalog object', async () => {
  const { AZIRO_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Aziro\n',
    catalog: [hydrateProviderCatalogEntry(AZIRO_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Aziro scraper validates the first-party careers page and maps table rows into shared job fields', async () => {
  const aziro = await loadScraperModule()

  assert.equal(aziro.hasOfficialAziroCareersSignal(CAREERS_HTML), true)
  assert.equal(aziro.extractAziroJobs(CAREERS_HTML).length, 3)

  const jobs = await aziro.createAziroScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => CAREERS_HTML,
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Senior full stack engineer')
  assert.equal(jobs[0].experienceRequired, '5+yrs')
  assert.equal(jobs[0].applyUrl, 'https://www.aziro.com/en/careers')
  assert.equal(jobs[1].country, 'India')
})
