import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'scraper',
  'cloverinfotech',
  'fixtures',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadCloverModule = async () => {
  try {
    return await import('../../scraper/cloverinfotech/script.js')
  } catch {
    return null
  }
}

const pageOneHtml = readFixture('job-openings-page-1.html')
const pageTwoHtml = readFixture('job-openings-page-2.html')
const oracleFusionDetailHtml = readFixture('oracle-fusion-erp-finance-consultant.html')
const oneStreamDetailHtml = readFixture('senior-analyst-application-support-onestream-xf.html')
const javaTechLeadDetailHtml = readFixture('java-tech-lead-payments-domain.html')

test('buildJobOpeningsPageUrl keeps Clover Infotech on the verified first-party paginated jobs surface', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.equal(clover.JOB_OPENINGS_URL, 'https://www.cloverinfotech.com/job-openings/')
  assert.equal(
    clover.buildJobOpeningsPageUrl(),
    'https://www.cloverinfotech.com/job-openings/',
  )
  assert.equal(
    clover.buildJobOpeningsPageUrl(2),
    'https://www.cloverinfotech.com/job-openings/page/2/',
  )
})

test('Clover Infotech exports the desktop browser user agent used for blocked job pages', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.equal(
    clover.DESKTOP_BROWSER_USER_AGENT,
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  )
})

test('isIndiaLocation keeps Clover India city groups and rejects foreign listings', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.equal(clover.isIndiaLocation('Indore, Gurugram'), true)
  assert.equal(
    clover.isIndiaLocation('Mumbai, Pune, Chennai, Bengaluru, Delhi NCR, Hyderabad'),
    true,
  )
  assert.equal(clover.isIndiaLocation('New Jersey, New York'), false)
  assert.equal(clover.isIndiaLocation('Singapore'), false)
})

test('extractListings parses Clover job cards and filters them to India roles', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.equal(clover.hasOfficialJobOpeningsSignal(pageOneHtml), true)

  const listings = clover.extractListings(pageOneHtml)

  assert.equal(listings.length, 2)
  assert.deepEqual(listings[0], {
    title: 'Oracle Fusion ERP Finance Consultant',
    sourceUrl: 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
    location: 'Indore, Gurugram',
    city: 'Indore',
    experienceRequired: '6+ Years',
  })
  assert.deepEqual(listings[1], {
    title: 'Senior Analyst – Application Support (OneStream XF)',
    sourceUrl: 'https://www.cloverinfotech.com/jobs/senior-analyst-application-support-onestream-xf/',
    location: 'Gurugram',
    city: 'Gurugram',
    experienceRequired: '5+ Years',
  })
})

test('extractPaginationSummary reads Clover page navigation from the official jobs pages', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.deepEqual(clover.extractPaginationSummary(pageOneHtml), {
    currentPage: 1,
    totalPages: 2,
  })
  assert.deepEqual(clover.extractPaginationSummary(pageTwoHtml), {
    currentPage: 2,
    totalPages: 2,
  })
})

test('extractJobDetail pulls Clover job detail content, first-party form metadata, and published date', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')
  assert.equal(clover.hasOfficialJobDetailSignal(oracleFusionDetailHtml), true)

  const detail = clover.extractJobDetail(oracleFusionDetailHtml, {
    title: 'Oracle Fusion ERP Finance Consultant',
    sourceUrl: 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
    location: 'Indore, Gurugram',
    city: 'Indore',
    experienceRequired: '6+ Years',
  })

  assert.deepEqual(detail, {
    title: 'Oracle Fusion ERP Finance Consultant',
    jobId: '142451',
    requisitionId: '142451',
    location: 'Gurugram / Indore',
    city: 'Gurugram',
    employmentType: null,
    experienceRequired: '6+ Years',
    jobDescription:
      'Job Summary: We are looking for an experienced Oracle Fusion ERP Finance Consultant to support, configure, and enhance Oracle Fusion Cloud Financials applications. Key Responsibilities: Provide day-to-day production support for Oracle Fusion Cloud Financials applications. Support Oracle Fusion Finance modules including General Ledger (GL), Accounts Payable (AP), Accounts Receivable (AR), Fixed Assets (FA), and Cash Management (CM). Support month-end financial close activities. Qualifications and Skills: Bachelor’s degree in Commerce, Finance, Accounting, Engineering, or equivalent (MBA/CA preferred). Minimum 6 years of Oracle Fusion Finance / ERP Application Support experience. Experience with OTBI, BI Publisher, FBDI, REST APIs, and basic SQL. Good to Have: Oracle Fusion Cloud Finance Certification. Experience with Finance data models and Oracle Fusion integrations.',
    minimumQualification:
      'Bachelor’s degree in Commerce, Finance, Accounting, Engineering, or equivalent (MBA/CA preferred).',
    preferredQualification: 'Oracle Fusion Cloud Finance Certification.',
    requiredSkills: [
      'Provide day-to-day production support for Oracle Fusion Cloud Financials applications.',
      'Support Oracle Fusion Finance modules including General Ledger (GL), Accounts Payable (AP), Accounts Receivable (AR), Fixed Assets (FA), and Cash Management (CM).',
      'Support month-end financial close activities.',
    ],
    postingDate: '2026-07-01T10:56:38+00:00',
    closingDate: null,
    applyUrl: 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
    sourceUrl: 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
  })
})

test('extractJobDetail ignores generic widget headings and keeps the specific job title', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')

  const detail = clover.extractJobDetail(`
    <html>
      <head>
        <title>Business Development and Relationship Manager</title>
      </head>
      <body>
        <h3>Job Openings</h3>
        <h3>Apply For Job</h3>
        <h3>Job Features</h3>
        <div class="job-description"></div>
        <div class="job-features"></div>
        <div class="jobpost-form"></div>
      </body>
    </html>
  `, {
    title: 'Business Development and Relationship Manager',
    sourceUrl: 'https://www.cloverinfotech.com/jobs/business-development-and-relationship-manager/',
    location: 'Mumbai',
    city: 'Mumbai',
    experienceRequired: '5+ Years',
  })

  assert.equal(detail.title, 'Business Development and Relationship Manager')
})

test('run paginates the Clover first-party jobs pages, fetches only India detail pages, and decorates the jobs', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')

  const requestedUrls = []
  const jobs = await clover.createCloverInfotechScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === clover.buildJobOpeningsPageUrl(1)) return pageOneHtml
      if (url === clover.buildJobOpeningsPageUrl(2)) return pageTwoHtml
      if (url === 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/') {
        return oracleFusionDetailHtml
      }
      if (url === 'https://www.cloverinfotech.com/jobs/senior-analyst-application-support-onestream-xf/') {
        return oneStreamDetailHtml
      }
      if (url === 'https://www.cloverinfotech.com/jobs/java-tech-lead-payments-domain/') {
        return javaTechLeadDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    clover.buildJobOpeningsPageUrl(1),
    'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
    'https://www.cloverinfotech.com/jobs/senior-analyst-application-support-onestream-xf/',
    clover.buildJobOpeningsPageUrl(2),
    'https://www.cloverinfotech.com/jobs/java-tech-lead-payments-domain/',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.sourceUrl]),
    [
      [
        'Oracle Fusion ERP Finance Consultant',
        'Gurugram / Indore',
        'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/',
      ],
      [
        'Senior Analyst – Application Support (OneStream XF)',
        'Gurugram',
        'https://www.cloverinfotech.com/jobs/senior-analyst-application-support-onestream-xf/',
      ],
      [
        'Java Tech Lead – Payments Domain',
        'Mumbai',
        'https://www.cloverinfotech.com/jobs/java-tech-lead-payments-domain/',
      ],
    ],
  )
  assert.equal(jobs[0].source, 'cloverinfotech')
  assert.equal(jobs[0].company, 'Clover Infotech')
  assert.equal(jobs[0].companyCareerPage, 'https://www.cloverinfotech.com/job-openings/')
  assert.equal(jobs[0].companyDomain, 'cloverinfotech.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-14T00:00:00.000Z')
})

test('run returns [] when the verified Clover job openings route matches the live Cloudflare challenge shell', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')

  const requestedPages = []
  const jobs = await clover.createCloverInfotechScraper().run({
    fetchText: async (url) => { throw new Error(`HTTP 403 for ${url}`) },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2abf26a28447e84-MAA',
        },
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <title>Just a moment...</title>
              <noscript>
                <meta http-equiv="refresh" content="0;url=https://www.cloverinfotech.com/job-openings/?ki-cf-botcl=1">
              </noscript>
            </head>
            <body>
              <h1>Checking your browser...</h1>
              <p>This may take a few seconds.</p>
              <script>
                window.location.replace("https://www.cloverinfotech.com/job-openings/?ki-cf-botcl=1");
              </script>
            </body>
          </html>
        `,
      }
    },
  })

  assert.deepEqual(requestedPages, [clover.buildJobOpeningsPageUrl(1)])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified Clover listings or job details drift away from the trusted first-party surface', async () => {
  const clover = await loadCloverModule()

  assert.ok(clover, 'Expected Clover Infotech scraper module at ../../scraper/cloverinfotech/script.js')

  await assert.rejects(
    clover.createCloverInfotechScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body>No jobs</body></html>',
    }),
    /verified first-party job openings page/i,
  )

  await assert.rejects(
    clover.createCloverInfotechScraper().run({
      fetchText: async (url) => {
        if (url === clover.buildJobOpeningsPageUrl(1)) return pageOneHtml
        if (url === 'https://www.cloverinfotech.com/jobs/oracle-fusion-erp-finance-consultant/') {
          return '<html><head><title>Oracle Fusion ERP Finance Consultant</title></head><body><h1>Broken</h1></body></html>'
        }
        if (url === 'https://www.cloverinfotech.com/jobs/senior-analyst-application-support-onestream-xf/') {
          return oneStreamDetailHtml
        }
        if (url === clover.buildJobOpeningsPageUrl(2)) return pageTwoHtml
        if (url === 'https://www.cloverinfotech.com/jobs/java-tech-lead-payments-domain/') {
          return javaTechLeadDetailHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party job detail page/i,
  )
})
