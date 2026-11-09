import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const customProvidersPath = path.join(currentDir, '..', '..', 'scraper-support', 'providers', 'customProviders.json')

const verifiedHomepageHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta charset="UTF-8" />
      <title>Merlinhawk Aerospace | Advanced Aerospace Solutions</title>
      <meta
        name="description"
        content="Merlin Hawk Aerospace delivers advanced aerospace, defense, avionics, and engineering solutions with precision, innovation, and reliability."
      />
      <link rel="canonical" href="https://merlinhawkaerospace.com" />
    </head>
    <body>
      <h1>Pioneer In Indigenous Defence Systems</h1>
      <p>
        Merlinhawk Aerospace boasts over 40 years of leadership in the aviation and defense
        industries. Headquartered in dynamic Bengaluru, we also have offices in New Delhi,
        Hyderabad, and Malaysia.
      </p>
      <section>
        <h2>Notable Clients</h2>
        <p>SIDM Champion Awards 2024 - Import Substitution</p>
      </section>
      <footer>
        <p>Sales: sales@merlinhawk.com</p>
        <p>Product Support: service@merlinhawk.com</p>
        <p>Careers: hr@merlinhawk.com</p>
      </footer>
    </body>
  </html>
`

const verifiedContactHtml = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta charset="UTF-8" />
      <title>Contact Merlinhawk Aerospace</title>
      <meta
        name="description"
        content="Get in touch with Merlinhawk Aerospace to discuss aerospace, defense, avionics, and engineering solutions."
      />
      <link rel="canonical" href="https://merlinhawkaerospace.com/contact" />
    </head>
    <body>
      <h1>Contact</h1>
      <section>
        <h2>Bengaluru</h2>
        <p>Merlinhawk Aerospace Pvt. Ltd.</p>
        <p># 49, Bommasandra Jigani Link Rd, KIADB Industrial Area, Bengaluru 560105</p>
      </section>
      <section>
        <h2>Merlinhawk Aerospace EMS Unit</h2>
        <p>82/A Ground Floor, 3rd Cross, Electronics City Phase 1, Bengaluru 560100</p>
      </section>
      <section>
        <h2>Hyderabad</h2>
        <p>Merlinhawk Aerospace Pvt. Ltd.</p>
        <p>#9-6, 2nd Floor, Surya Towers, HMT Nagar, Nacharam, Hyderabad 500076</p>
      </section>
      <section>
        <h2>New Delhi</h2>
        <p>Merlinhawk Aerospace Private Limited</p>
        <p>DSO 709, 7th floor, DLF Saket, South Court, New Delhi 110017</p>
      </section>
      <footer>
        <p>Sales: sales@merlinhawk.com</p>
        <p>Product Support: service@merlinhawk.com</p>
        <p>Careers: hr@merlinhawk.com</p>
      </footer>
    </body>
  </html>
`

const verifiedPageSitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc><![CDATA[https://merlinhawkaerospace.com]]></loc>
    </url>
    <url>
      <loc><![CDATA[https://merlinhawkaerospace.com/airborne-systems]]></loc>
    </url>
    <url>
      <loc><![CDATA[https://merlinhawkaerospace.com/ground-support]]></loc>
    </url>
    <url>
      <loc><![CDATA[https://merlinhawkaerospace.com/news-events]]></loc>
    </url>
    <url>
      <loc><![CDATA[https://merlinhawkaerospace.com/contact]]></loc>
    </url>
  </urlset>
`

const verified404Html = `
  <!DOCTYPE html>
  <html lang="en-US">
    <head>
      <meta charset="UTF-8" />
      <title>Page not found &#8211; Merlinhawkaerospace</title>
      <meta name="robots" content="noindex" />
    </head>
    <body class="error404">
      <nav>
        <a href="https://merlinhawkaerospace.com/airborne-systems">Airborne</a>
        <a href="https://merlinhawkaerospace.com/contact">Contact</a>
      </nav>
      <div class="no-content">
        404 - Not found
        <span>
          This page could not be found.
          Continue to the <a href="https://merlinhawkaerospace.com">Homepage</a>
        </span>
      </div>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Merlinhawk Aerospace scraper module at ./script.js')
  }
}

test('Merlinhawk Aerospace scraper constants stay pinned to the verified first-party homepage, contact page, sitemap, and missing careers routes', async () => {
  const merlinhawk = await loadModule()

  assert.equal(merlinhawk.SOURCE, 'merlinhawkaerospace')
  assert.equal(merlinhawk.COMPANY, 'Merlinhawk Aerospace')
  assert.equal(merlinhawk.HOMEPAGE_URL, 'https://merlinhawkaerospace.com/')
  assert.equal(merlinhawk.CONTACT_PAGE_URL, 'https://merlinhawkaerospace.com/contact')
  assert.equal(merlinhawk.PAGE_SITEMAP_URL, 'https://merlinhawkaerospace.com/page-sitemap.xml')
  assert.deepEqual(merlinhawk.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://merlinhawkaerospace.com/careers',
    'https://merlinhawkaerospace.com/careers/',
    'https://merlinhawkaerospace.com/career',
    'https://merlinhawkaerospace.com/career/',
    'https://merlinhawkaerospace.com/jobs',
    'https://merlinhawkaerospace.com/jobs/',
    'https://merlinhawkaerospace.com/join-us',
    'https://merlinhawkaerospace.com/join-us/',
  ])
  assert.equal(merlinhawk.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(merlinhawk.hasOfficialContactSignal(verifiedContactHtml), true)
  assert.equal(merlinhawk.sitemapHasCareerLikeUrl(verifiedPageSitemapXml), false)
  assert.equal(merlinhawk.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(merlinhawk.hasPublicJobsSignal(verifiedContactHtml), false)
  assert.equal(
    merlinhawk.isMissingCareerRoute({
      status: 404,
      url: merlinhawk.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: verified404Html,
    }),
    true,
  )
})

test('Merlinhawk Aerospace returns no jobs only while the verified homepage, contact page, sitemap, and missing careers routes remain unchanged', async () => {
  const merlinhawk = await loadModule()
  const requestedUrls = []

  const jobs = await merlinhawk.createMerlinhawkAerospaceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === merlinhawk.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === merlinhawk.CONTACT_PAGE_URL) {
        return { status: 200, url, html: verifiedContactHtml }
      }

      if (url === merlinhawk.PAGE_SITEMAP_URL) {
        return { status: 200, url, html: verifiedPageSitemapXml }
      }

      if (merlinhawk.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: verified404Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    merlinhawk.HOMEPAGE_URL,
    merlinhawk.CONTACT_PAGE_URL,
    merlinhawk.PAGE_SITEMAP_URL,
    ...merlinhawk.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Merlinhawk Aerospace homepage signal accepts the live awards copy punctuation variant', async () => {
  const merlinhawk = await loadModule()
  const liveLikeHomepageHtml = verifiedHomepageHtml.replace(
    'SIDM Champion Awards 2024 - Import Substitution',
    'SIDM Champion Awards 2024 â€“ Import Substitution',
  )

  assert.equal(merlinhawk.hasOfficialHomepageSignal(liveLikeHomepageHtml), true)
})

test('Merlinhawk Aerospace contact signal accepts the live address wording variants', async () => {
  const merlinhawk = await loadModule()
  const liveLikeContactHtml = verifiedContactHtml
    .replace(
      '82/A Ground Floor, 3rd Cross, Electronics City Phase 1, Bengaluru 560100',
      '82/A Ground Floor, 3rd Cross, Electronics City Phase 1, Electronic City, Bengaluru 560100',
    )
    .replace(
      'DSO 709, 7th floor, DLF Saket, South Court, New Delhi 110017',
      'DSO 709, 7th floor DLF Saket, South Court, Saket Disctrict Centre, New Delhi 110017',
    )

  assert.equal(merlinhawk.hasOfficialContactSignal(liveLikeContactHtml), true)
})

test('Merlinhawk Aerospace fails closed when the homepage, contact page, sitemap, or a checked careers route changes materially', async () => {
  const merlinhawk = await loadModule()

  await assert.rejects(
    merlinhawk.createMerlinhawkAerospaceScraper().run({
      fetchPage: async (url) => {
        if (url === merlinhawk.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === merlinhawk.CONTACT_PAGE_URL) {
          return { status: 200, url, html: verifiedContactHtml }
        }

        if (url === merlinhawk.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: verifiedPageSitemapXml }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    merlinhawk.createMerlinhawkAerospaceScraper().run({
      fetchPage: async (url) => {
        if (url === merlinhawk.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === merlinhawk.CONTACT_PAGE_URL) {
          return { status: 200, url, html: verifiedContactHtml }
        }

        if (url === merlinhawk.PAGE_SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: verifiedPageSitemapXml.replace(
              '</urlset>',
              '<url><loc>https://merlinhawkaerospace.com/careers</loc></url></urlset>',
            ),
          }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /verified page sitemap no longer matches the no-public-careers surface/i,
  )

  await assert.rejects(
    merlinhawk.createMerlinhawkAerospaceScraper().run({
      fetchPage: async (url) => {
        if (url === merlinhawk.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === merlinhawk.CONTACT_PAGE_URL) {
          return { status: 200, url, html: verifiedContactHtml }
        }

        if (url === merlinhawk.PAGE_SITEMAP_URL) {
          return { status: 200, url, html: verifiedPageSitemapXml }
        }

        if (url === merlinhawk.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current openings</body></html>' }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})

test('Merlinhawk Aerospace custom provider entry points at the one-company no-public-careers scraper lane', () => {
  const providers = JSON.parse(readFileSync(customProvidersPath, 'utf8'))
  const merlinhawkProvider = providers.find((provider) => provider.source === 'merlinhawkaerospace')

  assert.deepEqual(merlinhawkProvider, {
    source: 'merlinhawkaerospace',
    companyName: 'Merlinhawk Aerospace',
    adapter: 'script',
    modulePath: '../merlinhawkaerospace/script.js',
    companyCareerPage: 'https://merlinhawkaerospace.com/',
    atsPlatform: 'official-company-site-no-public-careers',
    countryFilter: 'India',
    paginationStrategy: 'homepage-plus-contact-page-plus-page-sitemap-plus-common-careers-route-validation',
    extractionStrategy: 'verified-homepage+verified-contact-page+verified-page-sitemap-without-careers+verified-missing-first-party-careers-routes-return-empty',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'merlinhawkaerospace.com',
  })
})

