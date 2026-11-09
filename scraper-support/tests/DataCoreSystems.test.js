import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/datacoresystems/script.js')

const bambooBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Current Openings" />
    <meta property="og:description" content="Take a look at the current openings at Data-Core System, Inc." />
    <meta property="og:site_name" content="Data-Core System, Inc." />
    <title>BambooHR</title>
  </head>
  <body>
    Current Openings
  </body>
</html>
`

const bambooListPayload = {
  meta: {
    totalCount: 2,
  },
  result: [
    {
      id: '676',
      jobOpeningName: 'Customer Relationship Management (CRM) Lead',
      departmentLabel: 'Consulting',
      employmentStatusLabel: 'Consultant W2/Contractor',
      location: {
        city: 'Harrisburg',
        state: 'Pennsylvania',
      },
      isRemote: null,
    },
    {
      id: '677',
      jobOpeningName: 'Junior MS Dynamics CRM Data Migration Developer',
      departmentLabel: 'Consulting',
      employmentStatusLabel: 'Consultant W2/Contractor',
      location: {
        city: 'Middletown',
        state: 'Pennsylvania',
      },
      isRemote: null,
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/datacoresystems/catalog.js')
  } catch {
    assert.fail('Expected Data-Core Systems catalog module at ../../scraper/datacoresystems/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/datacoresystems/script.js')
  } catch {
    assert.fail('Expected Data-Core Systems scraper module at ../../scraper/datacoresystems/script.js')
  }
}

test('Data-Core Systems local catalog captures the verified BambooHR handoff', async () => {
  const { DATA_CORE_SYSTEMS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(DATA_CORE_SYSTEMS_CATALOG)

  assert.equal(defaultCatalog, DATA_CORE_SYSTEMS_CATALOG)
  assert.equal(provider.source, 'datacoresystems')
  assert.equal(provider.companyName, 'Data-Core Systems')
  assert.equal(provider.officialBrandName, 'Data-Core Systems')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://datacoresystems.com/')
  assert.equal(provider.companyCareerPage, 'https://datacoresystems.com/careers/')
  assert.equal(provider.officialJobsBoardUrl, 'https://datacoresystems.bamboohr.com/careers')
  assert.equal(provider.jobsApiUrl, 'https://datacoresystems.bamboohr.com/careers/list')
  assert.equal(provider.companyDomain, 'datacoresystems.com')
  assert.equal(provider.atsPlatform, 'bamboohr')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(provider.paginationStrategy, 'single-bamboohr-json-list')
  assert.equal(provider.extractionStrategy, 'verified-official-bamboohr-board+json-list')
  assert.equal(provider.verifiedPublicJobCount, 21)
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Cloudflare 403/i)
  assert.match(provider.verifiedSurfaceSummary, /Customer Relationship Management \(CRM\) Lead/i)
  assert.match(provider.verifiedSurfaceSummary, /SAP ABAP/i)
})

test('Data-Core Systems exact backlog row resolves from the local catalog', async () => {
  const { DATA_CORE_SYSTEMS_CATALOG } = await loadCatalogModule()
  const report = generateCompanyCoverageReport({
    csvText: 'Data-Core Systems\n',
    catalog: [hydrateProviderCatalogEntry(DATA_CORE_SYSTEMS_CATALOG)],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Data-Core Systems list candidates preserve unknown native countries and incomplete descriptions', async () => {
  const dataCore = await loadScriptModule()
  const jobs = await dataCore.run({
    requestIntervalMs: 0,
    fetchText: async (url) => {
      if(url === dataCore.CAREERS_URL) return '<html><title>Data-Core Systems careers</title><h1>Careers</h1><a href="'+dataCore.JOBS_BOARD_URL+'">Current openings</a></html>'
      assert.equal(url, dataCore.JOBS_BOARD_URL)
      return bambooBoardHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, dataCore.JOBS_API_URL)
      return bambooListPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map(({ title, department, employmentType, location, country, sourceUrl, applyUrl }) => ({
      title,
      department,
      employmentType,
      location,
      country,
      sourceUrl,
      applyUrl,
    })),
    [
      {
        title: 'Customer Relationship Management (CRM) Lead',
        department: 'Consulting',
        employmentType: 'Consultant W2/Contractor',
        location: null,
        country: null,
        sourceUrl: 'https://datacoresystems.bamboohr.com/careers/676',
        applyUrl: 'https://datacoresystems.bamboohr.com/careers/676',
      },
      {
        title: 'Junior MS Dynamics CRM Data Migration Developer',
        department: 'Consulting',
        employmentType: 'Consultant W2/Contractor',
        location: null,
        country: null,
        sourceUrl: 'https://datacoresystems.bamboohr.com/careers/677',
        applyUrl: 'https://datacoresystems.bamboohr.com/careers/677',
      },
    ],
  )
  assert.equal(jobs[0].source, 'datacoresystems')
})

test('Data-Core Systems scraper fails closed when the official BambooHR board signal disappears', async () => {
  const dataCore = await loadScriptModule()

  await assert.rejects(
    dataCore.run({
      requestIntervalMs: 0,
      fetchText: async url => url===dataCore.CAREERS_URL?'<html><title>Data-Core careers</title><a href="'+dataCore.JOBS_BOARD_URL+'">Openings</a></html>':'<html><head><title>BambooHR</title></head><body>No openings metadata</body></html>',
      fetchJson: async () => bambooListPayload,
    }),
    /official BambooHR board/i,
  )
})
