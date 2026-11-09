import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  INDIA_JOBS_URL,
  createEvokeTechnologiesScraper,
} from './script.js'

const indiaLandingHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title></title>
    </head>
    <body>
      <a href="https://www.evoketechnologies.com/">Evoke Technologies</a>
      <h1>Join Our Team and Shape the Future of Transformation</h1>
      <p>View Job Openings</p>
      <a href="https://careers.evoketechnologies.com/viewalljobs/">View All Jobs</a>
      <a href="https://careers.evoketechnologies.com/topjobs/">Jobs</a>
      <p>Explore Opportunities</p>
      <p>Explore Life at Evoke</p>
      <a href="https://careers.evoketechnologies.com/go/India/733644/">India</a>
      <a href="https://www.evoketechnologies.com/contact-us">Contact Us</a>
      <footer>Evoke Technologies Pvt. Ltd. © 2026 All Rights Reserved.</footer>
    </body>
  </html>
`

const indiaCategoryHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title></title>
    </head>
    <body>
      <a href="https://careers.evoketechnologies.com/viewalljobs/">View All Jobs</a>
      <p>Results 1 – 2 of 2 Page 1 of 1</p>
      <p>Job Req ID</p>
      <table>
        <tbody>
          <tr class="data-row">
            <td class="colFacility hidden-phone"><span class="jobFacility">4316</span></td>
            <td class="colTitle">
              <span class="jobTitle hidden-phone">
                <a href="/job/Hyderabad-Technical-Associate-_NET%2BAngular/56602544/" class="jobTitle-link">
                  Technical Associate - .NET+Angular
                </a>
              </span>
            </td>
            <td class="colLocation hidden-phone"><span class="jobLocation"> Hyderabad, India </span></td>
            <td class="colDate hidden-phone"><span class="jobDate">Aug 1, 2026 </span></td>
          </tr>
          <tr class="data-row">
            <td class="colFacility hidden-phone"><span class="jobFacility">4363</span></td>
            <td class="colTitle">
              <span class="jobTitle hidden-phone">
                <a href="/job/Hyderabad-Senior-Technical-Associate/57273944/" class="jobTitle-link">
                  Senior Technical Associate
                </a>
              </span>
            </td>
            <td class="colLocation hidden-phone"><span class="jobLocation"> Hyderabad, India </span></td>
            <td class="colDate hidden-phone"><span class="jobDate">Jul 23, 2026 </span></td>
          </tr>
        </tbody>
      </table>
      <a href="https://www.evoketechnologies.com/privacy-policy/">Privacy Policy</a>
      <footer>Evoke Technologies Pvt. Ltd. © 2026 All Rights Reserved.</footer>
    </body>
  </html>
`

test('Evoke uses the current India category page and extracts the visible SAP-style job rows', async () => {
  const requestedUrls = []
  const jobs = await createEvokeTechnologiesScraper({
    now: () => '2026-08-02T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_URL) return indiaLandingHtml
      if (url === INDIA_JOBS_URL) return indiaCategoryHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_URL,
    INDIA_JOBS_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      location: job.location,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Technical Associate - .NET+Angular',
        jobId: '4316',
        location: 'Hyderabad, India',
        sourceUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-Technical-Associate-_NET%2BAngular/56602544/',
        applyUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-Technical-Associate-_NET%2BAngular/56602544/',
        postingDate: 'Aug 1, 2026',
        source: 'evoketechnologies',
        scrapedAt: '2026-08-02T00:00:00.000Z',
      },
      {
        title: 'Senior Technical Associate',
        jobId: '4363',
        location: 'Hyderabad, India',
        sourceUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-Senior-Technical-Associate/57273944/',
        applyUrl: 'https://careers.evoketechnologies.com/job/Hyderabad-Senior-Technical-Associate/57273944/',
        postingDate: 'Jul 23, 2026',
        source: 'evoketechnologies',
        scrapedAt: '2026-08-02T00:00:00.000Z',
      },
    ],
  )
})
