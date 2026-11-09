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
    <body>
      <main>
        <a href="https://testpress.tech/careers/">Join us as Software Developer</a>
        <p>support@testpress.in</p>
        <h1>Discover Why Leading Institutes Trust Testpress</h1>
        <p>The Ultimate LMS Software for Scalable Growth</p>
        <p>© 2013 - 2026 Testpress Tech Labs.</p>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Journey of Testpress</h2>
        <h2>Birth of Testpress Online Exam Software (2014)</h2>
        <p>Fueled by this need, Testpress was born in 2014.</p>
        <p>HR/Career</p>
        <p>© 2013 - 2026 Testpress Tech Labs.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Apply for Software Developer</h2>
        <p>if so, we want to meet you.</p>
        <h2>What do we do?</h2>
        <p>At Testpress, we are revolutionizing the way Indian Students learn.</p>
        <h2>Who should join us?</h2>
        <a href="https://zfrmz.com/example-testpress-apply">Join us now</a>
      </main>
      <footer>
        <p>sales@testpress.in</p>
        <p>HR/Career</p>
        <p>© 2013 - 2026 Testpress Tech Labs.</p>
      </footer>
    </body>
  </html>
`

test('Testpress sentinel validates the verified homepage, about page, and careers page with an outbound apply handoff', async () => {
  const testpress = await loadModule()
  assert.ok(testpress, 'Testpress scraper module should load')

  assert.equal(testpress.SOURCE, 'testpress')
  assert.equal(testpress.COMPANY, 'Testpress Tech Labs')
  assert.equal(testpress.HOMEPAGE_URL, 'https://testpress.tech/')
  assert.equal(testpress.ABOUT_URL, 'https://testpress.tech/about-us/')
  assert.equal(testpress.CAREERS_URL, 'https://testpress.tech/careers/')
  assert.equal(testpress.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(testpress.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(testpress.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    testpress.extractOutboundApplyUrl(careersHtml),
    'https://zfrmz.com/example-testpress-apply',
  )
  assert.equal(testpress.hasPublicJobListingSignal(careersHtml), false)
})

test('Testpress run returns an empty list while the verified careers page exposes only a direct outbound apply handoff', async () => {
  const testpress = await loadModule()
  assert.ok(testpress, 'Testpress scraper module should load')

  const requestedUrls = []
  const jobs = await testpress.createTestpressScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === testpress.HOMEPAGE_URL) return homepageHtml
      if (url === testpress.ABOUT_URL) return aboutHtml
      if (url === testpress.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Testpress URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://testpress.tech/',
    'https://testpress.tech/about-us/',
    'https://testpress.tech/careers/',
  ])
  assert.deepEqual(jobs, [])
})

test('Testpress fails closed when the trusted pages change materially or a public jobs board appears', async () => {
  const testpress = await loadModule()
  assert.ok(testpress, 'Testpress scraper module should load')

  await assert.rejects(
    testpress.createTestpressScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    testpress.createTestpressScraper().run({
      fetchText: async (url) => {
        if (url === testpress.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Unexpected page</h1></body></html>'
      },
    }),
    /verified about page|verified careers page/i,
  )

  await assert.rejects(
    testpress.createTestpressScraper().run({
      fetchText: async (url) => {
        if (url === testpress.HOMEPAGE_URL) return homepageHtml
        if (url === testpress.ABOUT_URL) return aboutHtml
        return careersHtml.replace(
          '</main>',
          '<script type="application/ld+json">{"@type":"JobPosting"}</script></main>',
        )
      },
    }),
    /now appears to expose public job records/i,
  )
})
