import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import {
  buildDetailUrl,
  buildSearchUrl,
  extractJobDetail,
  extractSearchResults,
} from '../../scraper/cgi/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'cgi',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps CGI listings on the public Njoyn India route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?page=joblisting&CLID=21001&CountryID=IN',
  )
})

test('buildDetailUrl constructs public CGI detail URLs from job identifiers', () => {
  assert.equal(
    buildDetailUrl({ jobId: 'J0526-2158', brid: '1312064' }),
    'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?NTKN=c&clid=21001&Page=JobDetails&Jobid=J0526-2158&BRID=1312064&lang=1',
  )
})

test('extractSearchResults parses CGI Njoyn listing rows and keeps only India jobs', () => {
  const html = readFixture('job-listing-india.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Developer - Java Fullstack',
    company: 'CGI',
    department: 'Software Development / Engineering',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    jobId: 'J0526-2158',
    requisitionId: 'J0526-2158',
    sourceUrl: 'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?NTKN=c&clid=21001&Page=JobDetails&Jobid=J0526-2158&BRID=1312064&lang=1',
    applyUrl: 'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?NTKN=c&clid=21001&Page=JobDetails&Jobid=J0526-2158&BRID=1312064&lang=1',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
})

test('extractJobDetail reads CGI detail metadata and apply links from public HTML', () => {
  const html = readFixture('job-detail-j0526-2158.html')
  const detail = extractJobDetail(html, {
    title: 'Senior Developer - Java Fullstack',
    company: 'CGI',
    department: 'Software Development / Engineering',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    jobId: 'J0526-2158',
    requisitionId: 'J0526-2158',
    sourceUrl: buildDetailUrl({ jobId: 'J0526-2158', brid: '1312064' }),
    applyUrl: buildDetailUrl({ jobId: 'J0526-2158', brid: '1312064' }),
  })

  assert.equal(detail.title, 'Senior Developer - Java Fullstack')
  assert.equal(detail.department, 'Software Development / Engineering')
  assert.equal(detail.location, 'Hyderabad, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.jobId, 'J0526-2158')
  assert.equal(detail.requisitionId, 'J0526-2158')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5-8 years')
  assert.equal(detail.postingDate, 'May 26, 2026')
  assert.match(detail.jobDescription, /Build Java services and modern frontend integrations/i)
  assert.deepEqual(detail.requiredSkills, [
    'Strong Java and Spring Boot skills',
    'Microservices architecture experience',
  ])
  assert.equal(
    detail.applyUrl,
    'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?clid=21001&page=jobapplication&jobid=J0526-2158&BRID=1312064&lang=1',
  )
})

test('normalizeScrapedJob composes CGI job types from detail pages', () => {
  const html = readFixture('job-detail-j0526-2158.html')
  const detail = extractJobDetail(html, {
    title: 'Senior Developer - Java Fullstack',
    company: 'CGI',
    department: 'Software Development / Engineering',
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    jobId: 'J0526-2158',
    requisitionId: 'J0526-2158',
    sourceUrl: buildDetailUrl({ jobId: 'J0526-2158', brid: '1312064' }),
    applyUrl: buildDetailUrl({ jobId: 'J0526-2158', brid: '1312064' }),
  })

  const normalized = normalizeScrapedJob(detail, {
    source: 'cgi',
    companyName: 'CGI',
    companyCareerPage: 'https://cgi.njoyn.com/CORP/xweb/Xweb.asp?page=joblisting&CLID=21001&CountryID=IN',
    atsPlatform: 'njoyn',
  })

  assert.equal(normalized.employmentType, 'Full-time')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})
