import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createVerteilTechnologiesScraper,
  extractJobCards,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <main>
    <h1>We're Hiring</h1>
    <h2>Open Positions</h2>
    <p>Even if you don't find a suitable position, you can still send your resume to ta@verteil.com</p>
    <p>Program Manager</p>
    <a href="https://recruitcareers.zappyhire.com/en/Verteil/apply?job=256">Manager-Accounts Non Engineering Hybrid-India</a>
    <a href="https://recruitcareers.zappyhire.com/en/Verteil/apply?job=43">Executive - Customer Support Non Engineering Kochi-Kerala</a>
    <a href="https://recruitcareers.zappyhire.com/en/Verteil/apply?job=257">Sales Executive-B2B Consolidation Hybrid-India Non Engineering</a>
    <a href="https://recruitcareers.zappyhire.com/en/Verteil/apply?job=241">Inside Sales Representative- B2B Flight Booking Portal Hybrid- India Non-engineering</a>
  </main>
`

test('Verteil Technologies scraper validates the official careers page before extracting jobs', () => {
  assert.equal(CAREERS_URL, 'https://www.verteil.com/career')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('extractJobCards keeps only linked public roles and normalizes titles from the official careers page', () => {
  assert.deepEqual(extractJobCards(careersHtml), [
    {
      title: 'Manager-Accounts',
      company: 'Verteil Technologies',
      department: 'Non Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '256',
      requisitionId: '256',
      sourceUrl: 'https://www.verteil.com/career',
      applyUrl: 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=256',
      employmentType: 'Hybrid',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Executive - Customer Support',
      company: 'Verteil Technologies',
      department: 'Non Engineering',
      location: 'Kochi, Kerala, India',
      city: 'Kochi',
      country: 'India',
      jobId: '43',
      requisitionId: '43',
      sourceUrl: 'https://www.verteil.com/career',
      applyUrl: 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=43',
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
      title: 'Sales Executive-B2B Consolidation',
      company: 'Verteil Technologies',
      department: 'Non Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '257',
      requisitionId: '257',
      sourceUrl: 'https://www.verteil.com/career',
      applyUrl: 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=257',
      employmentType: 'Hybrid',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Inside Sales Representative- B2B Flight Booking Portal',
      company: 'Verteil Technologies',
      department: 'Non Engineering',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '241',
      requisitionId: '241',
      sourceUrl: 'https://www.verteil.com/career',
      applyUrl: 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=241',
      employmentType: 'Hybrid',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('run decorates the extracted jobs from the official careers page', async () => {
  const requestedUrls = []
  const requestedNativeUrls = []
  const nativeUnavailable = new Error('Controlled native detail unavailable in this synthetic listing fixture')
  const jobs = await createVerteilTechnologiesScraper().run({
    fetchNative: async (url) => {
      requestedNativeUrls.push(url)
      throw nativeUnavailable
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'verteiltechnologies')
  assert.equal(jobs[0].link, 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=256')
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
  assert.deepEqual(requestedNativeUrls, [
    'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/configurations/?job=256',
    'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/configurations/?job=43',
    'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/configurations/?job=257',
    'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/careers/configurations/?job=241',
  ])
  assert.ok(jobs.every((job) => job.sourceDetailComplete === false
    && job.sourceDetailFailureKind === 'source-detail-access-failed'
    && job.jobDescription === null && job.postingDate === null))
})
