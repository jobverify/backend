import assert from 'node:assert/strict'
import test from 'node:test'

const createShellHtml = ({ bundleUrl, extraLinks = '' } = {}) => `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TruEstate</title>
  </head>
  <body>
    <a href="/trap/scraper-detected">data</a>
    <a href="mailto:bot-trap@truestate.in">contact</a>
    <div id="root"></div>
    ${extraLinks}
    <script type="module" src="${bundleUrl}"></script>
  </body>
</html>
`

const bundleUrl = 'https://truestate.in/assets/index-C6KEFWYU.js'
const homepageHtml = createShellHtml({ bundleUrl })
const careersHtml = createShellHtml({
  bundleUrl,
  extraLinks: '<link rel="canonical" href="https://truestate.in/careers" />',
})
const jobsHtml = createShellHtml({ bundleUrl })

const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://truestate.in/</loc></url>
  <url><loc>https://truestate.in/about</loc></url>
  <url><loc>https://truestate.in/careers</loc></url>
  <url><loc>https://truestate.in/contact</loc></url>
  <url><loc>https://truestate.in/privacy</loc></url>
</urlset>
`

const bundleJs = `
const routes = [
  { path: "/", Component: hN },
  { path: "careers", Component: x1e },
  { path: "contact", Component: S1e },
  { path: "*", Component: hN },
]
const nav = [{ label: "Home", to: "/" }, { label: "Services", to: "/services" }]
const footer = "Modernizing real estate intelligence with India's first unified property data platform."
const homepageHero = "Bangalore's only fair-price engine."
const demoCta = "Book a demo"
const enterpriseSection = "Tailored for Enterprises."
const careersHero = "Join the Mission"
const careersHeading = "Build the future of Real Estate Intelligence"
const careersSection = "Current Openings"
const noOpenRoles = "While we don't have any open roles right now, we're always looking for exceptional talent."
const dropResume = "Drop your Resume"
const resumeEmail = "mailto:akshay@truestate.in"
const contactEmail = "mailto:contact@truestate.in"
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('TruEstate sentinel pins the verified first-party shell, sitemap, and no-openings careers bundle contract', async () => {
  const truestate = await loadModule()
  assert.ok(truestate, 'Expected scraper module at ./script.js')

  assert.equal(truestate.SOURCE, 'truestate')
  assert.equal(truestate.COMPANY, 'TruEstate')
  assert.equal(truestate.HOMEPAGE_URL, 'https://truestate.in/')
  assert.equal(truestate.CAREERS_URL, 'https://truestate.in/careers')
  assert.equal(truestate.JOBS_URL, 'https://truestate.in/jobs')
  assert.equal(truestate.SITEMAP_URL, 'https://truestate.in/sitemap-static.xml')

  assert.equal(truestate.hasShellSignal(homepageHtml), true)
  assert.equal(truestate.hasShellSignal(careersHtml), true)
  assert.equal(truestate.extractBundleUrl(homepageHtml, truestate.HOMEPAGE_URL), bundleUrl)
  assert.equal(truestate.extractBundleUrl(careersHtml, truestate.CAREERS_URL), bundleUrl)
  assert.equal(truestate.hasHomepageBundleSignal(bundleJs), true)
  assert.equal(truestate.hasCareersBundleSignal(bundleJs), true)
  assert.equal(truestate.hasJobsFallbackSignal(bundleJs), true)
  assert.equal(truestate.hasVerifiedSitemapSignal(sitemapXml), true)
  assert.equal(truestate.hasPublicJobsSignal(bundleJs), false)
})

test('TruEstate sentinel returns no jobs only while the verified first-party careers surface remains in the no-openings state', async () => {
  const truestate = await loadModule()
  assert.ok(truestate, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await truestate.createTruEstateScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === truestate.HOMEPAGE_URL) return homepageHtml
      if (url === truestate.CAREERS_URL) return careersHtml
      if (url === truestate.JOBS_URL) return jobsHtml
      if (url === truestate.SITEMAP_URL) return sitemapXml
      if (url === bundleUrl) return bundleJs
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    truestate.HOMEPAGE_URL,
    truestate.CAREERS_URL,
    truestate.JOBS_URL,
    truestate.SITEMAP_URL,
    bundleUrl,
  ])
  assert.deepEqual(jobs, [])
})

test('TruEstate sentinel fails closed when the verified surface drifts into a public jobs board or route change', async () => {
  const truestate = await loadModule()
  assert.ok(truestate, 'Expected scraper module at ./script.js')

  await assert.rejects(
    truestate.createTruEstateScraper().run({
      fetchText: async (url) => {
        if (url === truestate.HOMEPAGE_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    truestate.createTruEstateScraper().run({
      fetchText: async (url) => {
        if (url === truestate.HOMEPAGE_URL) return homepageHtml
        if (url === truestate.CAREERS_URL) return careersHtml
        if (url === truestate.JOBS_URL) return jobsHtml
        if (url === truestate.SITEMAP_URL) return sitemapXml
        if (url === bundleUrl) {
          return bundleJs.replace(
            "While we don't have any open roles right now, we're always looking for exceptional talent.",
            'Browse all open roles and apply today.',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no-openings careers contract|public jobs/i,
  )

  await assert.rejects(
    truestate.createTruEstateScraper().run({
      fetchText: async (url) => {
        if (url === truestate.HOMEPAGE_URL) return homepageHtml
        if (url === truestate.CAREERS_URL) return careersHtml
        if (url === truestate.JOBS_URL) return jobsHtml
        if (url === truestate.SITEMAP_URL) {
          return sitemapXml.replace(
            '</urlset>',
            '<url><loc>https://truestate.in/jobs</loc></url></urlset>',
          )
        }
        if (url === bundleUrl) return bundleJs
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /sitemap|jobs fallback/i,
  )
})
