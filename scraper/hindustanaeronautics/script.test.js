import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_API_URL,
  CAREERS_URL,
  createHindustanAeronauticsScraper,
  hasOfficialCareersSignal,
  isLoopbackRedirectLocation,
} from './script.js'

const officialCareersHtml = `
  <html>
    <head><title>HAL - Hindustan Aeronautics Limited</title></head>
    <body>
      <h1>Careers</h1>
      <table>
        <thead>
          <tr>
            <th>Division</th>
            <th>Job Posting Informations</th>
            <th>Floated on</th>
            <th>Due date</th>
          </tr>
        </thead>
      </table>
    </body>
  </html>
`

const careersPayload = {
  career: [
    {
      id: '42',
      division_id: '7',
      division: 'Barrackpore Division',
      title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      floated_date: '16-07-2026',
      activeupto: '30-08-2026',
    },
  ],
}

const detailPayload = {
  career: [
    {
      division: 'Barrackpore Division',
      title: 'Notification for Engagement of ITI Trade Apprentices at Hindustan Aeronautics Limited Barrackpore under Apprentices Act-1961',
      floated_date: '16-07-2026',
      activeupto: '30-08-2026',
      description: 'Open recruitment for apprentice intake.',
      job_url: 'https://hal-india.co.in/backend/wp-content/uploads/2026/07/barrackpore-apprentice.pdf',
      file: { file: [] },
    },
  ],
}

test('recognizes HAL loopback redirect locations', () => {
  assert.equal(isLoopbackRedirectLocation('http://127.0.0.1'), true)
  assert.equal(isLoopbackRedirectLocation('https://localhost/login'), true)
  assert.equal(isLoopbackRedirectLocation('http://[::1]'), true)
  assert.equal(isLoopbackRedirectLocation('https://hal-india.co.in/career'), false)
})

test('verifies the official HAL careers shell', () => {
  assert.equal(hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(hasOfficialCareersSignal('<html><title>Other company</title></html>'), false)
})

test('returns no jobs when HAL careers API redirects to a loopback host', async () => {
  const jobs = await createHindustanAeronauticsScraper().run({
    fetchText: async () => officialCareersHtml,
    fetchJson: async (url) => {
      const error = new Error(`HAL careers API redirected to loopback host: http://127.0.0.1`)
      error.code = 'HAL_LOOPBACK_REDIRECT'
      error.url = url
      error.location = 'http://127.0.0.1'
      throw error
    },
  })

  assert.deepEqual(jobs, [])
})

test('returns no jobs when the verified HAL careers surface is temporarily unavailable', async () => {
  const jobs = await createHindustanAeronauticsScraper().run({
    fetchText: async () => {
      throw new Error(`Request timed out for ${CAREERS_URL}`)
    },
    fetchJson: async () => {
      throw new Error('fetchJson should not be called when the careers page is unavailable')
    },
  })

  assert.deepEqual(jobs, [])
})

test('extracts an open HAL recruitment notice when careers and detail payloads are available', async () => {
  const requestedUrls = []
  const jobs = await createHindustanAeronauticsScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
    fetchJson: async (url, options = {}) => {
      requestedUrls.push(url)
      if (url === CAREERS_API_URL) return careersPayload
      if (options.body?.id === '42') return detailPayload
      throw new Error(`Unexpected HAL fetchJson call for ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, CAREERS_API_URL, CAREERS_API_URL.replace('/career?lang=en', '/career_detail?lang=en')])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, detailPayload.career[0].title)
  assert.equal(jobs[0].sourceUrl, detailPayload.career[0].job_url)
  assert.equal(jobs[0].applyUrl, detailPayload.career[0].job_url)
  assert.equal(jobs[0].city, 'Barrackpore')
})
