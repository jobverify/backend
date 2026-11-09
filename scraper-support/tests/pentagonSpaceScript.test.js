import assert from 'node:assert/strict'
import test from 'node:test'

const loadPentagonSpaceModule = async () => {
  try {
    return await import('../../scraper/pentagonspace/script.js')
  } catch {
    assert.fail('Expected Pentagon Space scraper module at ../../scraper/pentagonspace/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Pentagon</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="/about">About Us</a>
        <a href="/courses">Courses</a>
        <a href="/placements">Placements</a>
        <a href="/branch">Branches</a>
        <a href="/branch">Contact</a>
      </nav>
    </header>
    <main>
      <p>Trusted by thousands</p>
      <h1>Where Ambition Meets Direction.</h1>
      <p>Transform your potential through industry-ready programs, hands-on experience, and career guidance from seasoned professionals.</p>
      <p>
        Pentagon Space is a trusted finishing school and career acceleration platform in Bengaluru, committed to bridging the gap between aspiring software professionals and evolving industry requirements.
      </p>
    </main>
    <footer>
      <a href="https://www.facebook.com/PentagonSpace">Facebook</a>
      <a href="https://www.instagram.com/pentagonspace_official/">Instagram</a>
      <a href="https://x.com/pentagon_space">X</a>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Pentagon Space Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.ashbyhq.com/pentagonspace/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

test('Pentagon Space sentinels recognize the verified homepage and missing first-party careers routes', async () => {
  const pentagonSpace = await loadPentagonSpaceModule()

  assert.equal(pentagonSpace.SOURCE, 'pentagonspace')
  assert.equal(pentagonSpace.COMPANY, 'Pentagon Space')
  assert.equal(pentagonSpace.HOMEPAGE_URL, 'https://pentagonspace.in/')
  assert.deepEqual(pentagonSpace.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://pentagonspace.in/careers',
    'https://pentagonspace.in/careers/',
    'https://pentagonspace.in/career',
    'https://pentagonspace.in/career/',
    'https://pentagonspace.in/jobs',
    'https://pentagonspace.in/jobs/',
    'https://pentagonspace.in/job',
    'https://pentagonspace.in/job/',
    'https://pentagonspace.in/join-us',
    'https://pentagonspace.in/join-us/',
    'https://pentagonspace.in/openings',
    'https://pentagonspace.in/openings/',
    'https://pentagonspace.in/vacancies',
    'https://pentagonspace.in/vacancies/',
    'https://pentagonspace.in/hiring',
    'https://pentagonspace.in/hiring/',
    'https://pentagonspace.in/work-with-us',
    'https://pentagonspace.in/work-with-us/',
  ])
  assert.equal(pentagonSpace.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(pentagonSpace.hasPublicJobsSignal(officialHomepageHtml), false)
  assert.equal(
    pentagonSpace.hasPublicJobsSignal(
      officialHomepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
    ),
    true,
  )
  assert.equal(pentagonSpace.hasPublicJobsSignal(publicJobsHtml), true)
  assert.equal(pentagonSpace.isMissingCareerRoute({ status: 404 }), true)
  assert.equal(pentagonSpace.isMissingCareerRoute({ status: 200 }), false)
})

test('Pentagon Space returns no jobs only while the verified homepage and missing careers routes still hold', async () => {
  const pentagonSpace = await loadPentagonSpaceModule()
  const requestedUrls = []

  const jobs = await pentagonSpace.createPentagonSpaceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pentagonSpace.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: officialHomepageHtml,
        }
      }

      if (pentagonSpace.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          html: '',
        }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pentagonSpace.HOMEPAGE_URL,
    ...pentagonSpace.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Pentagon Space fails closed when the homepage changes, grows a public jobs signal, or a checked careers route resolves', async () => {
  const pentagonSpace = await loadPentagonSpaceModule()

  await assert.rejects(
    pentagonSpace.createPentagonSpaceScraper().run({
      fetchPage: async (url) => {
        if (url === pentagonSpace.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    pentagonSpace.createPentagonSpaceScraper().run({
      fetchPage: async (url) => {
        if (url === pentagonSpace.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: officialHomepageHtml.replace(
              '</nav>',
              '<a href="https://jobs.ashbyhq.com/pentagonspace">Careers</a></nav>',
            ),
          }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /homepage now exposes a public careers or jobs signal/i,
  )

  await assert.rejects(
    pentagonSpace.createPentagonSpaceScraper().run({
      fetchPage: async (url) => {
        if (url === pentagonSpace.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === pentagonSpace.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: '' }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
