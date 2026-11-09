import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Simhatel scraper module at ./script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Simhatel - Pioneering Drone Technology &amp; AI Solutions</title>
      <meta property="og:site_name" content="Simhatel" />
    </head>
    <body>
      <header>
        <nav>
          <a href="/">Home</a>
          <a href="/products">Products</a>
          <a href="/services">Services</a>
          <a href="/labs">Innovation Labs</a>
          <a href="/resources">Resources</a>
          <a href="/news">News</a>
          <a href="/about">About</a>
          <a href="/contact">Contact</a>
        </nav>
      </header>
      <main>
        <h1>See it in action.</h1>
        <p>Firestriker Airdrop</p>
        <p>DenseSight</p>
        <p>Join leading enterprises deploying autonomous systems at scale.</p>
      </main>
      <footer>
        <p>Simhatel Technology Private Limited</p>
        <a href="mailto:support@simhatel.com">support@simhatel.com</a>
        <p>IIT Mandi, Himachal Pradesh, India</p>
      </footer>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Simhatel - Pioneering Drone Technology &amp; AI Solutions</title>
    </head>
    <body>
      <main>
        <h1>About Simhatel.</h1>
        <h2>Our Mission</h2>
        <p>To deliver production-ready autonomous solutions powered by AI, computer vision, and robotics.</p>
        <p>Dr. Amit Shukla</p>
        <p>Simhatel Technology Private Limited</p>
        <p>support@simhatel.com</p>
        <p>IIT Mandi, Himachal Pradesh, India</p>
      </main>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Simhatel - Pioneering Drone Technology &amp; AI Solutions</title>
    </head>
    <body>
      <main>
        <h1>Get in touch.</h1>
        <p>We&#x27;d love to hear from you. Reach out to discuss your project.</p>
        <p>support@simhatel.com</p>
        <p>+91 82269 48584</p>
        <p>IIT Mandi, Himachal Pradesh, India</p>
        <p>Simhatel Technology Private Limited</p>
      </main>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://www.simhatel.com</loc></url>
    <url><loc>https://www.simhatel.com/about</loc></url>
    <url><loc>https://www.simhatel.com/products</loc></url>
    <url><loc>https://www.simhatel.com/contact</loc></url>
    <url><loc>https://www.simhatel.com/products/firestriker-airdrop</loc></url>
    <url><loc>https://www.simhatel.com/products/densesight</loc></url>
  </urlset>
`

const robotsTxt = `
  User-Agent: *
  Allow: /

  Sitemap: https://www.simhatel.com/sitemap.xml
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.simhatel.com/careers',
  headers: {},
  html: `
    <!doctype html>
    <html lang="en">
      <head>
        <title>404: This page could not be found.</title>
      </head>
      <body>
        <main>
          <h1>404</h1>
          <h2>This page could not be found.</h2>
          <a href="/">Go back home</a>
        </main>
      </body>
    </html>
  `,
}

const careersAliasRedirectPage = {
  status: 308,
  url: 'https://www.simhatel.com/careers/',
  headers: {
    location: '/careers',
    refresh: '0;url=/careers',
  },
  html: 'Redirecting...',
}

const jobsAliasRedirectPage = {
  status: 308,
  url: 'https://www.simhatel.com/jobs/',
  headers: {
    location: '/jobs',
    refresh: '0;url=/jobs',
  },
  html: 'Redirecting...',
}

const careerAliasRedirectPage = {
  status: 308,
  url: 'https://www.simhatel.com/career/',
  headers: {
    location: '/career',
    refresh: '0;url=/career',
  },
  html: 'Redirecting...',
}

const joinUsAliasRedirectPage = {
  status: 308,
  url: 'https://www.simhatel.com/join-us/',
  headers: {
    location: '/join-us',
    refresh: '0;url=/join-us',
  },
  html: 'Redirecting...',
}

test('Simhatel sentinel validates the verified first-party no-public-careers surface', async () => {
  const simhatel = await loadModule()

  assert.equal(simhatel.SOURCE, 'simhatel')
  assert.equal(simhatel.COMPANY, 'Simhatel Technology Private Limited')
  assert.equal(simhatel.HOMEPAGE_URL, 'https://www.simhatel.com/')
  assert.equal(simhatel.ABOUT_URL, 'https://www.simhatel.com/about')
  assert.equal(simhatel.CONTACT_URL, 'https://www.simhatel.com/contact')
  assert.equal(simhatel.SITEMAP_URL, 'https://www.simhatel.com/sitemap.xml')
  assert.equal(simhatel.ROBOTS_URL, 'https://www.simhatel.com/robots.txt')
  assert.deepEqual(simhatel.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.simhatel.com/careers',
    'https://www.simhatel.com/career',
    'https://www.simhatel.com/jobs',
    'https://www.simhatel.com/join-us',
    'https://www.simhatel.com/hiring',
    'https://www.simhatel.com/openings',
  ])
  assert.deepEqual(simhatel.NO_PUBLIC_CAREERS_ALIAS_URLS, [
    'https://www.simhatel.com/careers/',
    'https://www.simhatel.com/career/',
    'https://www.simhatel.com/jobs/',
    'https://www.simhatel.com/join-us/',
  ])

  assert.equal(simhatel.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(simhatel.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(simhatel.hasOfficialContactSignal(contactHtml), true)
  assert.equal(simhatel.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(simhatel.hasOfficialRobotsSignal(robotsTxt), true)
  assert.equal(simhatel.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(simhatel.hasPublicJobsSignal(aboutHtml), false)
  assert.equal(simhatel.hasPublicJobsSignal(contactHtml), false)
  assert.equal(simhatel.hasFirstPartyCareerLikeLink(homepageHtml), false)
  assert.equal(simhatel.hasFirstPartyCareerLikeLink(aboutHtml), false)
  assert.equal(simhatel.hasFirstPartyCareerLikeLink(contactHtml), false)
  assert.equal(simhatel.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
  assert.equal(
    simhatel.isVerifiedMissingCareerAliasRedirect(careersAliasRedirectPage, 'https://www.simhatel.com/careers'),
    true,
  )
})

test('Simhatel sentinel returns no jobs only while the verified first-party surfaces stay unchanged', async () => {
  const simhatel = await loadModule()
  const requestedUrls = []

  const jobs = await simhatel.createSimhatelScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === simhatel.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
      if (url === simhatel.ABOUT_URL) return { status: 200, url, headers: {}, html: aboutHtml }
      if (url === simhatel.CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }
      if (url === simhatel.SITEMAP_URL) return { status: 200, url, headers: {}, html: sitemapXml }
      if (url === simhatel.ROBOTS_URL) return { status: 200, url, headers: {}, html: robotsTxt }
      if (url === 'https://www.simhatel.com/careers/') return careersAliasRedirectPage
      if (url === 'https://www.simhatel.com/career/') return careerAliasRedirectPage
      if (url === 'https://www.simhatel.com/jobs/') return jobsAliasRedirectPage
      if (url === 'https://www.simhatel.com/join-us/') return joinUsAliasRedirectPage
      if (simhatel.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    simhatel.HOMEPAGE_URL,
    simhatel.ABOUT_URL,
    simhatel.CONTACT_URL,
    simhatel.SITEMAP_URL,
    simhatel.ROBOTS_URL,
    ...simhatel.NO_PUBLIC_CAREERS_ALIAS_URLS,
    ...simhatel.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Simhatel exposes runner metadata for the verified no-public-careers provider', async () => {
  const simhatel = await loadModule()

  assert.deepEqual(simhatel.getRunnerMetadata(), {
    name: 'simhatel',
    dryRunFile: 'jobs.json',
    provider: {
      source: 'simhatel',
      companyName: 'Simhatel Technology Private Limited',
      companyCareerPage: 'https://www.simhatel.com/',
      alternateCareerPages: [
        'https://www.simhatel.com/careers',
        'https://www.simhatel.com/career',
        'https://www.simhatel.com/jobs',
        'https://www.simhatel.com/join-us',
        'https://www.simhatel.com/hiring',
        'https://www.simhatel.com/openings',
        'https://www.simhatel.com/careers/',
        'https://www.simhatel.com/career/',
        'https://www.simhatel.com/jobs/',
        'https://www.simhatel.com/join-us/',
      ],
      officialSurfaceUrls: [
        'https://www.simhatel.com/',
        'https://www.simhatel.com/about',
        'https://www.simhatel.com/contact',
        'https://www.simhatel.com/sitemap.xml',
        'https://www.simhatel.com/robots.txt',
      ],
      adapter: 'script',
      atsPlatform: 'official-company-site-no-public-careers',
      countryFilter: 'India',
      parser: 'custom-script',
      paginationStrategy: 'verified-first-party-site-and-no-public-careers-routes',
      extractionStrategy: 'verified-first-party-marketing-surface-and-missing-careers-routes-return-empty',
      normalizationProfile: 'engineering-default',
      companyDomain: 'www.simhatel.com',
    },
  })
})

test('Simhatel sentinel fails closed when a verified surface starts exposing careers content', async () => {
  const simhatel = await loadModule()

  await assert.rejects(
    simhatel.createSimhatelScraper().run({
      fetchPage: async (url) => {
        if (url === simhatel.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage now appears to expose a public jobs surface/i,
  )

  await assert.rejects(
    simhatel.createSimhatelScraper().run({
      fetchPage: async (url) => {
        if (url === simhatel.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
        if (url === simhatel.ABOUT_URL) return { status: 200, url, headers: {}, html: aboutHtml }
        if (url === simhatel.CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }
        if (url === simhatel.SITEMAP_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: sitemapXml.replace(
              '</urlset>',
              '<url><loc>https://www.simhatel.com/careers</loc></url></urlset>',
            ),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    simhatel.createSimhatelScraper().run({
      fetchPage: async (url) => {
        if (url === simhatel.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
        if (url === simhatel.ABOUT_URL) return { status: 200, url, headers: {}, html: aboutHtml }
        if (url === simhatel.CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }
        if (url === simhatel.SITEMAP_URL) return { status: 200, url, headers: {}, html: sitemapXml }
        if (url === simhatel.ROBOTS_URL) return { status: 200, url, headers: {}, html: robotsTxt }
        if (url === 'https://www.simhatel.com/careers/') return careersAliasRedirectPage
        if (url === 'https://www.simhatel.com/career/') return careerAliasRedirectPage
        if (url === 'https://www.simhatel.com/jobs/') return jobsAliasRedirectPage
        if (url === 'https://www.simhatel.com/join-us/') return joinUsAliasRedirectPage
        if (url === 'https://www.simhatel.com/careers') {
          return {
            status: 200,
            url,
            headers: {},
            html: `
              <html>
                <body>
                  <h1>Current Openings</h1>
                  <a href="/careers/founding-robotics-engineer">Apply now</a>
                </body>
              </html>
            `,
          }
        }
        if (simhatel.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no-public-careers route changed/i,
  )
})

test('Simhatel sentinel fails closed when a verified alias redirect drifts', async () => {
  const simhatel = await loadModule()

  await assert.rejects(
    simhatel.createSimhatelScraper().run({
      fetchPage: async (url) => {
        if (url === simhatel.HOMEPAGE_URL) return { status: 200, url, headers: {}, html: homepageHtml }
        if (url === simhatel.ABOUT_URL) return { status: 200, url, headers: {}, html: aboutHtml }
        if (url === simhatel.CONTACT_URL) return { status: 200, url, headers: {}, html: contactHtml }
        if (url === simhatel.SITEMAP_URL) return { status: 200, url, headers: {}, html: sitemapXml }
        if (url === simhatel.ROBOTS_URL) return { status: 200, url, headers: {}, html: robotsTxt }
        if (url === 'https://www.simhatel.com/careers/') {
          return {
            ...careersAliasRedirectPage,
            headers: {
              location: '/jobs',
              refresh: '0;url=/jobs',
            },
            html: 'Redirecting...',
          }
        }
        if (url === 'https://www.simhatel.com/career/') return careerAliasRedirectPage
        if (url === 'https://www.simhatel.com/jobs/') return jobsAliasRedirectPage
        if (url === 'https://www.simhatel.com/join-us/') return joinUsAliasRedirectPage
        if (simhatel.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /alias route changed/i,
  )
})
