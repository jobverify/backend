import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadIciciBankModule = async () => {
  try {
    return await import('../../scraper/icicibank/script.js')
  } catch {
    assert.fail('Expected ICICI Bank scraper module at ../../scraper/icicibank/script.js')
  }
}

const ENCRYPTION_KEY = '$k@m0u$0172@0r!k'
const FIXED_IV = '1234567890abcdef'

const encryptIciciPayload = (value, iv = FIXED_IV) => {
  const cipher = crypto.createCipheriv(
    'aes-128-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf8'),
    Buffer.from(iv, 'utf8'),
  )

  return Buffer.concat([
    cipher.update(JSON.stringify(value), 'utf8'),
    cipher.final(),
  ]).toString('base64') + iv
}

const decryptIciciPayload = (value) => {
  const encrypted = String(value ?? '')
  const iv = encrypted.slice(-16)
  const payload = encrypted.slice(0, -16)
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf8'),
    Buffer.from(iv, 'utf8'),
  )

  return JSON.parse(Buffer.concat([
    decipher.update(payload, 'base64'),
    decipher.final(),
  ]).toString('utf8'))
}

const searchResponsePayload = {
  Count: 2,
  TotalRows: 2,
  Data: [
    {
      f_title: 'Credit Manager',
      f_jobId: '2204493',
      hc_Location: 'Across India',
      hc_Experience: '1 - 5 Yrs',
      hc_Function: 'Credit and Policy',
      hc_MainGroup: 'Retail Banking',
      f_short_description: 'Evaluate corporate borrowers and approve credit proposals.',
      ShortUrl: 'https://icici-careers.mobi/1-1-1-dcdad44d',
      hc_EndDate: '2026-12-31',
      Education: 'Graduation',
    },
    {
      f_title: 'Relationship Manager - Farmer Finance',
      f_jobId: '2204494',
      hc_Location: 'Hyderabad',
      hc_Experience: '0 - 3 Yrs',
      hc_Function: 'Farmer Finance',
      hc_MainGroup: 'Retail Banking',
      f_short_description: 'Manage farmer finance relationships across local branches.',
      ShortUrl: 'https://icici-careers.mobi/1-1-1-abcd1234',
      hc_EndDate: null,
      Education: 'Graduation',
    },
  ],
}

const detailPayloads = {
  2204493: {
    JobTitle: 'Credit Manager',
    JobID: '2204493',
    JobNumber: '2204493',
    Location: 'Across India',
    Experience: '5',
    Function: 'Credit and Policy',
    MainGroup: 'Retail Banking',
    EndDate: '2026-12-31',
    JD: '<p>About the role</p><ul><li>Evaluate corporate borrowers</li><li>Manage credit proposals</li></ul>',
    ShortUrl: 'https://icici-careers.mobi/1-1-1-dcdad44d',
    Education: 'Graduation',
    Grade: 'Manager',
    f_short_description: 'Evaluate corporate borrowers and approve credit proposals.',
  },
  2204494: {
    JobTitle: 'Relationship Manager - Farmer Finance',
    JobID: '2204494',
    JobNumber: '2204494',
    Location: 'Hyderabad',
    Experience: '0',
    Function: 'Farmer Finance',
    MainGroup: 'Retail Banking',
    EndDate: null,
    JD: '<p>About the role</p><ul><li>Acquire farmer finance customers</li><li>Support portfolio growth</li></ul>',
    ShortUrl: 'https://icici-careers.mobi/1-1-1-abcd1234',
    Education: 'Graduation',
    Grade: 'Associate',
    f_short_description: 'Manage farmer finance relationships across local branches.',
  },
}

const blockedIncidentHtml = `
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <title>Error</title>
  </head>
  <body>
    <h2>Error</h2>
    <table summary="Error" border="0" bgcolor="#FEEE7A" cellpadding="0" cellspacing="0" width="400">
      <tr>
        <td>
          <table summary="Error" border="0" cellpadding="3" cellspacing="1">
            <tr valign="top" bgcolor="#FBFFDF" align="left">
              <td><strong>Error</strong></td>
            </tr>
            <tr valign="top" bgcolor="#FFFFFF">
              <td>
                This page can't be displayed. Contact support for additional information.<br />
                The incident ID is: 7645407135896463049.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`

test('buildSearchRequestPayload keeps ICICI Bank on the verified encrypted public search contract', async () => {
  const iciciBank = await loadIciciBankModule()

  assert.deepEqual(iciciBank.buildSearchRequestPayload(), {
    userId: 1,
    ApplicantId: '',
    keyword: '',
    maingroup: '',
    experience: '',
    PageNo: 0,
    limit: 12,
    isAllIndia: 3,
  })

  assert.deepEqual(iciciBank.buildSearchRequestPayload(3), {
    userId: 1,
    ApplicantId: '',
    keyword: '',
    maingroup: '',
    experience: '',
    PageNo: 3,
    limit: 12,
    isAllIndia: 3,
  })
})

test('extractSearchResults decrypts ICICI search payloads and derives public job detail pages', async () => {
  const iciciBank = await loadIciciBankModule()

  const jobs = iciciBank.extractSearchResults({
    Data: encryptIciciPayload(searchResponsePayload),
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Credit Manager',
    location: 'Across India',
    city: null,
    department: 'Credit and Policy',
    jobCategory: 'Retail Banking',
    jobId: '2204493',
    requisitionId: '2204493',
    sourceUrl: 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493',
    applyUrl: 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493',
    experienceRequired: '1 - 5 Yrs',
    minimumQualification: 'Graduation',
    closingDate: '2026-12-31',
    shortDescription: 'Evaluate corporate borrowers and approve credit proposals.',
    shortUrl: 'https://icici-careers.mobi/1-1-1-dcdad44d',
  })

  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(jobs[1].applyUrl, 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204494')
})

test('extractJobDetail decrypts ICICI single-job payloads and preserves the public detail page as the apply surface', async () => {
  const iciciBank = await loadIciciBankModule()

  const detail = iciciBank.extractJobDetail(
    { Data: encryptIciciPayload(detailPayloads[2204493]) },
    {
      title: 'Credit Manager',
      location: 'Across India',
      city: null,
      department: 'Credit and Policy',
      jobCategory: 'Retail Banking',
      jobId: '2204493',
      requisitionId: '2204493',
      sourceUrl: 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493',
      applyUrl: 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493',
      experienceRequired: '1 - 5 Yrs',
      minimumQualification: 'Graduation',
      shortDescription: 'Evaluate corporate borrowers and approve credit proposals.',
      shortUrl: 'https://icici-careers.mobi/1-1-1-dcdad44d',
    },
  )

  assert.equal(detail.title, 'Credit Manager')
  assert.equal(detail.location, 'Across India')
  assert.equal(detail.department, 'Credit and Policy')
  assert.equal(detail.jobCategory, 'Retail Banking')
  assert.equal(detail.jobId, '2204493')
  assert.equal(detail.requisitionId, '2204493')
  assert.equal(detail.minimumQualification, 'Graduation')
  assert.equal(detail.closingDate, '2026-12-31')
  assert.deepEqual(detail.requiredSkills, [
    'Evaluate corporate borrowers',
    'Manage credit proposals',
  ])
  assert.match(detail.jobDescription, /About the role/i)
  assert.match(detail.jobDescription, /Evaluate corporate borrowers/i)
  assert.equal(detail.applyUrl, 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493')
  assert.equal(detail.sourceUrl, 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493')

  const normalized = normalizeScrapedJob(detail, {
    source: 'icicibank',
    companyName: 'ICICI Bank Ltd',
    companyCareerPage: 'https://careers.icici.bank.in/CareerApplicant/Career/Home',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'ICICI Bank Ltd')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run fetches the ICICI public search and detail APIs, then decorates jobs for the shared runner', async () => {
  const iciciBank = await loadIciciBankModule()
  const requested = []
  const scraper = iciciBank.createIciciBankScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    now: () => '2026-07-10T00:00:00.000Z',
    fetchJson: async (url, options = {}) => {
      requested.push({
        url,
        method: options.method || 'GET',
        headers: options.headers || {},
        body: options.body || null,
      })

      if (url === iciciBank.SEARCH_API_URL) {
        return { Data: encryptIciciPayload(searchResponsePayload) }
      }

      const detailJobId = url.split('/').at(-1)
      if (detailPayloads[detailJobId]) {
        return { Data: encryptIciciPayload(detailPayloads[detailJobId]) }
      }

      throw new Error(`Unexpected ICICI URL: ${url}`)
    },
  })

  assert.deepEqual(requested.map((entry) => entry.method), ['POST', 'GET', 'GET'])
  assert.equal(requested[0].headers.authorization, 'Bearer token')
  assert.equal(requested[0].headers.Referer, 'https://careers.icici.bank.in/CareerApplicant/career/job-listing/')
  assert.deepEqual(
    decryptIciciPayload(JSON.parse(requested[0].body).data),
    iciciBank.buildSearchRequestPayload(),
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'ICICI Bank Ltd')
  assert.equal(jobs[0].source, 'icicibank')
  assert.equal(jobs[0].link, 'https://careers.icici.bank.in/CareerApplicant/Career/job-details/2204493')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.equal(jobs[1].city, 'Hyderabad')
})

test('run falls back to browser-backed ICICI APIs when Node fetch times out', async () => {
  const iciciBank = await loadIciciBankModule()
  const requestedPrimary = []
  const requestedBrowser = []

  const jobs = await iciciBank.createIciciBankScraper({ maxJobs: 1 }).run({
    now: () => '2026-08-02T12:00:00.000Z',
    fetchJson: async (url, options = {}) => {
      requestedPrimary.push({
        url,
        method: options.method || 'GET',
      })
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    fetchBrowserJson: async (url, options = {}, landingUrl) => {
      requestedBrowser.push({
        url,
        method: options.method || 'GET',
        landingUrl,
      })

      if (url === iciciBank.SEARCH_API_URL) {
        return { Data: encryptIciciPayload(searchResponsePayload) }
      }

      const detailJobId = url.split('/').at(-1)
      if (detailPayloads[detailJobId]) {
        return { Data: encryptIciciPayload(detailPayloads[detailJobId]) }
      }

      throw new Error(`Unexpected browser ICICI URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimary, [
    { url: iciciBank.SEARCH_API_URL, method: 'POST' },
    { url: `${iciciBank.DETAIL_API_BASE_URL}/2204493`, method: 'GET' },
  ])
  assert.deepEqual(requestedBrowser, [
    {
      url: iciciBank.SEARCH_API_URL,
      method: 'POST',
      landingUrl: iciciBank.CAREERS_PORTAL_URL,
    },
    {
      url: `${iciciBank.DETAIL_API_BASE_URL}/2204493`,
      method: 'GET',
      landingUrl: null,
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '2204493')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T12:00:00.000Z')
})

test('run falls back to browser-backed ICICI APIs when Node fetch returns the blocked HTML error page shell', async () => {
  const iciciBank = await loadIciciBankModule()
  const requestedPrimary = []
  const requestedBrowser = []

  const jobs = await iciciBank.createIciciBankScraper({ maxJobs: 1 }).run({
    now: () => '2026-08-15T00:00:00.000Z',
    fetchJson: async (url, options = {}) => {
      requestedPrimary.push({
        url,
        method: options.method || 'GET',
      })
      throw new Error(`ICICI Bank careers endpoint returned blocked HTML error page for ${url}`)
    },
    fetchBrowserJson: async (url, options = {}, landingUrl) => {
      requestedBrowser.push({
        url,
        method: options.method || 'GET',
        landingUrl,
      })

      if (url === iciciBank.SEARCH_API_URL) {
        return { Data: encryptIciciPayload(searchResponsePayload) }
      }

      const detailJobId = url.split('/').at(-1)
      if (detailPayloads[detailJobId]) {
        return { Data: encryptIciciPayload(detailPayloads[detailJobId]) }
      }

      throw new Error(`Unexpected browser ICICI URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPrimary, [
    { url: iciciBank.SEARCH_API_URL, method: 'POST' },
    { url: `${iciciBank.DETAIL_API_BASE_URL}/2204493`, method: 'GET' },
  ])
  assert.deepEqual(requestedBrowser, [
    {
      url: iciciBank.SEARCH_API_URL,
      method: 'POST',
      landingUrl: iciciBank.CAREERS_PORTAL_URL,
    },
    {
      url: `${iciciBank.DETAIL_API_BASE_URL}/2204493`,
      method: 'GET',
      landingUrl: null,
    },
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '2204493')
  assert.equal(jobs[0].scrapedAt, '2026-08-15T00:00:00.000Z')
})

test('run returns no jobs when the verified ICICI careers surfaces remain blocked after browser API fallback still receives HTML', async () => {
  const iciciBank = await loadIciciBankModule()
  const requestedPages = []

  const jobs = await iciciBank.createIciciBankScraper().run({
    fetchJson: async (url) => {
      throw new Error(`ICICI Bank careers endpoint returned blocked HTML error page for ${url}`)
    },
    fetchBrowserJson: async (url) => {
      throw new Error(`Expected JSON from ${url} but received an invalid API payload`)
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 200,
        url,
        html: blockedIncidentHtml,
      }
    },
  })

  assert.equal(jobs.length, 0)
  assert.deepEqual(requestedPages, [
    iciciBank.CAREERS_PORTAL_URL,
    iciciBank.JOB_LISTING_URL,
  ])
})
