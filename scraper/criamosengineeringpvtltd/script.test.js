import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL,
  HOMEPAGE_URL,
  createCriamosEngineeringPvtLtdScraper,
  extractPublicJobs,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

test('CRIAMOS homepage and careers fixtures match the verified first-party surface', () => {
  assert.equal(HOMEPAGE_URL, 'https://www.criamose.com/')
  assert.equal(CAREERS_URL, 'https://www.criamose.com/index.php/careers')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('CRIAMOS careers page exposes the current numbered public opening', () => {
  const jobs = extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Required Design Engineer with Good experience and knowledge',
    company: 'CRIAMOS ENGINEERING PVT LTD',
    department: null,
    location: 'Chennai / Trivandrum, India',
    city: null,
    state: null,
    country: 'India',
    jobId: 'criamosengineeringpvtltd-required-design-engineer-with-good-experience-and-knowledge',
    requisitionId: 'criamosengineeringpvtltd-required-design-engineer-with-good-experience-and-knowledge',
    sourceUrl: CAREERS_URL,
    applyUrl: CAREERS_URL,
    employmentType: null,
    experienceRequired: 'Good experience and knowledge',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Remuneration at par with the best in the industry.\nLocation: Chennai / Trivandrum',
    remoteStatus: null,
  })
})

test('CRIAMOS scraper returns stable first-party job metadata', async () => {
  const scraper = createCriamosEngineeringPvtLtdScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'criamosengineeringpvtltd')
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].companyDomain, 'criamose.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].link, CAREERS_URL)
})
