import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  buildPagePostbackPayload,
  extractAspNetState,
  extractCurrentOpportunities,
  extractJobDetail,
  extractPagerTargets,
  run,
} from '../../scraper/techmahindra/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'techMahindra',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const response = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => body,
})

test('extractAspNetState captures the hidden form fields needed for Tech Mahindra ASP.NET postbacks', () => {
  const html = readFixture('current-opportunity-india-page-1.html')

  assert.deepEqual(extractAspNetState(html), {
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __VIEWSTATE: 'state-token',
    __EVENTVALIDATION: 'event-token',
  })
})

test('extractCurrentOpportunities parses India-filtered Tech Mahindra cards from the official listing page', () => {
  const html = readFixture('current-opportunity-india-page-1.html')
  const jobs = extractCurrentOpportunities(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Automation Testing',
    category: 'IT',
    location: 'BENGALURU',
    city: 'BENGALURU',
    skillSet: 'Selenium,API testing',
    experienceRequired: '4.00-10.00 Years',
    jobCode: 'OAAAADUAAAA4AAAAOAAAADEAAAA=-HsJ7bfzYRUE=',
    sourceUrl: 'https://careers.techmahindra.com/JobDetails.aspx?JobCode=OAAAADUAAAA4AAAAOAAAADEAAAA=-HsJ7bfzYRUE=&IndustryType=SQAAAFQAAAA=-cu6HGbNv01o=',
  })
  assert.equal(jobs[1].location, 'PUNE')
})

test('extractPagerTargets reads the active and next Tech Mahindra ASP.NET page targets', () => {
  const html = readFixture('current-opportunity-india-page-1.html')

  assert.deepEqual(extractPagerTargets(html), [
    {
      label: '1',
      target: 'ctl00$ContentPlaceHolder1$rptPager$ctl00$lnkPage',
      current: true,
    },
    {
      label: '2',
      target: 'ctl00$ContentPlaceHolder1$rptPager$ctl01$lnkPage',
      current: false,
    },
    {
      label: '>>',
      target: 'ctl00$ContentPlaceHolder1$rptPager$ctl05$lnkPage',
      current: false,
    },
    {
      label: 'Last',
      target: 'ctl00$ContentPlaceHolder1$rptPager$ctl06$lnkPage',
      current: false,
    },
  ])
})

test('buildPagePostbackPayload preserves the India filter while targeting the next Tech Mahindra page', () => {
  const state = {
    __EVENTTARGET: '',
    __EVENTARGUMENT: '',
    __VIEWSTATE: 'state-token',
    __EVENTVALIDATION: 'event-token',
  }

  const payload = buildPagePostbackPayload(state, {
    target: 'ctl00$ContentPlaceHolder1$rptPager$ctl01$lnkPage',
    country: 'IND',
    maxExperience: '0',
  })

  assert.equal(payload.__VIEWSTATE, 'state-token')
  assert.equal(payload.__EVENTVALIDATION, 'event-token')
  assert.equal(payload.__EVENTTARGET, 'ctl00$ContentPlaceHolder1$rptPager$ctl01$lnkPage')
  assert.equal(payload.__EVENTARGUMENT, '')
  assert.equal(payload['ctl00$ContentPlaceHolder1$ddlCountry'], 'IND')
  assert.equal(payload['ctl00$ContentPlaceHolder1$ddlTotExpYears'], '0')
})

test('extractJobDetail reads Tech Mahindra detail metadata, experience, and qualifications from the official page', () => {
  const html = readFixture('job-detail-4091208.html')
  const detail = extractJobDetail(html, {
    sourceUrl: 'https://careers.techmahindra.com/JobDetails.aspx?JobCode=OQAAADAAAAA5AAAAMwAAADQAAAA=-81i043Cgrec=&&IndustryType=SQAAAFQAAAA=-cu6HGbNv01o=',
  })

  assert.equal(detail.location, 'HYDERABAD [India]')
  assert.equal(detail.city, 'HYDERABAD')
  assert.equal(detail.jobId, '4091208')
  assert.equal(detail.requisitionId, '4091208')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '7 10 Years')
  assert.match(detail.jobDescription, /Infrastructure Management Specialist/i)
  assert.match(detail.jobDescription, /Opsramp/i)
  assert.deepEqual(detail.requiredSkills, [
    'Strong expertise in Opsramp, including setup, configuration, and troubleshooting.',
    'Knowledge of Windows and Linux server administration.',
    'Experience with automation tools and scripting languages (e.g., Python, PowerShell).',
  ])
  assert.equal(
    detail.minimumQualification,
    "Bachelor's degree in Computer Science, Information Technology, or a related field.",
  )
  assert.equal(
    detail.applyUrl,
    'https://careers.techmahindra.com/JobDetails.aspx?JobCode=OQAAADAAAAA5AAAAMwAAADQAAAA=-81i043Cgrec=&&IndustryType=SQAAAFQAAAA=-cu6HGbNv01o=',
  )
})

test('run refuses legacy unbranded listing fragments as current native employer evidence', async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  const signals = []
  globalThis.fetch = async (url, init = {}) => {
    signals.push(init.signal)
    return response(readFixture('current-opportunity-india-page-1.html'))
  }
  try {
    const jobs = await run({ maxPages: 1, signal: controller.signal })
    assert.equal(jobs.length, 0)
    const evidence = jobs[Symbol.for('jobverify.inventory-evidence')]
    assert.equal(evidence.listingComplete, false)
    assert.match(evidence.reason, /employer identity missing/)
    assert.ok(signals.every(signal => signal instanceof AbortSignal))
  } finally { globalThis.fetch = originalFetch }
})
