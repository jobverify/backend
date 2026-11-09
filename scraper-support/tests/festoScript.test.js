import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildIndiaSearchUrl,
  createFestoScraper,
  extractSearchResults,
} from '../../scraper/festo/script.js'

const listingHtml = `
  <table>
    <tr class="data-row">
      <td class="colTitle"><span class="jobTitle"><a class="jobTitle-link" href="/job/Bangalore-Senior-Fullstack-Developer-Karnataka/1391000000/">Senior Fullstack Developer</a></span></td>
      <td class="colLocation"><span class="jobLocation">Bangalore, Karnataka, IN</span></td>
      <td class="colJobFunction"><span class="jobFunction">Information Technology</span></td>
    </tr>
    <tr class="data-row">
      <td class="colTitle"><span class="jobTitle"><a class="jobTitle-link" href="/job/Kaunas-Network-DevOps-Engineer/1391000001/">Network DevOps Engineer</a></span></td>
      <td class="colLocation"><span class="jobLocation">Kaunas, LT</span></td>
      <td class="colJobFunction"><span class="jobFunction">Information Technology</span></td>
    </tr>
  </table>
`

test('extractSearchResults keeps India jobs from Festo official public search rows', () => {
  const jobs = extractSearchResults(listingHtml)

  assert.deepEqual(jobs, [{
    title: 'Senior Fullstack Developer',
    company: 'Festo',
    department: 'Information Technology',
    location: 'Bangalore, Karnataka, IN',
    city: 'Bangalore',
    country: 'India',
    jobId: '1391000000',
    requisitionId: '1391000000',
    sourceUrl: 'https://jobs.festo.com/job/Bangalore-Senior-Fullstack-Developer-Karnataka/1391000000/',
    applyUrl: 'https://jobs.festo.com/job/Bangalore-Senior-Fullstack-Developer-Karnataka/1391000000/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }])
})

test('run requests Festo official India listings and decorates shared runner fields', async () => {
  const requestedUrls = []
  const jobs = await createFestoScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return listingHtml
    },
  })

  assert.equal(
    buildIndiaSearchUrl(),
    'https://jobs.festo.com/search/?q=&locationsearch=India',
  )
  assert.deepEqual(requestedUrls, [buildIndiaSearchUrl()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'festo')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
