import assert from 'node:assert/strict'
import test from 'node:test'

const loadCreatEDModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>CreatED | Inspiring the Innovators of Tomorrow</title>
    <link rel="canonical" href="https://www.create-ed.in"/>
  </head>
  <body>
    <main>
      <h1>INSPIRING THE INNOVATORS OF TOMORROW</h1>
      <p>From curiosity to creation</p>
      <p>CreatED is an innovation hub empowering high school students to ideate, create, and build groundbreaking projects to solve the most pressing problems in the world, guided by our expert mentors from Harvard and leading institutes across India.</p>
      <a href="/schedule-a-consultation">Schedule A Consultation</a>
      <p>Contact Us: info@create-ed.in | +91 8655700705</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About | CreatED</title>
    <link rel="canonical" href="https://www.create-ed.in/about"/>
  </head>
  <body>
    <main>
      <h2>Aashna Saraf</h2>
      <p>Aashna is a visionary and entrepreneur in the field of educational technology, holding a Masters in Educational Technology from Harvard University and a B.A. from Pomona College.</p>
      <p>Aashna founded CreatEd with the vision of turning curiosity into creation. With a deep commitment to education and a love for project based learning, she has poured her expertise and passion into developing innovative programs that provide children with a world-class, research-backed educational experience.</p>
      <p>Founder &amp; CEO</p>
      <p>Contact Us: info@create-ed.in | +91 8655700705</p>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.create-ed.in/</loc></url>
  <url><loc>https://www.create-ed.in/about</loc></url>
  <url><loc>https://www.create-ed.in/schedule-a-consultation</loc></url>
  <url><loc>https://www.create-ed.in/featured-projects</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.create-ed.in/careers',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>404 Not Found</title>
      </head>
      <body>
        <h1>404</h1>
      </body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.create-ed.in/careers',
  html: `
    <html>
      <head>
        <title>Careers | CreatED</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="/careers/mentor">Apply Now</a>
      </body>
    </html>
  `,
}

test('CreatED sentinel recognizes the verified homepage, about page, sitemap, and missing careers routes', async () => {
  const createed = await loadCreatEDModule()
  assert.ok(createed, 'Expected scraper module at ./script.js')

  assert.equal(createed.SOURCE, 'createed')
  assert.equal(createed.COMPANY, 'CreatED')
  assert.equal(createed.HOMEPAGE_URL, 'https://www.create-ed.in/')
  assert.equal(createed.ABOUT_URL, 'https://www.create-ed.in/about')
  assert.equal(createed.SITEMAP_URL, 'https://www.create-ed.in/pages-sitemap.xml')
  assert.deepEqual(createed.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.create-ed.in/careers',
    'https://www.create-ed.in/career',
    'https://www.create-ed.in/jobs',
    'https://www.create-ed.in/join-us',
  ])
  assert.equal(createed.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(createed.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(createed.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(createed.sitemapHasExpectedCorePages(sitemapXml), true)
  assert.equal(createed.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(createed.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('CreatED sentinel returns no jobs only while the verified first-party surface exposes no careers board', async () => {
  const createed = await loadCreatEDModule()
  assert.ok(createed, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await createed.createCreatEDScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === createed.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === createed.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === createed.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (createed.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    createed.HOMEPAGE_URL,
    createed.ABOUT_URL,
    createed.SITEMAP_URL,
    ...createed.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('CreatED default page fetches are bounded with abort signals', async () => {
  const createed = await loadCreatEDModule()
  assert.ok(createed, 'Expected scraper module at ./script.js')

  const originalFetch = globalThis.fetch
  const requests = []
  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === createed.HOMEPAGE_URL) return { status: 200, url, text: async () => homepageHtml }
    if (url === createed.ABOUT_URL) return { status: 200, url, text: async () => aboutHtml }
    if (url === createed.SITEMAP_URL) return { status: 200, url, text: async () => sitemapXml }
    if (createed.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
      return { status: 404, url, text: async () => missingCareerRoutePage.html }
    }

    assert.fail(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await createed.createCreatEDScraper().run()

    assert.deepEqual(jobs, [])
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('CreatED sentinel fails closed when the verified first-party surface drifts into a jobs signal', async () => {
  const createed = await loadCreatEDModule()
  assert.ok(createed, 'Expected scraper module at ./script.js')

  await assert.rejects(
    createed.createCreatEDScraper().run({
      fetchPage: async (url) => {
        if (url === createed.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    createed.createCreatEDScraper().run({
      fetchPage: async (url) => {
        if (url === createed.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === createed.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === createed.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://www.create-ed.in/careers</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    createed.createCreatEDScraper().run({
      fetchPage: async (url) => {
        if (url === createed.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === createed.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === createed.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === createed.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (createed.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
