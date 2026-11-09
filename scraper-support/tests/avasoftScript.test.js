import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadAvasoftModule = async () => {
  try {
    return await import('../../scraper/avasoft/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'avasoft',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('archived extractJobCards keeps only India roles from the AVASOFT careers page and maps them into the shared listing contract', async () => {
  const avasoft = await loadAvasoftModule()
  assert.ok(avasoft)

  const jobs = avasoft.extractJobCards(readFixture('career.html'))

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Trainee Engineer',
    location: 'Chennai, TN, India',
    city: 'Chennai',
    jobId: 'trainee-engineer',
    requisitionId: 'trainee-engineer',
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: null,
    closingDate: null,
    sourceUrl: 'https://avasoft.com/trainee-engineer/',
    applyUrl: 'https://avasoft.com/contact-us/',
    department: 'Software Engineering',
    minimumQualification: null,
    requiredSkills: [],
  })

  assert.equal(jobs[2].title, 'Human Resource')
  assert.equal(jobs[2].city, 'Chennai')
  assert.equal(jobs[2].department, 'HR')
})

test('archived extractJobDetail pulls AVASOFT location, apply link, and candidate requirements from a role page', async () => {
  const avasoft = await loadAvasoftModule()
  assert.ok(avasoft)

  const listing = avasoft.extractJobCards(readFixture('career.html'))[0]
  const detail = avasoft.extractJobDetail(readFixture('trainee-engineer.html'), listing)

  assert.equal(detail.title, 'Trainee Engineer')
  assert.equal(detail.location, 'Chennai, TN, India')
  assert.equal(detail.city, 'Chennai')
  assert.equal(detail.jobId, 'trainee-engineer')
  assert.equal(detail.requisitionId, 'trainee-engineer')
  assert.equal(detail.department, 'Software Engineering')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '0 - 1 Years')
  assert.match(detail.jobDescription, /2025 passing outstudents/i)
  assert.equal(detail.minimumQualification, null)
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'Having an attitude of openness, eagerness, and endless possibilities.',
    'Somebody who starts with great doubt and great faith, having this mindset isthe highest rating for attitude in our performance pyramid.',
    'Very good speaking and written skills in English.',
  ])
  assert.equal(detail.postingDate, null)
  assert.equal(detail.closingDate, null)
  assert.equal(detail.sourceUrl, 'https://avasoft.com/trainee-engineer/')
  assert.equal(detail.applyUrl, 'https://avasoft.com/contact-us/')
})

test('archived normalizeScrapedJob composes AVASOFT early-career India roles from the detail page contract', async () => {
  const avasoft = await loadAvasoftModule()
  assert.ok(avasoft)

  const detail = avasoft.extractJobDetail(
    readFixture('trainee-engineer.html'),
    avasoft.extractJobCards(readFixture('career.html'))[0],
  )

  const normalized = normalizeScrapedJob(detail, {
    source: 'avasoft',
    companyName: 'AVASOFT',
    companyCareerPage: 'https://avasoft.com/career/',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'AVASOFT')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
})

test('Avasoft exported run excludes current dormant cards and preserves partial evidence', async () => {
  const avasoft = await loadAvasoftModule()
  const { avasoftNativeOptions } = await import('./fixtures/avasoftNativeOptions.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const options = avasoftNativeOptions(), jobs = await avasoft.run(options)
  assert.equal(jobs.length, 0)
  assert.equal(options.calls.length, 20)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Avasoft factory retains the complete native content path when genuine cards become visible', async () => {
  const avasoft = await loadAvasoftModule()
  const { avasoftNativeOptions, avasoftVisibleOpenings } = await import('./fixtures/avasoftNativeOptions.js')
  const jobs = await avasoft.createAvasoftScraper(avasoftNativeOptions(avasoftVisibleOpenings)).run()
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].requisitionId, null)
  assert.ok(jobs[0].sourceDescription.length > 1500)
  assert.equal(jobs[0].applicationMethod, 'career-enquiry')
})

test('Avasoft rejects obsolete listing-only transport overrides before any implicit network request', async () => {
  const avasoft = await loadAvasoftModule()
  await assert.rejects(avasoft.run({ fetchText: async () => readFixture('career.html') }), /current native transport requires fetchPage/)
})
