import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import * as kpmgScript from '../../scraper/kpmg/script.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kpmg',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))
const currentReceipts = JSON.parse(gunzipSync(readFileSync(path.join(fixturesDir, 'current-surfaces-20261105.json.gz'))))
const corporateResponse = url => url === kpmgScript.CAREERS_URL
  ? { ok: true, status: 200, url, text: async () => currentReceipts.find(packet => packet.url === url).body }
  : url === kpmgScript.INDIA_PRACTICE_URL
    ? { ok: false, status: 403, url, text: async () => currentReceipts.find(packet => packet.url === url).body } : null

test('buildSearchUrl keeps KPMG searches on the public Oracle Cloud careers finder with board-specific India scoping', () => {
  assert.equal(typeof kpmgScript.buildSearchUrl, 'function')
  assert.equal(
    kpmgScript.buildSearchUrl({ siteNumber: 'CX_1' }),
    'https://ejgk.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_1,limit=24,offset=0,location=India',
  )
  assert.equal(
    kpmgScript.buildSearchUrl({
      siteNumber: 'CX_3',
      page: 2,
      limit: 10,
      location: 'Bangalore, Karnataka, India',
    }),
    'https://ejgk.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_3,limit=10,offset=20,location=Bangalore, Karnataka, India',
  )
})

test('buildJobDetailUrl keeps KPMG detail links on the public Oracle Cloud candidate route', () => {
  assert.equal(typeof kpmgScript.buildJobDetailUrl, 'function')
  assert.equal(
    kpmgScript.buildJobDetailUrl({ siteNumber: 'CX_3001', jobId: 'INTG10043364' }),
    'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/INTG10043364',
  )
  assert.equal(
    kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_3001', jobId: 'INTG10043364' }),
    'https://ejgk.fa.em2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22INTG10043364%22,siteNumber=CX_3001',
  )
})

test('extractSearchResults normalizes KPMG Oracle Cloud requisitions and keeps only India jobs', () => {
  assert.equal(typeof kpmgScript.extractSearchResults, 'function')

  const payload = readJsonFixture('cx1-search-results.json')
  const jobs = kpmgScript.extractSearchResults(payload, { siteNumber: 'CX_1' })

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Associate Consultant -Market Risk',
    company: 'KPMG',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: 'INTG10043364',
    requisitionId: 'INTG10043364',
    sourceUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10043364',
    applyUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10043364',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-25',
    closingDate: null,
    jobDescription: 'Support market risk engagements. Deliver analytics and reporting.',
  })
})

test('extractJobDetail recovers experience requirements from the KPMG Oracle detail payload', () => {
  const detail = kpmgScript.extractJobDetail({
    items: [{
      Id: 'INTG10043364',
      Title: 'Associate Consultant -Market Risk',
      PostedDate: '2026-06-25',
      ExternalPostedStartDate: '2026-06-25T00:00:00+00:00',
      ExternalDescriptionStr: '<p>Work on market risk transformations.</p><p>Years of Experience Required: 2-4 years of relevant experience.</p>',
      ExternalResponsibilitiesStr: '<p>Deliver analytics and reporting.</p>',
      ExternalQualificationsStr: '<p>Bachelor degree in finance or engineering.</p>',
      PrimaryLocation: 'Mumbai, Maharashtra, India',
      JobSchedule: 'Full time',
      Department: 'Risk Consulting',
    }],
  }, {
    title: 'Associate Consultant -Market Risk',
    company: 'KPMG',
    department: null,
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    jobId: 'INTG10043364',
    requisitionId: 'INTG10043364',
    sourceUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10043364',
    applyUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10043364',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-25',
    closingDate: null,
    jobDescription: 'Support market risk engagements. Deliver analytics and reporting.',
  }, {
    siteNumber: 'CX_1',
  })

  assert.equal(detail.experienceRequired, '2-4 years')
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /years of experience required/i)
  assert.equal(detail.department, 'Risk Consulting')
})

test('extractJobDetail marks verified KPMG detail records as checked when experience is absent', () => {
  const detail = kpmgScript.extractJobDetail({
    items: [{
      Id: 'INTG10040445',
      Title: 'Manager - Data Engineer',
      ExternalDescriptionStr: '<p>Functional Skills</p><ul><li>Build data platforms.</li></ul>',
      ExternalResponsibilitiesStr: '<p>Lead delivery.</p>',
      ExternalQualificationsStr: '<p>B.E/B.Tech</p>',
      PrimaryLocation: 'Noida, Uttar Pradesh, India',
      JobSchedule: 'Full time',
      Department: 'Data Engineering',
    }],
  }, {
    title: 'Manager - Data Engineer',
    company: 'KPMG',
    department: null,
    location: 'Noida, Uttar Pradesh, India',
    city: 'Noida',
    jobId: 'INTG10040445',
    requisitionId: 'INTG10040445',
    sourceUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10040445',
    applyUrl: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/INTG10040445',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-14',
    closingDate: null,
    jobDescription: 'Functional skills. Build data platforms.',
  }, {
    siteNumber: 'CX_1',
  })

  assert.equal(detail.experienceRequired, null)
  assert.equal(detail.publicExperienceChecked, true)
  assert.match(detail.jobDescription, /Functional Skills/i)
})

test('createKpmgScraper aggregates current declared Oracle boards while retaining the denied India-practice gap', async () => {
  assert.equal(typeof kpmgScript.createKpmgScraper, 'function')

  const cx1Payload = {
    items: [{
      TotalJobsCount: 1,
      Limit: 24,
      requisitionList: [{
        Id: 'INTG10043364',
        Title: 'Associate Consultant -Market Risk',
        PostedDate: '2026-06-25',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Mumbai, Maharashtra, India',
        ShortDescriptionStr: 'Support market risk engagements.',
        ExternalResponsibilitiesStr: 'Deliver analytics and reporting.',
      }],
    }],
  }
  const cx3Payload = {
    items: [{
      TotalJobsCount: 1,
      Limit: 24,
      requisitionList: [{
        Id: 'INTG10043365',
        Title: 'Senior- Oracle Security',
        PostedDate: '2026-06-26',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Bangalore, Karnataka, India',
        Department: 'Cyber Security',
        ShortDescriptionStr: 'Secure Oracle estates.',
        ExternalResponsibilitiesStr: 'Lead reviews and remediation.',
      }],
    }],
  }
  const cx3001Payload = {
    items: [{
      TotalJobsCount: 1,
      Limit: 24,
      requisitionList: [{
        Id: 'INTG10043366',
        Title: 'Manager-KDNI Oracle HCM Cloud-Gurgaon',
        PostedDate: '2026-06-27',
        PrimaryLocationCountry: 'IN',
        PrimaryLocation: 'Gurgaon, Haryana, India',
        Department: 'Oracle HCM',
        ShortDescriptionStr: 'Drive HCM delivery.',
        ExternalResponsibilitiesStr: 'Manage enterprise implementations.',
      }],
    }],
  }
  const detailPayloadByUrl = new Map([
    [
      kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_1', jobId: 'INTG10043364' }),
      {
        items: [{
          Id: 'INTG10043364',
          Title: 'Associate Consultant -Market Risk',
          ExternalDescriptionStr: '<p>Support market risk engagements.</p><p>Years of Experience Required: 2-4 years of relevant experience.</p>',
          ExternalResponsibilitiesStr: '<p>Deliver analytics and reporting.</p>',
          PrimaryLocation: 'Mumbai, Maharashtra, India',
          JobSchedule: 'Full time',
        }],
      },
    ],
    [
      kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_3', jobId: 'INTG10043365' }),
      {
        items: [{
          Id: 'INTG10043365',
          Title: 'Senior- Oracle Security',
          ExternalDescriptionStr: '<p>Secure Oracle estates.</p><p>Minimum experience: 5 years.</p>',
          ExternalResponsibilitiesStr: '<p>Lead reviews and remediation.</p>',
          PrimaryLocation: 'Bangalore, Karnataka, India',
          JobSchedule: 'Full time',
          Department: 'Cyber Security',
        }],
      },
    ],
    [
      kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_3001', jobId: 'INTG10043366' }),
      {
        items: [{
          Id: 'INTG10043366',
          Title: 'Manager-KDNI Oracle HCM Cloud-Gurgaon',
          ExternalDescriptionStr: '<p>Drive HCM delivery.</p><p>Minimum experience: 8+ years.</p>',
          ExternalResponsibilitiesStr: '<p>Manage enterprise implementations.</p>',
          PrimaryLocation: 'Gurgaon, Haryana, India',
          JobSchedule: 'Full time',
          Department: 'Oracle HCM',
        }],
      },
    ],
  ])

  const responsesByUrl = new Map([
    [kpmgScript.buildSearchUrl({ siteNumber: 'CX_1', page: 0 }), cx1Payload],
    [kpmgScript.buildSearchUrl({ siteNumber: 'CX_3', page: 0 }), cx3Payload],
    [kpmgScript.buildSearchUrl({ siteNumber: 'CX_3001', page: 0 }), cx3001Payload],
  ])
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const official = corporateResponse(url)
    if (official) return official
    const payload = responsesByUrl.get(url) || detailPayloadByUrl.get(url)
    assert.ok(payload, `unexpected fetch for ${url}`)

    return {
      ok: true,
      async json() {
        return payload
      },
    }
  }

  const jobs = await kpmgScript.createKpmgScraper({
    maxPages: 1,
    fetchImpl,
  }).run()

  assert.deepEqual(calls, [
    kpmgScript.CAREERS_URL,
    kpmgScript.INDIA_PRACTICE_URL,
    kpmgScript.buildSearchUrl({ siteNumber: 'CX_3', page: 0 }),
    kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_3', jobId: 'INTG10043365' }),
    kpmgScript.buildSearchUrl({ siteNumber: 'CX_3', page: 0 }),
    kpmgScript.buildSearchUrl({ siteNumber: 'CX_3001', page: 0 }),
    kpmgScript.buildJobDetailApiUrl({ siteNumber: 'CX_3001', jobId: 'INTG10043366' }),
    kpmgScript.buildSearchUrl({ siteNumber: 'CX_3001', page: 0 }),
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      city: job.city,
      source: job.source,
      company: job.company,
      link: job.link,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: 'Senior- Oracle Security',
        city: 'Bangalore',
        source: 'kpmg',
        company: 'KPMG',
        link: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3/job/INTG10043365',
        experienceRequired: '5 years',
      },
      {
        title: 'Manager-KDNI Oracle HCM Cloud-Gurgaon',
        city: 'Gurgaon',
        source: 'kpmg',
        company: 'KPMG',
        link: 'https://ejgk.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_3001/job/INTG10043366',
        experienceRequired: '8+ years',
      },
    ],
  )
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
  assert.ok(jobs.every(job => job.sourceListingComplete === false && job.lifecycleCleanupAllowed === false))
})

test('createKpmgScraper bounds concurrent Oracle detail requests and forwards cancellation', async () => {
  const listingRecords = Array.from({ length: 8 }, (_, index) => ({
    Id: `INTG${index}`,
    Title: `Consultant ${index}`,
    PrimaryLocationCountry: 'IN',
    PrimaryLocation: 'Bangalore, Karnataka, India',
  }))
  const controller = new AbortController()
  let activeDetails = 0
  let maximumActiveDetails = 0
  const detailSignals = []

  const fetchImpl = async (url, options = {}) => {
    const official = corporateResponse(url)
    if (official) return official
    if (url.includes('recruitingCEJobRequisitions?')) {
      return {
        ok: true,
        async json() {
          return {
            items: [{
              TotalJobsCount: listingRecords.length,
              Limit: 24,
              requisitionList: listingRecords,
            }],
          }
        },
      }
    }

    detailSignals.push(options.signal)
    activeDetails += 1
    maximumActiveDetails = Math.max(maximumActiveDetails, activeDetails)
    await new Promise((resolve) => setImmediate(resolve))
    activeDetails -= 1

    const jobId = decodeURIComponent(url).match(/Id="([^"]+)"/)?.[1]
    return {
      ok: true,
      async json() {
        return { items: [{
          Id: jobId,
          Title: `Consultant ${jobId.replace('INTG', '')}`,
          PrimaryLocation: 'Bangalore, Karnataka, India',
        }] }
      },
    }
  }

  const jobs = await kpmgScript.createKpmgScraper({
    maxPages: 1,
    siteNumbers: ['CX_3'],
    detailConcurrency: 3,
    fetchImpl,
  }).run({ signal: controller.signal })

  assert.equal(jobs.length, listingRecords.length)
  assert.equal(maximumActiveDetails, 3)
  const reason = Object.freeze({ sourceCancellation: 'kpmg-control' })
  controller.abort(reason)
  assert.ok(detailSignals.every((signal) => signal.aborted && signal.reason === reason))
  assert.ok(jobs.every(job => job.sourceDetailComplete === false && job.lifecycleCleanupAllowed === false),
    'This concurrency model supplies no authored native descriptions')
  assert.deepEqual(jobs.map((job) => job.jobId), listingRecords.map((record) => record.Id))
})
