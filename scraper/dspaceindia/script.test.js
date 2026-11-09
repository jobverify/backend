import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_EMAIL,
  CAREERS_LANDING_URL,
  COMPANY,
  COMPANY_DOMAIN,
  CURRENT_POSITIONS_URL,
  SOURCE,
  createDSpaceIndiaScraper,
  extractIndiaJobsFromListingHtml,
  hasOfficialCareersLandingSignal,
  hasVerifiedCurrentPositionsSignal,
} from './script.js'

const malformedJsonControlChar = String.fromCharCode(2)

const legacyLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - dSPACE</title>
  </head>
  <body>
    <h1>Shape the future of mobility with us</h1>
    <a href="/en/pub/home/career/jobfinder.cfm">Job Finder</a>
    <div>Professionals</div>
  </body>
</html>
`

const currentLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - dSPACE</title>
    <link rel="canonical" href="https://www.dspace.com/en/pub/home/career.cfm">
  </head>
  <body>
    <h1>Shape the future of mobility with us</h1>
    <p>Then apply now.</p>
    <a href="../../../en/pub/home/career/jobfinder/stellen.cfm">Current Positions</a>
    <a href="../../../en/pub/home/career/career-india.cfm">Career in India</a>
  </body>
</html>
`

const filterSections = {
  default: {
    groups: [
      {
        id: 'country',
        filters: [
          { name: 'India', value: 'term-land-9' },
        ],
      },
      {
        id: 'location',
        filters: [
          { name: 'Trivandrum', value: 'term-ort-1031' },
        ],
      },
      {
        id: 'employment_type',
        filters: [
          { name: 'Full-time', value: 'term-emp-fulltime' },
        ],
      },
      {
        id: 'trade',
        filters: [
          { name: 'Engineering', value: 'term-trade-engineering' },
        ],
      },
    ],
  },
}

const resultsData = [
  {
    title: 'Software Developer (f/m/d)',
    href: '/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
    location: 'Trivandrum',
    description: 'Minimum of 3 years experience with embedded systems.',
    code: 'INST-SSD-001',
    filterterms: ['term-land-9', 'term-ort-1031', 'term-emp-fulltime', 'term-trade-engineering'],
  },
]

const currentPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Positions - dSPACE</title>
  </head>
  <body>
    <h1>Job Finder</h1>
    <h2>Current Positions</h2>
    <div>https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm</div>
    <div :filter-sections='${JSON.stringify(filterSections)}'></div>
    <div :results-data='${JSON.stringify(resultsData)}'></div>
    <div>term-land-9</div>
    <div>term-ort-1031</div>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Developer (f/m/d) - dSPACE</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Software Developer (f/m/d)",
        "identifier": {
          "@type": "PropertyValue",
          "value": "38151"
        },
        "datePosted": "2026-07-15",
        "employmentType": "Full-time",
        "description": "Minimum of 3 years experience${malformedJsonControlChar} with embedded systems.",
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Paderborn",
            "addressCountry": "DE"
          }
        }
      }
    </script>
  </head>
  <body>
    <p>Code: INST-SSD-001</p>
    <p>Location: Trivandrum</p>
    <a href="mailto:info@dspace.de">info@dspace.de</a>
    <p>Send your application to career.tvm@dspace.in.</p>
  </body>
</html>
`

test('dSpace India landing contract accepts both the legacy and current CTA shapes', () => {
  assert.equal(SOURCE, 'dspaceindia')
  assert.equal(COMPANY, 'dSpace India')
  assert.equal(COMPANY_DOMAIN, 'dspace.com')
  assert.equal(CAREERS_LANDING_URL, 'https://www.dspace.com/en/pub/home/career.cfm')
  assert.equal(CURRENT_POSITIONS_URL, 'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm')
  assert.equal(APPLICATION_EMAIL, 'career.tvm@dspace.in')
  assert.equal(hasOfficialCareersLandingSignal(legacyLandingHtml), true)
  assert.equal(hasOfficialCareersLandingSignal(currentLandingHtml), true)
})

test('dSpace India listing parser keeps the pinned India filter contract intact', () => {
  assert.equal(hasVerifiedCurrentPositionsSignal(currentPositionsHtml), true)

  const jobs = extractIndiaJobsFromListingHtml(currentPositionsHtml, {
    scrapedAt: '2026-08-02T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Developer (f/m/d)')
  assert.equal(jobs[0].location, 'Trivandrum, India')
  assert.equal(jobs[0].requisitionId, 'INST-SSD-001')
  assert.equal(jobs[0].department, 'Engineering')
  assert.equal(jobs[0].employmentType, 'Full-time')
})

test('dSpace India retains a conflict when its India listing disagrees with the own native country', async () => {
  const jobs = await createDSpaceIndiaScraper().run({
    now: () => '2026-08-02T00:00:00.000Z',
    fetchText: async (url) => {
      if (url === CAREERS_LANDING_URL) return currentLandingHtml
      if (url === CURRENT_POSITIONS_URL) return currentPositionsHtml
      if (url === 'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29') {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Developer (f/m/d)')
  assert.equal(jobs[0].requisitionId, 'INST-SSD-001')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[0].nativeLocation, 'Trivandrum')
  assert.equal(jobs[0].sourceDetailFailureKind, 'native-country-conflict')
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].nativeLocationEvidence.addresses[0].addressCountry, 'DE')
  assert.equal(jobs[0].city, null)
  assert.equal(jobs[0].applicationEmail, APPLICATION_EMAIL)
  assert.equal(jobs[0].experienceRequired, '3 years')
  assert.equal(jobs[0].postingDate, '2026-07-15')
})
