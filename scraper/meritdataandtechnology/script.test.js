import assert from 'node:assert/strict'
import test from 'node:test'

const loadMeritDataAndTechnologyModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Merit Data & Technology scraper module at ./script.js')
  }
}

const homepageHtml = `
  <html lang="en">
    <head>
      <title>Merit Data &amp; Technology | AI &amp; Data Solutions for Business Growth</title>
      <meta
        name="description"
        content="Discover how Merit Data &amp; Technology leverages over 20 years of expertise in AI, data collection, and digital transformation to help businesses innovate."
      />
    </head>
    <body>
      <nav>
        <a href="/tech">Tech &amp; AI</a>
        <a href="/data">Data</a>
        <a href="/our-team">Our Team</a>
        <a href="/our-work">Our Work</a>
        <a href="/contact-us">Get in touch</a>
      </nav>
      <main>
        <h1>Data &amp; AI is what we do.</h1>
        <p>The toughest challenges require expertise, not guesswork.</p>
      </main>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://meritdata-tech.com/</loc></url>
    <url><loc>https://meritdata-tech.com/our-team</loc></url>
    <url><loc>https://meritdata-tech.com/our-work</loc></url>
    <url><loc>https://meritdata-tech.com/contact-us</loc></url>
    <url><loc>https://meritdata-tech.com/resources-26</loc></url>
    <url><loc>https://meritdata-tech.com/draft-templates/careers</loc></url>
    <url><loc>https://meritdata-tech.com/resources-categories/life-at-merit</loc></url>
  </urlset>
`

const draftCareersHtml = `
  <html lang="en">
    <head>
      <title>Careers</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>Jobs &amp; Careers</h2>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
        <article>
          <h3>UI Designer</h3>
          <p>Department</p>
          <a href="#">Apply Now</a>
          <a href="#">Apply on Indeed</a>
        </article>
      </main>
    </body>
  </html>
`

test('Merit Data & Technology sentinel exports the verified first-party contract', async () => {
  const merit = await loadMeritDataAndTechnologyModule()

  assert.equal(merit.SOURCE, 'meritdataandtechnology')
  assert.equal(merit.COMPANY, 'Merit Data & Technology')
  assert.equal(merit.VERIFIED_ON, '2026-07-13')
  assert.equal(merit.HOMEPAGE_URL, 'https://meritdata-tech.com/')
  assert.equal(merit.SITEMAP_URL, 'https://meritdata-tech.com/sitemap.xml')
  assert.equal(
    merit.DRAFT_CAREERS_URL,
    'https://meritdata-tech.com/draft-templates/careers',
  )
  assert.deepEqual(merit.CHECKED_ABSENT_ROUTES, [
    'https://meritdata-tech.com/careers',
    'https://meritdata-tech.com/jobs',
    'https://meritdata-tech.com/career',
    'https://meritdata-tech.com/join-us',
    'https://meritdata-tech.com/work-with-us',
    'https://meritdata-tech.com/open-positions',
  ])
  assert.equal(
    merit.VERIFIED_SURFACE_SUMMARY,
    'The live first-party Webflow site existed on July 13, 2026, but it exposed no trustworthy public jobs surface: homepage navigation had no careers link, common careers routes returned 404, the sitemap listed only a placeholder draft careers template, and that draft page contained lorem-ipsum demo job content.',
  )
})

test('Merit Data & Technology helper predicates recognize the verified no-jobs surface', async () => {
  const merit = await loadMeritDataAndTechnologyModule()

  assert.equal(merit.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(merit.hasCareersNavigationLink(homepageHtml), false)
  assert.equal(merit.hasOnlyNonPublicCareerUrls(sitemapXml), true)
  assert.equal(merit.isVerifiedPlaceholderCareersPage(draftCareersHtml), true)
})

test('Merit Data & Technology sentinel returns [] while the verified no-public-jobs contract remains true', async () => {
  const merit = await loadMeritDataAndTechnologyModule()
  const seenUrls = []

  const jobs = await merit.createMeritDataAndTechnologyScraper().run({
    fetchPage: async (url) => {
      seenUrls.push(url)

      if (url === merit.HOMEPAGE_URL) {
        return { status: 200, text: homepageHtml }
      }

      if (url === merit.SITEMAP_URL) {
        return { status: 200, text: sitemapXml }
      }

      if (url === merit.DRAFT_CAREERS_URL) {
        return { status: 200, text: draftCareersHtml }
      }

      if (merit.CHECKED_ABSENT_ROUTES.includes(url)) {
        return { status: 404, text: '<html><title>404</title></html>' }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(seenUrls, [
    merit.HOMEPAGE_URL,
    merit.SITEMAP_URL,
    merit.DRAFT_CAREERS_URL,
    ...merit.CHECKED_ABSENT_ROUTES,
  ])
  assert.deepEqual(jobs, [])
})

test('Merit Data & Technology sentinel fails closed when the homepage starts linking to a public careers surface', async () => {
  const merit = await loadMeritDataAndTechnologyModule()
  const homepageWithCareersLink = `
    <html>
      <head><title>Merit Data &amp; Technology | AI &amp; Data Solutions for Business Growth</title></head>
      <body>
        <nav>
          <a href="/our-team">Our Team</a>
          <a href="/careers">Careers</a>
        </nav>
      </body>
    </html>
  `

  await assert.rejects(
    merit.createMeritDataAndTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === merit.HOMEPAGE_URL) {
          return { status: 200, text: homepageWithCareersLink }
        }

        if (url === merit.SITEMAP_URL) {
          return { status: 200, text: sitemapXml }
        }

        if (url === merit.DRAFT_CAREERS_URL) {
          return { status: 200, text: draftCareersHtml }
        }

        if (merit.CHECKED_ABSENT_ROUTES.includes(url)) {
          return { status: 404, text: '<html><title>404</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Merit Data & Technology homepage no longer matches the verified no-public-jobs surface/i,
  )
})

test('Merit Data & Technology sentinel fails closed when the sitemap grows a real careers URL', async () => {
  const merit = await loadMeritDataAndTechnologyModule()
  const sitemapWithRealCareersUrl = `
    <?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url><loc>https://meritdata-tech.com/careers</loc></url>
      <url><loc>https://meritdata-tech.com/draft-templates/careers</loc></url>
    </urlset>
  `

  await assert.rejects(
    merit.createMeritDataAndTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === merit.HOMEPAGE_URL) {
          return { status: 200, text: homepageHtml }
        }

        if (url === merit.SITEMAP_URL) {
          return { status: 200, text: sitemapWithRealCareersUrl }
        }

        if (url === merit.DRAFT_CAREERS_URL) {
          return { status: 200, text: draftCareersHtml }
        }

        if (merit.CHECKED_ABSENT_ROUTES.includes(url)) {
          return { status: 404, text: '<html><title>404</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Merit Data & Technology sitemap no longer matches the verified no-public-jobs surface/i,
  )
})

test('Merit Data & Technology sentinel fails closed when the draft careers page stops looking like placeholder demo content', async () => {
  const merit = await loadMeritDataAndTechnologyModule()
  const realCareersHtml = `
    <html>
      <head><title>Careers at Merit Data &amp; Technology</title></head>
      <body>
        <main>
          <h1>Open Roles</h1>
          <article>
            <h2>Senior Data Engineer</h2>
            <p>Bangalore, India</p>
            <a href="https://apply.example.com/senior-data-engineer">Apply</a>
          </article>
        </main>
      </body>
    </html>
  `

  await assert.rejects(
    merit.createMeritDataAndTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === merit.HOMEPAGE_URL) {
          return { status: 200, text: homepageHtml }
        }

        if (url === merit.SITEMAP_URL) {
          return { status: 200, text: sitemapXml }
        }

        if (url === merit.DRAFT_CAREERS_URL) {
          return { status: 200, text: realCareersHtml }
        }

        if (merit.CHECKED_ABSENT_ROUTES.includes(url)) {
          return { status: 404, text: '<html><title>404</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Merit Data & Technology draft careers page no longer matches the verified placeholder surface/i,
  )
})

test('Merit Data & Technology sentinel fails closed when a checked careers route stops returning 404', async () => {
  const merit = await loadMeritDataAndTechnologyModule()

  await assert.rejects(
    merit.createMeritDataAndTechnologyScraper().run({
      fetchPage: async (url) => {
        if (url === merit.HOMEPAGE_URL) {
          return { status: 200, text: homepageHtml }
        }

        if (url === merit.SITEMAP_URL) {
          return { status: 200, text: sitemapXml }
        }

        if (url === merit.DRAFT_CAREERS_URL) {
          return { status: 200, text: draftCareersHtml }
        }

        if (url === merit.CHECKED_ABSENT_ROUTES[0]) {
          return { status: 200, text: '<html><title>Careers at Merit</title></html>' }
        }

        if (merit.CHECKED_ABSENT_ROUTES.slice(1).includes(url)) {
          return { status: 404, text: '<html><title>404</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Merit Data & Technology checked route no longer returns the verified 404 status/i,
  )
})
