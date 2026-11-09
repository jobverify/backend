import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Injectable Manufacturer & Supplier | CDMO Company | Gland Pharma Limited</title>
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Gland Pharma Limited",
        "alternateName": "Gland Pharma",
        "url": "https://glandpharma.com",
        "logo": "https://glandpharma.com/images/logo.png"
      }
    </script>
    <img src="https://glandpharma.com/images/header_logo.webp" alt="Gland Pharma logo">
  </body>
</html>
`

const careerShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gland Pharma</title>
  </head>
  <body>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "Gland Pharma Limited",
        "alternateName": "Gland Pharma",
        "url": "https://glandpharma.com",
        "logo": "https://glandpharma.com/images/logo.png"
      }
    </script>
    <img src="https://glandpharma.com/images/header_logo.webp" alt="Gland Pharma logo">
    <footer>
      <a href="mailto:gland@glandpharma.com">gland@glandpharma.com</a>
    </footer>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gland Pharma</title>
  </head>
  <body>
    <a href="/apply/process-chemist">Apply Now</a>
    <script type="application/ld+json">
      { "@context": "https://schema.org", "@type": "JobPosting", "title": "Process Chemist" }
    </script>
  </body>
</html>
`

const loadGlandPharmaModule = async () => {
  try {
    return await import('../../scraper/glandpharma/script.js')
  } catch {
    assert.fail('Expected Gland Pharma scraper module at ../../scraper/glandpharma/script.js')
  }
}

test('Gland Pharma sentinel constants stay pinned to the verified homepage and empty-board careers shell routes', async () => {
  const glandPharma = await loadGlandPharmaModule()

  assert.equal(glandPharma.SOURCE, 'glandpharma')
  assert.equal(glandPharma.COMPANY, 'Gland Pharma')
  assert.equal(glandPharma.OFFICIAL_BRAND_NAME, 'Gland Pharma Limited')
  assert.equal(glandPharma.HOMEPAGE_URL, 'https://glandpharma.com/')
  assert.equal(glandPharma.CAREERS_URL, 'https://glandpharma.com/careers')
  assert.deepEqual(glandPharma.ADJACENT_CAREERS_ROUTE_URLS, [
    'https://glandpharma.com/career',
    'https://glandpharma.com/jobs',
  ])
  assert.equal(glandPharma.COMPANY_DOMAIN, 'glandpharma.com')
  assert.equal(glandPharma.VERIFIED_ON, '2026-07-16')
  assert.equal(glandPharma.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(glandPharma.hasVerifiedCareerShellSignal(careerShellHtml), true)
  assert.equal(glandPharma.hasPublicJobSignals(careerShellHtml), false)
  assert.equal(glandPharma.hasPublicJobSignals(publicJobsHtml), true)
})

test('Gland Pharma returns [] only while the verified careers routes remain non-listing shells', async () => {
  const glandPharma = await loadGlandPharmaModule()
  const requestedUrls = []

  const jobs = await glandPharma.createGlandPharmaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === glandPharma.HOMEPAGE_URL) return homepageHtml
      if (url === glandPharma.CAREERS_URL) return careerShellHtml
      if (glandPharma.ADJACENT_CAREERS_ROUTE_URLS.includes(url)) return careerShellHtml
      throw new Error(`Unexpected Gland Pharma URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    glandPharma.HOMEPAGE_URL,
    glandPharma.CAREERS_URL,
    ...glandPharma.ADJACENT_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Gland Pharma fails closed when the homepage or a careers route drifts into a public jobs surface', async () => {
  const glandPharma = await loadGlandPharmaModule()

  await assert.rejects(
    glandPharma.createGlandPharmaScraper().run({
      fetchText: async (url) => {
        if (url === glandPharma.HOMEPAGE_URL) {
          return homepageHtml.replace('Gland Pharma Limited', 'Different Company')
        }
        throw new Error(`Unexpected Gland Pharma URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    glandPharma.createGlandPharmaScraper().run({
      fetchText: async (url) => {
        if (url === glandPharma.HOMEPAGE_URL) return homepageHtml
        if (url === glandPharma.CAREERS_URL) return publicJobsHtml
        if (glandPharma.ADJACENT_CAREERS_ROUTE_URLS.includes(url)) return careerShellHtml
        throw new Error(`Unexpected Gland Pharma URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    glandPharma.createGlandPharmaScraper().run({
      fetchText: async (url) => {
        if (url === glandPharma.HOMEPAGE_URL) return homepageHtml
        if (url === glandPharma.CAREERS_URL) return careerShellHtml
        if (url === glandPharma.ADJACENT_CAREERS_ROUTE_URLS[0]) return publicJobsHtml
        if (url === glandPharma.ADJACENT_CAREERS_ROUTE_URLS[1]) return careerShellHtml
        throw new Error(`Unexpected Gland Pharma URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )
})
