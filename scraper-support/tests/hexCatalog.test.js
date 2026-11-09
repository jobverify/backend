import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import companyAliases from '../providers/companyAliases.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import {
  buildScrapers,
  getScraperCatalog,
  hydrateProviderCatalogEntry,
} from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/hex/script.js')

const CAREERS_FIXTURE = `
  <title>Careers at Hex - Make everyone a data person</title>
  <meta name="description" content="Careers at Hex" />
  <p>It's just "Hex"! Not "HEX" or "Hex dot tech"</p>
  <h1>Make everyone a data person</h1>
  <p>We're hiring in San Francisco, New York, and remote.</p>
  <p>We have beautiful offices in both cities – and remote team members throughout US, Canada, and a few other countries.</p>
  <h2>Open roles</h2>
  <div class="OpenRolesSidebar__TotalRoleCount-x">[<!-- -->2<!-- -->]</div>
  <a class="OpenRole__Wrapper-x" href="/careers/software-engineer-backend-%28platform%29/"><p class="OpenRole__TitleText-x">Software Engineer, Backend (Platform)</p><p class="OpenRole__LocationText-x">Remote - US or New York</p></a>
  <a class="OpenRole__Wrapper-x" href="/careers/cloud-security-engineer/"><p class="OpenRole__TitleText-x">Cloud Security Engineer</p><p class="OpenRole__LocationText-x">Remote - US, San Francisco or New York</p></a>
`

const BACKEND_PLATFORM_ROLE_FIXTURE = `
  <title>Software Engineer, Backend (Platform) - Careers | Hex</title>
  <p>Open Role</p>
  <h1>Software Engineer, Backend (Platform)</h1>
  <p>location NYC or Remote (US)</p>
  <p>This role is fully remote anywhere within the US Eastern timezone, with the option to work from our NYC office.</p>
`

const CLOUD_SECURITY_ROLE_FIXTURE = `
  <title>Cloud Security Engineer - Careers | Hex</title>
  <p>Open Role</p>
  <h1>Cloud Security Engineer</h1>
  <p>location SF, NYC, or Remote (US)</p>
  <p>We are looking for an experienced Cloud Security Engineer to join Hex’s security team.</p>
`

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/hex/catalog.js')
  } catch {
    assert.fail('Expected Hex catalog module at ../../scraper/hex/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/hex/script.js')
  } catch {
    assert.fail('Expected Hex scraper module at ../../scraper/hex/script.js')
  }
}

test('Hex local catalog captures the verified first-party careers surface and intentionally stays fail-closed for US-only openings', async () => {
  const { HEX_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(HEX_CATALOG)

  assert.equal(defaultCatalog, HEX_CATALOG)
  assert.equal(provider.source, 'hex')
  assert.equal(provider.companyName, 'Hex')
  assert.equal(provider.officialBrandName, 'Hex')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.homepageUrl, 'https://hex.tech/')
  assert.equal(provider.companyCareerPage, 'https://hex.tech/careers/')
  assert.deepEqual(provider.sampleRoleUrls, [
    'https://hex.tech/careers/software-engineer-backend-%28platform%29/',
    'https://hex.tech/careers/cloud-security-engineer/',
  ])
  assert.equal(provider.atsPlatform, 'first-party-careers-page-us-only-openings')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-page-complete-inventory')
  assert.equal(
    provider.extractionStrategy,
    'verified-first-party-role-cards+complete-count+us-only-locations',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'hex.tech')
  assert.equal(provider.verifiedOn, '2026-10-03')
  assert.match(provider.dryRunFile, /hex[\\/]jobs\.json$/i)
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /October 3, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /https:\/\/hex\.tech\/careers\//i)
  assert.match(provider.verifiedSurfaceSummary, /software-engineer-backend-%28platform%29/i)
  assert.match(provider.verifiedSurfaceSummary, /Cloud Security Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /36 first-party role cards/i)
  assert.match(provider.verifiedSurfaceSummary, /Remote - US/i)
  assert.match(provider.verifiedSurfaceSummary, /no India-eligible openings/i)
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hex'), false)

  const report = generateCompanyCoverageReport({
    csvText: 'Hex\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hex', 'hex', 'Hex']],
  )
})

test('Hex scraper verifies the official careers surface and returns an empty list while openings stay US-only', async () => {
  const hex = await loadScriptModule()
  const scraper = hex.createHexScraper()

  assert.equal(hex.hasVerifiedCareersLandingSignal(CAREERS_FIXTURE), true)
  assert.equal(hex.hasCompleteUsOnlyInventory(CAREERS_FIXTURE), true)
  assert.equal(
    hex.hasUsOnlyRolePageSignal(
      BACKEND_PLATFORM_ROLE_FIXTURE,
      'Software Engineer, Backend (Platform)',
    ),
    true,
  )
  assert.equal(
    hex.hasUsOnlyRolePageSignal(CLOUD_SECURITY_ROLE_FIXTURE, 'Cloud Security Engineer'),
    true,
  )

  const visited = []
  const jobs = await scraper.run({
    fetchText: async (url) => {
      visited.push(url)

      if (url === hex.CAREERS_URL) return CAREERS_FIXTURE
      assert.fail(`Unexpected URL requested by Hex scraper: ${url}`)
    },
  })

  assert.deepEqual(visited, ['https://hex.tech/careers/'])
  assert.deepEqual(jobs, [])
})

test('getScraperCatalog exposes Hex as a runnable shared provider without alias churn', async () => {
  const provider = getScraperCatalog().find((item) => item.source === 'hex')
  const scraper = buildScrapers().find((item) => item.name === 'hex')

  assert.ok(provider, 'Expected Hex provider to be registered in customProviders.json')
  assert.ok(scraper, 'Expected Hex scraper to be exposed through buildScrapers')
  assert.equal(provider.companyName, 'Hex')
  assert.equal(provider.companyCareerPage, 'https://hex.tech/careers/')
  assert.equal(provider.companyDomain, 'hex.tech')
  assert.equal(provider.atsPlatform, 'first-party-careers-page-us-only-openings')
  assert.equal(Object.prototype.hasOwnProperty.call(companyAliases, 'Hex'), false)

  const module = await import(pathToFileURL(path.resolve(currentDir, provider.modulePath)).href)
  assert.equal(typeof module.run, 'function')

  const report = generateCompanyCoverageReport({
    csvText: 'Hex\n',
    catalog: getScraperCatalog(),
    aliasMap: companyAliases,
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => [item.companyName, item.source, item.provider?.companyName ?? null]),
    [['Hex', 'hex', 'Hex']],
  )
})
