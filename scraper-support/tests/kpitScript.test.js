import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildApplyUrl,
  buildJobDetailApiUrl,
  buildSearchUrl,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
} from '../../scraper/kpit/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kpit',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')
const readJsonFixture = (name) => JSON.parse(readFixture(name))

test('buildSearchUrl keeps KPIT listings on the public India show_all route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://www.kpit.com/job-listing/?country=India&location=&exp=&show_all=1',
  )
})

test('buildApplyUrl and buildJobDetailApiUrl keep KPIT links on the public Talentojo routes', () => {
  assert.equal(
    buildApplyUrl('82048'),
    'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
  )
  assert.equal(
    buildJobDetailApiUrl('82048'),
    'https://talentojo.kpit.com/service/jobs/82048',
  )
})

test('extractSearchResults keeps India jobs from the public KPIT listing page and normalizes their cities', () => {
  const html = readFixture('search-india-show-all.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'System Engineer',
    company: 'KPIT',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '82048',
    requisitionId: '82048',
    sourceUrl: 'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
    applyUrl: 'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
    employmentType: 'Full Time',
    experienceRequired: '3-12 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'System Engineering',
      'MBSE',
      'MagicDraw',
      'Sysml',
      'IBM DOORS',
      'Rhapsody',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[1], {
    title: 'Devops Expert',
    company: 'KPIT',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    jobId: '82388',
    requisitionId: '82388',
    sourceUrl: 'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82388',
    applyUrl: 'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82388',
    employmentType: 'Full Time',
    experienceRequired: '4-10 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Cloud',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('extractPaginationSummary treats the KPIT India show_all page as a single page listing', () => {
  const html = readFixture('search-india-show-all.html')

  assert.deepEqual(extractPaginationSummary(html), {
    hasNext: false,
    totalJobCount: 2,
  })
})

test('extractJobDetail reads KPIT Talentojo detail fields, skills, and qualification data', () => {
  const payload = readJsonFixture('job-detail-82048.json')
  const detail = extractJobDetail(payload, {
    title: 'System Engineer',
    location: 'Bangalore, India',
    city: 'Bangalore',
    jobId: '82048',
    requisitionId: '82048',
    sourceUrl: 'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
  })

  assert.equal(detail.title, 'System Engineer')
  assert.equal(detail.department, null)
  assert.equal(detail.location, 'Bangalore, India')
  assert.equal(detail.city, 'Bangalore')
  assert.equal(detail.jobId, '82048')
  assert.equal(detail.requisitionId, '82048')
  assert.equal(detail.employmentType, 'Full Time With Benef')
  assert.equal(detail.experienceRequired, '3-12 years')
  assert.equal(detail.minimumQualification, 'B.E')
  assert.equal(detail.preferredQualification, null)
  assert.deepEqual(detail.requiredSkills, [
    'System Engineering',
    'MBSE',
    'MagicDraw',
    'Sysml',
    'IBM DOORS',
    'Rhapsody',
    'Jira',
    'Confluence&',
  ])
  assert.equal(detail.postingDate, '2026-06-09')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
  )
  assert.equal(
    detail.sourceUrl,
    'https://talentojo.kpit.com/tojo/app/job-apply/#/Career%20Portal/82048',
  )
  assert.match(detail.jobDescription, /Job Overview/i)
  assert.match(detail.jobDescription, /Key Responsibilities/i)
  assert.match(detail.jobDescription, /Required Skills/i)
})
