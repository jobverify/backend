import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected E-Mote Electric scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Emote Electric | Geared Electric Motorcycle | India</title>
  </head>
  <body>
    <main>
      <h1>The All New Sleek, Smart & Economical Surge is coming soon</h1>
      <section>
        <h2>10+ years of R&D</h2>
        <p>Winner NASSCOM Design Award 2018</p>
      </section>
      <footer>
        <p>info@emoteelectric.com</p>
        <p>+91 99521 67234</p>
        <p>© 2024 Emote Electric, All Rights Reserved.</p>
      </footer>
    </main>
  </body>
</html>
`

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 | Emote Electric</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>The page you requested could not be found.</p>
      <a href="https://www.emoteelectric.in/">Back to Home</a>
    </main>
  </body>
</html>
`

test('E-Mote Electric sentinel pins the verified first-party no-public-careers surface from July 13, 2026', async () => {
  const emote = await loadModule()

  assert.equal(emote.SOURCE, 'emoteelectric')
  assert.equal(emote.COMPANY, 'E-Mote Electric')
  assert.equal(emote.VERIFIED_ON, '2026-07-13')
  assert.equal(emote.HOMEPAGE_URL, 'https://www.emoteelectric.in/')
  assert.deepEqual(emote.CAREERS_URLS, [
    'https://www.emoteelectric.in/careers',
    'https://www.emoteelectric.in/jobs',
  ])
  assert.match(
    emote.VERIFIED_SURFACE_SUMMARY,
    /no trustworthy public jobs surface/i,
  )
  assert.equal(emote.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(emote.hasOfficialHomepageSignal('<html><body>Other company</body></html>'), false)
  assert.equal(emote.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    emote.hasPublicJobsSignal('<a href="https://boards.greenhouse.io/emoteelectric">Open positions</a>'),
    true,
  )
  assert.equal(emote.isVerifiedMissingCareersRoute(404, careers404Html), true)
  assert.equal(emote.isVerifiedMissingCareersRoute(200, careers404Html), false)
})

test('E-Mote Electric sentinel returns [] only while the verified homepage and missing careers routes stay unchanged', async () => {
  const emote = await loadModule()
  const requestedUrls = []

  const jobs = await emote.createEmoteElectricScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === emote.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (emote.CAREERS_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected E-Mote Electric URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    emote.HOMEPAGE_URL,
    ...emote.CAREERS_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('E-Mote Electric sentinel fails closed when the homepage or careers-route behavior drifts', async () => {
  const emote = await loadModule()

  await assert.rejects(
    emote.createEmoteElectricScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: emote.HOMEPAGE_URL,
        html: '<html><body><h1>Unexpected homepage</h1></body></html>',
      }),
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    emote.createEmoteElectricScraper().run({
      fetchPage: async (url) => {
        if (url === emote.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        return { status: 200, url, html: careers404Html }
      },
    }),
    /verified missing careers route/i,
  )

  await assert.rejects(
    emote.createEmoteElectricScraper().run({
      fetchPage: async (url) => {
        if (url === emote.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: `${homepageHtml}<a href="https://jobs.lever.co/emoteelectric">Apply now</a>`,
          }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /public jobs surface/i,
  )
})
