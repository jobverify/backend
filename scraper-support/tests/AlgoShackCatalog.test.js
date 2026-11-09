import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/algoshack/script.js')

const kekaShellHtml = `
  <!DOCTYPE html>
  <html>
    <body>
      <script>
        fetch('/ats/documents/f5063fa6-0819-41ce-971a-1cf377fd6636/careerportal/5794e2596b90430c92f47b086c3dacae.html')
      </script>
    </body>
  </html>
`

const portalHtml = `
  <html>
    <head>
      <script>
        window.khConfig = {
          identifier: 'f5063fa6-0819-41ce-971a-1cf377fd6636',
          domain: 'https://algoshack.keka.com/careers/',
          portalName: 'default'
        }
      </script>
    </head>
  </html>
`

const activeJobsPayload = [
  {
    id: 132430,
    title: 'Automation Engineer',
    description: '<p>Automation testing role.</p>',
    departmentName: 'Projects',
    excerpt: 'Automation testing role.',
    jobLocations: [{ name: 'Bangalore', city: 'Bangalore', state: 'KA', countryCode: 'IN', countryName: 'India' }],
    jobType: 2,
    experience: '3-4',
    jobNumber: '104540',
    publishedOn: '2026-06-19T11:36:34.887Z',
    skillNames: ['java', 'API automation', 'kubernetes', 'selenium'],
  },
  {
    id: 132286,
    title: 'Project Lead',
    description: '<p>Lead automation projects.</p>',
    departmentName: 'Projects',
    excerpt: 'Lead automation projects.',
    jobLocations: [{ name: 'Bangalore', city: 'Bangalore', state: 'KA', countryCode: 'IN', countryName: 'India' }],
    jobType: 2,
    experience: '8+ Years',
    jobNumber: '102860',
    publishedOn: '2025-05-02T14:48:36.047Z',
    skillNames: [],
  },
]

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/algoshack/catalog.js')
  } catch {
    assert.fail('Expected AlgoShack catalog module at ../../scraper/algoshack/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/algoshack/script.js')
  } catch {
    assert.fail('Expected AlgoShack scraper module at ../../scraper/algoshack/script.js')
  }
}

test('AlgoShack local catalog captures the verified public Keka careers endpoint', async () => {
  const { ALGOSHACK_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(ALGOSHACK_CATALOG)

  assert.equal(defaultCatalog, ALGOSHACK_CATALOG)
  assert.equal(provider.source, 'algoshack')
  assert.equal(provider.companyName, 'AlgoShack')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://algoshack.keka.com/careers')
  assert.equal(provider.companyDomain, 'algoshack.com')
  assert.equal(provider.atsPlatform, 'keka-embed-api')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'single-keka-active-jobs-endpoint')
  assert.equal(
    provider.extractionStrategy,
    'verified-public-keka-careers-shell+embedded-khConfig+active-keka-embed-api',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /algoshack\.keka\.com\/careers/i)
  assert.match(provider.verifiedSurfaceSummary, /Automation Engineer/i)
})

test('AlgoShack scraper extracts India jobs from the verified public Keka endpoint', async () => {
  const algoshack = await loadScriptModule()

  assert.equal(
    algoshack.extractPortalDocumentUrl(kekaShellHtml),
    'https://algoshack.keka.com/ats/documents/f5063fa6-0819-41ce-971a-1cf377fd6636/careerportal/5794e2596b90430c92f47b086c3dacae.html',
  )
  assert.deepEqual(
    algoshack.extractCareerConfig(portalHtml),
    {
      identifier: 'f5063fa6-0819-41ce-971a-1cf377fd6636',
      domain: 'https://algoshack.keka.com/careers/',
      portalName: 'default',
    },
  )

  const jobs = await algoshack.createAlgoShackScraper().run({
    fetchText: async (url) => {
      if (url === 'https://algoshack.keka.com/careers') return kekaShellHtml
      return portalHtml
    },
    fetchJson: async () => activeJobsPayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.country]),
    [
      ['Automation Engineer', 'Bangalore, KA, India', 'Projects', 'India'],
      ['Project Lead', 'Bangalore, KA, India', 'Projects', 'India'],
    ],
  )
})
