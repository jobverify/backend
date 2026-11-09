import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  JOBS_API_URL,
  buildApplyUrl,
  buildJobsApiBody,
  buildViewUrl,
  createFutureSoftIndiaScraper,
  extractJobRecords,
  hasVerifiedCareersSignal,
  hasVerifiedJobsPayloadContract,
  hasVerifiedJobsTableShellSignal,
} from './script.js'

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Propel Your Career with Futuresoft India | Career at FS </title>
    </head>
    <body>
      <h1>Careers at Futuresoft India</h1>
      <table>
        <thead>
          <tr>
            <th>Job Code</th>
            <th>Job Title</th>
            <th>Location</th>
            <th>Experience (Yrs)</th>
            <th>Action</th>
          </tr>
        </thead>
      </table>
      <script>var endpoint = '/Careers/GetAllRequisitions';</script>
    </body>
  </html>
`

const payload = {
  draw: '1',
  recordsFiltered: 2,
  recordsTotal: 2,
  data: [
    {
      iClientRecruitmentId: 10996,
      JobTitle: 'Fraud Investigation Analyst',
      JobCode: '2607-REPW-FHC-01',
      ShortDescription: 'fraud investigation, identity theft',
      DetailedJD: '<ul><li>Analyze alerts</li></ul>',
      LocationName: 'Bangalore',
      Experience: '1-10',
      Queue: 'FHC',
    },
    {
      iClientRecruitmentId: 15411,
      JobTitle: 'Application Support Engineer',
      JobCode: '2606-RIFU-FSO-02',
      ShortDescription: 'Application Support, Client Support',
      DetailedJD: '<p>Provide L1 support</p>',
      LocationName: 'Delhi NCR',
      Experience: '2-5',
      Queue: 'FSO',
    },
  ],
}

test('FutureSoft India accepts the live jobs table shell and payload contract', async () => {
  assert.equal(hasVerifiedCareersSignal(careersHtml), true)
  assert.equal(hasVerifiedJobsTableShellSignal(careersHtml), true)
  assert.equal(hasVerifiedJobsPayloadContract(payload), true)
  assert.equal(extractJobRecords(payload).length, 2)

  const jobs = await createFutureSoftIndiaScraper({ now: () => '2026-08-02T06:00:00.000Z' }).run({
    fetchText: async (url) => {
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, body) => {
      if (url !== JOBS_API_URL) throw new Error(`Unexpected JSON URL: ${url}`)
      assert.equal(body.toString(), buildJobsApiBody({ draw: 1, start: 0, length: 25 }).toString())
      return payload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].sourceUrl, buildViewUrl(payload.data[0]))
  assert.equal(jobs[0].applyUrl, buildApplyUrl(payload.data[0]))
  assert.equal(jobs[1].location, 'Delhi NCR, India')
})
