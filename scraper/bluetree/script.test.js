import assert from 'node:assert/strict'
import test from 'node:test'

const loadBlueTreeModule = async () => {
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
    <title>BeeForce by BlueTree: Labour Management Software</title>
    <meta
      name="description"
      content="BeeForce by BlueTree is India’s leading labour management software, helping enterprise companies manage gig, piece-rate and contract labour."
    />
  </head>
  <body>
    <main>
      <h1>Beeforce by BlueTree</h1>
      <p>Your companion to Workforce & Labour Management</p>
      <p>Your companion to External Workforce & Labour Management</p>
      <p>One Platform to manage Contract Labour, Gig & Piece Rate Workforce with ease</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>BeeForce by BlueTree: Labour Management Software</title>
    <meta
      name="description"
      content="BeeForce by BlueTree is India’s Best Labour Management Software, helping enterprise companies manage gig, piece-rate and contract labour."
    />
  </head>
  <body>
    <main>
      <h1>Beeforce by BlueTree</h1>
      <p>Your companion to External Workforce & Labour Management</p>
      <p>One Platform to manage Contract Labour, Gig & Piece Rate Workforce with full compliance & labour laws tracking.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Know about BlueTree</title>
    <meta
      name="description"
      content="BlueTree has delivered workforce management solutions since 2010, powering the external workforce lifecycle with innovative technology."
    />
  </head>
  <body>
    <main>
      <h1>Empowering You For The Future Of Work</h1>
      <p>Driving innovation for sustainable business growth through state-of-the-art technology</p>
      <p>Platform Products</p>
      <p>Workforce Managed</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us for Queries - BlueTree Team </title>
    <meta
      name="description"
      content="Ready to transform your external workforce management? Our team is here to help you streamline onboarding, compliance, attendance & payouts."
    />
  </head>
  <body>
    <main>
      <h1>Let’s Simplify Workforce Operations Together</h1>
      <p>Built for Workforce Operations at Scale</p>
      <p>One Platform to Manage Onboarding, Attendance, Payouts, Compliance, and Offboarding</p>
    </main>
  </body>
</html>
`

const sitemapXml = `
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://www.getbluetree.com/</loc></url>
  <url><loc>https://www.getbluetree.com/about-us</loc></url>
  <url><loc>https://www.getbluetree.com/contact-sales</loc></url>
</urlset>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.getbluetree.com/careers',
  html: `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <title>Page Not Found | Framer</title>
      </head>
      <body></body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.getbluetree.com/careers',
  html: `
    <html>
      <head>
        <title>BlueTree Careers</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="https://jobs.lever.co/bluetree/software-engineer">Apply now</a>
      </body>
    </html>
  `,
}

test('Blue Tree sentinel recognizes the verified homepage, about page, contact page, sitemap, and missing careers routes', async () => {
  const blueTree = await loadBlueTreeModule()
  assert.ok(blueTree, 'Expected scraper module at ./script.js')

  assert.equal(blueTree.SOURCE, 'bluetree')
  assert.equal(blueTree.COMPANY, 'Blue Tree')
  assert.equal(blueTree.HOMEPAGE_URL, 'https://www.getbluetree.com/')
  assert.equal(blueTree.ABOUT_URL, 'https://www.getbluetree.com/about-us')
  assert.equal(blueTree.CONTACT_URL, 'https://www.getbluetree.com/contact-sales')
  assert.equal(blueTree.SITEMAP_URL, 'https://www.getbluetree.com/sitemap.xml')
  assert.deepEqual(blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.getbluetree.com/careers',
    'https://www.getbluetree.com/jobs',
    'https://www.getbluetree.com/join-us',
    'https://www.getbluetree.com/openings',
    'https://www.getbluetree.com/work-with-us',
    'https://www.getbluetree.com/careers-at-bluetree',
  ])
  assert.equal(blueTree.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(blueTree.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(blueTree.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(blueTree.hasOfficialContactSignal(contactHtml), true)
  assert.equal(blueTree.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(blueTree.sitemapHasCareerLikeUrl(sitemapXml), false)
  assert.equal(blueTree.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('Blue Tree sentinel returns no jobs only while the verified public surface exposes no careers board', async () => {
  const blueTree = await loadBlueTreeModule()
  assert.ok(blueTree, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await blueTree.createBlueTreeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === blueTree.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === blueTree.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === blueTree.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === blueTree.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    blueTree.HOMEPAGE_URL,
    blueTree.ABOUT_URL,
    blueTree.CONTACT_URL,
    blueTree.SITEMAP_URL,
    ...blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Blue Tree sentinel preserves the zero-public-careers contract when verified routes are temporarily timeout-blocked', async () => {
  const blueTree = await loadBlueTreeModule()
  assert.ok(blueTree, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await blueTree.createBlueTreeScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === blueTree.HOMEPAGE_URL) {
        throw new Error('fetch failed | Connect Timeout Error (attempted addresses: 31.43.161.6:443, timeout: 10000ms)')
      }
      if (url === blueTree.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === blueTree.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === blueTree.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
      if (blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    blueTree.HOMEPAGE_URL,
    blueTree.ABOUT_URL,
    blueTree.CONTACT_URL,
    blueTree.SITEMAP_URL,
    ...blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Blue Tree sentinel fails closed when the verified public surface drifts', async () => {
  const blueTree = await loadBlueTreeModule()
  assert.ok(blueTree, 'Expected scraper module at ./script.js')

  await assert.rejects(
    blueTree.createBlueTreeScraper().run({
      fetchPage: async (url) => {
        if (url === blueTree.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    blueTree.createBlueTreeScraper().run({
      fetchPage: async (url) => {
        if (url === blueTree.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === blueTree.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === blueTree.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === blueTree.SITEMAP_URL) {
          return {
            status: 200,
            url,
            html: sitemapXml.replace('</urlset>', '<url><loc>https://www.getbluetree.com/careers</loc></url></urlset>'),
          }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified sitemap/i,
  )

  await assert.rejects(
    blueTree.createBlueTreeScraper().run({
      fetchPage: async (url) => {
        if (url === blueTree.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === blueTree.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === blueTree.CONTACT_URL) return { status: 200, url, html: contactHtml }
        if (url === blueTree.SITEMAP_URL) return { status: 200, url, html: sitemapXml }
        if (url === blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (blueTree.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
