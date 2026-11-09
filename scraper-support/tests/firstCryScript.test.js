import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Baby Products Online India: Newborn Baby Products & Kids Online Shopping at FirstCry.com</title>
  </head>
  <body>
    <footer>
      <section>
        <h4>COMPANY INFO</h4>
        <a href="https://www.firstcry.com/contactus">Contact Us</a>
        <a href="https://www.firstcry.com/investor-relations">Investor Relations</a>
      </section>
      <section>
        <h4>CAREER AT FIRSTCRY.COM</h4>
        <a href="https://www.firstcry.com/careers">Current Openings at FirstCry.com</a>
      </section>
    </footer>
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FirstCry Careers: Current Job Opening at FirstCry.com</title>
  </head>
  <body>
    <h1>FirstCry Careers</h1>
    <p>working at firstcry.com</p>
    <section>
      <p>Design If you love new challenge everyday then welcome to the Design Team at FirstCry! Design brings to life all our products and Read More</p>
      <p>Marketing Explore Marketing @FirstCry - a dynamic, creative, fast-paced environment where you'll closely collaborate with other verticals Read More</p>
      <p>Product Product is an innovative, insightful & creative function within the organisation. We ensure all our online products and systems Read More</p>
      <p>Technology The technology team forms a core part of the Firstcry business. It houses various sub-teams ranging from development to data science Read More</p>
    </section>
    <section>
      <h2>Our colleagues-their voice</h2>
      <p>Arpit Agrawal</p>
      <p>My 7+ years of journey at FirstCry has been very exciting and full of action.</p>
      <p>Megha Arora</p>
      <p>I have been with FirstCry for 8+ years now and this feels like home.</p>
    </section>
    <footer>
      <a href="https://twitter.com/firstcryindia">Twitter</a>
      <a href="https://www.facebook.com/firstcryindia">Facebook</a>
      <a href="https://www.linkedin.com/company/firstcry-com">LinkedIn</a>
      <a href="https://www.instagram.com/firstcryindia">Instagram</a>
      <a href="https://www.youtube.com/user/FirstCryIndia">YouTube</a>
      <a href="https://www.firstcry.com/privacy-policy">Privacy Policy</a>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>FirstCry Careers: Current Job Opening at FirstCry.com</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer"}
    </script>
  </head>
  <body>
    <h1>FirstCry Careers</h1>
    <p>working at firstcry.com</p>
    <a href="https://jobs.lever.co/firstcry/123">Apply now</a>
  </body>
</html>
`

const loadFirstCryModule = async () => {
  try {
    return await import('../../scraper/firstcry/script.js')
  } catch {
    assert.fail('Expected FirstCry scraper module at ../../scraper/firstcry/script.js')
  }
}

test('FirstCry sentinel constants stay pinned to the verified first-party informational careers surface', async () => {
  const firstCry = await loadFirstCryModule()

  assert.equal(firstCry.SOURCE, 'firstcry')
  assert.equal(firstCry.COMPANY, 'FirstCry')
  assert.equal(firstCry.VERIFIED_ON, '2026-07-15')
  assert.equal(firstCry.HOMEPAGE_URL, 'https://www.firstcry.com/')
  assert.equal(firstCry.CAREERS_URL, 'https://www.firstcry.com/careers')
  assert.equal(
    firstCry.extractHomepageCareersUrl(homepageHtml),
    'https://www.firstcry.com/careers',
  )
  assert.equal(firstCry.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(firstCry.hasInformationalCareersPageSignal(careersPageHtml), true)
  assert.equal(firstCry.hasPublicJobListingSignal(careersPageHtml), false)
  assert.equal(firstCry.hasPublicJobListingSignal(publicJobsHtml), true)
  assert.match(firstCry.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
})

test('FirstCry sentinel returns [] only while the verified homepage and careers page stay informational', async () => {
  const firstCry = await loadFirstCryModule()
  const requestedUrls = []

  const jobs = await firstCry.createFirstCryScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === firstCry.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === firstCry.CAREERS_URL) {
        return { status: 200, url, html: careersPageHtml }
      }

      throw new Error(`Unexpected FirstCry URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    firstCry.HOMEPAGE_URL,
    firstCry.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('FirstCry sentinel fails closed when the homepage careers handoff drifts', async () => {
  const firstCry = await loadFirstCryModule()

  await assert.rejects(
    firstCry.createFirstCryScraper().run({
      fetchPage: async (url) => {
        if (url === firstCry.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              'https://www.firstcry.com/careers',
              'https://www.firstcry.com/jobs',
            ),
          }
        }

        throw new Error(`Unexpected FirstCry URL: ${url}`)
      },
    }),
    /verified homepage careers handoff/i,
  )
})

test('FirstCry sentinel fails closed when the verified careers page drifts or starts exposing public jobs', async () => {
  const firstCry = await loadFirstCryModule()

  await assert.rejects(
    firstCry.createFirstCryScraper().run({
      fetchPage: async (url) => {
        if (url === firstCry.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === firstCry.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersPageHtml.replace('Technology The technology team forms a core part', 'Engineering'),
          }
        }

        throw new Error(`Unexpected FirstCry URL: ${url}`)
      },
    }),
    /verified careers page no longer matches/i,
  )

  await assert.rejects(
    firstCry.createFirstCryScraper().run({
      fetchPage: async (url) => {
        if (url === firstCry.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === firstCry.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected FirstCry URL: ${url}`)
      },
    }),
    /careers page now appears to expose a public jobs board/i,
  )
})
