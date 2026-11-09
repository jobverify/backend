import assert from 'node:assert/strict'
import test from 'node:test'

const panasonicIndiaDigitalModule = await import('../../scraper/panasonicindiadigital/script.js').catch(
  () => ({}),
)

const {
  COMPANY,
  CORPORATE_URL,
  DISPOSITION,
  GLOBAL_CAREERS_URL,
  INDIA_CAREERS_URL,
  OFFICIAL_BRAND,
  PUBLIC_SURFACE_URL,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  createPanasonicIndiaDigitalScraper,
  findVerifiedGlobalCareersHandoff,
  findVerifiedIndiaCareersHandoff,
  hasVerifiedCorporateSurface,
  hasVerifiedIndiaPublicSurface,
  run,
} = panasonicIndiaDigitalModule

const VERIFIED_PUBLIC_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Panasonic Home Appliances &amp; Consumer Electronics in India</title>
    </head>
    <body>
      <main>
        <h1>Panasonic India</h1>
        <p>Create Today. Enrich Tomorrow.</p>
        <a href="https://www.panasoniccareersindia.in/">Careers</a>
      </main>
    </body>
  </html>
`

const VERIFIED_CORPORATE_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>About Us - Panasonic India</title>
    </head>
    <body>
      <main>
        <h1>About Panasonic India</h1>
        <p>Corporate information for Panasonic India.</p>
        <a href="https://www.panasoniccareersindia.in/" target="_blank" rel="noopener">
          <span>Careers</span>
        </a>
        <a href="https://holdings.panasonic/global/corporate/careers.html">
          Careers [Global site]
        </a>
      </main>
    </body>
  </html>
`

const EXPIRED_CERT_PAGE = {
  status: 0,
  html: '',
  errorCode: 'CERT_HAS_EXPIRED',
  errorMessage: 'certificate has expired',
}

test('Panasonic India Digital stays fail-closed on the verified Panasonic India public surfaces', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === PUBLIC_SURFACE_URL) {
        return { status: 200, url, html: VERIFIED_PUBLIC_SURFACE_HTML }
      }

      if (url === CORPORATE_URL) {
        return { status: 200, url, html: VERIFIED_CORPORATE_SURFACE_HTML }
      }

      if (url === INDIA_CAREERS_URL) {
        return { ...EXPIRED_CERT_PAGE, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [PUBLIC_SURFACE_URL, CORPORATE_URL, INDIA_CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(SOURCE, 'panasonicindiadigital')
  assert.equal(COMPANY, 'Panasonic India Digital')
  assert.equal(OFFICIAL_BRAND, 'Panasonic India')
  assert.equal(PUBLIC_SURFACE_URL, 'https://www.panasonic.com/in/')
  assert.equal(CORPORATE_URL, 'https://www.panasonic.com/in/corporate.html')
  assert.equal(INDIA_CAREERS_URL, 'https://www.panasoniccareersindia.in/')
  assert.equal(
    GLOBAL_CAREERS_URL,
    'https://holdings.panasonic/global/corporate/careers.html',
  )
  assert.equal(
    DISPOSITION,
    'verified-panasonic-india-careers-handoff-expired-cert-fail-closed',
  )
  assert.match(VERIFIED_SURFACE_SUMMARY, /Monday, August 3, 2026/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /CERT_HAS_EXPIRED/i)
  assert.match(VERIFIED_SURFACE_SUMMARY, /exact workbook entity Panasonic India Digital/i)
  assert.equal(typeof createPanasonicIndiaDigitalScraper, 'function')
  assert.equal(hasVerifiedIndiaPublicSurface(VERIFIED_PUBLIC_SURFACE_HTML), true)
  assert.equal(hasVerifiedCorporateSurface(VERIFIED_CORPORATE_SURFACE_HTML), true)
  assert.equal(
    findVerifiedIndiaCareersHandoff(VERIFIED_CORPORATE_SURFACE_HTML, CORPORATE_URL)?.url.toString(),
    INDIA_CAREERS_URL,
  )
  assert.equal(
    findVerifiedGlobalCareersHandoff(VERIFIED_CORPORATE_SURFACE_HTML, CORPORATE_URL)?.url.toString(),
    GLOBAL_CAREERS_URL,
  )
})

test('Panasonic India Digital rejects when the verified Panasonic India public surface disappears', async () => {
  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Example Home</title></head>
                <body><h1>Example</h1></body>
              </html>
            `,
          }
        }

        if (url === CORPORATE_URL) {
          return { status: 200, url, html: VERIFIED_CORPORATE_SURFACE_HTML }
        }

        return { ...EXPIRED_CERT_PAGE, url }
      },
    }),
    /verified Panasonic India public surface changed/i,
  )
})

test('Panasonic India Digital rejects when the verified corporate careers handoff disappears', async () => {
  const missingHandoffCorporateHtml = `
    <html>
      <head>
        <title>About Us - Panasonic India</title>
      </head>
      <body>
        <h1>About Panasonic India</h1>
        <p>Corporate information for Panasonic India.</p>
      </body>
    </html>
  `

  assert.equal(hasVerifiedCorporateSurface(missingHandoffCorporateHtml), false)

  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return { status: 200, url, html: VERIFIED_PUBLIC_SURFACE_HTML }
        }

        if (url === CORPORATE_URL) {
          return { status: 200, url, html: missingHandoffCorporateHtml }
        }

        return { ...EXPIRED_CERT_PAGE, url }
      },
    }),
    /verified Panasonic careers handoff changed/i,
  )
})

test('Panasonic India Digital rejects when the Panasonic India surfaces start exposing public jobs directly', async () => {
  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: `
              ${VERIFIED_PUBLIC_SURFACE_HTML}
              <script type="application/ld+json">
                {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
              </script>
            `,
          }
        }

        if (url === CORPORATE_URL) {
          return { status: 200, url, html: VERIFIED_CORPORATE_SURFACE_HTML }
        }

        return { ...EXPIRED_CERT_PAGE, url }
      },
    }),
    /JobPosting markup/i,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return { status: 200, url, html: VERIFIED_PUBLIC_SURFACE_HTML }
        }

        if (url === CORPORATE_URL) {
          return {
            status: 200,
            url,
            html: `
              ${VERIFIED_CORPORATE_SURFACE_HTML}
              <iframe src="https://boards.greenhouse.io/panasonic"></iframe>
            `,
          }
        }

        return { ...EXPIRED_CERT_PAGE, url }
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: `
              ${VERIFIED_PUBLIC_SURFACE_HTML}
              <a href="/careers/software-engineer">Software Engineer</a>
            `,
          }
        }

        if (url === CORPORATE_URL) {
          return { status: 200, url, html: VERIFIED_CORPORATE_SURFACE_HTML }
        }

        return { ...EXPIRED_CERT_PAGE, url }
      },
    }),
    /public jobs surface/i,
  )
})
