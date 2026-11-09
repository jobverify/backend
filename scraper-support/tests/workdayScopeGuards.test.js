import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  runWorkdayScraper,
  shouldFetchWorkdayJobDetail,
} from '../myworkday/engine.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

test('shouldFetchWorkdayJobDetail skips obvious non-India country-code summaries while keeping India-prefixed ones', () => {
  assert.equal(
    shouldFetchWorkdayJobDetail({ location: 'CO - Bogota' }),
    false,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail({ location: 'TH - Laem Chabang' }),
    false,
  )

  assert.equal(
    shouldFetchWorkdayJobDetail({ location: 'IN - Chennai' }),
    true,
  )
})

test('shouldFetchWorkdayJobDetail recognizes dotted and comma-separated US locations from CXS', () => {
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'USA.VA.Reston' }), false)
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'USA, GA, Atlanta' }), false)
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'USA.IL.Home Office Chicago Metro' }), false)
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'IN, Chennai' }), true)
})

test('runWorkdayScraper jobs-api mode skips leaked non-India country-code listings before detail fetches', async () => {
  const originalFetch = global.fetch
  const detailUrls = []

  global.fetch = async (url, options = {}) => {
    if ((options.method || 'GET') === 'POST') {
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'application/json' },
        json: async () => ({
          total: 2,
          jobPostings: [
            {
              title: 'Customs Operations Associate',
              externalPath: '/job/CO---Bogota/Customs-Operations-Associate_R186594',
              locationsText: 'CO - Bogota',
              postedOn: 'Today',
            },
            {
              title: 'Senior Specialist - Workflow Management',
              externalPath: '/job/IN---Chennai/Senior-Specialist---Workflow-Management_R190557',
              locationsText: 'IN - Chennai',
              postedOn: 'Today',
            },
          ],
        }),
      }
    }

    if (url.includes('/job/')) {
      detailUrls.push(url)
      if (url.includes('/wday/cxs/')) {
        return { ok: true, status: 200, url, headers: { get: () => 'application/json' },
          text: async () => JSON.stringify({ jobPostingInfo: { title: 'Senior Specialist - Workflow Management',
            location: 'IN - Chennai', jobReqId: 'R190557', jobDescription: '<p>Required experience</p><ul><li>3 years of professional experience</li><li>Excel certification preferred</li></ul>' } }) }
      }
      return {
        ok: true,
        status: 200,
        url,
        headers: { get: () => 'text/html' },
        text: async () => '<html><body>India detail page</body></html>',
      }
    }

    return {
      ok: true,
      status: 200,
      url,
      headers: {
        getSetCookie: () => [],
        get: () => 'text/html; charset=UTF-8',
      },
      text: async () => '<html><body>Workday shell</body></html>',
    }
  }

  try {
    const jobs = await runWorkdayScraper({
      company: 'Scope Guard Test',
      baseUrl: 'https://scope-guard-test.wd5.myworkdayjobs.com/External',
      locationCountry: 'india-id',
      source: 'scope-guard-test',
      scraperDir: path.join(testsDir, '../myworkday'),
      requestTimeoutMs: 1000,
      retryBaseDelayMs: 0,
    })

    assert.equal(jobs.length, 1)
    assert.equal(jobs[0].title, 'Senior Specialist - Workflow Management')
    assert.equal(jobs[0].location, 'IN - Chennai')
    assert.match(jobs[0].sourceDescription, /experience\nExcel certification preferred/)
    assert.deepEqual(detailUrls, [
      'https://scope-guard-test.wd5.myworkdayjobs.com/wday/cxs/scope-guard-test/External/job/IN---Chennai/Senior-Specialist---Workflow-Management_R190557',
    ])
  } finally {
    global.fetch = originalFetch
  }
})


test('shouldFetchWorkdayJobDetail excludes US office labels while retaining explicit India secondary scope', () => {
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'Workday USA Offices' }), false)
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'Workday United States Offices' }), false)
  assert.equal(shouldFetchWorkdayJobDetail({ location: 'Workday USA Offices', locations: ['Bangalore, India'] }), true)
})
