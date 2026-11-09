import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { hydrateProviderCatalogEntry } from '../providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/gen/script.js')
const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Roles at Gen | Join Our Team | Gen</title>
  </head>
  <body>
    <main>
      <h1>Grow your career at Gen</h1>
      <h2>Open roles</h2>
      <p>Check out all the exciting career possibilities waiting for you at Gen.</p>
      <a href="https://jobs.ashbyhq.com/gen-digital">See all open jobs</a>
    </main>
  </body>
</html>
`

const ashbyPayload = {
  jobs: [
    {
      id: 'senior-data-platform-engineer',
      title: 'Senior Data Platform Engineer',
      department: 'Finance & Business Performance',
      employmentType: 'FullTime',
      location: 'IND - Chennai; IND - Pune',
      isListed: true,
      publishedAt: '2026-07-16T00:00:00.000Z',
      address: {
        postalAddress: {
          addressLocality: 'Chennai',
          addressRegion: 'Tamil Nadu',
          addressCountry: 'India',
        },
      },
      secondaryLocations: [
        {
          location: 'IND - Pune',
          address: {
            postalAddress: {
              addressLocality: 'Pune',
              addressRegion: 'Maharashtra',
              addressCountry: 'India',
            },
          },
        },
      ],
      jobUrl: 'https://jobs.ashbyhq.com/gen-digital/8893d820-33cb-4c10-9a18-def7fdbe2fbf',
      applyUrl: 'https://jobs.ashbyhq.com/gen-digital/8893d820-33cb-4c10-9a18-def7fdbe2fbf/application',
      descriptionHtml: '<p>Build modern data platforms for Gen from Chennai and Pune.</p>',
    },
    {
      id: 'technical-support-specialist',
      title: 'Technical Support Specialist',
      department: 'Consumer Services & Inside Sales',
      employmentType: 'FullTime',
      location: 'IND - Chennai',
      isListed: true,
      publishedAt: '2026-07-12T00:00:00.000Z',
      address: {
        postalAddress: {
          addressLocality: 'Chennai',
          addressRegion: 'Tamil Nadu',
          addressCountry: 'India',
        },
      },
      secondaryLocations: [],
      jobUrl: 'https://jobs.ashbyhq.com/gen-digital/8128d69d-2084-4330-89f7-9dac34d6f211',
      applyUrl: 'https://jobs.ashbyhq.com/gen-digital/8128d69d-2084-4330-89f7-9dac34d6f211/application',
      descriptionHtml: '<p>Support Gen customers from Chennai.</p>',
    },
    {
      id: 'content-platform-lead',
      title: 'Content Platform Lead',
      department: 'Trust Based Solutions',
      employmentType: 'FullTime',
      location: 'USA - New York, NY',
      isListed: true,
      publishedAt: '2026-07-14T00:00:00.000Z',
      address: {
        postalAddress: {
          addressLocality: 'New York',
          addressRegion: 'New York',
          addressCountry: 'United States',
        },
      },
      secondaryLocations: [],
      jobUrl: 'https://jobs.ashbyhq.com/gen-digital/c0728941-2336-4e13-b1c4-b76f32f1eca4',
      applyUrl: 'https://jobs.ashbyhq.com/gen-digital/c0728941-2336-4e13-b1c4-b76f32f1eca4/application',
      descriptionHtml: '<p>Lead content platform work from New York.</p>',
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/gen/catalog.js')
  } catch {
    assert.fail('Expected Gen catalog module at ../../scraper/gen/catalog.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/gen/script.js')
  } catch {
    assert.fail('Expected Gen scraper module at ../../scraper/gen/script.js')
  }
}

test('Gen local catalog captures the verified official-site handoff to the public Ashby board', async () => {
  const { GEN_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const provider = hydrateProviderCatalogEntry(GEN_CATALOG)

  assert.equal(defaultCatalog, GEN_CATALOG)
  assert.equal(provider.source, 'gen')
  assert.equal(provider.companyName, 'Gen')
  assert.equal(provider.officialBrandName, 'Gen Digital Inc.')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyCareerPage, 'https://www.gendigital.com/us/en/life-gen/jobs/')
  assert.equal(provider.officialJobsPageUrl, 'https://www.gendigital.com/us/en/life-gen/jobs/')
  assert.equal(provider.ashbyPublicBoardUrl, 'https://jobs.ashbyhq.com/gen-digital')
  assert.equal(provider.ashbyJobBoardUrl, 'https://api.ashbyhq.com/posting-api/job-board/gen-digital')
  assert.equal(provider.companyDomain, 'gendigital.com')
  assert.equal(provider.atsPlatform, 'ashby')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.paginationStrategy, 'official-site-handoff-plus-public-ashby-job-board')
  assert.equal(
    provider.extractionStrategy,
    'verified-official-jobs-page+public-ashby-job-board-api+india-location-filter',
  )
  assert.equal(provider.verifiedOn, '2026-07-18')
  assert.equal(provider.modulePath, modulePath)
  assert.match(provider.verifiedSurfaceSummary, /Saturday, July 18, 2026/i)
  assert.match(provider.verifiedSurfaceSummary, /Senior Data Platform Engineer/i)
  assert.match(provider.verifiedSurfaceSummary, /Technical Support Specialist/i)

  const report = generateCompanyCoverageReport({
    csvText: 'Gen\n',
    catalog: [provider],
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Gen scraper validates the official jobs-page handoff and keeps only India Ashby roles', async () => {
  const gen = await loadScriptModule()

  assert.equal(gen.SOURCE, 'gen')
  assert.equal(gen.COMPANY, 'Gen')
  assert.equal(gen.OFFICIAL_JOBS_PAGE_URL, 'https://www.gendigital.com/us/en/life-gen/jobs/')
  assert.equal(gen.ASHBY_PUBLIC_BOARD_URL, 'https://jobs.ashbyhq.com/gen-digital')
  assert.equal(gen.ASHBY_JOB_BOARD_URL, 'https://api.ashbyhq.com/posting-api/job-board/gen-digital')
  assert.equal(gen.hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.equal(
    gen.extractVerifiedAshbyPublicBoardUrl(jobsPageHtml),
    'https://jobs.ashbyhq.com/gen-digital',
  )
  assert.equal(
    gen.buildAshbyJobBoardUrl('https://jobs.ashbyhq.com/gen-digital'),
    'https://api.ashbyhq.com/posting-api/job-board/gen-digital',
  )

  const extractedJobs = gen.extractAshbyJobs(ashbyPayload)
  assert.equal(extractedJobs.length, 2)
  assert.deepEqual(
    extractedJobs.map((job) => [job.title, job.city, job.country]),
    [
      ['Senior Data Platform Engineer', 'Chennai', 'India'],
      ['Technical Support Specialist', 'Chennai', 'India'],
    ],
  )

  const jobs = await gen.createGenScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, gen.OFFICIAL_JOBS_PAGE_URL)
      return jobsPageHtml
    },
    fetchJson: async (url) => {
      assert.equal(url, gen.ASHBY_JOB_BOARD_URL)
      return ashbyPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'gen')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Gen fails closed when the verified official page or Ashby payload drifts', async () => {
  const gen = await loadScriptModule()

  await assert.rejects(
    gen.createGenScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchJson: async () => ashbyPayload,
    }),
    /verified gen jobs page/i,
  )

  await assert.rejects(
    gen.createGenScraper().run({
      fetchText: async () => jobsPageHtml.replace('gen-digital', 'other-company'),
      fetchJson: async () => ashbyPayload,
    }),
    /verified gen ashby board/i,
  )

  await assert.rejects(
    gen.createGenScraper().run({
      fetchText: async () => jobsPageHtml,
      fetchJson: async () => ({ postings: [] }),
    }),
    /verified gen ashby payload/i,
  )
})
