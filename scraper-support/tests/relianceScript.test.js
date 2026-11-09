import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildNextPagePayload,
  buildSearchPayload,
  extractAspNetState,
  extractJobDetail,
  extractListings,
  extractSearchResultsUrl,
  hasNoResults,
  hasNextPage,
} from '../../scraper/reliance/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'reliance',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('extractAspNetState captures the hidden fields from the official Reliance landing page', () => {
  const html = readFixture('index.html')

  assert.deepEqual(extractAspNetState(html), {
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __VIEWSTATE: 'landing-state-token',
    __VIEWSTATEGENERATOR: 'AB9A3CD4',
    __VIEWSTATEENCRYPTED: '',
    __EVENTVALIDATION: 'landing-event-token',
    'ctl00$hdnbussID': '1172',
    'ctl00$hdnToken': '1295052385',
    'ctl00$hdnmaibaap': '1295052385',
    'ctl00$ContentPlaceHolder1$hdnToken': '1295052385',
    'ctl00$ContentPlaceHolder1$hdnKeyword': '',
    'ctl00$ContentPlaceHolder1$hdnfuncation': '',
    'ctl00$ContentPlaceHolder1$hdnLocation': '',
  })
})

test('buildSearchPayload preserves ASP.NET state while submitting a Reliance function search', () => {
  const payload = buildSearchPayload(extractAspNetState(readFixture('index.html')), {
    functionCode: '315',
  })

  assert.equal(payload.__VIEWSTATE, 'landing-state-token')
  assert.equal(payload.__EVENTVALIDATION, 'landing-event-token')
  assert.equal(payload['ctl00$head$ddlFunction'], '315')
  assert.equal(payload['ctl00$ContentPlaceHolder1$hdnfuncation'], '315')
  assert.equal(payload['ctl00$head$Button1'], 'Search')
})

test('extractListings parses Reliance jobs from the official search results table', () => {
  const html = readFixture('search-results-page-1.html')
  const jobs = extractListings(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Lead Maintenance Mechanical - PTA 5 ( 82857024 )',
    jobId: '82857024',
    requisitionId: '82857024',
    department: 'Manufacturing',
    location: 'Bharuch',
    city: 'Bharuch',
    postingDate: '09 Jul 2026',
    sourceUrl:
      'https://careers.ril.com/rilcareers/frmJobSearch.aspx?JBTITLE=+7xCRCJP6InVYShawnKntw==&jbID=1YHyXGsx9z98xII5jQJvww==',
  })
  assert.equal(jobs[1].city, 'Jamnagar')
})

test('extractSearchResultsUrl and buildNextPagePayload support Reliance ASP.NET pagination', () => {
  const html = readFixture('search-results-page-1.html')

  assert.equal(
    extractSearchResultsUrl(html),
    'https://careers.ril.com/rilcareers/frmJobSearch.aspx?func=g2B7x6hGz2w%3d&loc=%2fwASbQn4xyQ%3d&expreq=%2fwASbQn4xyQ%3d&flag=%2fwASbQn4xyQ%3d',
  )
  assert.equal(hasNextPage(html), true)

  const payload = buildNextPagePayload(extractAspNetState(html))
  assert.equal(payload.__VIEWSTATE, 'results-state-token')
  assert.equal(payload.__EVENTVALIDATION, 'results-event-token')
  assert.equal(payload['ctl00$MainContent$rgJobs$ctl13$lnkNext'], 'Next')
})

test('hasNoResults detects the official Reliance empty-state copy', () => {
  assert.equal(hasNoResults(readFixture('search-results-empty.html')), true)
  assert.equal(hasNextPage(readFixture('search-results-empty.html')), false)
})

test('extractJobDetail reads title, location, qualifications, and skills from the official Reliance detail page', () => {
  const html = readFixture('job-detail-82857024.html')
  const detail = extractJobDetail(html, {
    title: 'Lead Maintenance Mechanical - PTA 5 ( 82857024 )',
    sourceUrl:
      'https://careers.ril.com/rilcareers/frmJobSearch.aspx?JBTITLE=+7xCRCJP6InVYShawnKntw==&jbID=1YHyXGsx9z98xII5jQJvww==',
  })

  assert.equal(detail.title, 'Lead Maintenance Mechanical - PTA 5 ( 82857024 )')
  assert.equal(detail.jobId, '82857024')
  assert.equal(detail.requisitionId, '82857024')
  assert.equal(detail.department, 'Manufacturing')
  assert.equal(detail.location, 'Bharuch')
  assert.equal(detail.city, 'Bharuch')
  assert.equal(detail.postingDate, '09 Jul 2026')
  assert.match(detail.jobDescription, /Purpose of the Role/i)
  assert.match(detail.jobDescription, /manage overall reliability/i)
  assert.match(detail.minimumQualification, /Bachelors in Engineering or Diploma/i)
  assert.match(detail.experienceRequired, /3 to 7 years of maintenance/i)
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'B. Function-specific Competencies (Technical /Functional)',
    'CL Cost',
    'CL Productivity',
  ])
  assert.equal(
    detail.applyUrl,
    'https://careers.ril.com/rilcareers/frmJobSearch.aspx?JBTITLE=+7xCRCJP6InVYShawnKntw==&jbID=1YHyXGsx9z98xII5jQJvww==',
  )
})
