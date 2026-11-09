import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadBankOfAmericaModule = async () => {
  try {
    return await import('../../scraper/bankofamerica/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'bankofamerica',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))
const readTextFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildListingUrl keeps Bank of America listings on the public jobssearchservlet contract', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  assert.equal(
    bankOfAmerica.buildListingUrl(),
    'https://careers.bankofamerica.com/services/jobssearchservlet?search=jobsByCountry&country=India&start=0&rows=10',
  )

  assert.equal(
    bankOfAmerica.buildListingUrl({ start: 20, rows: 25 }),
    'https://careers.bankofamerica.com/services/jobssearchservlet?search=jobsByCountry&country=India&start=20&rows=25',
  )
})

test('extractListingSummary reads total counts from the Bank of America listing payload', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const summary = bankOfAmerica.extractListingSummary(readJsonFixture('listing-page-0.json'))
  assert.deepEqual(summary, {
    totalCount: 63,
  })
})

test('extractListings maps Bank of America jobsearchservlet postings into the shared listing contract', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const jobs = bankOfAmerica.extractListings(readJsonFixture('listing-page-0.json'))

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Executive Administrator',
    location: 'Mumbai, India',
    city: 'Mumbai',
    jobId: '26021140',
    requisitionId: '26021140',
    employmentType: null,
    experienceRequired: null,
    postingDate: '2026-06-29',
    closingDate: null,
    sourceUrl: 'https://careers.bankofamerica.com/en-us/job-detail/26021140/executive-administrator-mumbai-india',
    applyUrl: null,
    department: 'Administration; Corporate Services & Security',
  })
})

test('extractJobDetail pulls Bank of America description, apply link, and skill lists from the detail page', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const listing = bankOfAmerica.extractListings(readJsonFixture('listing-page-0.json'))[1]
  const detail = bankOfAmerica.extractJobDetail(
    readTextFixture('job-detail-26022159.html'),
    listing,
  )

  assert.equal(detail.title, 'Info Security Controls Specialist II B')
  assert.equal(detail.location, 'Hyderabad, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.jobId, '26022159')
  assert.equal(detail.requisitionId, '26022159')
  assert.equal(detail.department, 'Technology')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '8+ Years')
  assert.match(detail.jobDescription, /Privileged Access Management Services team/i)
  assert.equal(detail.minimumQualification, 'BE/BTECH/MCA/MSC (IT) equivalent (Any Technical Degree)')
  assert.deepEqual(detail.requiredSkills.slice(0, 3), [
    'Evaluate, solution, and remediate active directory IAM vulnerabilities.',
    'Develop, configure, integrate and deliver solutions to improve the privileged access posture of the company.',
    'Design and solution IAM-PAM compliance platform to identify control defects, assign remediation, measure and report on risk posture improvement',
  ])
  assert.equal(detail.postingDate, '2026-06-29')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.sourceUrl,
    'https://careers.bankofamerica.com/en-us/job-detail/26022159/info-security-controls-specialist-ii-b-hyderabad-india',
  )
  assert.equal(
    detail.applyUrl,
    'https://ghr.wd1.myworkdayjobs.com/lateral-ba_continuum/job/Hyderabad-Telangana/Info-Security-Controls-Specialist-II-B_26022159',
  )
})

test('extractJobDetail reads inline Bank of America Experience Range values from the official detail page', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const detail = bankOfAmerica.extractJobDetail(
    `
      <html>
        <head>
          <meta name="job-path" content="/en-us/job-detail/26021959/senior-analyst-multiple-locations">
        </head>
        <body>
          <div
            class="job-description-body"
            data-jobTitle="Senior Analyst"
            data-jobSaveLocation="Hyderabad, India"
            data-jobRequisitionID="26021959"
            data-jobFamily="Risk"
            data-jobTimeType="Full Time"
            data-postedDate="07/29/2026"
          ></div>
          <div class="job-description-body__internal job__external js-job-description-body-internal">
            <p><b>Requirements:</b></p>
            <p><b>Education : </b>Master's degree or equivalent work experience</p>
            <p><b>Experience Range: </b>5 yrs +</p>
            <a href="https://ghr.wd1.myworkdayjobs.com/lateral-ba_continuum/job/Hyderabad/Senior-Analyst_26021959-1">Apply</a>
          </div>
          <div class="job-description-body__video-wrapper"></div>
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "title": "Senior Analyst",
              "datePosted": "2026-07-29"
            }
          </script>
        </body>
      </html>
    `,
    {
      title: 'Senior Analyst',
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      jobId: '26021959',
      requisitionId: '26021959',
      sourceUrl: 'https://careers.bankofamerica.com/en-us/job-detail/26021959/senior-analyst-multiple-locations',
      employmentType: 'Full-time',
      experienceRequired: null,
      department: 'Risk',
      postingDate: '2026-07-29',
    },
  )

  assert.equal(detail.experienceRequired, '5 yrs +')
})

test('normalizeScrapedJob composes Bank of America experienced security roles from detail pages', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const detail = bankOfAmerica.extractJobDetail(
    readTextFixture('job-detail-26022159.html'),
    bankOfAmerica.extractListings(readJsonFixture('listing-page-0.json'))[1],
  )

  const normalized = normalizeScrapedJob(detail, {
    source: 'bankofamerica',
    companyName: 'Bank of America',
    companyCareerPage: 'https://careers.bankofamerica.com/en-us/job-search?searchstring=India&start=0&rows=10',
    atsPlatform: 'bankofamerica-jobssearchservlet',
  })

  assert.equal(normalized.company, 'Bank of America')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Mid Level')
  assert.equal(normalized.jobType, 'Full-time Experienced')
})

test('run fetches Bank of America listings and detail pages, then decorates shared runner fields', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const requested = []
  const scraper = bankOfAmerica.createBankOfAmericaScraper()

  const jobs = await scraper.run({
    maxPages: 1,
    fetchJson: async (url) => {
      requested.push(url)

      if (url.includes('/services/jobssearchservlet?')) {
        return readJsonFixture('listing-page-0.json')
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    fetchText: async (url) => {
      requested.push(url)

      if (url.includes('/26022159/')) {
        return readTextFixture('job-detail-26022159.html')
      }

      if (url.includes('/26021140/')) {
        return readTextFixture('job-detail-26022159.html')
          .replaceAll('26022159', '26021140')
          .replaceAll('Info Security Controls Specialist II B', 'Executive Administrator')
          .replaceAll('Hyderabad', 'Mumbai')
          .replaceAll('Info-Security-Controls-Specialist-II-B', 'Executive-Administrator')
          .replaceAll('HYD', 'MUM')
      }

      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.equal(requested.length, 4)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Bank of America')
  assert.equal(jobs[0].source, 'bankofamerica')
  assert.equal(
    jobs[0].link,
    'https://ghr.wd1.myworkdayjobs.com/lateral-ba_continuum/job/Mumbai-Telangana/Executive-Administrator_26021140',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run refetches the full first page when the Bank of America endpoint reports more jobs but ignores offsets', async () => {
  const bankOfAmerica = await loadBankOfAmericaModule()
  assert.ok(bankOfAmerica)

  const requested = []
  const scraper = bankOfAmerica.createBankOfAmericaScraper()
  const listingPayload = {
    ...readJsonFixture('listing-page-0.json'),
    totalMatches: 3,
  }
  const expandedPayload = {
    ...listingPayload,
    totalMatches: 3,
    jobsList: [
      ...listingPayload.jobsList,
      {
        postingTitle: 'Senior Manager',
        jobRequisitionId: '26021228',
        jcrURL: '/en-us/job-detail/26021228/senior-manager-mumbai-india',
        city: 'Mumbai',
        country: 'India',
        area: 'Customer Service; Investment & Trading; Operations & Support; Reporting, Analytics & Business Intelligence',
        postedDate: '06/29/2026',
        yearsOfExperience: 'N/A',
        location: 'Mumbai, India',
        primaryLocation: 'Mumbai, India'
      }
    ],
  }

  const jobs = await scraper.run({
    maxPages: 2,
    rows: 2,
    fetchJson: async (url) => {
      requested.push(url)

      if (url.includes('start=0') && url.includes('rows=2')) {
        return listingPayload
      }

      if (url.includes('start=2') && url.includes('rows=2')) {
        return {
          totalMatches: 3,
          jobsList: [],
        }
      }

      if (url.includes('start=0') && url.includes('rows=3')) {
        return expandedPayload
      }

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    fetchText: async (url) => {
      requested.push(url)

      if (url.includes('/26022159/')) {
        return readTextFixture('job-detail-26022159.html')
      }

      if (url.includes('/26021140/')) {
        return readTextFixture('job-detail-26022159.html')
          .replaceAll('26022159', '26021140')
          .replaceAll('Info Security Controls Specialist II B', 'Executive Administrator')
          .replaceAll('Hyderabad', 'Mumbai')
          .replaceAll('Info-Security-Controls-Specialist-II-B', 'Executive-Administrator')
          .replaceAll('HYD', 'MUM')
      }

      if (url.includes('/26021228/')) {
        return readTextFixture('job-detail-26022159.html')
          .replaceAll('26022159', '26021228')
          .replaceAll('Info Security Controls Specialist II B', 'Senior Manager')
          .replaceAll('Hyderabad', 'Mumbai')
          .replaceAll('Info-Security-Controls-Specialist-II-B', 'Senior-Manager')
          .replaceAll('HYD', 'MUM')
      }

      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(
    requested.filter((url) => url.includes('/services/jobssearchservlet?')).length,
    6,
  )
  assert.ok(requested.some((url) => url.includes('start=0') && url.includes('rows=3')))
})
