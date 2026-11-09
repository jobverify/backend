import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CAREERS_API_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  VERIFIED_ON,
  createCodeAptScraper,
  extractBundleUrl,
  extractPublicJobs,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasOfficialShellSignal,
  hasVerifiedApiBackedCareersSignal,
  hasVerifiedCareersLink,
  isAuthRequiredCareersApiResponse,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>CodeApt | Home - CodeApt</title>
    </head>
    <body>
      <small class="brand-cyan fw-bold">Redefining Campus Placement Training</small>
      <li class="nav-item"><a class="nav-link" href="/placements/">Placements</a></li>
      <li class="nav-item"><a class="nav-link" href="/careers/">Careers</a></li>
      <p>&copy; 2025 CodeApt LLP. All Rights Reserved.</p>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>CodeApt | Careers & Openings - CodeApt</title>
    </head>
    <body>
      <h1 class="fw-bold brand-black">Career Opportunities</h1>
      <p class="text-muted lead">Exclusive job openings for CodeApt students.</p>

      <div class="card shadow-sm border-0 mb-4 hover-shadow transition-all">
        <div class="card-body p-4">
          <div class="row align-items-center">
            <div class="col-md-8">
              <div class="d-flex align-items-center mb-2">
                <h4 class="fw-bold mb-0 me-3">Microsoft - Software Engineering Intern - 2027 graduates</h4>
                <span class="badge bg-light text-dark border">
                  <i class="bi bi-geo-alt-fill me-1"></i> In Office | Pan India
                </span>
              </div>
              <h6 class="text-primary fw-bold mb-3">Microsoft</h6>
              <p class="text-muted mb-0">
                <p>Company name: Microsoft <br>Role: Software Engineering Intern<br>Batch Eligible: 2027 graduates<br>Expected Stipend: INR 1.25 Lacs per month</p>
                <p>Job ID: 200005595<br>Date posted: Dec 30, 2025<br>Work site: Fully on-site</p>
                <p>Profession: Software Engineering</p>
                <p>Employment type: Internship</p>
              </p>
              <small class="text-muted mt-2 d-block">Posted: Dec 31, 2025</small>
            </div>
            <div class="col-md-5 text-md-end mt-4 mt-md-0">
              <div class="d-flex flex-column align-items-end gap-2" id="action-group-3">
                <a href="https://apply.careers.microsoft.com/careers/job/1970393556625300" target="_blank" class="btn btn-primary px-4 w-100">
                  Apply on Company Site
                </a>
                <a href="/accounts/login/?next=/careers/" class="btn btn-outline-secondary btn-sm w-100">
                  Sign in to Apply
                </a>
              </div>
              <button id="success-btn-3" class="btn btn-success px-4 py-2 disabled d-none"></button>
            </div>
          </div>
        </div>
      </div>

      <div class="card shadow-sm border-0 mb-4 hover-shadow transition-all">
        <div class="card-body p-4">
          <div class="row align-items-center">
            <div class="col-md-8">
              <div class="d-flex align-items-center mb-2">
                <h4 class="fw-bold mb-0 me-3">Meta Hiring - Software Engineer (University Grad) - Bangalore</h4>
                <span class="badge bg-light text-dark border">
                  <i class="bi bi-geo-alt-fill me-1"></i> Bangalore
                </span>
              </div>
              <h6 class="text-primary fw-bold mb-3">Meta Careers</h6>
              <p class="text-muted mb-0">
                <p>Meta Hiring - Software Engineer (University Grad) - Bangalore</p>
                <p>Batch: 2025/2026</p>
                <p>Currently has, or is in the process of obtaining a Bachelor's degree in Computer Science.</p>
              </p>
              <small class="text-muted mt-2 d-block">Posted: Dec 30, 2025</small>
            </div>
            <div class="col-md-5 text-md-end mt-4 mt-md-0">
              <div class="d-flex flex-column align-items-end gap-2" id="action-group-2">
                <a href="https://www.metacareers.com/profile/job_details/1503103504068487" target="_blank" class="btn btn-primary px-4 w-100">
                  Apply on Company Site
                </a>
                <a href="/accounts/login/?next=/careers/" class="btn btn-outline-secondary btn-sm w-100">
                  Sign in to Apply
                </a>
              </div>
              <button id="success-btn-2" class="btn btn-success px-4 py-2 disabled d-none"></button>
            </div>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const shellHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <title>CodeApt</title>
      <script type="module" crossorigin src="/assets/index-DahbLw3O.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const shellCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
      <title>CodeApt</title>
      <script type="module" crossorigin src="/assets/index-DahbLw3O.js"></script>
    </head>
    <body>
      <div id="root"></div>
    </body>
  </html>
`

const shellBundleText = `
  const API_BASE = "https://api.codeapt.in";
  const chunks = ["assets/CareersPage-DECQsJno.js", "assets/PostingDetailPage-0EfnNnuE.js"];
  const services = { careers:{list:async()=>{}, get:async()=>{}, apply:async()=>{} } };
  const applyPath = "careers/\${e}/apply";
`

const authRequiredApiResponse = {
  status: 401,
  url: 'https://api.codeapt.in/api/careers',
  text: '{"error":{"message":"Authentication required","code":"UNAUTHENTICATED"}}',
}

test('CodeApt scraper recognizes the verified homepage and careers surface', () => {
  assert.equal(SOURCE, 'codeapt')
  assert.equal(COMPANY, 'CodeApt')
  assert.equal(HOMEPAGE_URL, 'https://www.codeapt.in/')
  assert.equal(CAREERS_URL, 'https://www.codeapt.in/careers/')
  assert.equal(CAREERS_API_URL, 'https://api.codeapt.in/api/careers')
  assert.equal(VERIFIED_ON, '2026-08-07')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
})

test('CodeApt scraper recognizes the verified Friday, August 7, 2026 auth-required SPA shell', () => {
  assert.equal(hasOfficialShellSignal(shellHomepageHtml), true)
  assert.equal(hasOfficialShellSignal(shellCareersHtml), true)
  assert.equal(extractBundleUrl(shellHomepageHtml), 'https://www.codeapt.in/assets/index-DahbLw3O.js')
  assert.equal(hasVerifiedApiBackedCareersSignal(shellBundleText), true)
  assert.equal(isAuthRequiredCareersApiResponse(authRequiredApiResponse), true)
})

test('CodeApt scraper extracts the current public career cards and external apply links', () => {
  const jobs = extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Microsoft - Software Engineering Intern - 2027 graduates',
    company: 'CodeApt',
    department: 'Microsoft',
    location: 'Pan India, India',
    city: 'Pan India',
    country: 'India',
    jobId: 'codeapt-3',
    requisitionId: '200005595',
    sourceUrl: 'https://www.codeapt.in/careers/',
    applyUrl: 'https://apply.careers.microsoft.com/careers/job/1970393556625300',
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-12-31',
    closingDate: null,
    jobDescription: [
      'Company name: Microsoft',
      'Role: Software Engineering Intern',
      'Batch Eligible: 2027 graduates',
      'Expected Stipend: INR 1.25 Lacs per month',
      'Job ID: 200005595',
      'Date posted: Dec 30, 2025',
      'Work site: Fully on-site',
      'Profession: Software Engineering',
      'Employment type: Internship',
    ].join('\n'),
    remoteStatus: 'On-site',
  })

  assert.deepEqual(jobs[1], {
    title: 'Meta Hiring - Software Engineer (University Grad) - Bangalore',
    company: 'CodeApt',
    department: 'Meta Careers',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'codeapt-2',
    requisitionId: '1503103504068487',
    sourceUrl: 'https://www.codeapt.in/careers/',
    applyUrl: 'https://www.metacareers.com/profile/job_details/1503103504068487',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2025-12-30',
    closingDate: null,
    jobDescription: [
      'Meta Hiring - Software Engineer (University Grad) - Bangalore',
      'Batch: 2025/2026',
      "Currently has, or is in the process of obtaining a Bachelor's degree in Computer Science.",
    ].join('\n'),
    remoteStatus: 'On-site',
  })
})

test('CodeApt scraper runs end to end and fails closed on homepage or card drift', async () => {
  const requestedUrls = []

  const jobs = await createCodeAptScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs[0].source, 'codeapt')
  assert.equal(jobs[0].link, 'https://apply.careers.microsoft.com/careers/job/1970393556625300')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)

  await assert.rejects(
    createCodeAptScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    createCodeAptScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head>
                  <title>CodeApt | Careers & Openings - CodeApt</title>
                </head>
                <body>
                  <h1>Career Opportunities</h1>
                  <p>Exclusive job openings for CodeApt students.</p>
                  <p>Apply on Company Site</p>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job-card structure/i,
  )
})

test('CodeApt returns an honest zero result when the verified public careers shell requires authentication for the careers API', async () => {
  const requested = []

  const jobs = await createCodeAptScraper().run({
    fetchPage: async (url) => {
      requested.push(url)

      if (url === HOMEPAGE_URL) return { status: 200, url, html: shellHomepageHtml }
      if (url === CAREERS_URL) return { status: 200, url, html: shellCareersHtml }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      requested.push(url)

      if (url === 'https://www.codeapt.in/assets/index-DahbLw3O.js') {
        return shellBundleText
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchResource: async (url) => {
      requested.push(url)

      if (url === CAREERS_API_URL) {
        return authRequiredApiResponse
      }

      throw new Error(`Unexpected resource URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    HOMEPAGE_URL,
    'https://www.codeapt.in/assets/index-DahbLw3O.js',
    CAREERS_URL,
    CAREERS_API_URL,
  ])
  assert.deepEqual(jobs, [])
})
