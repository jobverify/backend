import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLYING_URL,
  CAREERS_URL,
  CURRENT_OPENINGS_URL,
  HOMEPAGE_URL,
  createEngineersIndiaLimitedScraper,
  extractOpenings,
  hasCurrentOpeningsSignal,
  hasOfficialApplyingSignal,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
  hasPublicOpeningsOnMainSite,
  isExpectedLegacyPortalTimeout,
  LEGACY_CURRENT_OPENINGS_URL,
  VERIFIED_ON,
} from './script.js'

const openingsHtml = `
  <html>
    <head>
      <title>EIL Recruitment Portal</title>
    </head>
    <body>
      <h1>Current Openings</h1>
      <p>Recruitment of Fresher / Experienced Candidates: Live Advertisements / Print Outs</p>
      1. SRD FOR SC, ST &amp; OBCs (Adv No:HRD/RECTT./ADVT./2026-27/04)
      <a href="/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F04">Print Application</a>
      2. FIXED TERM HIRING (Adv No:HRD/RECTT./ADVT./2026-27/02)
      <a href="/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F02">Print Application</a>
      3. RECRUITMENT FOR EXPERIENCED PERSONNEL (Adv No:HRD/RECTT./ADVT./2026-27/03)
      <a href="/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F03">Print Application</a>
      * * *
    </body>
  </html>
`

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>EIL | Global Engineering Consultancy Offering Total Energy Solutions</title>
    </head>
    <body>
      <main>
        <h1>Global Engineering Consultancy Offering Total Energy Solutions</h1>
        <section>
          <h2>Why Work at EIL</h2>
          <a href="/careers">Careers</a>
          <a href="/applying-to-eil">Applying to EIL</a>
        </section>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers at EIL | Join India's Leading Engineering Consultancy</title>
    </head>
    <body>
      <main>
        <h1>Careers at EIL</h1>
        <p>Explore our career opportunities</p>
        <p>Why Work at EIL</p>
        <p>Applying to EIL</p>
        <a href="mailto:Opportunities@EIL">Opportunities@EIL</a>
      </main>
    </body>
  </html>
`

const applyingHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Applying to EIL | Join India's Premier Engineering Consultancy Company</title>
    </head>
    <body>
      <main>
        <h1>Applying to EIL</h1>
        <p>No Fee is Payable</p>
        <p>BEWARE OF FRAUDULENT WEBSITES / EMAILS</p>
        <p>Recruitment of candidates with work experience through open competition</p>
        <p>Management Trainees</p>
      </main>
    </body>
  </html>
`

const timeoutPage = (url) => ({
  status: null,
  url,
  html: null,
  errorKind: 'timeout',
})

test('extractOpenings maps EIL recruitment portal entries into shared job fields', () => {
  assert.equal(LEGACY_CURRENT_OPENINGS_URL, 'https://recruitment.eil.co.in/')
  assert.equal(CURRENT_OPENINGS_URL, LEGACY_CURRENT_OPENINGS_URL)
  assert.equal(HOMEPAGE_URL, 'https://www.engineersindia.com/')
  assert.equal(CAREERS_URL, 'https://www.engineersindia.com/careers')
  assert.equal(APPLYING_URL, 'https://www.engineersindia.com/applying-to-eil')
  assert.equal(VERIFIED_ON, '2026-08-15')
  assert.equal(hasCurrentOpeningsSignal(openingsHtml), true)
  assert.deepEqual(extractOpenings(openingsHtml), [
    {
      title: 'SRD FOR SC, ST & OBCs',
      company: 'Engineers India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'eil-hrd-rectt-advt-2026-27-04',
      requisitionId: 'eil-hrd-rectt-advt-2026-27-04',
      sourceUrl: 'https://recruitment.eil.co.in/',
      applyUrl: 'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F04',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'FIXED TERM HIRING',
      company: 'Engineers India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'eil-hrd-rectt-advt-2026-27-02',
      requisitionId: 'eil-hrd-rectt-advt-2026-27-02',
      sourceUrl: 'https://recruitment.eil.co.in/',
      applyUrl: 'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F02',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'RECRUITMENT FOR EXPERIENCED PERSONNEL',
      company: 'Engineers India Limited',
      department: null,
      location: 'India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'eil-hrd-rectt-advt-2026-27-03',
      requisitionId: 'eil-hrd-rectt-advt-2026-27-03',
      sourceUrl: 'https://recruitment.eil.co.in/',
      applyUrl: 'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F03',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Engineers India Limited recognizes the verified main-domain fallback surfaces when the legacy portal times out', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialApplyingSignal(applyingHtml), true)
  assert.equal(hasPublicOpeningsOnMainSite('<section><h2>Current Openings</h2></section>'), true)
  assert.equal(isExpectedLegacyPortalTimeout(timeoutPage(CURRENT_OPENINGS_URL)), true)
})

test('run decorates legacy recruitment portal jobs when that surface is still reachable', async () => {
  const requestedUrls = []
  const jobs = await createEngineersIndiaLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: openingsHtml,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [CURRENT_OPENINGS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'engineersindialimited')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run returns [] when the legacy EIL recruitment portal times out but the verified main-domain pages remain live without public openings', async () => {
  const requestedUrls = []

  const jobs = await createEngineersIndiaLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === CURRENT_OPENINGS_URL) return timeoutPage(url)
      if (url === HOMEPAGE_URL) return { status: 200, url, html: homepageHtml, errorKind: null }
      if (url === CAREERS_URL) return { status: 200, url, html: careersHtml, errorKind: null }
      if (url === APPLYING_URL) return { status: 200, url, html: applyingHtml, errorKind: null }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CURRENT_OPENINGS_URL,
    HOMEPAGE_URL,
    CAREERS_URL,
    APPLYING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the verified EIL reachable-or-timeout contract drifts', async () => {
  await assert.rejects(
    createEngineersIndiaLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === CURRENT_OPENINGS_URL) return timeoutPage(url)
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Unexpected homepage</h1></body></html>',
            errorKind: null,
          }
        }
        if (url === CAREERS_URL) return { status: 200, url, html: careersHtml, errorKind: null }
        if (url === APPLYING_URL) return { status: 200, url, html: applyingHtml, errorKind: null }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified main-domain no-public-openings surface/i,
  )

  await assert.rejects(
    createEngineersIndiaLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === CURRENT_OPENINGS_URL) {
          return {
            status: 502,
            url,
            html: '<html><body><h1>Bad gateway</h1></body></html>',
            errorKind: null,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /legacy recruitment portal no longer matches the verified reachable-or-timeout contract/i,
  )

  assert.equal(hasCurrentOpeningsSignal('<main><h1>Recruitment</h1></main>'), false)
  assert.throws(
    () => extractOpenings('<main><h1>Recruitment</h1></main>'),
    /expected current openings list/,
  )
})
