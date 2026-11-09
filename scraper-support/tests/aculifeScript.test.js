import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <body>
      <nav><a href="https://www.aculife.co.in/resource/career.aspx">Careers</a></nav>
      <h1>Aculife Healthcare Private Limited</h1>
      <p>Health is Happiness</p>
      <p>We've supplied over 1.3 million IV bottles in just 2 days to Sri Lanka during a crisis.</p>
      <p>We supply 1 in every 6 IV fluids &amp; diluents in India</p>
      <p>Email: corporate@aculife.co.in, info@aculife.co.in</p>
    </body>
  </html>
`

const careerFormHtml = `
  <html>
    <body>
      <form method="post" action="Career.aspx"><input name="Position" type="text" />
      <h2>-Apply Here-</h2>
      <p>Apply via the form given below and meet us for face to face interview.</p>
      <label>First name</label>
      <label>Position you are applying for</label>
      <label>Upload Resume</label>
      <label>Years Of Experience</label>
      </form>
    </body>
  </html>
`

const notFoundHtml = `
  <html>
    <head><title>404 Not Found</title></head>
    <body><h1>Not Found</h1></body>
  </html>
`

const loadAculifeModule = async () => {
  try {
    return await import('../../scraper/aculife/script.js')
  } catch {
    assert.fail('Expected Aculife scraper module at ../../scraper/aculife/script.js')
  }
}

test('Aculife scraper constants stay pinned to the verified first-party apply form and historical route probes', async () => {
  const aculife = await loadAculifeModule()

  assert.equal(aculife.SOURCE, 'aculife')
  assert.equal(aculife.COMPANY, 'Aculife')
  assert.equal(aculife.HOMEPAGE_URL, 'https://www.aculife.co.in/resource/home.aspx')
  assert.equal(aculife.CAREER_PAGE_URL, 'https://www.aculife.co.in/resource/career.aspx')
  assert.deepEqual(aculife.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.aculife.co.in/careers',
    'https://www.aculife.co.in/career',
    'https://www.aculife.co.in/jobs',
    'https://www.aculife.co.in/openings',
    'https://www.aculife.co.in/current-openings',
    'https://www.aculife.co.in/join-us',
    'https://www.aculife.co.in/work-with-us',
  ])
  assert.equal(aculife.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aculife.hasOfficialCareerFormSignal(careerFormHtml), true)
  assert.equal(aculife.isMissingPublicJobRoute({ status: 404, url: aculife.NO_PUBLIC_JOB_ROUTE_URLS[0] }), true)
})

test('Aculife returns no jobs only while the verified first-party surface stays a general application form', async () => {
  const aculife = await loadAculifeModule()
  const requestedUrls = []

  const jobs = await aculife.createAculifeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aculife.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aculife.CAREER_PAGE_URL) {
        return { status: 200, url, html: careerFormHtml }
      }

      if (aculife.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aculife.HOMEPAGE_URL,
    aculife.CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Aculife fails closed when the homepage, apply form, or newly published jobs drift', async () => {
  const aculife = await loadAculifeModule()

  await assert.rejects(
    aculife.createAculifeScraper().run({
      fetchPage: async (url) => {
        if (url === aculife.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === aculife.CAREER_PAGE_URL) {
          return { status: 200, url, html: careerFormHtml }
        }

        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aculife.createAculifeScraper().run({
      fetchPage: async (url) => {
        if (url === aculife.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aculife.CAREER_PAGE_URL) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /verified first-party career form/i,
  )

  await assert.rejects(
    aculife.createAculifeScraper().run({
      fetchPage: async (url) => {
        if (url === aculife.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aculife.CAREER_PAGE_URL) {
          return { status: 200, url, html: careerFormHtml + '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>' }
        }

        if (url === aculife.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Open positions</body></html>' }
        }

        return { status: 404, url, html: notFoundHtml }
      },
    }),
    /public jobs|hiring handoff/i,
  )
})
