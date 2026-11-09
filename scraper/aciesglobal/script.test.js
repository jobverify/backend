import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_PAGE_URL,
  CAREER_PAGE_URL,
  CAREERS_PAGE_URL,
  CAREERS_ROUTE_URL,
  CONTRACT_CA_URL,
  HIRING_DAYS_URL,
  createAciesGlobalScraper,
  extractContractHiringJobs,
  hasHomepageCareersLink,
  hasOfficialCareersPageSignal,
  hasOfficialContractHiringSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const officialHomepageHtml = `
  <html lang="en">
    <head>
      <title>Acies | Democratizing Technology</title>
    </head>
    <body>
      <nav>
        <a href="/about-us">About Us</a>
        <a href="https://www.acies.consulting/careers.php"></a>
        <a href="careers.html">Careers</a>
      </nav>
      <main>
        <h1>Democratizing Technology</h1>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <html lang="en">
    <head>
      <title>Careers | Acies</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>More than a job. It's our mission to surmount the impossible.</h2>
        <a href="careers.html#custom-html-x0">View job openings</a>
        <a href="hiring-days.html">Hiring Days</a>
        <a href="careers-contract-ca.html">CA/ ACCA Professionals</a>
        <a href="careers-apply.html">Apply here</a>
        <h3>Entry-level job opportunities</h3>
        <p>careers@acies.consulting</p>
      </main>
    </body>
  </html>
`

const applicationHtml = `
  <html lang="en">
    <head>
      <title>Send us your application | Careers | Acies</title>
    </head>
    <body>
      <main>
        <h1>Send us your application</h1>
        <p>Careers</p>
      </main>
    </body>
  </html>
`

const hiringDaysHtml = `
  <html lang="en">
    <head>
      <title>Hiring Days | Careers | Acies</title>
    </head>
    <body>
      <main>
        <h1>Hiring Days</h1>
        <p>Fast track recruitment for select competencies</p>
        <a href="hiring-days.html#header01-1ry">View opportunities</a>
        <h1>Current hiring opportunities</h1>
        <p>Same-day hiring for select competencies</p>
      </main>
    </body>
  </html>
`

const contractHiringHtml = `
  <html lang="en">
    <head>
      <title>CA/ ACCA Professionals | Contract Hiring | Careers | Acies</title>
    </head>
    <body>
      <main>
        <h3>Contract Hiring Program</h3>
        <h1>CA/ ACCA Professionals</h1>
        <p>Join us and get to work on high-impact projects</p>
        <a href="#">Apply Now</a>
        <h1>Join our Contract Hiring Program!</h1>
        <p>Are you a qualified or semi-qualified CA or ACCA professional looking for exciting, flexible, project-based opportunities?</p>
        <h3>Highlights of this profile</h3>
        <h5>Qualification requirements</h5>
        <p>Qualified/ semi-qualified CA/ ACCA professionals</p>
        <h5>Area of expertise required</h5>
        <p>IA/ ORM/ BCM/ TPRM/ compliance and controls effectiveness</p>
        <h5>Industry of expertise required</h5>
        <p>Financial services (India and other geographies)</p>
        <h5>Nature of contracting</h5>
        <p>Project based</p>
        <h5>Nature of role</h5>
        <p>Customer/ client facing</p>
        <h5>Type of role</h5>
        <p>On-ground and in-person</p>
      </main>
    </body>
  </html>
`

test('homepage helpers detect the official Acies Global surface and careers route link', () => {
  assert.equal(CAREER_PAGE_URL, 'https://www.acies.consulting/')
  assert.equal(CAREERS_ROUTE_URL, 'https://www.acies.consulting/careers')
  assert.equal(CAREERS_PAGE_URL, 'https://www.acies.consulting/careers.html')
  assert.equal(APPLICATION_PAGE_URL, 'https://www.acies.consulting/careers-apply.html')
  assert.equal(CONTRACT_CA_URL, 'https://www.acies.consulting/careers-contract-ca.html')
  assert.equal(HIRING_DAYS_URL, 'https://www.acies.consulting/hiring-days.html')
  assert.equal(hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(hasHomepageCareersLink(officialHomepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(hasOfficialContractHiringSignal(contractHiringHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Acies</title></html>'), false)
  assert.equal(hasHomepageCareersLink('<html><body>No nav link</body></html>'), false)
})

test('contract hiring helper extracts the public Acies CA/ACCA profile into the shared job shape', () => {
  const jobs = extractContractHiringJobs(contractHiringHtml, {
    now: () => '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'CA/ ACCA Professionals',
      company: 'Acies Global',
      department: 'Contract Hiring Program',
      location: 'India and other geographies',
      city: null,
      country: 'India',
      jobId: 'ca-acca-professionals-contract-hiring',
      requisitionId: 'ca-acca-professionals-contract-hiring',
      sourceUrl: 'https://www.acies.consulting/careers-contract-ca.html',
      applyUrl: 'https://www.acies.consulting/careers-contract-ca.html',
      employmentType: 'Contract',
      experienceRequired: null,
      minimumQualification: 'Qualified/ semi-qualified CA/ ACCA professionals',
      preferredQualification: null,
      requiredSkills: [
        'IA/ ORM/ BCM/ TPRM/ compliance and controls effectiveness',
        'Customer/ client facing',
        'On-ground and in-person',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Join our Contract Hiring Program! Are you a qualified or semi-qualified CA or ACCA professional looking for exciting, flexible, project-based opportunities? Qualification requirements Qualified/ semi-qualified CA/ ACCA professionals Area of expertise required IA/ ORM/ BCM/ TPRM/ compliance and controls effectiveness Industry of expertise required Financial services (India and other geographies) Nature of contracting Project based Nature of role Customer/ client facing Type of role On-ground and in-person',
      source: 'aciesglobal',
      link: 'https://www.acies.consulting/careers-contract-ca.html',
      scrapedAt: '2026-07-19T00:00:00.000Z',
    },
  ])
})

test('run returns the public contract-hiring job while verified generic career routes remain non-listing surfaces', async () => {
  const requestedUrls = []
  const jobs = await createAciesGlobalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === CAREER_PAGE_URL) {
        return officialHomepageHtml
      }

      if (url === CAREERS_ROUTE_URL) {
        throw new Error(`HTTP 404 for ${url}`)
      }

      if (url === CAREERS_PAGE_URL) {
        return careersHtml
      }

      if (url === APPLICATION_PAGE_URL) {
        return applicationHtml
      }

      if (url === HIRING_DAYS_URL) {
        return hiringDaysHtml
      }

      if (url === CONTRACT_CA_URL) {
        return contractHiringHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-19T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    CAREERS_ROUTE_URL,
    CAREERS_PAGE_URL,
    APPLICATION_PAGE_URL,
    HIRING_DAYS_URL,
    CONTRACT_CA_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'CA/ ACCA Professionals')
  assert.equal(jobs[0].source, 'aciesglobal')
})

test('run fails closed when the fetched homepage no longer matches the official Acies surface', async () => {
  await assert.rejects(
    createAciesGlobalScraper().run({
      fetchText: async () => '<html><head><title>Placeholder</title></head><body>Coming soon</body></html>',
    }),
    /Acies Global homepage no longer matches the verified official site/i,
  )
})

test('run fails closed when the checked careers route stops being the verified 404 surface', async () => {
  await assert.rejects(
    createAciesGlobalScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) {
          return officialHomepageHtml
        }

        if (url === CAREERS_ROUTE_URL) {
          return '<html><head><title>Careers</title></head><body><h1>Careers</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Acies Global careers route no longer matches the verified public 404 surface/i,
  )
})

test('run fails closed when the contract-hiring page stops exposing the verified public profile', async () => {
  await assert.rejects(
    createAciesGlobalScraper().run({
      fetchText: async (url) => {
        if (url === CAREER_PAGE_URL) return officialHomepageHtml
        if (url === CAREERS_ROUTE_URL) throw new Error(`HTTP 404 for ${url}`)
        if (url === CAREERS_PAGE_URL) return careersHtml
        if (url === APPLICATION_PAGE_URL) return applicationHtml
        if (url === HIRING_DAYS_URL) return hiringDaysHtml
        if (url === CONTRACT_CA_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Acies Global contract hiring page no longer matches the verified public profile/i,
  )
})
