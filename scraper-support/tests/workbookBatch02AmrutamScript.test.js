import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Amrutam - Authentic Ayurvedic Products for Health &amp; Beauty</title>
  </head>
  <body>
    <nav>
      <a href="/pages/meet-the-team">About Us</a>
      <a href="https://forms.gle/YCyYEZ5BLToeqw7u9">Work with Us</a>
    </nav>
    <main>
      <h1>Amrutam</h1>
      <p>Authentic Ayurvedic Products for Health &amp; Beauty</p>
      <p>support@amrutam.co.in</p>
    </main>
  </body>
</html>
`

const TEAM_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Meet the Team &ndash; Amrutam</title>
  </head>
  <body>
    <main>
      <h1>MEET THE TEAM</h1>
      <p>The OG Gang of Amrutam</p>
      <p>Ashok Gupta</p>
      <p>Chandrakanta Gupta</p>
    </main>
  </body>
</html>
`

const STORY_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Our Story – The Journey of Amrutam</title>
  </head>
  <body>
    <main>
      <h1>Our Story - The Journey of Amrutam</h1>
      <p>The Origins of Amrutam</p>
      <p>Based out of the globally-known, culturally-rich town of Gwalior</p>
      <p>Sh. Ashok and Smt. Chandrakanta Gupta</p>
      <p>Elixir of Life</p>
    </main>
  </body>
</html>
`

const WORK_WITH_US_FORM_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Work with Amrutam</title>
  </head>
  <body>
    <main>
      <h1>Work with Amrutam</h1>
      <p>Exciting Opportunities await at Amrutam - Apply Now!</p>
      <p>Location: Gwalior - Heart of India</p>
      <label>Which role are you interested in?</label>
    </main>
  </body>
</html>
`

const MISSING_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found &ndash; Amrutam</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Sorry! Page you are looking can’t be found.</p>
      <a href="/">Go back to the homepage</a>
      <p>Get in touch</p>
      <a href="https://forms.gle/YCyYEZ5BLToeqw7u9">Work with Us</a>
      <p>support@amrutam.co.in</p>
      <p>Amrutam Pharmaceuticals Pvt Ltd</p>
    </main>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Current Openings</h1>
    <article>
      <h2>Ayurveda Content Writer</h2>
      <p>Gwalior, India</p>
      <a href="https://jobs.example.com/amrutam-content-writer">Apply Now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/amrutam/script.js')
  } catch {
    assert.fail('Expected Amrutam scraper module at ../../scraper/amrutam/script.js')
  }
}

test('Amrutam helper signals stay pinned to the verified homepage, identity pages, Work with Us form, and branded missing careers routes', async () => {
  const amrutam = await loadModule()

  assert.equal(amrutam.SOURCE, 'amrutam')
  assert.equal(amrutam.COMPANY, 'Amrutam')
  assert.equal(amrutam.VERIFIED_ON, '2026-07-30')
  assert.equal(amrutam.HOMEPAGE_URL, 'https://amrutam.co.in/')
  assert.equal(amrutam.TEAM_URL, 'https://amrutam.co.in/pages/meet-the-team')
  assert.equal(amrutam.STORY_URL, 'https://amrutam.co.in/pages/our-story-the-journey-of-amrutam-1')
  assert.equal(amrutam.WORK_WITH_US_URL, 'https://forms.gle/YCyYEZ5BLToeqw7u9')
  assert.equal(amrutam.CAREERS_URL, 'https://amrutam.co.in/careers')
  assert.equal(amrutam.PAGES_CAREERS_URL, 'https://amrutam.co.in/pages/careers')
  assert.equal(amrutam.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(amrutam.hasOfficialTeamPageSignal(TEAM_HTML), true)
  assert.equal(amrutam.hasOfficialStoryPageSignal(STORY_HTML), true)
  assert.equal(
    amrutam.isVerifiedWorkWithUsFormPage({
      status: 200,
      url: 'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform?usp=send_form',
      html: WORK_WITH_US_FORM_HTML,
    }),
    true,
  )
  assert.equal(amrutam.pageExposesPublicJobListings(HOMEPAGE_HTML), false)
  assert.equal(amrutam.pageExposesPublicJobListings(TEAM_HTML), false)
  assert.equal(amrutam.pageExposesPublicJobListings(STORY_HTML), false)
  assert.equal(amrutam.pageExposesPublicJobListings(PUBLIC_JOBS_HTML), true)
  assert.equal(
    amrutam.isVerifiedMissingCareerRoute(
      {
        status: 404,
        url: amrutam.CAREERS_URL,
        html: MISSING_CAREERS_HTML,
      },
      amrutam.CAREERS_URL,
    ),
    true,
  )
  assert.equal(
    amrutam.isVerifiedMissingCareerRoute(
      {
        status: 404,
        url: amrutam.PAGES_CAREERS_URL,
        html: MISSING_CAREERS_HTML,
      },
      amrutam.PAGES_CAREERS_URL,
    ),
    true,
  )
})

test('Amrutam returns [] only while the verified company pages stay intact, the Work with Us form remains generic, and both careers routes stay missing', async () => {
  const amrutam = await loadModule()
  const requestedUrls = []

  const jobs = await amrutam.createAmrutamScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === amrutam.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === amrutam.TEAM_URL) {
        return { status: 200, url, html: TEAM_HTML }
      }

      if (url === amrutam.STORY_URL) {
        return { status: 200, url, html: STORY_HTML }
      }

      if (url === amrutam.WORK_WITH_US_URL) {
        return {
          status: 200,
          url: 'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform?usp=send_form',
          html: WORK_WITH_US_FORM_HTML,
        }
      }

      if (url === amrutam.CAREERS_URL) {
        return { status: 404, url, html: MISSING_CAREERS_HTML }
      }

      if (url === amrutam.PAGES_CAREERS_URL) {
        return { status: 404, url, html: MISSING_CAREERS_HTML }
      }

      throw new Error(`Unexpected Amrutam URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    amrutam.HOMEPAGE_URL,
    amrutam.TEAM_URL,
    amrutam.STORY_URL,
    amrutam.WORK_WITH_US_URL,
    amrutam.CAREERS_URL,
    amrutam.PAGES_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Amrutam fails closed when the verified company pages, Work with Us form, or missing careers routes drift', async () => {
  const amrutam = await loadModule()

  await assert.rejects(
    amrutam.createAmrutamScraper().run({
      fetchPage: async (url) => {
        if (url === amrutam.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>Unexpected</body></html>' }
        }

        if (url === amrutam.TEAM_URL) {
          return { status: 200, url, html: TEAM_HTML }
        }

        if (url === amrutam.STORY_URL) {
          return { status: 200, url, html: STORY_HTML }
        }

        if (url === amrutam.WORK_WITH_US_URL) {
          return {
            status: 200,
            url: 'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform?usp=send_form',
            html: WORK_WITH_US_FORM_HTML,
          }
        }

        if (url === amrutam.CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        if (url === amrutam.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Amrutam URL: ${url}`)
      },
    }),
    /homepage for amrutam/i,
  )

  await assert.rejects(
    amrutam.createAmrutamScraper().run({
      fetchPage: async (url) => {
        if (url === amrutam.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === amrutam.TEAM_URL) {
          return { status: 200, url, html: TEAM_HTML }
        }

        if (url === amrutam.STORY_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === amrutam.WORK_WITH_US_URL) {
          return {
            status: 200,
            url: 'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform?usp=send_form',
            html: WORK_WITH_US_FORM_HTML,
          }
        }

        if (url === amrutam.CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        if (url === amrutam.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Amrutam URL: ${url}`)
      },
    }),
    /story page for amrutam/i,
  )

  await assert.rejects(
    amrutam.createAmrutamScraper().run({
      fetchPage: async (url) => {
        if (url === amrutam.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === amrutam.TEAM_URL) {
          return { status: 200, url, html: TEAM_HTML }
        }

        if (url === amrutam.STORY_URL) {
          return { status: 200, url, html: STORY_HTML }
        }

        if (url === amrutam.WORK_WITH_US_URL) {
          return {
            status: 200,
            url: 'https://docs.google.com/forms/d/e/example/viewform',
            html: '<html><body>Unexpected form</body></html>',
          }
        }

        if (url === amrutam.CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        if (url === amrutam.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Amrutam URL: ${url}`)
      },
    }),
    /work with us form for amrutam/i,
  )

  await assert.rejects(
    amrutam.createAmrutamScraper().run({
      fetchPage: async (url) => {
        if (url === amrutam.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === amrutam.TEAM_URL) {
          return { status: 200, url, html: TEAM_HTML }
        }

        if (url === amrutam.STORY_URL) {
          return { status: 200, url, html: STORY_HTML }
        }

        if (url === amrutam.WORK_WITH_US_URL) {
          return {
            status: 200,
            url: 'https://docs.google.com/forms/d/e/1FAIpQLSf8eTDw5QUalbBJqZVjtzv-blElhCQgCBI4QNj9tHTZ-VDl-w/viewform?usp=send_form',
            html: WORK_WITH_US_FORM_HTML,
          }
        }

        if (url === amrutam.CAREERS_URL) {
          return { status: 200, url, html: PUBLIC_JOBS_HTML }
        }

        if (url === amrutam.PAGES_CAREERS_URL) {
          return { status: 404, url, html: MISSING_CAREERS_HTML }
        }

        throw new Error(`Unexpected Amrutam URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
