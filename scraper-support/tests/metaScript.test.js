import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  VERIFIED_ON,
  VERIFIED_SURFACE_SUMMARY,
  buildSearchUrl,
  createMetaScraper,
  extractJobDetail,
  extractPaginationSummary,
  extractSearchResults,
  hasVerifiedPlatformErrorSignal,
} from '../../scraper/meta/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'meta',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const runtimeErrorPage = {
  status: 400,
  url: 'https://www.metacareers.com/jobsearch/?q=India',
  headers: {
    'content-type': 'text/html; charset="utf-8"',
  },
  html: `
<?xml version="1.0"?>
<!DOCTYPE html>
<html lang="en" id="facebook">
  <head>
    <title>Error</title>
    <meta charset="utf-8"/>
  </head>
  <body>
    <div class="core">
      <h1>Sorry, something went wrong.</h1>
      <p>We're working on getting this fixed as soon as we can.</p>
      <p>
        <a id="back" href="//www.facebook.com/">Go Back</a>
      </p>
    </div>
  </body>
</html>
`,
}

test('buildSearchUrl keeps Meta listings on the public India job search route', () => {
  assert.equal(
    buildSearchUrl(),
    'https://www.metacareers.com/jobsearch/?q=India',
  )
  assert.equal(VERIFIED_ON, '2026-08-14')
  assert.match(VERIFIED_SURFACE_SUMMARY, /21 India results/i)
  assert.match(
    VERIFIED_SURFACE_SUMMARY,
    /generic first-party "Sorry, something went wrong\." error shell/i,
  )
})

test('extractSearchResults keeps India jobs and normalizes Meta job cards', () => {
  const html = readFixture('search-india-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Client Partner - CPG, Auto, D2C & Health',
    company: 'Meta',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '1265801552028354',
    requisitionId: '1265801552028354',
    sourceUrl: 'https://www.metacareers.com/profile/job_details/1265801552028354',
    applyUrl: 'https://www.metacareers.com/profile/job_details/1265801552028354',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.deepEqual(jobs[2], {
    title: 'Enterprise Technical Sales Specialist, APAC',
    company: 'Meta',
    department: null,
    location: 'Bangalore, India +2 locations',
    city: 'Bangalore',
    jobId: '1643819606631284',
    requisitionId: '1643819606631284',
    sourceUrl: 'https://www.metacareers.com/profile/job_details/1643819606631284',
    applyUrl: 'https://www.metacareers.com/profile/job_details/1643819606631284',
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

test('extractPaginationSummary reads the Meta pager labels', () => {
  const html = readFixture('search-india-page-1.html')

  assert.deepEqual(extractPaginationSummary(html), {
    currentPage: 1,
    totalPages: 2,
    hasNext: true,
    totalJobCount: 11,
  })
})

test('extractJobDetail reads public Meta job metadata from JSON-LD', () => {
  const html = readFixture('detail-client-partner.html')

  assert.deepEqual(extractJobDetail(html), {
    title: 'Client Partner - CPG, Auto, D2C & Health',
    company: 'Meta',
    location: 'Mumbai, India',
    city: 'Mumbai',
    employmentType: 'Full-time',
    jobDescription: "Meta is seeking a Client Partner to bring the full potential of its advertising, messaging, and AI solutions to India's large advertisers across its CPG/FMCG, Automotive, and Direct-to-Consumer verticals.",
    postingDate: '2026-06-03T22:56:16-07:00',
    closingDate: '2026-07-27T21:04:13-07:00',
    minimumQualification: '5+ years of experience working in Brand marketing and/or sales in digital first or complex and iconic brand led businesses.',
    preferredQualification: null,
    requiredSkills: [],
    experienceRequired: '5+ years of experience working in Brand marketing and/or sales in digital first or complex and iconic brand led businesses.',
  })
})

test('Meta returns a truthful current-openings signal when direct runtime access only sees the first-party error shell', async () => {
  assert.equal(hasVerifiedPlatformErrorSignal(runtimeErrorPage), true)

  const jobs = await createMetaScraper().run({
    fetchPage: async (url) => {
      assert.equal(url, 'https://www.metacareers.com/jobsearch/?q=India')
      return runtimeErrorPage
    },
    now: () => '2026-08-14T03:20:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Current openings at Meta',
      company: 'Meta',
      location: 'India',
      city: null,
      country: 'India',
      link: 'https://www.metacareers.com/jobsearch/?q=India',
      applyUrl: 'https://www.metacareers.com/jobsearch/?q=India',
      sourceUrl: 'https://www.metacareers.com/jobsearch/?q=India',
      source: 'meta',
      jobId: 'meta-current-openings',
      requisitionId: 'meta-current-openings',
      department: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'The official Meta Careers browser experience still exposes India openings, but direct anonymous HTTP/API access to https://www.metacareers.com/jobsearch/?q=India returned the generic first-party runtime error shell during this scrape. Review current openings directly on https://www.metacareers.com/jobsearch/?q=India.',
      companyCareerPage: 'https://www.metacareers.com/jobsearch/',
      companyDomain: 'metacareers.com',
      atsPlatform: 'official-company-careers',
      scrapedAt: '2026-08-14T03:20:00.000Z',
    },
  ])
})
