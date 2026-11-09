import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Livguard Energy Storage Solutions for Inverters and Batteries</title>
  </head>
  <body>
    <main>
      <h1>Livguard</h1>
      <p>Energy storage solutions for homes and businesses.</p>
      <a href="/about-us">About Us</a>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Livguard | Powering Innovation in Energy Solutions</title>
  </head>
  <body>
    <main>
      <h1>About Livguard</h1>
      <p>Powering innovation in energy solutions.</p>
      <a href="/contact-us">Contact Us</a>
    </main>
  </body>
</html>
`

const missingCareersRoutePage = {
  status: 404,
  url: 'https://www.livguard.com/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head><title>404 | Livguard</title></head>
      <body>
        <h1>404</h1>
        <p>Livguard</p>
        <p>Page not found</p>
      </body>
    </html>
  `,
}

const loadLivguardModule = async () => {
  try {
    return await import('../../scraper/livguard/script.js')
  } catch {
    assert.fail('Expected Livguard scraper module at ../../scraper/livguard/script.js')
  }
}

test('Livguard sentinel pins the verified first-party no-public-careers surface', async () => {
  const livguard = await loadLivguardModule()

  assert.equal(livguard.SOURCE, 'livguard')
  assert.equal(livguard.COMPANY, 'Livguard')
  assert.equal(livguard.VERIFIED_ON, '2026-07-16')
  assert.equal(livguard.HOMEPAGE_URL, 'https://www.livguard.com/')
  assert.equal(livguard.ABOUT_URL, 'https://www.livguard.com/about-us')
  assert.deepEqual(livguard.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.livguard.com/careers',
    'https://www.livguard.com/career',
    'https://www.livguard.com/jobs',
    'https://www.livguard.com/join-us',
    'https://www.livguard.com/openings',
  ])
  assert.equal(livguard.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(livguard.hasVerifiedAboutSignal(aboutHtml), true)
  assert.equal(livguard.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(livguard.isVerifiedMissingCareerRoute(missingCareersRoutePage), true)
})

test('Livguard sentinel returns no jobs only while the verified first-party surfaces stay unchanged', async () => {
  const livguard = await loadLivguardModule()
  const requestedUrls = []

  const jobs = await livguard.createLivguardScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === livguard.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === livguard.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (livguard.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareersRoutePage, url }
      throw new Error(`Unexpected Livguard URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    livguard.HOMEPAGE_URL,
    livguard.ABOUT_URL,
    ...livguard.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Livguard sentinel fails closed when the verified no-public-careers contract drifts', async () => {
  const livguard = await loadLivguardModule()

  await assert.rejects(
    livguard.createLivguardScraper().run({
      fetchPage: async (url) => {
        if (url === livguard.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><a href="/careers/software-engineer">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected Livguard URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    livguard.createLivguardScraper().run({
      fetchPage: async (url) => {
        if (url === livguard.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === livguard.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === livguard.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current openings</h1><a href="/jobs/1">Apply now</a></body></html>',
          }
        }

        return { ...missingCareersRoutePage, url }
      },
    }),
    /no-public-careers route/i,
  )
})
