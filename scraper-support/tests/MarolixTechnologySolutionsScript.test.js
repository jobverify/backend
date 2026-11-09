import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Marolix Technology Solutions Pvt Ltd</title>
  </head>
  <body>
    <nav>
      <a href="/about-us">About Us</a>
      <a href="/services">Services</a>
      <a href="/contact-us">Contact Us</a>
    </nav>
    <h1>Marolix Technology Solutions Pvt Ltd</h1>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us - Marolix</title>
  </head>
  <body>
    <h1>Contact Us</h1>
    <p>hrrecruiter@marolix.com</p>
    <p>+91-9154982071</p>
  </body>
</html>
`

const cloudflareTimeoutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>marolix.com | 522: Connection timed out</title>
  </head>
  <body>
    <h1>522: Connection timed out</h1>
    <p>marolix.com</p>
  </body>
</html>
`

const cloudflareOriginUnreachableHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>marolix.com | 523: Origin is unreachable</title>
  </head>
  <body>
    <h1>523: Origin is unreachable</h1>
    <p>marolix.com</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/marolixtechnologysolutions/script.js')
  } catch {
    assert.fail('Expected Marolix Technology Solutions scraper module at ../../scraper/marolixtechnologysolutions/script.js')
  }
}

test('Marolix Technology Solutions validates the verified no-public-careers homepage, contact page, and careers route', async () => {
  const marolix = await loadModule()

  assert.equal(marolix.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(marolix.hasPublicCareersLink(homepageHtml), false)
  assert.equal(marolix.hasOfficialContactSignal(contactHtml), true)
  assert.equal(marolix.hasCloudflareOriginOutageSignal(cloudflareTimeoutHtml), true)
  assert.equal(marolix.hasCloudflareOriginOutageSignal(cloudflareOriginUnreachableHtml), true)
  assert.equal(
    marolix.isExpectedMissingCareersRoute({
      status: 404,
      url: 'https://www.marolix.com/careers',
      html: '<html><body><h1>Not Found</h1></body></html>',
    }),
    true,
  )
  assert.equal(
    marolix.isExpectedCloudflareOriginOutageRoute({
      status: 522,
      url: 'https://www.marolix.com/',
      html: cloudflareTimeoutHtml,
    }),
    true,
  )
  assert.equal(
    marolix.isExpectedCloudflareOriginOutageRoute({
      status: 523,
      url: 'https://www.marolix.com/careers',
      html: cloudflareOriginUnreachableHtml,
    }),
    true,
  )
})

test('Marolix Technology Solutions run returns no jobs while the verified first-party no-public-careers surface remains unchanged', async () => {
  const marolix = await loadModule()
  const requestedUrls = []

  const jobs = await marolix.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === marolix.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml, headers: {} }
      }
      if (url === marolix.CONTACT_URL) {
        return { status: 200, url, html: contactHtml, headers: {} }
      }
      if (url === marolix.CAREERS_URL) {
        return { status: 404, url, html: '<html><body><h1>Not Found</h1></body></html>', headers: {} }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    marolix.HOMEPAGE_URL,
    marolix.CONTACT_URL,
    marolix.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Marolix Technology Solutions run returns no jobs while the first-party site is temporarily unavailable behind a verified Cloudflare 522 page', async () => {
  const marolix = await loadModule()
  const requestedUrls = []

  const jobs = await marolix.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 522, url, html: cloudflareTimeoutHtml, headers: {} }
    },
  })

  assert.deepEqual(requestedUrls, [
    marolix.HOMEPAGE_URL,
    marolix.CONTACT_URL,
    marolix.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Marolix Technology Solutions run returns no jobs while verified routes surface a branded Cloudflare 523 origin outage page', async () => {
  const marolix = await loadModule()
  const requestedUrls = []

  const jobs = await marolix.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return { status: 523, url, html: cloudflareOriginUnreachableHtml, headers: {} }
    },
  })

  assert.deepEqual(requestedUrls, [
    marolix.HOMEPAGE_URL,
    marolix.CONTACT_URL,
    marolix.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})
