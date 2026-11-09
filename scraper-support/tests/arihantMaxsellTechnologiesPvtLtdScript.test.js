import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'arihantmaxselltechnologiespvtltd',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const verifiedCurrentOpeningsHtml = readFixture('current-openings.html')
const hrExecutiveDetailHtml = readFixture('hr-executive-recruiter-generalist.html')
const salesDetailHtml = readFixture('field-sales-representative-executive.html')
const customerSupportDetailHtml = readFixture('customer-support-executive-required-chennai.html')
const currentHomepageWithoutCareersLinkHtml = verifiedHomepageHtml
  .replace('href="https://maxsell.co.in/careers/"', 'href="https://maxsell.co.in/contact/"')
const currentOpeningsShellHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Current Job Openings at Maxsell India - Chennai &amp; PAN India Roles</title>
    <link rel="canonical" href="https://maxsell.co.in/current-openings/" />
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Browse current job openings at Maxsell.</p>
    </main>
  </body>
</html>
`
const currentOpeningsSitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/</loc>
  </url>
  <url>
    <loc>https://maxsell.co.in/current-opening/opening-for-freshers/</loc>
  </url>
</urlset>
`
const customerSupportLiveDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>&rarr; Customer Support Executive (Hindi + English) Urgent Hiring &#8212; Maxsell</title>
    <link rel="canonical" href="https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/" />
    <meta property="og:site_name" content="Maxsell" />
    <meta name="description" content="Join Maxsell as a Customer Support Executive in Chennai. We're hiring passionate individuals with great communication skills." />
  </head>
  <body>
    <main>
      <h1 class="entry-title">Customer Support Executive (Hindi + English) Urgent Hiring</h1>
      <p>How to Apply: Send your resume to hr@maxsell.co.in.</p>
    </main>
  </body>
</html>
`
const filledRoleLiveDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Opening for Freshers (Vacancy filled, Do Not Apply) - Maxsell</title>
    <link rel="canonical" href="https://maxsell.co.in/current-opening/opening-for-freshers/" />
    <meta property="og:site_name" content="Maxsell" />
  </head>
  <body>
    <main>
      <h1 class="entry-title">Opening for Freshers (Vacancy filled, Do Not Apply)</h1>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/arihantmaxselltechnologiespvtltd/script.js')
  } catch {
    assert.fail('Expected Arihant Maxsell Technologies Pvt Ltd scraper module at ../../scraper/arihantmaxselltechnologiespvtltd/script.js')
  }
}

test('Arihant Maxsell sentinels recognize the verified Maxsell homepage, careers handoff, and public current openings page', async () => {
  const arihantMaxsell = await loadModule()

  assert.equal(arihantMaxsell.SOURCE, 'arihantmaxselltechnologiespvtltd')
  assert.equal(arihantMaxsell.COMPANY, 'Arihant Maxsell Technologies Pvt Ltd')
  assert.equal(arihantMaxsell.HOMEPAGE_URL, 'https://maxsell.co.in/')
  assert.equal(arihantMaxsell.CAREERS_URL, 'https://maxsell.co.in/careers/')
  assert.equal(arihantMaxsell.CURRENT_OPENINGS_URL, 'https://maxsell.co.in/current-openings/')
  assert.equal(arihantMaxsell.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(arihantMaxsell.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(
    arihantMaxsell.extractCurrentOpeningsUrl(verifiedCareersHtml),
    arihantMaxsell.CURRENT_OPENINGS_URL,
  )
  assert.equal(arihantMaxsell.hasOfficialCurrentOpeningsSignal(verifiedCurrentOpeningsHtml), true)

  assert.deepEqual(arihantMaxsell.extractOpenings(verifiedCurrentOpeningsHtml), [
    {
      title: 'HR Executive - Recruiter & Generalist',
      positions: '2',
      location: 'Nungambakkam, Chennai',
      city: 'Chennai',
      sourceUrl: 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
      applyUrl: 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
      jobId: 'arihantmaxselltechnologiespvtltd-hr-executive-recruiter-generalist',
      requisitionId: 'arihantmaxselltechnologiespvtltd-hr-executive-recruiter-generalist',
    },
    {
      title: 'Sales Executive - XRF Spectrometer | Gold Testing Machines',
      positions: '5',
      location: 'Mumbai, Kolkata, Chennai, Hyderabad, Ahmedabad',
      city: 'Mumbai',
      sourceUrl: 'https://maxsell.co.in/current-opening/field-sales-representative-executive/',
      applyUrl: 'https://maxsell.co.in/current-opening/field-sales-representative-executive/',
      jobId: 'arihantmaxselltechnologiespvtltd-field-sales-representative-executive',
      requisitionId: 'arihantmaxselltechnologiespvtltd-field-sales-representative-executive',
    },
    {
      title: 'Customer Support Executive (Hindi + English) Urgent Hiring',
      positions: '2',
      location: 'Chennai, Nungambakkam',
      city: 'Chennai',
      sourceUrl: 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
      applyUrl: 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
      jobId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
      requisitionId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
    },
  ])
})

test('Arihant Maxsell extracts normalized detail fields from an official first-party job detail page', async () => {
  const arihantMaxsell = await loadModule()
  const sourceUrl = 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/'

  assert.deepEqual(
    arihantMaxsell.extractJobDetail(customerSupportDetailHtml, {
      title: 'Customer Support Executive (Hindi + English) Urgent Hiring',
      positions: '2',
      location: 'Chennai, Nungambakkam',
      city: 'Chennai',
      sourceUrl,
      applyUrl: sourceUrl,
      jobId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
      requisitionId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
    }),
    {
      title: 'Customer Support Executive (Hindi + English) Urgent Hiring',
      positions: '2',
      location: 'Chennai, Nungambakkam',
      city: 'Chennai',
      country: 'India',
      jobId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
      requisitionId: 'arihantmaxselltechnologiespvtltd-customer-support-executive-required-chennai',
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: null,
      experienceRequired: '1-3 years in customer coordination or support.',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        'Answer inbound customer calls and create service tickets with clear issue summaries.',
        'Coordinate engineers, spare parts, and follow-up communication until closure.',
        'Maintain CRM hygiene and daily updates for open service requests.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Only apply if well versed with spoken Hindi and experienced in customer service or coordination. About the Role: You will be the link between customers, service engineers, and logistics teams. Experience: 1-3 years in customer coordination or support. Key Responsibilities: Answer inbound customer calls and create service tickets with clear issue summaries. Coordinate engineers, spare parts, and follow-up communication until closure. Maintain CRM hygiene and daily updates for open service requests.',
    },
  )
})

test('Arihant Maxsell run validates the first-party flow, skips the filled role, and decorates live openings', async () => {
  const arihantMaxsell = await loadModule()
  const requestedUrls = []

  const jobs = await arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === arihantMaxsell.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === arihantMaxsell.CAREERS_URL) return verifiedCareersHtml
      if (url === arihantMaxsell.CURRENT_OPENINGS_URL) return verifiedCurrentOpeningsHtml
      if (url === 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/') return hrExecutiveDetailHtml
      if (url === 'https://maxsell.co.in/current-opening/field-sales-representative-executive/') return salesDetailHtml
      if (url === 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/') return customerSupportDetailHtml

      throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
    },
    now: () => '2026-07-11T10:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    arihantMaxsell.HOMEPAGE_URL,
    arihantMaxsell.CAREERS_URL,
    arihantMaxsell.CURRENT_OPENINGS_URL,
    'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
    'https://maxsell.co.in/current-opening/field-sales-representative-executive/',
    'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
  ])

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'HR Executive - Recruiter & Generalist',
    positions: '2',
    company: 'Arihant Maxsell Technologies Pvt Ltd',
    location: 'Nungambakkam, Chennai',
    city: 'Chennai',
    country: 'India',
    source: 'arihantmaxselltechnologiespvtltd',
    sourceUrl: 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
    applyUrl: 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
    link: 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/',
    jobId: 'arihantmaxselltechnologiespvtltd-hr-executive-recruiter-generalist',
    requisitionId: 'arihantmaxselltechnologiespvtltd-hr-executive-recruiter-generalist',
    employmentType: null,
    experienceRequired: '5yrs+',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Perform sourcing to fill open positions and anticipate future hiring needs.',
      'Draft job descriptions and coordinate approvals with stakeholders.',
      'Coordinate interviews and ensure timely closure of positions.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Opportunity to scale the team while building structured hiring processes across a growing business. Experience: 5yrs+. Industry Experience: Non-IT preferred. Talent Acquisition: Perform sourcing to fill open positions and anticipate future hiring needs. Draft job descriptions and coordinate approvals with stakeholders. Coordinate interviews and ensure timely closure of positions.',
    scrapedAt: '2026-07-11T10:30:00.000Z',
  })
  assert.equal(jobs[1].title, 'Sales Executive - XRF Spectrometer | Gold Testing Machines')
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(jobs[1].experienceRequired, '2-5 years in B2B field sales.')
  assert.equal(jobs[2].title, 'Customer Support Executive (Hindi + English) Urgent Hiring')
  assert.equal(jobs[2].city, 'Chennai')
  assert.equal(
    jobs.find((job) => /Freshers/i.test(job.title)),
    undefined,
  )
})

test('Arihant Maxsell falls back to the first-party current-opening sitemap when the openings page becomes a shell', async () => {
  const arihantMaxsell = await loadModule()
  const requestedUrls = []

  const jobs = await arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === arihantMaxsell.HOMEPAGE_URL) return currentHomepageWithoutCareersLinkHtml
      if (url === arihantMaxsell.CAREERS_URL) return verifiedCareersHtml
      if (url === arihantMaxsell.CURRENT_OPENINGS_URL) return currentOpeningsShellHtml
      if (url === 'https://maxsell.co.in/current-opening-sitemap.xml') return currentOpeningsSitemapXml
      if (url === 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/') {
        return customerSupportLiveDetailHtml
      }
      if (url === 'https://maxsell.co.in/current-opening/opening-for-freshers/') {
        return filledRoleLiveDetailHtml
      }

      throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
    },
    now: () => '2026-08-20T18:50:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    arihantMaxsell.HOMEPAGE_URL,
    arihantMaxsell.CAREERS_URL,
    arihantMaxsell.CURRENT_OPENINGS_URL,
    'https://maxsell.co.in/current-opening-sitemap.xml',
    'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
    'https://maxsell.co.in/current-opening/opening-for-freshers/',
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Customer Support Executive (Hindi + English) Urgent Hiring')
  assert.equal(jobs[0].company, 'Arihant Maxsell Technologies Pvt Ltd')
  assert.equal(jobs[0].source, 'arihantmaxselltechnologiespvtltd')
  assert.equal(
    jobs[0].sourceUrl,
    'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/',
  )
})

test('Arihant Maxsell fails closed when the verified homepage, careers handoff, openings page, or detail page drift', async () => {
  const arihantMaxsell = await loadModule()

  await assert.rejects(
    arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === arihantMaxsell.HOMEPAGE_URL) {
          return '<html><head><title>Maxsell</title></head><body>Broken homepage</body></html>'
        }

        throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === arihantMaxsell.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === arihantMaxsell.CAREERS_URL) {
          return verifiedCareersHtml.replace('/current-openings/', '/join-us/')
        }

        throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
      },
    }),
    /verified Maxsell careers handoff/i,
  )

  await assert.rejects(
    arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === arihantMaxsell.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === arihantMaxsell.CAREERS_URL) return verifiedCareersHtml
        if (url === arihantMaxsell.CURRENT_OPENINGS_URL) {
          return '<html><head><title>Broken openings</title></head><body>Missing trusted current openings shell</body></html>'
        }

        throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
      },
    }),
    /verified Maxsell current openings surface/i,
  )

  await assert.rejects(
    arihantMaxsell.createArihantMaxsellTechnologiesPvtLtdScraper().run({
      fetchText: async (url) => {
        if (url === arihantMaxsell.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === arihantMaxsell.CAREERS_URL) return verifiedCareersHtml
        if (url === arihantMaxsell.CURRENT_OPENINGS_URL) return verifiedCurrentOpeningsHtml
        if (url === 'https://maxsell.co.in/current-opening/hr-executive-recruiter-generalist/') {
          return hrExecutiveDetailHtml.replace('Apply Now Form', 'Broken Form')
        }
        if (url === 'https://maxsell.co.in/current-opening/field-sales-representative-executive/') return salesDetailHtml
        if (url === 'https://maxsell.co.in/current-opening/customer-support-executive-required-chennai/') return customerSupportDetailHtml

        throw new Error(`Unexpected Arihant Maxsell URL: ${url}`)
      },
    }),
    /verified Maxsell job detail surface/i,
  )
})
