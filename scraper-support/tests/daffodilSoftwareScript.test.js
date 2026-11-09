import assert from 'node:assert/strict'
import test from 'node:test'

const loadDaffodilModule = async () => {
  try {
    return await import('../../scraper/daffodilsoftware/script.js')
  } catch {
    assert.fail('Expected Daffodil Software scraper module at ../../scraper/daffodilsoftware/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Development Company | Daffodil Software</title>
  </head>
  <body>
    <section>
      <h2>Discover Daffodil</h2>
      <a href="https://www.daffodilsw.com/career">Career &amp; Culture</a>
      <p>Build your future with a team passionate about technology, innovation, and growth.</p>
    </section>
  </body>
</html>
`

const careerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Culture at Daffodil Software</title>
    <link rel="canonical" href="https://www.daffodilsw.com/career/" />
  </head>
  <body>
    <main>
      <h1>Careers &amp; Culture</h1>
      <p>We are on a mission to deliver innovation that transforms into unparalleled business growth.</p>
      <section>
        <h2>Open Vacancies</h2>
        <p>Lorem Ipsum is simply dummy text of the printing and typesetting industry.</p>
        <p>No career opportunities available at this time.</p>
        <p>Unable to retrieve career opportunities. Please try again later.</p>
        <h3>Can’t find your job here?</h3>
        <p>Submit your CV, we will contact you as soon as we have relevant openings</p>
        <select>
          <option>—Please choose an option—</option>
          <option>Sales</option>
          <option>Marketing</option>
          <option>Developer</option>
        </select>
        <label>Attach your CV</label>
      </section>
    </main>
  </body>
</html>
`

const publicJobsCareerHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Culture at Daffodil Software</title>
  </head>
  <body>
    <main>
      <h1>Careers &amp; Culture</h1>
      <section>
        <h2>Open Vacancies</h2>
        <article>
          <h3>Senior Backend Engineer</h3>
          <a href="/career/jobs/senior-backend-engineer">Apply now</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

test('Daffodil Software sentinel pins the verified official homepage, placeholder career page, and adjacent first-party routes', async () => {
  const daffodil = await loadDaffodilModule()

  assert.equal(daffodil.SOURCE, 'daffodilsoftware')
  assert.equal(daffodil.COMPANY, 'Daffodil Software')
  assert.equal(daffodil.VERIFIED_AT, '2026-07-14')
  assert.equal(daffodil.HOMEPAGE_URL, 'https://www.daffodilsw.com/')
  assert.equal(daffodil.CAREER_URL, 'https://www.daffodilsw.com/career/')
  assert.equal(daffodil.CAREERS_REDIRECT_URL, 'https://www.daffodilsw.com/careers/')
  assert.deepEqual(daffodil.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.daffodilsw.com/jobs/',
    'https://www.daffodilsw.com/join-us/',
    'https://www.daffodilsw.com/work-with-us/',
    'https://www.daffodilsw.com/open-vacancies/',
  ])

  assert.equal(daffodil.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(daffodil.hasOfficialCareerPageSignal(careerHtml), true)
  assert.equal(daffodil.hasPublicJobBoardSignal(careerHtml), false)
  assert.equal(daffodil.hasPublicJobBoardSignal(publicJobsCareerHtml), true)
  assert.equal(daffodil.isVerifiedMissingPublicJobRoute({ status: 404, html: '<html><body>Not Found</body></html>' }), true)
  assert.equal(daffodil.isVerifiedMissingPublicJobRoute({ status: 200, html: publicJobsCareerHtml }), false)
})

test('Daffodil Software sentinel returns [] only while the verified placeholder career surface remains unchanged', async () => {
  const daffodil = await loadDaffodilModule()
  const requestedUrls = []

  const jobs = await daffodil.createDaffodilSoftwareScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === daffodil.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === daffodil.CAREER_URL) {
        return { status: 200, url, html: careerHtml }
      }

      if (url === daffodil.CAREERS_REDIRECT_URL) {
        return { status: 200, url: daffodil.CAREER_URL, html: careerHtml }
      }

      if (daffodil.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '<html><body>Not Found</body></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    daffodil.HOMEPAGE_URL,
    daffodil.CAREER_URL,
    daffodil.CAREERS_REDIRECT_URL,
    ...daffodil.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Daffodil Software sentinel fails closed when the homepage, career page, redirect route, or common job routes drift into a public jobs surface', async () => {
  const daffodil = await loadDaffodilModule()

  await assert.rejects(
    daffodil.createDaffodilSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === daffodil.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Daffodil</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    daffodil.createDaffodilSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === daffodil.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === daffodil.CAREER_URL) {
          return { status: 200, url, html: publicJobsCareerHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified career page/i,
  )

  await assert.rejects(
    daffodil.createDaffodilSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === daffodil.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === daffodil.CAREER_URL) {
          return { status: 200, url, html: careerHtml }
        }

        if (url === daffodil.CAREERS_REDIRECT_URL) {
          return { status: 200, url, html: careerHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers redirect/i,
  )

  await assert.rejects(
    daffodil.createDaffodilSoftwareScraper().run({
      fetchPage: async (url) => {
        if (url === daffodil.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === daffodil.CAREER_URL) {
          return { status: 200, url, html: careerHtml }
        }

        if (url === daffodil.CAREERS_REDIRECT_URL) {
          return { status: 200, url: daffodil.CAREER_URL, html: careerHtml }
        }

        if (url === daffodil.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsCareerHtml }
        }

        if (daffodil.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '<html><body>Not Found</body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /common job route changed materially or now exposes public jobs/i,
  )
})
