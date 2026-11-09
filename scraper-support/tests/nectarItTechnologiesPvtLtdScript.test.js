import assert from 'node:assert/strict'
import test from 'node:test'

const loadNectarItModule = async () => {
  try {
    return await import('../../scraper/nectarittechnologiespvtltd/script.js')
  } catch {
    assert.fail('Expected NectarIt Technologies Pvt Ltd. scraper module at ../../scraper/nectarittechnologiespvtltd/script.js')
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Connect &amp; Analyze. Optimize Operations | NectarIT Technologies</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="/about">About</a>
      </nav>
      <h1>Connect &amp; Analyze</h1>
      <h2>A social world of Connected Assets</h2>
      <p>
        Leveraging IoT at its core, NectarIT enables any physical device to onboard to our
        platform with minimum time and effort.
      </p>
      <footer>
        <p>NectarIT Technologies Private Limited</p>
        <p>info@nectarit.com</p>
      </footer>
    </main>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Extracting Sweetness of Things | NectarIT Technologies</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="/about">About</a>
      </nav>
      <h1>Extracting Sweetness of Things</h1>
      <h2>Who We Are?</h2>
      <p>
        We are a pool of enthusiastic innovators, focused on leveraging technology to help
        enterprises minimize operational cost and achieve operational efficiency.
      </p>
      <section>
        <h2>Team nectar.</h2>
        <p>Join us? Let us Know</p>
        <a href="mailto:career@nectarit.com">career@nectarit.com</a>
      </section>
      <footer>
        <p>NectarIT Technologies Private Limited</p>
      </footer>
    </main>
  </body>
</html>
`

test('NectarIt Technologies Pvt Ltd. validates the verified homepage and about-page recruiting surface', async () => {
  const nectarIt = await loadNectarItModule()

  assert.equal(nectarIt.SOURCE, 'nectarittechnologiespvtltd')
  assert.equal(nectarIt.COMPANY, 'NectarIt Technologies Pvt Ltd.')
  assert.equal(nectarIt.HOMEPAGE_URL, 'https://www.nectarit.com/')
  assert.equal(nectarIt.CAREERS_URL, 'https://www.nectarit.com/about')
  assert.equal(nectarIt.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(nectarIt.hasOfficialCareersSignal(ABOUT_HTML), true)
  assert.deepEqual(nectarIt.extractSuspiciousPublicJobLinks(ABOUT_HTML), [])
})

test('NectarIt Technologies Pvt Ltd. returns no jobs while the verified recruiting surface stays email-only', async () => {
  const nectarIt = await loadNectarItModule()
  const requestedUrls = []

  const jobs = await nectarIt.createNectarItTechnologiesPvtLtdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === nectarIt.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: HOMEPAGE_HTML }
      }

      if (url === nectarIt.CAREERS_URL) {
        return { status: 200, url, headers: {}, html: ABOUT_HTML }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [nectarIt.HOMEPAGE_URL, nectarIt.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('NectarIt Technologies Pvt Ltd. fails closed when the homepage or recruiting surface drifts into public jobs', async () => {
  const nectarIt = await loadNectarItModule()

  await assert.rejects(
    nectarIt.createNectarItTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === nectarIt.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><title>Unexpected</title></html>' }
        }

        return { status: 200, url, headers: {}, html: ABOUT_HTML }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nectarIt.createNectarItTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === nectarIt.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: HOMEPAGE_HTML }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: ABOUT_HTML.replace(
            '</main>',
            '<a href="https://jobs.ashbyhq.com/nectarit/backend-engineer">Backend Engineer</a></main>',
          ),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )

  await assert.rejects(
    nectarIt.createNectarItTechnologiesPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === nectarIt.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: HOMEPAGE_HTML }
        }

        return {
          status: 200,
          url,
          headers: {},
          html: ABOUT_HTML.replace('</main>', '<a href="/jobs">View jobs</a></main>'),
        }
      },
    }),
    /public job links|public jobs surface/i,
  )
})
