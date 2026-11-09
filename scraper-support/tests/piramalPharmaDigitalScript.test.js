import assert from 'node:assert/strict'
import test from 'node:test'

const PUBLIC_SURFACE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Piramal Pharma Limited | Global Pharma Manufacturing Company</title>
  </head>
  <body>
    <nav>
      <a href="https://www.piramalpharma.com/careers">Careers</a>
      <a href="https://www.piramalpharma.com/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Piramal Pharma Limited</h1>
    </main>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Piramal Pharma Limited Careers | Opportunities to Grow</title>
    <link rel="canonical" href="https://www.piramalpharma.com/careers" />
  </head>
  <body>
    <main>
      <h1>We Invite You to Design Your Destiny with Piramal Pharma Limited</h1>
      <a href="#WhyJoinUs">Why Join Us</a>
      <h2>Explore Opportunities</h2>
      <a href="https://piramalpharma.wd102.myworkdayjobs.com/PIRAMAL_EXTERNAL_CAREERS">Apply Now</a>
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
          content="Introduce yourself to our recruiters and we'll get in touch if there's a role that seems like a good match. Piramal Pharma Limited operates in India."
        />
      </head>
      <body>
        <div>PIRAMAL_EXTERNAL_CAREERS</div>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/piramalpharmadigital/script.js')
  } catch {
    assert.fail('Expected Piramal Pharma Digital scraper module at ../../scraper/piramalpharmadigital/script.js')
  }
}

test('Piramal Pharma Digital stays pinned to the verified Piramal Pharma homepage, careers handoff, and public Workday board', async () => {
  const subject = await loadModule()

  assert.equal(subject.hasVerifiedPublicSurface(PUBLIC_SURFACE_HTML), true)
  assert.equal(subject.hasVerifiedCareersSurface(CAREERS_HTML), true)
  assert.equal(subject.hasVerifiedWorkdayBoardSignal(WORKDAY_BOARD_PAGE), true)
})

test('Piramal Pharma Digital returns [] only while the exact-name contract remains a fail-closed handoff review', async () => {
  const subject = await loadModule()
  const requestedUrls = []

  const jobs = await subject.createPiramalPharmaDigitalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === subject.PUBLIC_SURFACE_URL) {
        return { status: 200, url, html: PUBLIC_SURFACE_HTML }
      }

      if (url === subject.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (url === subject.WORKDAY_BOARD_URL) {
        return WORKDAY_BOARD_PAGE
      }

      throw new Error(`Unexpected Piramal Pharma Digital URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    subject.PUBLIC_SURFACE_URL,
    subject.CAREERS_URL,
    subject.WORKDAY_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})
