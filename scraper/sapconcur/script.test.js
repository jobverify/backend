import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  SAP_INDIA_JOBS_URL,
  SOURCE,
  createSapConcurScraper,
  extractSapConcurJobs,
  hasOfficialSapIndiaListingsSignal,
} from './script.js'

const SAP_INDIA_LISTINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs in India | SAP Careers</title>
  </head>
  <body>
    <main>
      <label>Search by keyword</label>
      <label>Search by location</label>
      <table id="searchresults" class="searchResults">
        <caption>Results 1 - 25 of 26 Page 1 of 2</caption>
        <tbody>
          <tr class="data-row">
            <td class="colTitle" headers="hdrTitle">
              <span class="jobTitle hidden-phone">
                <a href="/job/Bangalore-Development-Expert-%28Java-Kotlin-Go-Dot-Net%29%2C-SAP-Concur-Travel-KA-562149/1389533533/" class="jobTitle-link">Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel</a>
              </span>
            </td>
            <td class="colLocation hidden-phone" headers="hdrLocation">
              <span class="jobLocation">Bangalore, KA, IN, 562149</span>
            </td>
          </tr>
          <tr class="data-row">
            <td class="colTitle" headers="hdrTitle">
              <span class="jobTitle hidden-phone">
                <a href="/job/Bangalore-Forward-Deployed-ApplicationML-Engineering-Expert-KA-560066/1398927533/" class="jobTitle-link">Forward Deployed Application/ML Engineering Expert</a>
              </span>
            </td>
            <td class="colLocation hidden-phone" headers="hdrLocation">
              <span class="jobLocation">Bangalore, KA, IN, 560066</span>
            </td>
          </tr>
        </tbody>
      </table>
    </main>
  </body>
</html>
`

test('SAP Concur recognizes the current SAP India listings shell', () => {
  assert.equal(hasOfficialSapIndiaListingsSignal(SAP_INDIA_LISTINGS_HTML), true)
})

test('SAP Concur extracts Concur-branded India rows from the SAP parent listings table', () => {
  const jobs = extractSapConcurJobs(SAP_INDIA_LISTINGS_HTML)

  assert.deepEqual(jobs, [
    {
      title: 'Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel',
      company: COMPANY,
      department: null,
      location: 'Bangalore, KA, IN, 562149',
      city: 'Bangalore',
      country: 'India',
      jobId: '1389533533',
      requisitionId: '1389533533',
      sourceUrl: 'https://jobs.sap.com/job/Bangalore-Development-Expert-%28Java-Kotlin-Go-Dot-Net%29%2C-SAP-Concur-Travel-KA-562149/1389533533/',
      applyUrl: 'https://jobs.sap.com/job/Bangalore-Development-Expert-%28Java-Kotlin-Go-Dot-Net%29%2C-SAP-Concur-Travel-KA-562149/1389533533/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official SAP careers listing for Development Expert (Java/ Kotlin/ Go/ Dot Net), SAP Concur Travel.',
    },
  ])
})

test('SAP Concur run() decorates extracted parent SAP India roles for dry runs', async () => {
  const scraper = createSapConcurScraper()

  const jobs = await scraper.run({
    fetchPage: async () => ({
      status: 200,
      url: SAP_INDIA_JOBS_URL,
      html: SAP_INDIA_LISTINGS_HTML,
    }),
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})
