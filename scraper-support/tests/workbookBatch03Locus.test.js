import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/locus/script.js')
  } catch {
    assert.fail('Expected Locus scraper module at ../../scraper/locus/script.js')
  }
}

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in Locus | Be the force behind the Magic in Motion |</title>
  </head>
  <body>
    <main>
      <p>Backed by INGKA Group</p>
      <h1>The Software Machine</h1>
      <p>Digital workforce meets biological workforce — and together, they move the physical world.</p>
      <a href="https://locus.freshteam.com/jobs">Explore Open Roles</a>
      <h2>Find your place in the Software Machine</h2>
      <p>Hiring across engineering, product, data science, sales, and operations.</p>
      <p>Email careers@locus.sh</p>
    </main>
  </body>
</html>
`

const VERIFIED_LISTING_HTML = `
<!doctype html>
<html>
  <head>
    <title>Careers</title>
  </head>
  <body>
    <h3 class="advanced-page-title">Open Positions</h3>
    <div data-portal-id="job-role-list">
      <ul>
        <li data-portal-role="_role_engineering">
          <div class="role-title">
            <h5>
              Engineering
              <span class="mobile-role-count">- 2 Open Roles</span>
            </h5>
          </div>
          <div class="job-list">
            <a
              href="/jobs/BIPusuL3uPlh/senior-security-engineer"
              class="heading"
              data-portal-title="seniorsecurityengineer"
              data-portal-location="Bengaluru, Karnataka"
              data-portal-job-type="2"
              data-portal-remote-location="false"
            >
              <div class="row">
                <div class="job-list-info">
                  <div class="job-title">Senior Security Engineer</div>
                  <div class="job-desc text">Own and drive security engineering across cloud, DevSecOps, and detection engineering.</div>
                </div>
                <div class="job-location">
                  <div class="location-info">
                    Bengaluru, Karnataka
                    <br />
                    Full Time
                  </div>
                </div>
              </div>
            </a>
          </div>
        </li>
        <li data-portal-role="_role_customer_success">
          <div class="role-title">
            <h5>
              Customer Success
              <span class="mobile-role-count">- 1 Open Role</span>
            </h5>
          </div>
          <div class="job-list">
            <a
              href="/jobs/V_WbxtyQaGUe/sr-technical-account-manager"
              class="heading"
              data-portal-title="srtechnicalaccountmanager"
              data-portal-location="Bengaluru, Karnataka"
              data-portal-job-type="2"
              data-portal-remote-location="false"
            >
              <div class="row">
                <div class="job-list-info">
                  <div class="job-title">Sr. Technical Account Manager</div>
                  <div class="job-desc text">Support customers post go-live and drive operational value from Locus solutions.</div>
                </div>
                <div class="job-location">
                  <div class="location-info">
                    Bengaluru, Karnataka
                    <br />
                    Full Time
                  </div>
                </div>
              </div>
            </a>
          </div>
        </li>
        <li data-portal-role="_role_sales">
          <div class="role-title">
            <h5>
              Sales
              <span class="mobile-role-count">- 1 Open Role</span>
            </h5>
          </div>
          <div class="job-list">
            <a
              href="/jobs/USA123abcd/director-sales-usa-retail"
              class="heading"
              data-portal-title="directorsalesusaretail"
              data-portal-location="United States"
              data-portal-job-type="2"
              data-portal-remote-location="false"
            >
              <div class="row">
                <div class="job-list-info">
                  <div class="job-title">Director Sales - USA (Retail)</div>
                  <div class="job-desc text">Drive retail sales growth across US enterprise accounts.</div>
                </div>
                <div class="job-location">
                  <div class="location-info">
                    United States
                    <br />
                    Full Time
                  </div>
                </div>
              </div>
            </a>
          </div>
        </li>
      </ul>
    </div>
  </body>
</html>
`

const SENIOR_SECURITY_ENGINEER_DETAIL_HTML = `
<!doctype html>
<html>
  <body>
    <div class="job-details">
      <div class="job-details-header" id="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Engineering
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Senior Security Engineer</h1>
              <div class="stick-hide-in-mobile text-color">
                Location : Bangalore; (Full Time, Onsite)
                <div>
                  Work Type:
                  Full Time
                </div>
              </div>
            </div>
            <div class="col-xs-4 pull-xs-right text-right">
              <a href="#applicant-form" class="btn btn-custom">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <div>
          <h3>About the Role</h3>
          <p>We are looking for a Senior Security Engineer to own and drive our security engineering programme across cloud and infrastructure security, DevSecOps, and detection engineering.</p>
          <p>This is a hands-on senior IC role with broad scope. Minimum 5 years of experience in a multi-domain security engineering role is required.</p>
          <h3>Required Skills & Experience</h3>
          <ul>
            <li>5+ years of hands-on experience in a multi-domain security engineering role.</li>
            <li>Hands-on Kubernetes and container security expertise.</li>
          </ul>
        </div>
        <div class="application-form" id="applicant-form">
          <form action="/jobs/BIPusuL3uPlh/applicants" method="post"></form>
        </div>
      </div>
    </div>
  </body>
</html>
`

const TECHNICAL_ACCOUNT_MANAGER_DETAIL_HTML = `
<!doctype html>
<html>
  <body>
    <div class="job-details">
      <div class="job-details-header" id="job-details-header">
        <div class="content">
          <a class="link-back" id="job-details-back-btn">
            <i class="icon-arrow-left"></i>Customer Success
          </a>
          <div class="row">
            <div class="col-xs-8">
              <h1 class="brand-color">Sr. Technical Account Manager</h1>
              <div class="stick-hide-in-mobile text-color">
                Location : Bangalore; (Full Time, Onsite)
                <div>
                  Work Type:
                  Full Time
                </div>
              </div>
            </div>
            <div class="col-xs-4 pull-xs-right text-right">
              <a href="#applicant-form" class="btn btn-custom">Apply Now</a>
            </div>
          </div>
        </div>
      </div>
      <div class="job-details-content content">
        <div>
          <h3>About the role</h3>
          <p>Locus is seeking a Technical Account Manager who will be responsible for working with and supporting the customer to derive Operational Value and Success from the Locus solutions.</p>
          <p>5-7 years consulting experience in Supply Chain, Logistics and/or Transportation Management solutions required.</p>
          <ul>
            <li>Strong customer facing skills and deep understanding of supply chain processes.</li>
            <li>Experience in configuring and delivering software demonstrations are mandatory.</li>
          </ul>
        </div>
        <div class="application-form" id="applicant-form">
          <form action="/jobs/V_WbxtyQaGUe/applicants" method="post"></form>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('Locus registry selects native Darwinbox while legacy Freshteam parser compatibility remains', async () => {
  const locus = await loadModule()
  const provider = getScraperCatalog().find((entry) => entry.source === locus.SOURCE)
  const listings = locus.extractListingJobs(VERIFIED_LISTING_HTML)

  assert.equal(locus.SOURCE, 'locus')
  assert.equal(locus.COMPANY, 'Locus')
  assert.equal(locus.VERIFIED_ON, provider?.verifiedOn)
  assert.equal(locus.CAREERS_URL, 'https://locus.sh/careers/')
  assert.equal(locus.FRESHTEAM_JOBS_URL, 'https://locus.freshteam.com/jobs')
  assert.equal(
    locus.DISPOSITION,
    'verified-public-darwinbox-inventory',
  )
  assert.equal(
    locus.extractFreshteamJobsUrl(VERIFIED_CAREERS_HTML),
    'https://locus.freshteam.com/jobs',
  )
  assert.equal(locus.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(locus.hasFreshteamJobsBoardSignal(VERIFIED_LISTING_HTML), true)
  assert.equal(listings.length, 3)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      department: listing.department,
      locationText: listing.locationText,
      detailUrl: listing.detailUrl,
    })),
    [
      {
        title: 'Senior Security Engineer',
        department: 'Engineering',
        locationText: 'Bengaluru, Karnataka',
        detailUrl: 'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer',
      },
      {
        title: 'Sr. Technical Account Manager',
        department: 'Customer Success',
        locationText: 'Bengaluru, Karnataka',
        detailUrl: 'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager',
      },
      {
        title: 'Director Sales - USA (Retail)',
        department: 'Sales',
        locationText: 'United States',
        detailUrl: 'https://locus.freshteam.com/jobs/USA123abcd/director-sales-usa-retail',
      },
    ],
  )
  assert.match(provider?.modulePath || '', /[\\/]locus[\\/]script\.js$/i)
  assert.equal(provider?.bindingEvidence.verified, true)
  assert.equal(provider?.bindingEvidence.inventorySurface, 'https://locus.darwinbox.in/ms/candidateapi/job/alljobs?companyId=main')
  assert.ok(provider?.bindingEvidence.matchedLinks.includes(locus.DARWINBOX_CAREERS_URL))
  assert.equal(provider?.companyCareerPage, locus.CAREERS_URL)
  assert.equal(provider?.companyDomain, 'locus.sh')
  assert.equal(provider?.atsPlatform, 'darwinbox')
})

test('Locus extracts normalized India jobs from the verified Freshteam board and detail pages', async () => {
  const locus = await loadModule()
  const listings = locus.extractListingJobs(VERIFIED_LISTING_HTML)
  const securityJob = locus.extractJobDetail(SENIOR_SECURITY_ENGINEER_DETAIL_HTML, listings[0])
  const tamJob = locus.extractJobDetail(TECHNICAL_ACCOUNT_MANAGER_DETAIL_HTML, listings[1])

  assert.deepEqual(securityJob, {
    title: 'Senior Security Engineer',
    company: 'Locus',
    department: 'Engineering',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'BIPusuL3uPlh',
    requisitionId: 'BIPusuL3uPlh',
    sourceUrl: 'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer',
    applyUrl: 'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer',
    employmentType: 'Full-time',
    experienceRequired: '5+ years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the Role',
      'We are looking for a Senior Security Engineer to own and drive our security engineering programme across cloud and infrastructure security, DevSecOps, and detection engineering.',
      'This is a hands-on senior IC role with broad scope. Minimum 5 years of experience in a multi-domain security engineering role is required.',
      'Required Skills & Experience',
      '5+ years of hands-on experience in a multi-domain security engineering role.',
      'Hands-on Kubernetes and container security expertise.',
    ].join(' '),
    remoteStatus: 'On-site',
  })
  assert.deepEqual(tamJob, {
    title: 'Sr. Technical Account Manager',
    company: 'Locus',
    department: 'Customer Success',
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'V_WbxtyQaGUe',
    requisitionId: 'V_WbxtyQaGUe',
    sourceUrl: 'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager',
    applyUrl: 'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager',
    employmentType: 'Full-time',
    experienceRequired: '5-7 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the role',
      'Locus is seeking a Technical Account Manager who will be responsible for working with and supporting the customer to derive Operational Value and Success from the Locus solutions.',
      '5-7 years consulting experience in Supply Chain, Logistics and/or Transportation Management solutions required.',
      'Strong customer facing skills and deep understanding of supply chain processes.',
      'Experience in configuring and delivering software demonstrations are mandatory.',
    ].join(' '),
    remoteStatus: 'On-site',
  })
})

test('Locus run validates the official careers handoff, filters to India roles, and decorates Freshteam details', async () => {
  const locus = await loadModule()
  const requestedUrls = []

  const jobs = await locus.createLocusScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === locus.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === locus.FRESHTEAM_JOBS_URL) return VERIFIED_LISTING_HTML
      if (url === 'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer') {
        return SENIOR_SECURITY_ENGINEER_DETAIL_HTML
      }
      if (url === 'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager') {
        return TECHNICAL_ACCOUNT_MANAGER_DETAIL_HTML
      }
      throw new Error(`Unexpected Locus fixture URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    locus.CAREERS_URL,
    locus.FRESHTEAM_JOBS_URL,
    'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer',
    'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      scrapedAt: job.scrapedAt,
      link: job.link,
    })),
    [
      {
        title: 'Senior Security Engineer',
        source: 'locus',
        scrapedAt: '2026-07-30T00:00:00.000Z',
        link: 'https://locus.freshteam.com/jobs/BIPusuL3uPlh/senior-security-engineer',
      },
      {
        title: 'Sr. Technical Account Manager',
        source: 'locus',
        scrapedAt: '2026-07-30T00:00:00.000Z',
        link: 'https://locus.freshteam.com/jobs/V_WbxtyQaGUe/sr-technical-account-manager',
      },
    ],
  )
})

test('Locus fails closed when the verified careers handoff drifts', async () => {
  const locus = await loadModule()

  await assert.rejects(
    locus.createLocusScraper().run({
      fetchText: async (url) => {
        if (url === locus.CAREERS_URL) {
          return '<html><body><h1>Locus Careers</h1><a href="https://example.com/jobs">Explore Open Roles</a></body></html>'
        }
        throw new Error(`Unexpected URL in fail-closed fixture: ${url}`)
      },
    }),
    /Locus verified official careers page changed materially/i,
  )
})
