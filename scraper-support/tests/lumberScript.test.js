import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lumber',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const boardHtml = readFixture('board.html')
const importComplianceDetailHtml = readFixture('job-detail-import-compliance-specialist.html')
const rookieTraderDetailHtml = readFixture('job-detail-rookie-trader-sales-trainee.html')

const loadLumberModule = async () => {
  try {
    return await import('../../scraper/lumber/script.js')
  } catch {
    assert.fail('Expected Lumber scraper module at ../../scraper/lumber/script.js')
  }
}

test('Lumber scraper recognizes the verified homepage, careers page, board surface, and generic job detail pages', async () => {
  const lumber = await loadLumberModule()

  assert.equal(lumber.SOURCE, 'lumber')
  assert.equal(lumber.COMPANY, 'Lumber')
  assert.equal(lumber.HOMEPAGE_URL, 'https://www.lumber.com/')
  assert.equal(lumber.CAREERS_URL, 'https://www.lumber.com/careers')
  assert.equal(lumber.BOARD_URL, 'https://americaninternationalforestproductsllc.applytojob.com/apply')
  assert.equal(lumber.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(lumber.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(lumber.extractOfficialBoardUrls(careersHtml), [lumber.BOARD_URL])
  assert.equal(lumber.hasVerifiedBoardSignal(boardHtml), true)

  const jobs = lumber.extractBoardJobs(boardHtml)

  assert.deepEqual(jobs, [
    {
      title: 'Import Compliance Specialist',
      company: 'Lumber',
      department: null,
      location: 'Portland, OR',
      city: 'Portland',
      country: 'United States',
      jobId: 'RHnK3IiNee',
      requisitionId: 'RHnK3IiNee',
      sourceUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist',
      applyUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Rookie Trader - Sales Trainee',
      company: 'Lumber',
      department: null,
      location: 'Portland, OR',
      city: 'Portland',
      country: 'United States',
      jobId: 'rITjkVAYUS',
      requisitionId: 'rITjkVAYUS',
      sourceUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/rITjkVAYUS/Rookie-Trader-Sales-Trainee',
      applyUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/rITjkVAYUS/Rookie-Trader-Sales-Trainee',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])

  assert.equal(
    lumber.hasVerifiedJobDetailSignal(importComplianceDetailHtml, jobs[0]),
    true,
  )
  assert.deepEqual(lumber.extractJobDetail(importComplianceDetailHtml, jobs[0]), {
    title: 'Import Compliance Specialist',
    location: 'Portland, OR',
    city: 'Portland',
    employmentType: 'Full-time',
    experienceRequired: 'Mid Level',
    jobDescription:
      'Founded in 1964, American International Forest Products (AIFP), along with Affiliated Resources (AR), is part of Forest City Trading Group (FCTG), one of the largest suppliers of forest products in North America. The Compliance Specialist is responsible for ensuring all domestic and international lumber import and export operations comply with federal, state, and international regulations.',
  })

  assert.equal(
    lumber.hasVerifiedJobDetailSignal(rookieTraderDetailHtml, jobs[1]),
    true,
  )
  assert.deepEqual(lumber.extractJobDetail(rookieTraderDetailHtml, jobs[1]), {
    title: 'Rookie Trader - Sales Trainee',
    location: 'Portland, OR',
    city: 'Portland',
    employmentType: 'Full-time',
    experienceRequired: 'Entry Level',
    jobDescription:
      'Kickstart Your Career in Commodity Trading Are you highly motivated, eager to learn, and ready to take control of your career? At AIFP, we do not just offer jobs - we build long-term careers. Ready to take the leap? Apply today and discover where your ambition can take you.',
  })
})

test('Lumber scraper fetches the verified homepage, careers surface, board, and each live opening detail', async () => {
  const lumber = await loadLumberModule()
  const requestedUrls = []

  const jobs = await lumber.createLumberScraper({
    now: () => '2026-08-03T08:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lumber.HOMEPAGE_URL) return homepageHtml
      if (url === lumber.CAREERS_URL) return careersHtml
      if (url === lumber.BOARD_URL) return boardHtml
      if (url === 'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist') {
        return importComplianceDetailHtml
      }
      if (url === 'https://americaninternationalforestproductsllc.applytojob.com/apply/rITjkVAYUS/Rookie-Trader-Sales-Trainee') {
        return rookieTraderDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lumber.HOMEPAGE_URL,
    lumber.CAREERS_URL,
    lumber.BOARD_URL,
    'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist',
    'https://americaninternationalforestproductsllc.applytojob.com/apply/rITjkVAYUS/Rookie-Trader-Sales-Trainee',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Import Compliance Specialist',
    'Rookie Trader - Sales Trainee',
  ])
  assert.equal(jobs[0].source, 'lumber')
  assert.equal(jobs[0].company, 'Lumber')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].companyCareerPage, 'https://www.lumber.com/careers')
  assert.equal(jobs[0].companyDomain, 'lumber.com')
  assert.equal(jobs[0].atsPlatform, 'official-careers-page-plus-applytojob-board')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Lumber dry-run writer preserves public United States openings instead of India-only filtering them away', async () => {
  const lumber = await loadLumberModule()
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'lumber-dry-run-'))
  const dryRunFile = path.join(tempDir, 'jobs.json')
  const jobs = [
    {
      title: 'Import Compliance Specialist',
      company: 'Lumber',
      location: 'Portland, OR',
      country: 'United States',
      applyUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist',
      sourceUrl: 'https://americaninternationalforestproductsllc.applytojob.com/apply/RHnK3IiNee/Import-Compliance-Specialist',
    },
  ]

  try {
    lumber.saveDryRunJobs(jobs, dryRunFile)
    const savedJobs = JSON.parse(readFileSync(dryRunFile, 'utf8'))

    assert.deepEqual(savedJobs, jobs)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('Lumber catalog registration is present and buildScrapers exposes the runnable scraper', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'lumber')

  assert.ok(provider, 'Expected Lumber provider in customProviders.json')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.companyName, 'Lumber')
  assert.equal(provider.companyCareerPage, 'https://www.lumber.com/careers')
  assert.equal(provider.atsPlatform, 'official-careers-page-plus-applytojob-board')
  assert.equal(provider.countryFilter, 'United States')
  assert.equal(
    provider.paginationStrategy,
    'validate-official-careers-page-then-read-linked-public-applytojob-board',
  )
  assert.equal(
    provider.extractionStrategy,
    'official-careers-page-handoff-verification-plus-board-role-card-parsing',
  )
  assert.equal(provider.parser, 'custom-script')
  assert.equal(provider.normalizationProfile, 'engineering-default')
  assert.equal(provider.companyDomain, 'lumber.com')
  assert.match(provider.modulePath, /lumber[\\/]script\.js$/i)

  const scraper = buildScrapers().find((item) => item.name === 'lumber')

  assert.ok(scraper, 'Expected buildScrapers() to return the Lumber scraper')
  assert.equal(typeof scraper.run, 'function')
  assert.equal(scraper.provider.source, 'lumber')
  assert.equal(scraper.provider.companyCareerPage, 'https://www.lumber.com/careers')
  assert.match(scraper.dryRunFile, /lumber[\\/]jobs\.json$/i)
})
