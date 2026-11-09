import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

import {
  COMPANY,
  FIRST_PARTY_CAREERS_URL,
  HANDOFF_URL,
  JOB_LISTING_URL,
  SOURCE,
  buildDetailUrl,
  createUbGroupScraper,
  extractJobPosting,
  extractListings,
  hasFirstPartyCareersSignal,
  hasOfficialHandoffSignal,
  hasOfficialListingSignal,
} from './script.js'

const firstPartyCareersHtml = `
  <html>
    <head>
      <title>Careers | United Breweries Limited</title>
    </head>
    <body>
      <main>
        <h1>Build your Career with India's Pioneering Beer Company</h1>
        <a href="https://careers.theheinekencompany.com/India/?locale=en_GB">Apply Now</a>
        <a href="https://careers.theheinekencompany.com/">Join Us</a>
      </main>
    </body>
  </html>
`

const handoffHtml = `
  <html>
    <head>
      <title>Careers at United Breweries Limited | Part of The HEINEKEN Company</title>
    </head>
    <body>
      <main>
        <a href="/Job-Listing?operatings_company%5B0%5D=6739">Job Listing</a>
        <a href="/job/united-breweries-limited/india/shift-brewer">Shift Brewer</a>
        <a href="https://theheinekencompany-rmk.jobs.hr.cloud.sap/India/lp/Join%20Our%20Talent%20Community!/8cbf116bc4864a3e/?locale=en_GB">
          Join Our Talent Community
        </a>
      </main>
    </body>
  </html>
`

const listingHtml = `
  <html>
    <head>
      <title>Job Listing | HEINEKEN Careers</title>
    </head>
    <body class="job-listing-page">
      <script type="application/json" data-drupal-selector="drupal-settings-json">
        {"path":{"currentQuery":{"operatings_company":["6739"]}}}
      </script>
      <main>
        <article class="search-result">
          <a href="/job/united-breweries-limited/india/shift-brewer">Shift Brewer</a>
        </article>
        <article class="search-result">
          <a href="/job/united-breweries-limited/india/category-development-manager-gt-0">
            Category Development Manager - GT
          </a>
        </article>
        <article class="search-result">
          <a href="/job/united-breweries-limited/india/shift-brewer">Shift Brewer</a>
        </article>
      </main>
    </body>
  </html>
`

const shiftBrewerDetailHtml = `
  <html>
    <head>
      <title>Shift Brewer</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "JobPosting",
              "title": "Shift Brewer",
              "datePosted": "Jun 30 2026",
              "employmentType": "Permanent",
              "validThrough": "Jul 14 2026",
              "hiringOrganization": {
                "@type": "Organization",
                "name": "Heineken"
              }
            }
          ]
        }
      </script>
    </head>
    <body>
      <main>
        <div class="job-description">
          <p>Lead brewing operations across the assigned shift.</p>
        </div>
        <a href="https://career5.successfactors.eu/careers?company=C0000032666P&career_job_req_id=160900&career_ns=job_application" target="_blank">
          Apply Now
        </a>
      </main>
    </body>
  </html>
`

const categoryManagerDetailHtml = `
  <html>
    <head>
      <title>Category Development Manager - GT</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "JobPosting",
              "title": "Category Development Manager - GT",
              "datePosted": "Jun 24 2026",
              "employmentType": "Permanent",
              "validThrough": "Jul 17 2026",
              "hiringOrganization": {
                "@type": "Organization",
                "name": "Heineken"
              }
            }
          ]
        }
      </script>
    </head>
    <body>
      <main>
        <div class="job-description">
          <p>Drive category development for the general trade channel.</p>
        </div>
        <a href="https://career5.successfactors.eu/careers?company=C0000032666P&career_job_req_id=160532&career_ns=job_application" target="_blank">
          Apply Now
        </a>
      </main>
    </body>
  </html>
`

test('UB Group scraper pins the verified first-party careers page and official HEINEKEN handoff', () => {
  assert.equal(SOURCE, 'ubgroup')
  assert.equal(COMPANY, 'United Breweries Limited')
  assert.equal(FIRST_PARTY_CAREERS_URL, 'https://www.unitedbreweries.com/careers')
  assert.equal(HANDOFF_URL, 'https://careers.theheinekencompany.com/India/?locale=en_GB')
  assert.equal(JOB_LISTING_URL, 'https://careers.theheinekencompany.com/Job-Listing?operatings_company%5B0%5D=6739')
  assert.equal(hasFirstPartyCareersSignal(firstPartyCareersHtml), true)
  assert.equal(hasOfficialHandoffSignal(handoffHtml), true)
  assert.equal(hasOfficialListingSignal(listingHtml), true)
})

test('extractListings and extractJobPosting parse the official UB Group careers surfaces', () => {
  assert.deepEqual(
    extractListings(listingHtml),
    [
      {
        title: 'Shift Brewer',
        sourceUrl: 'https://careers.theheinekencompany.com/job/united-breweries-limited/india/shift-brewer',
      },
      {
        title: 'Category Development Manager - GT',
        sourceUrl: 'https://careers.theheinekencompany.com/job/united-breweries-limited/india/category-development-manager-gt-0',
      },
    ],
  )

  assert.deepEqual(
    extractJobPosting(shiftBrewerDetailHtml),
    {
      title: 'Shift Brewer',
      datePosted: 'Jun 30 2026',
      employmentType: 'Permanent',
      validThrough: 'Jul 14 2026',
    },
  )

  assert.equal(
    buildDetailUrl('/job/united-breweries-limited/india/shift-brewer'),
    'https://careers.theheinekencompany.com/job/united-breweries-limited/india/shift-brewer',
  )
})

test('run scrapes live UB Group roles from the verified official ATS handoff and fails closed on drift', async () => {
  const requests = []
  const scraper = createUbGroupScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === FIRST_PARTY_CAREERS_URL) return firstPartyCareersHtml
      if (url === HANDOFF_URL) return handoffHtml
      if (url === JOB_LISTING_URL) return listingHtml
      if (url === 'https://careers.theheinekencompany.com/job/united-breweries-limited/india/shift-brewer') {
        return shiftBrewerDetailHtml
      }
      if (url === 'https://careers.theheinekencompany.com/job/united-breweries-limited/india/category-development-manager-gt-0') {
        return categoryManagerDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    FIRST_PARTY_CAREERS_URL,
    HANDOFF_URL,
    JOB_LISTING_URL,
    'https://careers.theheinekencompany.com/job/united-breweries-limited/india/shift-brewer',
    'https://careers.theheinekencompany.com/job/united-breweries-limited/india/category-development-manager-gt-0',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'United Breweries Limited')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'ubgroup')
  assert.equal(jobs[0].requisitionId, '160900')
  assert.equal(jobs[0].link, 'https://career5.successfactors.eu/careers?company=C0000032666P&career_job_req_id=160900&career_ns=job_application')
  assert.equal(jobs[1].requisitionId, '160532')

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === FIRST_PARTY_CAREERS_URL) {
          return '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/ubgroup">Apply now</a></body></html>'
        }
        return ''
      },
    }),
    /verified first-party careers surface/i,
  )
})

test('UB Group accepts the current handoff without job cards only with an explicit filtered empty result', async () => {
  const emptyHandoff = handoffHtml.replace('<a href="/job/united-breweries-limited/india/shift-brewer">Shift Brewer</a>', '')
  const emptyListing = listingHtml.replace(/<main>[\s\S]*?<\/main>/, '<main><h3>No jobs found</h3></main>')
  const requests = []
  const jobs = await createUbGroupScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === FIRST_PARTY_CAREERS_URL) return firstPartyCareersHtml
      if (url === HANDOFF_URL) return emptyHandoff
      if (url === JOB_LISTING_URL) return emptyListing
      throw new Error('Unexpected detail request for an empty board')
    },
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, true)
  assert.deepEqual(requests, [FIRST_PARTY_CAREERS_URL, HANDOFF_URL, JOB_LISTING_URL])
  assert.equal(hasOfficialListingSignal(emptyListing.replace('6739', '0000')), false)
})

test('UB Group does not treat a loading shell, translation, or unparsed job path as confirmed empty', async () => {
  const shell = listingHtml.replace(/<main>[\s\S]*?<\/main>/, '<main>Loading...</main><script>{"noResults":"No jobs found"}</script>')
  const unparsed = shell.replace('Loading...', '/job/united-breweries-limited/india/shift-brewer')
  for (const page of [shell, unparsed]) {
    await assert.rejects(createUbGroupScraper().run({
      fetchText: async (url) => {
        if (url === FIRST_PARTY_CAREERS_URL) return firstPartyCareersHtml
        if (url === HANDOFF_URL) return handoffHtml
        return page
      },
    }), /listing|empty/i)
  }
})
