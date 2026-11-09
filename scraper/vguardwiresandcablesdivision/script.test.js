import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const readFixture = (name) => fs.readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const applyNowHtml = readFixture('apply-now.html')
const atsViewAllHtml = readFixture('ats-view-all.html')
const job6241Html = readFixture('job-6241.html')
const job6099Html = readFixture('job-6099.html')

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected V-Guard Wires & Cables Division scraper module at ./script.js')
  }
}

test('V-Guard Wires & Cables Division verifies the official homepage, apply-now handoff, and ATS list surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'vguardwiresandcablesdivision')
  assert.equal(scraper.COMPANY, 'V-Guard Wires & Cables Division')
  assert.equal(scraper.HOMEPAGE_URL, 'https://www.vguard.in/')
  assert.equal(scraper.APPLY_NOW_URL, 'https://www.vguard.in/careers/apply-now')
  assert.equal(scraper.ATS_LIST_URL, 'https://vguard.mua.hrdepartment.com/hr/ats/JobSearch/viewAll')

  assert.equal(scraper.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(scraper.hasOfficialApplyNowSignal(applyNowHtml), true)
  assert.equal(scraper.hasOfficialAtsListingsSignal(atsViewAllHtml), true)
})

test('V-Guard Wires & Cables Division extracts the current official ATS listings', async () => {
  const scraper = await loadModule()

  assert.deepEqual(scraper.extractListings(atsViewAllHtml), [
    {
      title: 'Executive/Sr. Executive/Officer - Marketing',
      sourceUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241',
      location: 'Bangalore Marketing Bangalore, KA, IN 560 038; Chennai, TN, IN 600 114 (Primary); Hubli Marketing Hubli, KA, IN 580021;',
      postingDate: '2024-12-09',
      department: 'Marketing',
      requisitionId: 'South Mktg 1',
    },
    {
      title: 'Chief Officer - Finance & Accounts',
      sourceUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099',
      location: 'Corporate Office Cochin, KL, IN 682 028;',
      postingDate: '2024-10-23',
      department: 'Finance',
      requisitionId: '5504',
    },
  ])
})

test('V-Guard Wires & Cables Division extracts job details from the official ATS postings', async () => {
  const scraper = await loadModule()

  const marketingJob = scraper.extractJobDetail(job6241Html, {
    title: 'Executive/Sr. Executive/Officer - Marketing',
    sourceUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241',
    location: 'Bangalore Marketing Bangalore, KA, IN 560 038; Chennai, TN, IN 600 114 (Primary); Hubli Marketing Hubli, KA, IN 580021;',
    postingDate: '2024-12-09',
    department: 'Marketing',
    requisitionId: 'South Mktg 1',
  })

  assert.deepEqual(
    {
      title: marketingJob.title,
      company: marketingJob.company,
      location: marketingJob.location,
      city: marketingJob.city,
      state: marketingJob.state,
      country: marketingJob.country,
      jobId: marketingJob.jobId,
      requisitionId: marketingJob.requisitionId,
      department: marketingJob.department,
      employmentType: marketingJob.employmentType,
      postingDate: marketingJob.postingDate,
      closingDate: marketingJob.closingDate,
      education: marketingJob.minimumQualification,
      experienceRequired: marketingJob.experienceRequired,
      applyUrl: marketingJob.applyUrl,
    },
    {
      title: 'Executive/Sr. Executive/Officer - Marketing',
      company: 'V-Guard Wires & Cables Division',
      location: 'Bangalore Marketing - Bangalore, KA 560 038 IN; Chennai - Chennai, TN 600 114 IN (Primary); Hubli Marketing - Hubli, KA 580021 IN;',
      city: 'Chennai',
      state: 'Tamil Nadu',
      country: 'India',
      jobId: '6241',
      requisitionId: 'South Mktg 1',
      department: 'Sales & Marketing',
      employmentType: 'Full-time',
      postingDate: '2024-12-09',
      closingDate: '2024-12-13',
      education: 'MBA',
      experienceRequired: null,
      applyUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241',
    },
  )
  assert.match(marketingJob.jobDescription, /Driving the sales of/i)
  assert.match(marketingJob.jobDescription, /Handling distributors and dealers/i)
  assert.ok(marketingJob.requiredSkills.includes('Prior experience in Channel sales.'))

  const financeJob = scraper.extractJobDetail(job6099Html, {
    title: 'Chief Officer - Finance & Accounts',
    sourceUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099',
    location: 'Corporate Office Cochin, KL, IN 682 028;',
    postingDate: '2024-10-23',
    department: 'Finance',
    requisitionId: '5504',
  })

  assert.deepEqual(
    {
      title: financeJob.title,
      company: financeJob.company,
      location: financeJob.location,
      city: financeJob.city,
      state: financeJob.state,
      country: financeJob.country,
      jobId: financeJob.jobId,
      requisitionId: financeJob.requisitionId,
      department: financeJob.department,
      employmentType: financeJob.employmentType,
      postingDate: financeJob.postingDate,
      closingDate: financeJob.closingDate,
      education: financeJob.minimumQualification,
      applyUrl: financeJob.applyUrl,
    },
    {
      title: 'Chief Officer - Finance & Accounts',
      company: 'V-Guard Wires & Cables Division',
      location: 'Corporate Office - Cochin, KL 682 028 IN (Primary);',
      city: 'Cochin',
      state: 'Kerala',
      country: 'India',
      jobId: '6099',
      requisitionId: '5504',
      department: 'Finance & Accounts',
      employmentType: 'Full-time',
      postingDate: '2024-10-23',
      closingDate: null,
      education: 'CA',
      applyUrl: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099',
    },
  )
  assert.match(financeJob.jobDescription, /Participate in month close activity/i)
  assert.match(financeJob.jobDescription, /Preferred Educational Requirements/i)
})

test('V-Guard Wires & Cables Division run returns the current official ATS jobs with metadata', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createVGuardWiresAndCablesDivisionScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === scraper.HOMEPAGE_URL) return homepageHtml
      if (url === scraper.APPLY_NOW_URL) return applyNowHtml
      if (url === scraper.ATS_LIST_URL) return atsViewAllHtml
      if (url === 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241') return job6241Html
      if (url === 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099') return job6099Html

      throw new Error(`Unexpected V-Guard URL: ${url}`)
    },
    now: () => '2026-07-13T10:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    scraper.HOMEPAGE_URL,
    scraper.APPLY_NOW_URL,
    scraper.ATS_LIST_URL,
    'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241',
    'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      company: job.company,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Executive/Sr. Executive/Officer - Marketing',
        source: 'vguardwiresandcablesdivision',
        company: 'V-Guard Wires & Cables Division',
        link: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241',
        companyCareerPage: 'https://www.vguard.in/careers/apply-now',
        companyDomain: 'vguard.in',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-13T10:30:00.000Z',
      },
      {
        title: 'Chief Officer - Finance & Accounts',
        source: 'vguardwiresandcablesdivision',
        company: 'V-Guard Wires & Cables Division',
        link: 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099',
        companyCareerPage: 'https://www.vguard.in/careers/apply-now',
        companyDomain: 'vguard.in',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-13T10:30:00.000Z',
      },
    ],
  )
})

test('V-Guard Wires & Cables Division fails closed when the verified handoff or ATS surface drifts', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createVGuardWiresAndCablesDivisionScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return homepageHtml
        if (url === scraper.APPLY_NOW_URL) {
          return applyNowHtml.replace(
            'https://vguard.mua.hrdepartment.com/hr/ats/JobSearch/viewAll',
            'https://example.com/jobs',
          )
        }
        throw new Error(`Unexpected V-Guard URL: ${url}`)
      },
    }),
    /verified official apply-now page/i,
  )

  await assert.rejects(
    scraper.createVGuardWiresAndCablesDivisionScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return homepageHtml
        if (url === scraper.APPLY_NOW_URL) return applyNowHtml
        if (url === scraper.ATS_LIST_URL) {
          return atsViewAllHtml.replace('jobSearchResultsGrid_table', 'unexpected-grid')
        }
        throw new Error(`Unexpected V-Guard URL: ${url}`)
      },
    }),
    /verified official ats listings/i,
  )

  await assert.rejects(
    scraper.createVGuardWiresAndCablesDivisionScraper().run({
      fetchText: async (url) => {
        if (url === scraper.HOMEPAGE_URL) return homepageHtml
        if (url === scraper.APPLY_NOW_URL) return applyNowHtml
        if (url === scraper.ATS_LIST_URL) return atsViewAllHtml
        if (url === 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6241') {
          return job6241Html.replace('Apply to this Job', 'Contact Recruiter')
        }
        if (url === 'https://vguard.mua.hrdepartment.com/hr/ats/Posting/view/6099') {
          return job6099Html
        }
        throw new Error(`Unexpected V-Guard URL: ${url}`)
      },
    }),
    /verified official ats job detail/i,
  )
})
