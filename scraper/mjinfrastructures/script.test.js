import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>MJ Infrastructure</title>
    </head>
    <body>
      <!-- <a href="careers">Careers</a> -->
      <header>
        <a href="/">Home</a>
        <a href="/about-us">About Us</a>
      </header>
      <main>
        <h1>MJ Infrastructure</h1>
        <p>Completed Projects</p>
        <p>Ongoing Projects</p>
        <p>Upcoming Projects</p>
        <p>+91 96863 00400</p>
      </main>
    </body>
  </html>
`

const verifiedContactHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>MJ Infrastructure</title>
    </head>
    <body>
      <main>
        <h1>Contact</h1>
        <p>Corporate Office : Bangalore</p>
        <p>MJ INFRASTRUCTURE &amp; BUILDERS INDIA PVT. LTD.</p>
        <p>#27, MJ House, Manipal County club Road Singasandra , Bangalore - 560068 Karnataka, India</p>
        <p>Land Line : 080 40934338</p>
        <p>+91 96863 00400</p>
      </main>
    </body>
  </html>
`

const verified404Html = `
  <!doctype html>
  <html>
    <head><title>404 Page Not Found</title></head>
    <body>404 Page Not Found The page you requested was not found.</body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../mjinfrastructures/script.js')
  } catch {
    assert.fail('Expected M. J. Infrastructures scraper module at ../mjinfrastructures/script.js')
  }
}

test('M. J. Infrastructures scraper recognizes the verified homepage, contact surface, and missing-route pages', async () => {
  const mj = await loadModule()

  assert.equal(mj.SOURCE, 'mjinfrastructures')
  assert.equal(mj.COMPANY, 'M. J. Infrastructures')
  assert.equal(mj.HOMEPAGE_URL, 'https://mjinfrastructure.com/')
  assert.equal(mj.CONTACT_PAGE_URL, 'https://mjinfrastructure.com/contact')
  assert.deepEqual(mj.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://mjinfrastructure.com/careers',
    'https://mjinfrastructure.com/career',
    'https://mjinfrastructure.com/jobs',
    'https://mjinfrastructure.com/join-us',
  ])
  assert.equal(mj.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(mj.hasContactPageSignal(verifiedContactHtml), true)
  assert.equal(
    mj.isVerifiedMissingCareersRoute({
      status: 404,
      url: mj.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      html: verified404Html,
    }),
    true,
  )
})

test('run returns no jobs when M. J. Infrastructures only exposes the verified homepage, contact page, and missing career routes', async () => {
  const mj = await loadModule()
  const requestedUrls = []

  const jobs = await mj.createMjInfrastructuresScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === mj.HOMEPAGE_URL) {
        return { status: 200, url, html: verifiedHomepageHtml }
      }

      if (url === mj.CONTACT_PAGE_URL) {
        return { status: 200, url, html: verifiedContactHtml }
      }

      if (mj.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: verified404Html }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mj.HOMEPAGE_URL,
    mj.CONTACT_PAGE_URL,
    ...mj.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the M. J. Infrastructures homepage, contact surface, or missing-route contract changes', async () => {
  const mj = await loadModule()

  await assert.rejects(
    mj.createMjInfrastructuresScraper().run({
      fetchPage: async (url) => {
        if (url === mj.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return { status: 200, url, html: verifiedContactHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    mj.createMjInfrastructuresScraper().run({
      fetchPage: async (url) => {
        if (url === mj.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === mj.CONTACT_PAGE_URL) {
          return { status: 200, url, html: '<html><body><p>Broken contact</p></body></html>' }
        }

        return { status: 404, url, html: verified404Html }
      },
    }),
    /verified contact surface/i,
  )

  await assert.rejects(
    mj.createMjInfrastructuresScraper().run({
      fetchPage: async (url) => {
        if (url === mj.HOMEPAGE_URL) {
          return { status: 200, url, html: verifiedHomepageHtml }
        }

        if (url === mj.CONTACT_PAGE_URL) {
          return { status: 200, url, html: verifiedContactHtml }
        }

        return {
          status: url === mj.NO_PUBLIC_CAREERS_ROUTE_URLS[0] ? 200 : 404,
          url,
          html: verified404Html,
        }
      },
    }),
    /verified no-public-careers route changed/i,
  )
})
