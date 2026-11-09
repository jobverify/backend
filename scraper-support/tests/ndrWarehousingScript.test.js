import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NDR WAREHOUSING</title>
  </head>
  <body>
    <main>
      <p>
        We are one of India’s leading Warehousing companies, offering tailor-made solutions for all your
        Industrial space demands.
      </p>
      <a href="contact.html">contact</a>
      <a href="mailto:info@ndrwarehousing.com?subject=Hi%20NDR%2C%20Let&#39;s%20connect.">Email-us</a>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NDR WAREHOUSING</title>
  </head>
  <body>
    <main>
      <h1>Let&apos;s talk</h1>
      <label>Name</label>
      <label>Email Address</label>
      <label>Your company</label>
      <label>Enquiry type</label>
      <label>Region</label>
      <p>Thank you! Your submission has been received!</p>
    </main>
  </body>
</html>
`

const missingCareersRoutePage = {
  status: 404,
  url: 'https://www.ndrwarehousing.com/careers',
  html: `
    <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
    <html>
      <head>
        <title>404 Not Found</title>
      </head>
      <body>
        <h1>Not Found</h1>
        <p>The requested URL was not found on this server.</p>
      </body>
    </html>
  `,
}

const loadNdrModule = async () => {
  try {
    return await import('../../scraper/ndrwarehousing/script.js')
  } catch {
    assert.fail('Expected NDR Warehousing scraper module at ../../scraper/ndrwarehousing/script.js')
  }
}

test('NDR Warehousing sentinel pins the verified first-party no-public-careers surface', async () => {
  const ndr = await loadNdrModule()

  assert.equal(ndr.SOURCE, 'ndrwarehousing')
  assert.equal(ndr.COMPANY, 'NDR Warehousing')
  assert.equal(ndr.VERIFIED_ON, '2026-07-16')
  assert.equal(ndr.HOMEPAGE_URL, 'https://www.ndrwarehousing.com/')
  assert.equal(ndr.CONTACT_PAGE_URL, 'https://www.ndrwarehousing.com/contact.html')
  assert.deepEqual(ndr.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.ndrwarehousing.com/careers',
    'https://www.ndrwarehousing.com/career',
    'https://www.ndrwarehousing.com/jobs',
    'https://www.ndrwarehousing.com/join-us',
  ])
  assert.equal(ndr.hasVerifiedHomepageSignal(homepageHtml), true)
  assert.equal(ndr.hasVerifiedContactSignal(contactHtml), true)
  assert.equal(ndr.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(ndr.isVerifiedMissingCareerRoute(missingCareersRoutePage), true)
})

test('NDR Warehousing sentinel returns no jobs only while the verified first-party surfaces stay unchanged', async () => {
  const ndr = await loadNdrModule()
  const requestedUrls = []

  const jobs = await ndr.createNdrWarehousingScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ndr.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === ndr.CONTACT_PAGE_URL) return { status: 200, url, html: contactHtml }
      if (ndr.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareersRoutePage, url }

      throw new Error(`Unexpected NDR Warehousing URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ndr.HOMEPAGE_URL,
    ndr.CONTACT_PAGE_URL,
    ...ndr.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('NDR Warehousing sentinel fails closed when the verified no-public-careers contract drifts', async () => {
  const ndr = await loadNdrModule()

  await assert.rejects(
    ndr.createNdrWarehousingScraper().run({
      fetchPage: async (url) => {
        if (url === ndr.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Current Openings</h1><a href="/jobs/1">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected NDR Warehousing URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    ndr.createNdrWarehousingScraper().run({
      fetchPage: async (url) => {
        if (url === ndr.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === ndr.CONTACT_PAGE_URL) return { status: 200, url, html: contactHtml }
        if (url === ndr.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Open Positions</h1><a href="/jobs/1">Apply now</a></body></html>',
          }
        }

        return { ...missingCareersRoutePage, url }
      },
    }),
    /no-public-careers route/i,
  )
})
