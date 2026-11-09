import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const modulePath = path.resolve(currentDir, '../../scraper/computergeneratedsolutions/script.js')

const currentUsOnlyPayload = {
  jobs: [
    {
      absolute_url: 'https://job-boards.greenhouse.io/computergeneratedsolutions/jobs/5350602008',
      id: 5350602008,
      requisition_id: '20240367',
      title: 'Founding Sales Leader',
      company_name: 'CGS (Computer Generated Solutions Inc.)',
      first_published: '2026-07-14T15:17:58-04:00',
      content: '<p>US-only sales opening.</p>',
      location: { name: 'United States / North America' },
      metadata: null,
    },
    {
      absolute_url: 'https://job-boards.greenhouse.io/computergeneratedsolutions/jobs/5295123008',
      id: 5295123008,
      requisition_id: '5295123008',
      title: 'On-Site Junior Server Support - Call Center',
      company_name: 'CGS (Computer Generated Solutions Inc.)',
      first_published: '2026-06-02T11:47:07-04:00',
      content: '<p>Tampa role.</p>',
      location: { name: '3101 W Martin Luther King Blvd. Suite 425. Tampa FL, zip code 33607' },
      metadata: null,
    },
    {
      absolute_url: 'https://job-boards.greenhouse.io/computergeneratedsolutions/jobs/5258912008',
      id: 5258912008,
      requisition_id: '5258912008',
      title: 'Technical Customer Service - On-site',
      company_name: 'CGS (Computer Generated Solutions Inc.)',
      first_published: '2026-04-23T17:42:16-04:00',
      content: '<p>Tampa support role.</p>',
      location: { name: '3101 W Martin Luther King Blvd. Suite 425. Tampa FL, zip code 33607' },
      metadata: null,
    },
  ],
}

const mixedPayload = {
  jobs: [
    ...currentUsOnlyPayload.jobs,
    {
      absolute_url: 'https://job-boards.greenhouse.io/computergeneratedsolutions/jobs/9999999008',
      id: 9999999008,
      requisition_id: 'IN-1001',
      title: 'Platform Engineer',
      company_name: 'CGS (Computer Generated Solutions Inc.)',
      first_published: '2026-07-18T09:00:00-04:00',
      content: '<p>India engineering opening.</p>',
      location: { name: 'Bengaluru, Karnataka, India' },
      metadata: [{ name: 'Country', value: ['India'] }],
    },
  ],
}

const loadCatalogModule = async () => {
  try {
    return await import('../../scraper/computergeneratedsolutions/catalog.js')
  } catch {
    assert.fail(
      'Expected Computer Generated Solutions catalog module at ../../scraper/computergeneratedsolutions/catalog.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/computergeneratedsolutions/script.js')
  } catch {
    assert.fail(
      'Expected Computer Generated Solutions scraper module at ../../scraper/computergeneratedsolutions/script.js',
    )
  }
}

test('Computer Generated Solutions local catalog captures the verified first-party careers handoff to Greenhouse', async () => {
  const { COMPUTER_GENERATED_SOLUTIONS_CATALOG, default: defaultCatalog } = await loadCatalogModule()
  const scriptModule = await loadScriptModule()

  assert.equal(defaultCatalog, COMPUTER_GENERATED_SOLUTIONS_CATALOG)
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.source, 'computergeneratedsolutions')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.companyName, 'Computer Generated Solutions')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.officialBrandName, 'CGS (Computer Generated Solutions Inc.)')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.adapter, 'script')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.companyCareerPage, 'https://cgsinc.com/en/cgs-careers')
  assert.equal(
    COMPUTER_GENERATED_SOLUTIONS_CATALOG.jobsBoardUrl,
    'https://job-boards.greenhouse.io/computergeneratedsolutions',
  )
  assert.equal(
    COMPUTER_GENERATED_SOLUTIONS_CATALOG.greenhouseJobsApiUrl,
    'https://boards-api.greenhouse.io/v1/boards/computergeneratedsolutions/jobs?content=true',
  )
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.atsPlatform, 'greenhouse-board-api')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.paginationStrategy, 'single-greenhouse-board-feed')
  assert.equal(
    COMPUTER_GENERATED_SOLUTIONS_CATALOG.extractionStrategy,
    'verified-first-party-careers-page+official-greenhouse-board-api+india-filter',
  )
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.companyDomain, 'cgsinc.com')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.verifiedOn, '2026-07-18')
  assert.equal(COMPUTER_GENERATED_SOLUTIONS_CATALOG.modulePath, modulePath)
  assert.match(COMPUTER_GENERATED_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Current openings at CGS Inc \(USA\)/i)
  assert.match(COMPUTER_GENERATED_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Founding Sales Leader/i)
  assert.match(COMPUTER_GENERATED_SOLUTIONS_CATALOG.verifiedSurfaceSummary, /Technical Customer Service - On-site/i)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, COMPUTER_GENERATED_SOLUTIONS_CATALOG)

  const report = generateCompanyCoverageReport({
    csvText: 'Computer Generated Solutions\n',
    catalog: [COMPUTER_GENERATED_SOLUTIONS_CATALOG],
    aliasMap: {},
  })

  assert.equal(report.matchedCount, 1)
  assert.equal(report.unmatchedCount, 0)
})

test('Computer Generated Solutions currently returns [] because the verified Greenhouse feed has no India jobs', async () => {
  const cgs = await loadScriptModule()

  assert.equal(cgs.isIndiaJob(currentUsOnlyPayload.jobs[0]), false)
  assert.equal(cgs.isIndiaJob(currentUsOnlyPayload.jobs[1]), false)
  assert.equal(cgs.isIndiaJob(currentUsOnlyPayload.jobs[2]), false)
  assert.deepEqual(cgs.extractJobsFromGreenhousePayload(currentUsOnlyPayload), [])

  const jobs = await cgs.createComputerGeneratedSolutionsScraper().run({
    fetchJson: async () => currentUsOnlyPayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})

test('Computer Generated Solutions keeps only India roles when the official Greenhouse payload includes them', async () => {
  const cgs = await loadScriptModule()

  assert.equal(cgs.isIndiaJob(mixedPayload.jobs[3]), true)

  const jobs = await cgs.createComputerGeneratedSolutionsScraper().run({
    fetchJson: async () => mixedPayload,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.jobId, job.sourceUrl]),
    [[
      'Platform Engineer',
      'Bengaluru, Karnataka, India',
      '9999999008',
      'https://job-boards.greenhouse.io/computergeneratedsolutions/jobs/9999999008',
    ]],
  )
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].country, 'India')
})
