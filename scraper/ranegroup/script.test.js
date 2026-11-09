import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rane Group &#8211; Expanding Horizons</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/careers/">Careers</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Expanding Horizons in Automotive Excellence</h1>
      <p>Legacy Since 1929</p>
      <p>Leading Manufacturing Tech</p>
      <p>Life @ Rane</p>
      <p>Join Our Team</p>
    </main>
  </body>
</html>
`

const liveHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rane Group &#8211; Expanding Horizons</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="https://ranegroup.com/careers/life-rane/">Life @ Rane</a>
      <a href="https://ranegroup.com/careers/join-our-team/">Join Our Team</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <main>
      <h1>Expanding Horizons in Automotive Excellence</h1>
      <p>Legacy Since 1929</p>
      <p>Leading Manufacturing Tech</p>
      <p>Life @ Rane</p>
      <p>Join Our Team</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Rane Group</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Life @ Rane</p>
      <p>Join Our Team</p>
      <p>Group Companies</p>
      <p>Rane Group is a trusted manufacturer of safety and critical auto components, delivering innovative mobility solutions to customers worldwide.</p>
      <p>Rane (Madras) Limited</p>
      <p>Rane Steering Systems Private Limited</p>
      <a href="mailto:info@ranegroup.com">info@ranegroup.com</a>
      <a href="mailto:investorservices@ranegroup.com">investorservices@ranegroup.com</a>
    </main>
  </body>
</html>
`

const missingRoutePage = {
  status: 404,
  url: 'https://ranegroup.com/jobs',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found &#8211; Rane Group</title>
      </head>
      <body>
        <main>
          <h1>The page can't be found.</h1>
          <p>It looks like nothing was found at this location.</p>
          <p>Group Companies</p>
          <p>Rane Group is a trusted manufacturer of safety and critical auto components, delivering innovative mobility solutions to customers worldwide.</p>
        </main>
      </body>
    </html>
  `,
}

const liveMissingRoutePage = {
  status: 404,
  url: 'https://ranegroup.com/jobs',
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>Page not found &#8211; Rane Group</title>
      </head>
      <body>
        <main>
          <h1>Oops! That page can&rsquo;t be found.</h1>
          <p>It looks like nothing was found at this location.</p>
          <p>Group Companies</p>
          <p>Rane Group is a trusted manufacturer of safety and critical auto components, delivering innovative mobility solutions to customers worldwide.</p>
        </main>
      </body>
    </html>
  `,
}

const robotsTxt = `
User-agent: *
Disallow: /wp-admin/
Allow: /wp-admin/admin-ajax.php

User-agent: *
Disallow: /wp-content/uploads/wpo/wpo-plugins-tables-list.json
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Rane Group sentinel recognizes the verified homepage, careers page, robots, and missing-route shell', async () => {
  const rane = await loadModule()
  assert.ok(rane, 'Expected scraper module at ./script.js')

  assert.equal(rane.SOURCE, 'ranegroup')
  assert.equal(rane.COMPANY, 'Rane Group')
  assert.equal(rane.HOMEPAGE_URL, 'https://ranegroup.com/')
  assert.equal(rane.ROBOTS_URL, 'https://ranegroup.com/robots.txt')
  assert.deepEqual(rane.CAREERS_ROUTE_URLS, [
    'https://ranegroup.com/careers',
    'https://ranegroup.com/careers/',
    'https://ranegroup.com/career',
    'https://ranegroup.com/career/',
  ])
  assert.deepEqual(rane.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://ranegroup.com/jobs',
    'https://ranegroup.com/jobs/',
    'https://ranegroup.com/join-us',
    'https://ranegroup.com/join-us/',
    'https://ranegroup.com/openings',
    'https://ranegroup.com/openings/',
  ])

  assert.equal(rane.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(rane.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(rane.hasVerifiedCareersLink(liveHomepageHtml), true)
  assert.equal(rane.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(rane.hasOfficialRobotsSignal(robotsTxt), true)
  assert.equal(rane.hasPublicJobsSignal(careersHtml), false)
  assert.equal(
    rane.isVerifiedMissingRoute(missingRoutePage, 'https://ranegroup.com/jobs'),
    true,
  )
  assert.equal(
    rane.isVerifiedMissingRoute(liveMissingRoutePage, 'https://ranegroup.com/jobs'),
    true,
  )
})

test('Rane Group sentinel returns no jobs while the verified first-party careers and missing-route surfaces stay unchanged', async () => {
  const rane = await loadModule()
  assert.ok(rane, 'Expected scraper module at ./script.js')

  const requestedPages = []
  const requestedTexts = []

  const jobs = await rane.createRaneGroupScraper().run({
    fetchPage: async (url) => {
      requestedPages.push(url)

      if (url === rane.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (rane.CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 200, url: 'https://ranegroup.com/careers/', html: careersHtml }
      }

      if (rane.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { ...missingRoutePage, url }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === rane.ROBOTS_URL) {
        return robotsTxt
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedPages, [
    rane.HOMEPAGE_URL,
    ...rane.CAREERS_ROUTE_URLS,
    ...rane.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(requestedTexts, [rane.ROBOTS_URL])
  assert.deepEqual(jobs, [])
})

test('Rane Group sentinel fails closed when the verified surface drifts into public jobs or route changes', async () => {
  const rane = await loadModule()
  assert.ok(rane, 'Expected scraper module at ./script.js')

  await assert.rejects(
    rane.createRaneGroupScraper().run({
      fetchPage: async (url) => {
        if (url === rane.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => robotsTxt,
    }),
    /official homepage/i,
  )

  await assert.rejects(
    rane.createRaneGroupScraper().run({
      fetchPage: async (url) => {
        if (url === rane.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace('</main>', '<p>Current Openings</p></main>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => robotsTxt,
    }),
    /homepage now appears to expose public jobs/i,
  )

  await assert.rejects(
    rane.createRaneGroupScraper().run({
      fetchPage: async (url) => {
        if (url === rane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (rane.CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('</main>', '<p>Current Openings</p></main>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => robotsTxt,
    }),
    /careers page now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    rane.createRaneGroupScraper().run({
      fetchPage: async (url) => {
        if (url === rane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (rane.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 200, url: 'https://ranegroup.com/careers/', html: careersHtml }
        }

        if (url === rane.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Jobs</h1><p>Apply now</p></body></html>',
          }
        }

        if (rane.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) {
          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => robotsTxt,
    }),
    /missing first-party careers route changed or now exposes a public careers surface/i,
  )

  await assert.rejects(
    rane.createRaneGroupScraper().run({
      fetchPage: async (url) => {
        if (url === rane.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (rane.CAREERS_ROUTE_URLS.includes(url)) {
          return { status: 200, url: 'https://ranegroup.com/careers/', html: careersHtml }
        }

        if (rane.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return { ...missingRoutePage, url }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
      fetchText: async () => 'User-agent: *\nDisallow: /private/',
    }),
    /robots\.txt/i,
  )
})
