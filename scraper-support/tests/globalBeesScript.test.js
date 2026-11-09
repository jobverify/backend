import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Experience the world of brands with GlobalBees</title>
  </head>
  <body>
    <header>
      <a href="https://www.globalbees.com/">Home</a>
      <a href="https://www.globalbees.com/about.html">About Us</a>
      <a href="https://www.globalbees.com/career.html">Work With Us</a>
    </header>
    <main>
      <h1>Experience the world of brands with GlobalBees</h1>
      <p>GlobalBees Brands is building and scaling consumer-first brands.</p>
    </main>
    <footer>
      <p>WORK WITH US careers@globalbees.com</p>
      <p>GET IN TOUCH contact@globalbees.com</p>
    </footer>
  </body>
</html>
`

const careerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>GlobalBees Careers</title>
  </head>
  <body>
    <main>
      <h2>We’re expanding the hive</h2>
      <p>If you thrive in a fast-paced, quick-to-action workplace, then you'll love working with us.</p>
      <p>We're hiring across multiple functions.</p>
      <p>Write to us at careers@globalbees.com</p>
      <h3>Send us your CV</h3>
      <form>
        <label>Your Name *</label>
        <label>Phone Number *</label>
        <label>Email Address *</label>
        <textarea>Type Your Message Here...</textarea>
      </form>
      <!-- <section class="work_with_us open_positions">
        <h2>Open positions in All Locations</h2>
        <a href="/job/front-end-designer">Apply now</a>
      </section> -->
    </main>
    <footer>
      <p>WORK WITH US careers@globalbees.com</p>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h2>Open positions in All Locations</h2>
      <article>
        <h3>Senior Brand Manager</h3>
        <a href="https://www.globalbees.com/job/senior-brand-manager">Apply now</a>
      </article>
    </main>
  </body>
</html>
`

const loadGlobalBeesModule = async () => {
  try {
    return await import('../../scraper/globalbees/script.js')
  } catch {
    assert.fail('Expected GlobalBees scraper module at ../../scraper/globalbees/script.js')
  }
}

test('GlobalBees sentinel pins the verified homepage and contact-form-only careers page from July 16, 2026', async () => {
  const globalBees = await loadGlobalBeesModule()

  assert.equal(globalBees.SOURCE, 'globalbees')
  assert.equal(globalBees.COMPANY, 'GlobalBees')
  assert.equal(globalBees.OFFICIAL_BRAND_NAME, 'GlobalBees')
  assert.equal(globalBees.VERIFIED_ON, '2026-07-16')
  assert.equal(globalBees.HOMEPAGE_URL, 'https://www.globalbees.com/')
  assert.equal(globalBees.CAREER_PAGE_URL, 'https://www.globalbees.com/career.html')
  assert.match(globalBees.VERIFIED_SURFACE_SUMMARY, /no trustworthy public job listings/i)

  assert.equal(globalBees.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(globalBees.hasOfficialCareerPageSignal(careerHtml), true)
  assert.equal(globalBees.hasPublicJobsSignal(careerHtml), false)
  assert.equal(globalBees.hasPublicJobsSignal(publicJobsHtml), true)
})

test('GlobalBees sentinel returns [] only while the verified contact-form-only careers surface remains unchanged', async () => {
  const globalBees = await loadGlobalBeesModule()
  const requestedUrls = []

  const jobs = await globalBees.createGlobalBeesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === globalBees.HOMEPAGE_URL) {
        return { ok: true, status: 200, url, text: homepageHtml }
      }

      if (url === globalBees.CAREER_PAGE_URL) {
        return { ok: true, status: 200, url, text: careerHtml }
      }

      throw new Error(`Unexpected GlobalBees URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    globalBees.HOMEPAGE_URL,
    globalBees.CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('GlobalBees sentinel fails closed when the homepage or careers page drifts into a public jobs surface', async () => {
  const globalBees = await loadGlobalBeesModule()

  await assert.rejects(
    globalBees.createGlobalBeesScraper().run({
      fetchPage: async (url) => {
        if (url === globalBees.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected GlobalBees URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    globalBees.createGlobalBeesScraper().run({
      fetchPage: async (url) => {
        if (url === globalBees.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === globalBees.CAREER_PAGE_URL) {
          return { ok: true, status: 200, url, text: publicJobsHtml }
        }

        throw new Error(`Unexpected GlobalBees URL: ${url}`)
      },
    }),
    /careers page now appears to expose public job listings/i,
  )

  await assert.rejects(
    globalBees.createGlobalBeesScraper().run({
      fetchPage: async (url) => {
        if (url === globalBees.HOMEPAGE_URL) {
          return { ok: true, status: 200, url, text: homepageHtml }
        }

        if (url === globalBees.CAREER_PAGE_URL) {
          return {
            ok: true,
            status: 200,
            url,
            text: '<html><body><h2>We’re expanding the hive</h2><p>Email us</p></body></html>',
          }
        }

        throw new Error(`Unexpected GlobalBees URL: ${url}`)
      },
    }),
    /careers page no longer matches the verified contact-form surface/i,
  )
})
