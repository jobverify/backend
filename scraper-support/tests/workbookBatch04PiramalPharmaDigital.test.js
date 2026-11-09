import assert from 'node:assert/strict'
import test from 'node:test'

const piramalPharmaDigitalModule = await import('../../scraper/piramalpharmadigital/script.js').catch(
  () => ({}),
)

const {
  CAREERS_URL,
  COMPANY,
  DISPOSITION,
  PUBLIC_SURFACE_URL,
  SOURCE,
  VERIFIED_SURFACE_SUMMARY,
  WORKDAY_BOARD_URL,
  createPiramalPharmaDigitalScraper,
  findVerifiedCareersHandoff,
  findVerifiedWorkdayBoardHandoff,
  hasVerifiedCareersSurface,
  hasVerifiedPublicSurface,
  hasVerifiedWorkdayBoardSignal,
  run,
} = piramalPharmaDigitalModule

const PUBLIC_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Piramal Pharma | Integrated global pharmaceutical company</title>
      <link rel="canonical" href="https://www.piramalpharma.com/" />
      <meta property="og:url" content="https://www.piramalpharma.com/" />
    </head>
    <body>
      <main>
        <h1>Piramal Pharma</h1>
        <p>Integrated global pharmaceutical company.</p>
        <nav>
          <a href="https://www.piramalpharma.com/careers">Careers</a>
        </nav>
      </main>
    </body>
  </html>
`

const CAREERS_SURFACE_HTML = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Piramal Pharma Limited Careers</title>
      <link rel="canonical" href="https://www.piramalpharma.com/careers" />
      <meta property="og:url" content="https://www.piramalpharma.com/careers" />
    </head>
    <body>
      <main>
        <h1>Piramal Pharma Limited Careers</h1>
        <a href="#WhyJoinUs">Why Join Us</a>
        <h2>Explore Opportunities</h2>
        <a href="https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS">Apply Now</a>
        <a href="https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS">I am a student</a>
        <a href="https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS">I am a professional</a>
      </main>
    </body>
  </html>
`

const WORKDAY_BOARD_PAGE = {
  status: 200,
  url: 'https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS',
  html: `
    <!doctype html>
    <html lang="en-US">
      <head>
        <link rel="canonical" href="https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS" />
        <meta name="title" property="og:title" content="Careers">
        <meta
          name="description"
          property="og:description"
          content="Introduce yourself to our recruiters and we'll get in touch if there's a role that seems like a good match. Piramal Pharma Limited offers a portfolio of differentiated products and services."
        >
      </head>
      <body>
        <div>PIRAMAL_EXTERNAL_CAREERS</div>
        <div>India</div>
      </body>
    </html>
  `,
}

test('Piramal Pharma Digital stays fail-closed on the verified Piramal Pharma public surface and Workday handoff', async () => {
  const requestedUrls = []

  const jobs = await run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === PUBLIC_SURFACE_URL) {
        return {
          status: 200,
          url,
          html: PUBLIC_SURFACE_HTML,
        }
      }

      if (url === CAREERS_URL) {
        return {
          status: 200,
          url,
          html: CAREERS_SURFACE_HTML,
        }
      }

      if (url === WORKDAY_BOARD_URL) {
        return WORKDAY_BOARD_PAGE
      }

      throw new Error(`Unexpected Piramal Pharma Digital page URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [PUBLIC_SURFACE_URL, CAREERS_URL, WORKDAY_BOARD_URL])
  assert.equal(SOURCE, 'piramalpharmadigital')
  assert.equal(COMPANY, 'Piramal Pharma Digital')
  assert.equal(PUBLIC_SURFACE_URL, 'https://www.piramalpharma.com/')
  assert.equal(CAREERS_URL, 'https://www.piramalpharma.com/careers')
  assert.equal(
    WORKDAY_BOARD_URL,
    'https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS',
  )
  assert.equal(DISPOSITION, 'verified-piramal-pharma-workday-handoff-fail-closed')
  assert.match(VERIFIED_SURFACE_SUMMARY, /Tuesday, August 4, 2026/)
  assert.match(VERIFIED_SURFACE_SUMMARY, /exact workbook entity Piramal Pharma Digital/i)
  assert.equal(typeof createPiramalPharmaDigitalScraper, 'function')
  assert.equal(hasVerifiedPublicSurface(PUBLIC_SURFACE_HTML), true)
  assert.equal(hasVerifiedCareersSurface(CAREERS_SURFACE_HTML), true)
  assert.equal(
    findVerifiedCareersHandoff(PUBLIC_SURFACE_HTML)?.url.toString(),
    'https://www.piramalpharma.com/careers',
  )
  assert.equal(
    findVerifiedWorkdayBoardHandoff(CAREERS_SURFACE_HTML),
    'https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS',
  )
  assert.equal(hasVerifiedWorkdayBoardSignal(WORKDAY_BOARD_PAGE), true)
})

test('Piramal Pharma Digital rejects when the verified public surface disappears', async () => {
  assert.equal(
    hasVerifiedPublicSurface(`
      <html>
        <head><title>Example Corp</title></head>
        <body><h1>Example</h1></body>
      </html>
    `),
    false,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Example Corp</title></head>
                <body><h1>Example</h1></body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected Piramal Pharma Digital page URL: ${url}`)
      },
    }),
    /verified public surface changed/i,
  )
})

test('Piramal Pharma Digital rejects when the careers handoff or verified Workday board changes materially', async () => {
  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: PUBLIC_SURFACE_HTML,
          }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_SURFACE_HTML.replace(
              /https:\/\/piramalpharma\.wd102\.myworkdayjobs\.com\/PIRAMAL_EXTERNAL_CAREERS/g,
              'https://example.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected Piramal Pharma Digital page URL: ${url}`)
      },
    }),
    /verified careers handoff changed/i,
  )

  await assert.rejects(
    run({
      fetchPage: async (url) => {
        if (url === PUBLIC_SURFACE_URL) {
          return {
            status: 200,
            url,
            html: PUBLIC_SURFACE_HTML,
          }
        }

        if (url === CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_SURFACE_HTML,
          }
        }

        if (url === WORKDAY_BOARD_URL) {
          return {
            ...WORKDAY_BOARD_PAGE,
            html: WORKDAY_BOARD_PAGE.html.replace('content="Careers"', 'content="Jobs"'),
          }
        }

        throw new Error(`Unexpected Piramal Pharma Digital page URL: ${url}`)
      },
    }),
    /verified workday board changed/i,
  )
})
