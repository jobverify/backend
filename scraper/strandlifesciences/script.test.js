import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Strand Life Sciences</title>
  </head>
  <body>
    <main>
      <h1>Strand Life Sciences</h1>
      <p>Bangalore, India</p>
      <p>Our CAP lab supports precision medicine workflows.</p>
      <p>Genomics and diagnostics services.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Strand</title>
  </head>
  <body>
    <main>
      <h1>Careers - Strand Life Sciences</h1>
      <p>Join us</p>
      <p>Open Roles</p>
      <form>
        <input type="file" name="resume" />
      </form>
      <div class="g-recaptcha"></div>
    </main>
  </body>
</html>
`

const privacyHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Privacy | Strand</title>
  </head>
  <body>
    <main>
      <h1>Privacy Policy</h1>
      <p>Data Controller</p>
      <p>Bangalore, India</p>
    </main>
  </body>
</html>
`

test('Strand Life Sciences validates the verified homepage, careers page, and privacy page', async () => {
  const strand = await loadModule()
  assert.ok(strand, 'Strand Life Sciences scraper module should load')

  assert.equal(strand.SOURCE, 'strandlifesciences')
  assert.equal(strand.COMPANY, 'Strand Life Sciences')
  assert.equal(strand.HOMEPAGE_URL, 'https://us.strandls.com/')
  assert.equal(strand.CAREERS_URL, 'https://us.strandls.com/careers')
  assert.equal(strand.PRIVACY_URL, 'https://us.strandls.com/privacy')
  assert.equal(strand.hasHomepageSignal(homepageHtml), true)
  assert.equal(strand.hasCareersPageSignal(careersHtml), true)
  assert.equal(strand.hasPrivacyPageSignal(privacyHtml), true)
  assert.equal(strand.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Strand Life Sciences returns no jobs while the verified careers surface remains form-only', async () => {
  const strand = await loadModule()
  assert.ok(strand, 'Strand Life Sciences scraper module should load')

  const requestedUrls = []
  const jobs = await strand.createStrandLifeSciencesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === strand.HOMEPAGE_URL) return homepageHtml
      if (url === strand.CAREERS_URL) return careersHtml
      if (url === strand.PRIVACY_URL) return privacyHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    strand.HOMEPAGE_URL,
    strand.CAREERS_URL,
    strand.PRIVACY_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Strand Life Sciences fails closed when the homepage, careers page, or privacy page drifts', async () => {
  const strand = await loadModule()
  assert.ok(strand, 'Strand Life Sciences scraper module should load')

  await assert.rejects(
    strand.createStrandLifeSciencesScraper().run({
      fetchText: async (url) => {
        if (url === strand.HOMEPAGE_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        if (url === strand.CAREERS_URL) return careersHtml
        if (url === strand.PRIVACY_URL) return privacyHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    strand.createStrandLifeSciencesScraper().run({
      fetchText: async (url) => {
        if (url === strand.HOMEPAGE_URL) return homepageHtml
        if (url === strand.CAREERS_URL) {
          return `${careersHtml}<a href="https://job-boards.greenhouse.io/strand/jobs/123">Software Engineer</a>`
        }
        if (url === strand.PRIVACY_URL) return privacyHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page now exposes public jobs/i,
  )

  await assert.rejects(
    strand.createStrandLifeSciencesScraper().run({
      fetchText: async (url) => {
        if (url === strand.HOMEPAGE_URL) return homepageHtml
        if (url === strand.CAREERS_URL) return careersHtml
        if (url === strand.PRIVACY_URL) return '<html><body><h1>Privacy</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /privacy page/i,
  )
})
