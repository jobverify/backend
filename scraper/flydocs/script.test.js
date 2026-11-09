import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'

import {
  CAREERS_API_URL,
  CAREERS_PORTAL_URL,
  createFlydocsScraper,
  extractIndiaJobs,
  hasOfficialPortalSignal,
} from './script.js'

const portalHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Careers</title>
      <script>var page_id = '61915000000214664'</script>
    </head>
    <body>
      <input id="pageJson" value="{&#34;company_name&#34;:&#34;flydocs&#34;,&#34;list_url&#34;:&#34;https://flydocs.zohorecruit.in/jobs/Careers&#34;,&#34;page_name&#34;:&#34;Careers&#34;}" />
      <input id="moduleMeta" />
      <input id="jobs" />
    </body>
  </html>
`

const jobsPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'DevOps Engineer',
      City: 'Delhi',
      State: 'Delhi',
      Country: 'India',
      Job_Type: 'Full time',
      Work_Experience: '6-8 years',
      Job_Description: 'Build and operate cloud infrastructure.',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000012043071/DevOps-Engineer?source=CareerSite',
      id: '61915000012043071',
      Publish: true,
      Is_Locked: false,
      Date_Opened: '30/07/2026',
    },
    {
      Posting_Title: 'NOC Engineer',
      City: '',
      State: '',
      Country: '',
      Remote_Job: 'Yes',
      Job_Type: 'Full time',
      Work_Experience: '2-3 years',
      Job_Description: 'This is a remote position.',
      $url: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000011859131/NOC-Engineer?source=CareerSite',
      id: '61915000011859131',
      Publish: true,
      Is_Locked: false,
      Date_Opened: '25/07/2026',
    },
  ],
}

test('Flydocs accepts the current Zoho portal shell and only keeps India-scoped rows from the public API', () => {
  assert.equal(hasOfficialPortalSignal(portalHtml), true)

  const jobs = extractIndiaJobs(jobsPayload)
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      location: jobs[0].location,
      city: jobs[0].city,
      country: jobs[0].country,
      remoteStatus: jobs[0].remoteStatus,
    },
    {
      title: 'DevOps Engineer',
      location: 'Delhi, Delhi, India',
      city: 'Delhi',
      country: 'India',
      remoteStatus: 'On-site',
    },
  )
})

test('Flydocs run validates the direct Zoho portal and public jobs API before returning India jobs', async () => {
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await createFlydocsScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === CAREERS_PORTAL_URL) return portalHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === CAREERS_API_URL) return jobsPayload
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-08-02T05:15:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [CAREERS_PORTAL_URL])
  assert.deepEqual(requestedJsonUrls, [CAREERS_API_URL])
  assert.equal(jobs.length, 1)
  assert.deepEqual(
    {
      title: jobs[0].title,
      link: jobs[0].link,
      source: jobs[0].source,
      scrapedAt: jobs[0].scrapedAt,
    },
    {
      title: 'DevOps Engineer',
      link: 'https://flydocs.zohorecruit.in/jobs/Careers/61915000012043071/DevOps-Engineer?source=CareerSite',
      source: 'flydocs',
      scrapedAt: '2026-08-02T05:15:00.000Z',
    },
  )
})

test('Flydocs preserves the day-first native June date instead of interpreting it as a future November posting', () => {
  const record = { ...jobsPayload.data[0], Date_Opened: '11/06/2026', Modified_Time: '2026-10-21T10:00:00Z' }
  const [job] = extractIndiaJobs({ code: 'success', data: [record] })
  assert.equal(job.postingDate, '2026-06-11')
  assert.equal(job.nativePostingDate, '11/06/2026')
  assert.equal(job.nativePostingDateFormat, 'dd/MM/yyyy')
  const analysis = analyzePublishableJobs([job], { now: new Date('2026-10-21T17:00:00Z') })
  assert.equal(analysis.eligibleJobs.length, 0)
  assert.equal(analysis.filterCounts.old, 1)
})

test('Flydocs normalizes unambiguous native dates and preserves leap days', () => {
  for (const [native, expected] of [['30/07/2026', '2026-07-30'], ['17/08/2026', '2026-08-17'], ['26/03/2026', '2026-03-26'], ['29/02/2024', '2024-02-29']]) {
    const [job] = extractIndiaJobs({ data: [{ ...jobsPayload.data[0], Date_Opened: native }] })
    assert.equal(job.postingDate, expected)
    assert.equal(job.nativePostingDate, native)
  }
})

test('Flydocs fails explicitly on nonempty invalid native dates rather than publishing them with an unknown date', () => {
  for (const native of ['31/02/2026', '29/02/2025', '00/10/2026', '21/13/2026', 'October 21, 2026', '10/21/2026', false, 20261021, {}]) {
    assert.throws(() => extractIndiaJobs({ data: [{ ...jobsPayload.data[0], Date_Opened: native }] }), /Flydocs.*Date_Opened/)
  }
})

test('Flydocs preserves existing unambiguous ISO day inputs and rejects impossible ISO dates', () => {
  const [job] = extractIndiaJobs({ data: [{ ...jobsPayload.data[0], Date_Opened: '2026-07-03' }] })
  assert.equal(job.postingDate, '2026-07-03')
  assert.equal(job.nativePostingDate, '2026-07-03')
  assert.equal(job.nativePostingDateFormat, 'yyyy-MM-dd')
  assert.throws(() => extractIndiaJobs({ data: [{ ...jobsPayload.data[0], Date_Opened: '2026-02-30' }] }), /Flydocs.*Date_Opened/)
})

test('Flydocs leaves genuinely missing native dates unknown without inventing a current date', () => {
  for (const native of [null, undefined, '']) {
    const [job] = extractIndiaJobs({ data: [{ ...jobsPayload.data[0], Date_Opened: native }] })
    assert.equal(job.postingDate, null)
  }
})
