import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

// Legacy synthetic contracts below are compatibility fixtures, not native source evidence.

const VERIFIED_CAREERS_HTML = `
  <html>
    <head>
      <title>Careers at BuzzBoard: The Future of Autonomous Marketing Services</title>
      <link rel="canonical" href="https://www.buzzboard.ai/careers/">
      <meta
        name="description"
        content="Join us as we push the frontiers of autonomous digital marketing, shaping groundbreaking technologies and new industry standards for high-volume providers."
      >
    </head>
    <body>
      <main>
        <p>Careers</p>
        <h1>Join the future of autonomous digital marketing</h1>
        <a href="#open-positions">View open positions</a>
        <h2>Why work at BuzzBoard</h2>
        <section id="open-positions">
          <h2>Open Positions</h2>
          <article>
            <h3>Associate Product Manager / Product Manager</h3>
            <p>Remote - Full Time</p>
            <a href="https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&">Apply</a>
          </article>
          <article>
            <h3>Software Engineer (Node JS Developer)</h3>
            <p>Remote - Full Time</p>
            <a href="https://buzzboard.applytojob.com/apply/zZ5VZq3ojD/Software-Engineer-Node-JS-Developer?&">Apply</a>
          </article>
        </section>
        <section>
          <h3>Current opportunities</h3>
          <p>Ready to innovate with us?</p>
          <p>Join our team</p>
        </section>
      </main>
    </body>
  </html>
`

const VERIFIED_BOARD_HTML = `
  <html>
    <head>
      <title>BuzzBoard - Career Page</title>
    </head>
    <body>
      <a href="http://www.buzzboard.com">View Our Website</a>
      <p>Thanks for visiting our Career Page.</p>
      <h2>Current Openings</h2>
      <ul>
        <li>
          <h3>
            <a href="https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&">
              Associate Product Manager / Product Manager
            </a>
          </h3>
          <p>Remote</p>
          <p>Full Time</p>
        </li>
      </ul>
      <p>Powered by <a href="https://info.jazzhr.com">JazzHR</a></p>
    </body>
  </html>
`

const GENERIC_BOARD_LISTING_HTML = `
  <html>
    <head>
      <title>JazzHR &raquo; Job Listings</title>
    </head>
    <body>
      <main>
        <h2>Current Openings</h2>
        <a href="http://buzzboard.applytojob.com/apply/">View All Jobs</a>
      </main>
    </body>
  </html>
`

const VERIFIED_PRODUCT_MANAGER_DETAIL_HTML = `
  <html>
    <body>
      <main>
        <h2>BuzzBoard</h2>
        <h1>Associate Product Manager / Product Manager</h1>
        <p>Remote - Full Time</p>
        <p>Product Manager/Associate Product Manager</p>
        <p>
          About Us: At BuzzBoard, we are growing and building AI-driven products.
          Job Description: As a Product Manager at BuzzBoard, you will own one or
          more product lines and collaborate across engineering and design.
          Experience: 4+ years
        </p>
        <p>Current CTC?</p>
        <p>Expected CTC?</p>
        <p>Notice Period?</p>
        <p>Apply for this position</p>
        <p>Powered by JazzHR</p>
      </main>
    </body>
  </html>
`

const VERIFIED_NODE_DETAIL_HTML = `
  <html>
    <body>
      <main>
        <h2>BuzzBoard</h2>
        <h1>Software Engineer (Node JS Developer)</h1>
        <p>Remote</p>
        <p>Full Time</p>
        <p>
          Job Summary: We are seeking a skilled Node.js developer to build robust
          microservices and APIs. Minimum 5 Years
        </p>
        <p>Current Annual CTC?</p>
        <p>Notice Period?</p>
        <p>Apply for this position</p>
        <p>Powered by JazzHR</p>
      </main>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/buzzboard/script.js')
  } catch {
    assert.fail('Expected BuzzBoard scraper module at ../../scraper/buzzboard/script.js')
  }
}

test('BuzzBoard validates the verified first-party careers surface and extracts public openings from the official page', async () => {
  const buzzboard = await loadModule()
  const listings = buzzboard.extractOfficialOpenings(VERIFIED_CAREERS_HTML)
  const detail = buzzboard.extractJobDetail(VERIFIED_PRODUCT_MANAGER_DETAIL_HTML, listings[0])

  assert.equal(buzzboard.SOURCE, 'buzzboard')
  assert.equal(buzzboard.COMPANY, 'BuzzBoard')
  assert.equal(buzzboard.OFFICIAL_BRAND, 'BuzzBoard')
  assert.equal(buzzboard.VERIFIED_ON, '2026-08-01')
  assert.equal(buzzboard.CAREERS_URL, 'https://www.buzzboard.ai/careers/')
  assert.equal(buzzboard.BOARD_URL, 'https://buzzboard.applytojob.com/apply')
  assert.equal(
    buzzboard.DISPOSITION,
    'verified-first-party-careers-page-plus-public-jazzhr-board',
  )
  assert.match(buzzboard.VERIFIED_SURFACE_SUMMARY, /Saturday, August 1, 2026/)
  assert.match(buzzboard.VERIFIED_SURFACE_SUMMARY, /buzzboard\.applytojob\.com\/apply/i)
  assert.match(
    buzzboard.VERIFIED_SURFACE_SUMMARY,
    /Associate Product Manager \/ Product Manager/i,
  )
  assert.match(
    buzzboard.VERIFIED_SURFACE_SUMMARY,
    /Test Engineer \(Automation\)/i,
  )
  assert.equal(buzzboard.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(buzzboard.extractOfficialApplyUrls(VERIFIED_CAREERS_HTML), [
    'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
    'https://buzzboard.applytojob.com/apply/zZ5VZq3ojD/Software-Engineer-Node-JS-Developer?&',
  ])
  assert.equal(buzzboard.hasVerifiedBoardSignal(VERIFIED_BOARD_HTML), true)
  assert.deepEqual(buzzboard.extractVerifiedBoardJobIds(VERIFIED_BOARD_HTML), ['KHFbeOLhcc'])
  assert.equal(listings.length, 2)
  assert.deepEqual(
    {
      ...listings[0],
      ...Object.fromEntries(
        Object.entries(detail).filter(([, value]) => value != null),
      ),
    },
    {
      title: 'Associate Product Manager / Product Manager',
      company: 'BuzzBoard',
      department: null,
      location: 'Remote',
      city: null,
      country: null,
      jobId: 'KHFbeOLhcc',
      requisitionId: null,
      sourceUrl: 'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
      applyUrl: 'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
      employmentType: 'Full-time',
      experienceRequired: '4+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: "At BuzzBoard, we are growing and building AI-driven products. Job Description: As a Product Manager at BuzzBoard, you will own one or more product lines and collaborate across engineering and design. Experience: 4+ years",
      remoteStatus: 'Remote',
      sourcePublisher: 'BuzzBoard',
      legalHiringEmployer: null,
      sourceNativeLocationLine: 'Remote - Full Time',
      sourceNativeListingContext: 'Associate Product Manager / Product Manager Remote - Full Time Apply',
      sourceVisibilityVerified: true,
      sourceNativeDetailHTML: VERIFIED_PRODUCT_MANAGER_DETAIL_HTML,
      sourceDetailComplete: false,
      sourceListingComplete: false,
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
    },
  )
})

test('BuzzBoard run keeps remote roles with unknown countries in its audit after handoff validation', async () => {
  const buzzboard = await loadModule()
  const requestedUrls = [], audits = []

  const jobs = await buzzboard.createBuzzBoardScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buzzboard.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === buzzboard.BOARD_URL) return VERIFIED_BOARD_HTML
      if (url === 'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&') {
        return VERIFIED_PRODUCT_MANAGER_DETAIL_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
    onAudit: audit => audits.push(audit),
  })

  assert.deepEqual(
    requestedUrls,
    [
      buzzboard.CAREERS_URL,
      buzzboard.BOARD_URL,
      'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
    ],
  )
  assert.equal(jobs.length, 0)
  const audit = audits.at(-1)
  assert.equal(audit.observations.length, 2)
  assert.deepEqual(audit.unknownCountryRoleIds, ['KHFbeOLhcc', 'zZ5VZq3ojD'])
  assert.ok(audit.observations.every(job => job.country === null && job.location === 'Remote'))
  assert.equal(audit.details[0].originalHTML, VERIFIED_PRODUCT_MANAGER_DETAIL_HTML)
  assert.equal(audit.lifecycleCleanupAllowed, false)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
})

test('BuzzBoard run propagates detail failures while retaining unresolved observations', async () => {
  const buzzboard = await loadModule()
  const requestedUrls = [], audits = []

  await assert.rejects(buzzboard.createBuzzBoardScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buzzboard.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === buzzboard.BOARD_URL) return VERIFIED_BOARD_HTML
      if (url === 'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&') {
        throw new Error(`HTTP 429 for ${url}`)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
    onAudit: audit => audits.push(audit),
  }), /HTTP 429/)

  assert.deepEqual(
    requestedUrls,
    [
      buzzboard.CAREERS_URL,
      buzzboard.BOARD_URL,
      'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
    ],
  )
  assert.equal(audits.at(-1).observations.length, 2)
  assert.equal(audits.at(-1).stage, 'native-verification-failed')
  assert.match(audits.at(-1).failure.message, /HTTP 429/)
  assert.equal(audits.at(-1).lifecycleCleanupAllowed, false)
})

test('BuzzBoard drops stale careers-page listings when the live JazzHR board exposes different job ids', async () => {
  const buzzboard = await loadModule()

  const jobs = await buzzboard.createBuzzBoardScraper().run({
    fetchText: async (url) => {
      if (url === buzzboard.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === buzzboard.BOARD_URL) {
        return VERIFIED_BOARD_HTML.replace(
          'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&',
          'https://buzzboard.applytojob.com/apply/mqPSQLBius/Team-LeadSenior-Specialist-AI',
        ).replace(
          'Associate Product Manager / Product Manager',
          'Team Lead/Senior Specialist - AI',
        )
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})

test('BuzzBoard rejects a role detail URL that resolves to generic JazzHR listings', async () => {
  const buzzboard = await loadModule()

  await assert.rejects(buzzboard.createBuzzBoardScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      if (url === buzzboard.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === buzzboard.BOARD_URL) return VERIFIED_BOARD_HTML
      if (url === 'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc?&') {
        return GENERIC_BOARD_LISTING_HTML
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
  }), /generic listing instead of role criteria/)
})

test('BuzzBoard fails closed when the official careers surface or JazzHR board drifts', async () => {
  const buzzboard = await loadModule()

  await assert.rejects(
    buzzboard.createBuzzBoardScraper().run({
      fetchText: async (url) => {
        if (url === buzzboard.CAREERS_URL) {
          return `
            <html>
              <head>
                <title>Careers</title>
              </head>
              <body>
                <main>
                  <h1>Work with us</h1>
                  <p>Explore roles.</p>
                </main>
              </body>
            </html>
          `
        }

        return VERIFIED_BOARD_HTML
      },
    }),
    /official careers page changed materially/i,
  )

  await assert.rejects(
    buzzboard.createBuzzBoardScraper().run({
      fetchText: async (url) => {
        if (url === buzzboard.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === buzzboard.BOARD_URL) {
          return VERIFIED_BOARD_HTML
            .replace('https://info.jazzhr.com', 'https://example.com')
            .replace('Powered by', 'Powered by Something Else')
        }

        return VERIFIED_PRODUCT_MANAGER_DETAIL_HTML
      },
    }),
    /public JazzHR board changed materially/i,
  )

  await assert.rejects(
    buzzboard.createBuzzBoardScraper().run({
      fetchText: async (url) => {
        if (url === buzzboard.CAREERS_URL) {
          return VERIFIED_CAREERS_HTML.replace(
            'https://buzzboard.applytojob.com/apply/jobs/details/KHFbeOLhcc',
            'https://example.com/apply/KHFbeOLhcc',
          )
        }

        if (url === buzzboard.BOARD_URL) return VERIFIED_BOARD_HTML
        return VERIFIED_PRODUCT_MANAGER_DETAIL_HTML
      },
    }),
    /official careers page changed materially/i,
  )
})
