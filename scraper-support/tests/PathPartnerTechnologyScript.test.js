import assert from 'node:assert/strict'
import test from 'node:test'

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/pathpartnertechnology/script.js')
  } catch {
    assert.fail('Expected PathPartner Technology scraper module at ../../scraper/pathpartnertechnology/script.js')
  }
}

test('PathPartner Technology recognizes the verified no-public-careers surface', async () => {
  const pathpartner = await loadScriptModule()

  assert.equal(pathpartner.SOURCE, 'pathpartnertechnology')
  assert.equal(pathpartner.HOMEPAGE_URL, 'https://pathpartnertech.com/')
  assert.equal(pathpartner.ABOUT_URL, 'https://pathpartnertech.com/about/')
  assert.equal(pathpartner.PAGE_SITEMAP_URL, 'https://pathpartnertech.com/page-sitemap.xml')
  assert.equal(pathpartner.CAREERS_URL, 'https://pathpartnertech.com/career/')
  assert.equal(pathpartner.CAREERS_ALIAS_URL, 'https://pathpartnertech.com/careers/')
  assert.equal(pathpartner.JOBS_URL, 'https://pathpartnertech.com/jobs/')
  assert.equal(pathpartner.isTrustedUnavailableFailure(new Error('fetch failed | read ECONNRESET')), true)
  assert.equal(pathpartner.isTrustedUnavailableFailure(new Error('fetch failed | connect timeout')), true)
  assert.equal(
    pathpartner.hasOfficialHomepageSignal(`
      <title>Home - Pathpartnertech</title>
      <main>
        PathPartner Technology is now a part of KPIT Group
        Empowering Next-Generation Mobility Solutions
        About Us
      </main>
    `),
    true,
  )
  assert.equal(
    pathpartner.hasOfficialAboutPageSignal(`
      <title>About Us - Pathpartnertech</title>
      <main>
        About Us
        PathPartner provides its clients the advantage of top-of-the-line technologies.
        OUR MISSION
        Empowering the Future of Automotive Software
        Our Journey So Far
      </main>
    `),
    true,
  )
  assert.equal(
    pathpartner.hasExpectedPageSitemapSurface(`
      <urlset>
        <url><loc>https://pathpartnertech.com/</loc></url>
        <url><loc>https://pathpartnertech.com/about/</loc></url>
      </urlset>
    `),
    true,
  )
  assert.equal(
    pathpartner.isVerifiedMissingCareerRoute({
      status: 404,
      url: pathpartner.CAREERS_URL,
      html: '<title>Page not found - Pathpartnertech</title>',
    }, pathpartner.CAREERS_URL),
    true,
  )
})

test('PathPartner Technology returns [] only while the verified first-party surface exposes no public careers routes', async () => {
  const pathpartner = await loadScriptModule()
  const pages = new Map([
    [
      pathpartner.HOMEPAGE_URL,
      {
        status: 200,
        url: pathpartner.HOMEPAGE_URL,
        html: `
          <title>Home - Pathpartnertech</title>
          <main>
            PathPartner Technology is now a part of KPIT Group
            Empowering Next-Generation Mobility Solutions
            About Us
          </main>
        `,
      },
    ],
    [
      pathpartner.ABOUT_URL,
      {
        status: 200,
        url: pathpartner.ABOUT_URL,
        html: `
          <title>About Us - Pathpartnertech</title>
          <main>
            About Us
            PathPartner provides its clients the advantage of top-of-the-line technologies.
            OUR MISSION
            Empowering the Future of Automotive Software
            Our Journey So Far
          </main>
        `,
      },
    ],
    [
      pathpartner.PAGE_SITEMAP_URL,
      {
        status: 200,
        url: pathpartner.PAGE_SITEMAP_URL,
        html: `
          <urlset>
            <url><loc>https://pathpartnertech.com/</loc></url>
            <url><loc>https://pathpartnertech.com/about/</loc></url>
          </urlset>
        `,
      },
    ],
    [
      pathpartner.CAREERS_URL,
      {
        status: 404,
        url: pathpartner.CAREERS_URL,
        html: '<title>Page not found - Pathpartnertech</title>',
      },
    ],
    [
      pathpartner.CAREERS_ALIAS_URL,
      {
        status: 404,
        url: pathpartner.CAREERS_ALIAS_URL,
        html: '<title>Page not found - Pathpartnertech</title>',
      },
    ],
    [
      pathpartner.JOBS_URL,
      {
        status: 404,
        url: pathpartner.JOBS_URL,
        html: '<title>Page not found - Pathpartnertech</title>',
      },
    ],
  ])

  const jobs = await pathpartner.createPathPartnerTechnologyScraper().run({
    fetchPage: async (url) => {
      const page = pages.get(url)
      if (!page) {
        assert.fail(`Unexpected page fetch: ${url}`)
      }
      return page
    },
  })

  assert.deepEqual(jobs, [])
})

test('PathPartner Technology returns [] when the trusted first-party host is currently unavailable', async () => {
  const pathpartner = await loadScriptModule()
  const requestedUrls = []

  const jobs = await pathpartner.createPathPartnerTechnologyScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      throw new Error('fetch failed | read ECONNRESET')
    },
  })

  assert.deepEqual(requestedUrls, [pathpartner.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('PathPartner Technology fails closed when a checked first-party route starts exposing public job listings', async () => {
  const pathpartner = await loadScriptModule()
  const pages = new Map([
    [
      pathpartner.HOMEPAGE_URL,
      {
        status: 200,
        url: pathpartner.HOMEPAGE_URL,
        html: `
          <title>Home - Pathpartnertech</title>
          <main>
            PathPartner Technology is now a part of KPIT Group
            Empowering Next-Generation Mobility Solutions
            About Us
          </main>
        `,
      },
    ],
    [
      pathpartner.ABOUT_URL,
      {
        status: 200,
        url: pathpartner.ABOUT_URL,
        html: `
          <title>About Us - Pathpartnertech</title>
          <main>
            About Us
            PathPartner provides its clients the advantage of top-of-the-line technologies.
            OUR MISSION
            Empowering the Future of Automotive Software
            Our Journey So Far
          </main>
        `,
      },
    ],
    [
      pathpartner.PAGE_SITEMAP_URL,
      {
        status: 200,
        url: pathpartner.PAGE_SITEMAP_URL,
        html: `
          <urlset>
            <url><loc>https://pathpartnertech.com/</loc></url>
            <url><loc>https://pathpartnertech.com/about/</loc></url>
          </urlset>
        `,
      },
    ],
    [
      pathpartner.CAREERS_URL,
      {
        status: 404,
        url: pathpartner.CAREERS_URL,
        html: '<title>Page not found - Pathpartnertech</title>',
      },
    ],
    [
      pathpartner.CAREERS_ALIAS_URL,
      {
        status: 404,
        url: pathpartner.CAREERS_ALIAS_URL,
        html: '<title>Page not found - Pathpartnertech</title>',
      },
    ],
    [
      pathpartner.JOBS_URL,
      {
        status: 200,
        url: pathpartner.JOBS_URL,
        html: '<title>Jobs - Pathpartnertech</title><main>Current Openings Apply Now</main>',
      },
    ],
  ])

  await assert.rejects(
    pathpartner.createPathPartnerTechnologyScraper().run({
      fetchPage: async (url) => {
        const page = pages.get(url)
        if (!page) {
          assert.fail(`Unexpected page fetch: ${url}`)
        }
        return page
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
