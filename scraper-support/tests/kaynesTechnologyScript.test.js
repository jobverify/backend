import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaynes Technology</title>
  </head>
  <body>
    <header>
      <img src="/images/logo.png" alt="Kaynes Technology India Limited">
    </header>
    <main>
      <section>
        <h2>Beware of Recruitment Frauds</h2>
        <p>Beware of Recruitment Frauds falsely claiming to represent Kaynes Technology India Limited.</p>
      </section>
      <nav>
        <a href="/team.html">Leadership Team</a>
        <a href="/contacts.html">Contact</a>
      </nav>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
404 Not Found
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kaynes Technology</title>
  </head>
  <body>
    <section>
      <h2>Beware of Recruitment Frauds</h2>
      <p>Beware of Recruitment Frauds falsely claiming to represent Kaynes Technology India Limited.</p>
    </section>
    <h1>Open Positions</h1>
    <article>
      <h2>Production Engineer</h2>
      <a href="/careers/production-engineer">Apply Now</a>
    </article>
  </body>
</html>
`

const loadKaynesTechnologyModule = async () => {
  try {
    return await import('../../scraper/kaynestechnology/script.js')
  } catch {
    assert.fail('Expected Kaynes Technology scraper module at ../../scraper/kaynestechnology/script.js')
  }
}

test('Kaynes Technology sentinel constants stay pinned to the verified homepage and missing careers routes', async () => {
  const kaynesTechnology = await loadKaynesTechnologyModule()

  assert.equal(kaynesTechnology.SOURCE, 'kaynestechnology')
  assert.equal(kaynesTechnology.COMPANY, 'Kaynes Technology')
  assert.equal(kaynesTechnology.OFFICIAL_BRAND_NAME, 'Kaynes Technology India Limited')
  assert.equal(kaynesTechnology.HOMEPAGE_URL, 'https://www.kaynestechnology.co.in/index.html')
  assert.equal(kaynesTechnology.CAREERS_URL, 'https://www.kaynestechnology.co.in/index.html')
  assert.deepEqual(kaynesTechnology.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.kaynestechnology.co.in/careers.html',
    'https://www.kaynestechnology.co.in/careers',
    'https://www.kaynestechnology.co.in/jobs.html',
    'https://www.kaynestechnology.co.in/recruitment.html',
  ])
  assert.equal(kaynesTechnology.COMPANY_DOMAIN, 'kaynestechnology.co.in')
  assert.equal(kaynesTechnology.VERIFIED_ON, '2026-07-16')
  assert.equal(kaynesTechnology.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(kaynesTechnology.hasPublicJobSignals(homepageHtml), false)
  assert.equal(kaynesTechnology.hasPublicJobSignals(publicJobsHtml), true)
  assert.equal(
    kaynesTechnology.isVerifiedMissingJobRoute({
      status: 404,
      html: missingRouteHtml,
    }),
    true,
  )
})

test('Kaynes Technology returns [] only while the verified first-party homepage exposes no trustworthy public jobs surface', async () => {
  const kaynesTechnology = await loadKaynesTechnologyModule()
  const requestedUrls = []

  const jobs = await kaynesTechnology.createKaynesTechnologyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === kaynesTechnology.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (kaynesTechnology.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingRouteHtml }
      }

      throw new Error(`Unexpected Kaynes Technology URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kaynesTechnology.HOMEPAGE_URL,
    ...kaynesTechnology.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Kaynes Technology fails closed when the homepage or adjacent first-party routes drift into a public jobs surface', async () => {
  const kaynesTechnology = await loadKaynesTechnologyModule()

  await assert.rejects(
    kaynesTechnology.createKaynesTechnologyScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: kaynesTechnology.HOMEPAGE_URL,
        html: '<html><body><h1>Different company</h1></body></html>',
      }),
    }),
    /homepage/i,
  )

  await assert.rejects(
    kaynesTechnology.createKaynesTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === kaynesTechnology.HOMEPAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Kaynes Technology URL: ${url}`)
      },
    }),
    /homepage now exposes a public jobs surface/i,
  )

  await assert.rejects(
    kaynesTechnology.createKaynesTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === kaynesTechnology.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === kaynesTechnology.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (kaynesTechnology.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingRouteHtml }
        }

        throw new Error(`Unexpected Kaynes Technology URL: ${url}`)
      },
    }),
    /common careers route changed materially or now exposes public jobs/i,
  )
})
