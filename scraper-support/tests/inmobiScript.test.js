import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildJobUrl,
  extractSearchResults,
} from '../../scraper/inmobi/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'inmobi',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildJobUrl keeps InMobi detail links on the first-party careers route', () => {
  assert.equal(
    buildJobUrl('Full Time Employee', 7959734),
    'https://www.inmobi.com/company/openings/full-time-employee/jobid/7959734',
  )
  assert.equal(
    buildJobUrl('Third party Consultant', 7417574),
    'https://www.inmobi.com/company/openings/third-party-consultant/jobid/7417574',
  )
})

test('extractSearchResults keeps only India jobs from the InMobi public careers API', () => {
  const payload = readJsonFixture('careersapi.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Account Manager - Microsoft Advertising',
    company: 'InMobi',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '7959734',
    requisitionId: '10929',
    sourceUrl: 'https://www.inmobi.com/company/openings/full-time-employee/jobid/7959734',
    applyUrl: 'https://www.inmobi.com/company/openings/full-time-employee/jobid/7959734',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[1], {
    title: 'Functional consultant - MSD - Contract',
    company: 'InMobi',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    jobId: '7417574',
    requisitionId: '10235',
    sourceUrl: 'https://www.inmobi.com/company/openings/third-party-consultant/jobid/7417574',
    applyUrl: 'https://www.inmobi.com/company/openings/third-party-consultant/jobid/7417574',
    employmentType: 'Contract',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[2], {
    title: 'Intern - Industrial Trainee',
    company: 'InMobi',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '7793050',
    requisitionId: '10675',
    sourceUrl: 'https://www.inmobi.com/company/openings/intern/jobid/7793050',
    applyUrl: 'https://www.inmobi.com/company/openings/intern/jobid/7793050',
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('normalizeScrapedJob composes InMobi job types from public API listings', () => {
  const payload = readJsonFixture('careersapi.json')
  const jobs = extractSearchResults(payload)

  const normalizedFullTime = normalizeScrapedJob(jobs[0], {
    source: 'inmobi',
    companyName: 'InMobi',
    companyCareerPage: 'https://www.inmobi.com/company/careers',
    atsPlatform: 'official-company-careers',
  })
  const normalizedIntern = normalizeScrapedJob(jobs[2], {
    source: 'inmobi',
    companyName: 'InMobi',
    companyCareerPage: 'https://www.inmobi.com/company/careers',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalizedFullTime.employmentType, 'Full-time')
  assert.equal(normalizedFullTime.jobType, 'Full-time Experienced')
  assert.equal(normalizedIntern.employmentType, 'Internship')
  assert.equal(normalizedIntern.jobType, 'Intern')
})
