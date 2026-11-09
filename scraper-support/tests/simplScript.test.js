import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Simpl — India's Leading 1-Tap Checkout Network</title>
  </head>
  <body>
    <h2>India's #1 Checkout Network</h2>
    <h1>Payments made invisible. Money made intelligent.</h1>
    <p>Based in Bengaluru, India, and founded in 2015, Simpl (One Sigma) is a fintech company.</p>
    <h2>About Simpl</h2>
    <p>Join thousands of merchants and millions of users who trust Simpl.</p>
    <footer>
      <div>Company</div>
      <span>About Us</span>
      <span>Partners</span>
      <span>Careers</span>
      <span>Blog</span>
      <span>Press</span>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us — Simpl</title>
  </head>
  <body>
    <h1>About Simpl</h1>
    <p>Reimagining credit for the mobile era.</p>
    <p>Based in Bengaluru, India, and founded in 2015, Simpl (One Sigma) is a fintech company.</p>
    <h2>What drives us forward</h2>
    <p>Customer First</p>
    <p>Speed with Trust</p>
    <p>Radical Simplicity</p>
    <footer>
      <div>Company</div>
      <span>About Us</span>
      <span>Partners</span>
      <span>Careers</span>
    </footer>
  </body>
</html>
`

const careersReferenceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Simpl - India's Leading 1-tap Checkout Network!</title>
  </head>
  <body>
    <h1>About Us</h1>
    <h2>Careers with Simpl</h2>
    <p>We are a team of independent thinkers and entrepreneurial leaders. Reinvent the world of commerce with us.</p>
    <a href="/join-us">Join Us</a>
    <p>The Simpl App</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/simpl/script.js')
  } catch {
    assert.fail('Expected Simpl scraper module at ../../scraper/simpl/script.js')
  }
}

test('Simpl sentinel helpers stay pinned to the verified first-party no-public-jobs surfaces', async () => {
  const simpl = await loadModule()

  assert.equal(simpl.SOURCE, 'simpl')
  assert.equal(simpl.COMPANY_NAME, 'Simpl')
  assert.equal(simpl.OFFICIAL_BRAND_NAME, 'Simpl')
  assert.equal(simpl.VERIFIED_ON, '2026-07-26')
  assert.equal(simpl.HOMEPAGE_URL, 'https://www.get-simpl.com/index.html')
  assert.equal(simpl.ABOUT_PAGE_URL, 'https://www.get-simpl.com/about.html')
  assert.equal(simpl.CAREERS_REFERENCE_PAGE_URL, 'https://sandbox.getsimpl.com/about-us/')
  assert.equal(simpl.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(simpl.hasOfficialHomepageSignal('<html><body>Simpl</body></html>'), false)
  assert.equal(simpl.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(simpl.hasOfficialAboutSignal('<html><body>About Simpl</body></html>'), false)
  assert.equal(simpl.hasOfficialCareersReferenceSignal(careersReferenceHtml), true)
  assert.equal(simpl.hasOfficialCareersReferenceSignal('<html><body>Careers with Simpl</body></html>'), false)
  assert.equal(simpl.hasLinkedFirstPartyCareersRoute(homepageHtml), false)
  assert.equal(
    simpl.hasLinkedFirstPartyCareersRoute('<a href="https://www.get-simpl.com/careers.html">Careers</a>'),
    true,
  )
  assert.equal(simpl.hasPublicJobsSignal(careersReferenceHtml), false)
  assert.equal(
    simpl.hasPublicJobsSignal('<a href="https://jobs.lever.co/simpl">Open positions</a>'),
    true,
  )
})

test('Simpl sentinel returns [] only while the verified first-party surfaces expose no trustworthy public jobs board', async () => {
  const simpl = await loadModule()
  const requestedUrls = []

  const jobs = await simpl.createSimplScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === simpl.HOMEPAGE_URL) return homepageHtml
      if (url === simpl.ABOUT_PAGE_URL) return aboutHtml
      if (url === simpl.CAREERS_REFERENCE_PAGE_URL) return careersReferenceHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    simpl.HOMEPAGE_URL,
    simpl.ABOUT_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Simpl sentinel fails closed when the first-party surface starts exposing a trustworthy jobs route', async () => {
  const simpl = await loadModule()

  await assert.rejects(
    simpl.createSimplScraper().run({
      fetchText: async (url) => {
        if (url === simpl.HOMEPAGE_URL) {
          return `${homepageHtml}<a href="https://www.get-simpl.com/careers.html">Careers</a>`
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now exposes a first-party careers route/i,
  )

  await assert.rejects(
    simpl.createSimplScraper().run({
      fetchText: async (url) => {
        if (url === simpl.HOMEPAGE_URL) return homepageHtml
        if (url === simpl.ABOUT_PAGE_URL) {
          return `${aboutHtml}<a href="https://jobs.lever.co/simpl">Open positions</a>`
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about page now exposes a public jobs surface/i,
  )
})
