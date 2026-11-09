import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en-GB">
    <head>
      <title>iPhone &amp; Android Spyware Detection | Certo Software</title>
    </head>
    <body>
      <h1>Your mobile privacy is our mission</h1>
      <p>Think your phone has been hacked? Our trusted apps make it easy for you to scan, detect and remove threats from your iPhone and Android devices.</p>
      <h2>At Certo, mobile security is not an afterthought, it&#8217;s what we do.</h2>
      <a href="/about/">About us</a>
      <a href="https://www.linkedin.com/company/certo-software/">LinkedIn</a>
      <p>Certo Software Limited | Registered in England &amp; Wales No. 10072356</p>
    </body>
  </html>
`

const currentHomepageHtml = `
  <!doctype html>
  <html lang="en-GB">
    <head>
      <title>iPhone &amp; Android Spyware Detection | Certo Software</title>
    </head>
    <body>
      <h1>Your mobile privacy is our mission</h1>
      <p>Think your phone has been hacked? Our trusted apps make it easy for you to scan, detect and remove threats from your iPhone and Android devices.</p>
      <h2>At Certo, mobile security is not an afterthought, it’s what we do.</h2>
      <a href="/about/">About us</a>
      <a href="https://www.linkedin.com/company/certo-software/">LinkedIn</a>
      <p>Copyright © 2026 Certo Software Limited | Registered in England &amp; Wales No. 10072356</p>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en-GB">
    <head>
      <title>About Certo | The iPhone &amp; Android Security Experts</title>
    </head>
    <body>
      <h1>We believe in a right to privacy</h1>
      <p>At Certo, we enable iOS and Android users to quickly and easily scan their device for spyware and security vulnerabilities.</p>
      <h2>Our story</h2>
      <p>August 2015</p>
      <p>Certo Software is born</p>
      <p>March 2026</p>
      <p>Certo wins Gold Cybersecurity Award</p>
      <p>Certo Software Limited | Registered in England &amp; Wales No. 10072356</p>
    </body>
  </html>
`

const sitemapXml = `
  <?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url><loc>https://www.certosoftware.com/</loc></url>
    <url><loc>https://www.certosoftware.com/about/</loc></url>
    <url><loc>https://www.certosoftware.com/insights/2025-mobile-security-roundup/</loc></url>
  </urlset>
`

const missingCareersPage = {
  status: 404,
  url: 'https://www.certosoftware.com/careers/',
  html: `
    <!doctype html>
    <html lang="en-GB">
      <head><title>Page not found &#8211; Certo Software</title></head>
      <body>
        <h1>Page not found</h1>
        <p>Sorry, but the page you are looking for doesn't exist.</p>
        <p>Certo Software</p>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/certo/script.js')
  } catch {
    assert.fail('Expected Certo scraper module at ../../scraper/certo/script.js')
  }
}

test('Certo sentinel pins the verified official first-party no-public-careers surface', async () => {
  const certo = await loadModule()

  assert.equal(certo.SOURCE, 'certo')
  assert.equal(certo.COMPANY, 'Certo')
  assert.equal(certo.HOMEPAGE_URL, 'https://www.certosoftware.com/')
  assert.equal(certo.ABOUT_URL, 'https://www.certosoftware.com/about/')
  assert.equal(certo.SITEMAP_URL, 'https://www.certosoftware.com/sitemap.xml')
  assert.deepEqual(certo.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.certosoftware.com/careers',
    'https://www.certosoftware.com/careers/',
    'https://www.certosoftware.com/jobs',
    'https://www.certosoftware.com/jobs/',
  ])
  assert.equal(certo.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(certo.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(certo.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(certo.hasOfficialSitemapSignal(sitemapXml), true)
  assert.equal(certo.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(certo.isVerifiedMissingCareerRoute(missingCareersPage), true)
})

test('Certo sentinel returns no jobs only while the verified first-party surface stays unchanged', async () => {
  const certo = await loadModule()
  const requestedUrls = []

  const jobs = await certo.createCertoScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === certo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === certo.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === certo.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (certo.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareersPage, url }
      throw new Error(`Unexpected Certo URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    certo.HOMEPAGE_URL,
    certo.ABOUT_URL,
    certo.SITEMAP_URL,
    ...certo.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Certo sentinel fails closed when the verified first-party surface starts exposing jobs or drifts', async () => {
  const certo = await loadModule()

  await assert.rejects(
    certo.createCertoScraper().run({
      fetchPage: async (url) => {
        if (url === certo.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><a href="/careers/security-researcher">Apply now</a></body></html>',
          }
        }
        throw new Error(`Unexpected Certo URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    certo.createCertoScraper().run({
      fetchPage: async (url) => {
        if (url === certo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === certo.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === certo.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: `${sitemapXml}<url><loc>https://www.certosoftware.com/careers/</loc></url>`,
          }
        }
        throw new Error(`Unexpected Certo URL: ${url}`)
      },
    }),
    /sitemap/i,
  )

  await assert.rejects(
    certo.createCertoScraper().run({
      fetchPage: async (url) => {
        if (url === certo.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === certo.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === certo.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (certo.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><p>Current openings</p><a href="https://jobs.lever.co/certo">Apply now</a></body></html>',
          }
        }
        throw new Error(`Unexpected Certo URL: ${url}`)
      },
    }),
    /route changed/i,
  )
})
