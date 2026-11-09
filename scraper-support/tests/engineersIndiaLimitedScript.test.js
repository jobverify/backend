import assert from 'node:assert/strict'
import test from 'node:test'

const legacyOpeningsHtml = `
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
      * * *
    </body>
  </html>
`

const currentLegacyOpeningsHtml = `
  <html>
    <head>
      <title>EIL | Recruitment</title>
    </head>
    <body>
      <h1>Current Openings</h1>
      <p>Live Advertisements / Print Outs</p>
      1. SRD FOR SC, ST &amp; OBCs (Adv No:HRD/RECTT./ADVT./2026-27/04)
      <a href="/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F04">Print Application</a>
      2. FIXED TERM HIRING (Adv No:HRD/RECTT./ADVT./2026-27/02)
      <a href="/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F02">Print Application</a>
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
        <p>Why Work at EIL</p>
        <a href="/careers">Careers</a>
        <a href="/applying-to-eil">Applying to EIL</a>
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

const loadModule = async () => {
  try {
    return await import('../../scraper/engineersindialimited/script.js')
  } catch {
    assert.fail('Expected Engineers India Limited scraper module at ../../scraper/engineersindialimited/script.js')
  }
}

test('Engineers India Limited exports the verified legacy-portal-or-main-domain contract from August 15, 2026', async () => {
  const eil = await loadModule()

  assert.equal(eil.SOURCE, 'engineersindialimited')
  assert.equal(eil.COMPANY, 'Engineers India Limited')
  assert.equal(eil.LEGACY_CURRENT_OPENINGS_URL, 'https://recruitment.eil.co.in/')
  assert.equal(eil.CURRENT_OPENINGS_URL, 'https://recruitment.eil.co.in/')
  assert.equal(eil.HOMEPAGE_URL, 'https://www.engineersindia.com/')
  assert.equal(eil.CAREERS_URL, 'https://www.engineersindia.com/careers')
  assert.equal(eil.APPLYING_URL, 'https://www.engineersindia.com/applying-to-eil')
  assert.equal(eil.VERIFIED_ON, '2026-08-15')
  assert.equal(eil.hasCurrentOpeningsSignal(legacyOpeningsHtml), true)
  assert.equal(eil.hasCurrentOpeningsSignal(currentLegacyOpeningsHtml), true)
  assert.equal(eil.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eil.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(eil.hasOfficialApplyingSignal(applyingHtml), true)
  assert.equal(eil.hasPublicOpeningsOnMainSite('<main><h2>Current Openings</h2></main>'), true)
  assert.equal(eil.isExpectedLegacyPortalTimeout(timeoutPage(eil.CURRENT_OPENINGS_URL)), true)
  assert.equal(eil.extractOpenings(currentLegacyOpeningsHtml).length, 2)
})

test('Engineers India Limited extracts legacy portal openings and decorates them when the old portal is reachable', async () => {
  const eil = await loadModule()
  const requestedUrls = []

  const jobs = await eil.createEngineersIndiaLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 200,
        url,
        html: legacyOpeningsHtml,
        errorKind: null,
      }
    },
  })

  assert.deepEqual(requestedUrls, [eil.CURRENT_OPENINGS_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link]),
    [
      [
        'SRD FOR SC, ST & OBCs',
        'engineersindialimited',
        'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F04',
      ],
      [
        'FIXED TERM HIRING',
        'engineersindialimited',
        'https://recruitment.eil.co.in/applicnExpRecruitment/Printout_regno.aspx?adv=HRD%2FRECTT.%2FADVT.%2F2026-27%2F02',
      ],
    ],
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Engineers India Limited returns [] when the legacy portal times out but the verified main-domain pages still expose no trustworthy openings list', async () => {
  const eil = await loadModule()
  const requestedUrls = []

  const jobs = await eil.createEngineersIndiaLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === eil.CURRENT_OPENINGS_URL) return timeoutPage(url)
      if (url === eil.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml, errorKind: null }
      if (url === eil.CAREERS_URL) return { status: 200, url, html: careersHtml, errorKind: null }
      if (url === eil.APPLYING_URL) return { status: 200, url, html: applyingHtml, errorKind: null }

      throw new Error(`Unexpected Engineers India Limited URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    eil.CURRENT_OPENINGS_URL,
    eil.HOMEPAGE_URL,
    eil.CAREERS_URL,
    eil.APPLYING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Engineers India Limited preserves the no-openings sentinel when both the legacy portal and current main-domain pages are timeout-blocked from this runtime', async () => {
  const eil = await loadModule()
  const requestedUrls = []

  const jobs = await eil.createEngineersIndiaLimitedScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return timeoutPage(url)
    },
  })

  assert.deepEqual(requestedUrls, [
    eil.CURRENT_OPENINGS_URL,
    eil.HOMEPAGE_URL,
    eil.CAREERS_URL,
    eil.APPLYING_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Engineers India Limited fails closed when either the legacy portal timeout contract or the main-domain fallback pages drift', async () => {
  const eil = await loadModule()

  await assert.rejects(
    eil.createEngineersIndiaLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === eil.CURRENT_OPENINGS_URL) {
          return {
            status: 504,
            url,
            html: '<html><body><h1>Gateway Timeout</h1></body></html>',
            errorKind: null,
          }
        }

        throw new Error(`Unexpected Engineers India Limited URL: ${url}`)
      },
    }),
    /legacy recruitment portal no longer matches the verified reachable-or-timeout contract/i,
  )

  await assert.rejects(
    eil.createEngineersIndiaLimitedScraper().run({
      fetchPage: async (url) => {
        if (url === eil.CURRENT_OPENINGS_URL) return timeoutPage(url)
        if (url === eil.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml, errorKind: null }
        if (url === eil.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Careers at EIL | Join India's Leading Engineering Consultancy</title></head>
                <body>
                  <h1>Current Openings</h1>
                  <a href="/openings">Apply now</a>
                </body>
              </html>
            `,
            errorKind: null,
          }
        }
        if (url === eil.APPLYING_URL) return { status: 200, url, html: applyingHtml, errorKind: null }

        throw new Error(`Unexpected Engineers India Limited URL: ${url}`)
      },
    }),
    /careers page no longer matches the verified main-domain no-public-openings surface/i,
  )
})
