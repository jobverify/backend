import assert from 'node:assert/strict'
import test from 'node:test'

import {
  JOB_BOARD_URL,
  createEnphaseScraper,
  extractJobBoardListings,
  extractJobDetail,
  hasOfficialJobBoardSignal,
} from '../../scraper/enphase/script.js'

const boardHtml = `
  <html>
    <body>
      <h1>Open Positions</h1>
      <p>Enphase Energy Careers</p>
      <h3 class="h2">Engineering</h3>
      <table class="jv-job-list">
        <tr>
          <td class="jv-job-list-name"><a href="/enphase-energy/job/oTest123">Senior Engineer, Software</a></td>
          <td class="jv-job-list-location">Bangalore, India</td>
        </tr>
        <tr>
          <td class="jv-job-list-name"><a href="/enphase-energy/job/oUs456">Software Engineer</a></td>
          <td class="jv-job-list-location">Austin, Texas</td>
        </tr>
      </table>
      <p>Powered by Jobvite</p>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <body>
      <h2>Senior Engineer, Software</h2>
      <p class="job-meta">Engineering Bangalore, India</p>
      <a href="/enphase-energy/job/oTest123/apply">Apply</a>
      <h3>Description</h3>
      <p>Build reliable software for Enphase Energy.</p>
      <ul><li>5+ years of experience</li><li>Python and Java</li></ul>
      <p>Powered by Jobvite</p>
    </body>
  </html>
`

test('Enphase recognizes the official Jobvite board and keeps only India listings', () => {
  assert.equal(hasOfficialJobBoardSignal(boardHtml), true)
  assert.deepEqual(extractJobBoardListings(boardHtml), [{
    title: 'Senior Engineer, Software',
    department: 'Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    detailUrl: 'https://jobs.jobvite.com/enphase-energy/job/oTest123',
    jobId: 'oTest123',
    requisitionId: 'oTest123',
  }])
})

test('Enphase normalizes a Jobvite detail page into the shared job shape', () => {
  const listing = extractJobBoardListings(boardHtml)[0]
  assert.deepEqual(extractJobDetail(detailHtml, listing), {
    title: 'Senior Engineer, Software',
    company: 'Enphase',
    department: 'Engineering',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'oTest123',
    requisitionId: 'oTest123',
    sourceUrl: 'https://jobs.jobvite.com/enphase-energy/job/oTest123',
    applyUrl: 'https://jobs.jobvite.com/enphase-energy/job/oTest123/apply',
    employmentType: null,
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['5+ years of experience', 'Python and Java'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Build reliable software for Enphase Energy. 5+ years of experience Python and Java',
  })
})

test('Enphase scraper follows the verified board and India detail pages', async () => {
  const requestedUrls = []
  const jobs = await createEnphaseScraper({ now: () => '2026-07-26T00:00:00.000Z' }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === JOB_BOARD_URL) return boardHtml
      if (url.endsWith('/oTest123')) return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [JOB_BOARD_URL, 'https://jobs.jobvite.com/enphase-energy/job/oTest123'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'enphase')
  assert.equal(jobs[0].scrapedAt, '2026-07-26T00:00:00.000Z')
})
