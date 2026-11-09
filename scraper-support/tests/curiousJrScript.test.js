import assert from 'node:assert/strict'
import test from 'node:test'

const loadCuriousJrModule = async () => {
  try {
    return await import('../../scraper/curiousjr/script.js')
  } catch {
    assert.fail('Expected CuriousJr scraper module at ../../scraper/curiousjr/script.js')
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Mute</title>
    </head>
    <body>
      <nav>After-School Learn English Learn Maths Activity Kits Talent Search</nav>
      <h1>Learning made fun for Curious Minds!</h1>
      <p>Trusted by Olympiad Rankers</p>
      <a href="https://www.pw.live/about-us">About Us</a>
      <footer>Copyright © 2025 Learning Platform Ltd. All rights reserved.</footer>
    </body>
  </html>
`

const currentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Mute</title>
    </head>
    <body>
      <nav>After-School Learn English Learn Maths Activity Kits Talent Search</nav>
      <h1>Learning made fun for Curious Minds!</h1>
      <p>Trusted by Olympiad Rankers</p>
      <a href="https://www.pw.live/about-us">About Us</a>
      <footer>Copyright © 2025 Learning Platform Ltd. All rights reserved.</footer>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>CuriousJr | Online Tuition Classes for 1st to 10th Kids</title>
    </head>
    <body>
      <h1>Contact Us</h1>
      <p>Welcome to CuriousJr powered by our learning platform!</p>
      <p>cjr_support@pw.live</p>
      <p>8448828113</p>
    </body>
  </html>
`

const parentAboutHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>About Us - Learning Platform</title>
    </head>
    <body>
      <nav>
        <a href="https://www.curiousjr.com">CuriousJr (3rd - 8th)</a>
      </nav>
      <h1>ABOUT PW</h1>
      <p>Want to check out the Exciting world of PW?</p>
    </body>
  </html>
`

const buildRoute404Html = (pathname) => `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404</title>
      <meta name="x-pathname" content="${pathname}" />
    </head>
    <body>
      <h1>404</h1>
      <p>Not Found</p>
    </body>
  </html>
`

test('CuriousJr sentinel pins the verified brand surfaces, parent-company careers handoff, and common route probes', async () => {
  const curiousJr = await loadCuriousJrModule()

  assert.equal(curiousJr.SOURCE, 'curiousjr')
  assert.equal(curiousJr.COMPANY, 'CuriousJr')
  assert.equal(curiousJr.BRAND_HOME_URL, 'https://www.curiousjr.com/')
  assert.equal(curiousJr.CONTACT_URL, 'https://www.curiousjr.com/contact-us')
  assert.equal(curiousJr.PARENT_ABOUT_URL, 'https://www.pw.live/about-us')
  assert.equal(curiousJr.PARENT_CAREERS_HANDOFF_URL, 'https://pwhr.darwinbox.in/ms/candidate/careers')
  assert.deepEqual(curiousJr.COMMON_CAREER_ROUTE_PROBES, [
    {
      url: 'https://www.curiousjr.com/careers',
      expectedStatus: 404,
    },
    {
      url: 'https://www.curiousjr.com/career',
      expectedStatus: 404,
    },
    {
      url: 'https://www.curiousjr.com/jobs',
      expectedStatus: 404,
    },
  ])
  assert.equal(curiousJr.hasCuriousJrHomeSignal(homepageHtml), true)
  assert.equal(curiousJr.hasCuriousJrHomeSignal(currentHomepageHtml), true)
  assert.equal(curiousJr.hasCuriousJrContactSignal(contactHtml), true)
  assert.equal(curiousJr.hasParentCompanyBridgeSignal(parentAboutHtml), true)
  assert.equal(
    curiousJr.extractParentCareersHandoffUrl(parentAboutHtml),
    null,
  )
  assert.equal(curiousJr.hasUnexpectedPublicJobsSignal(homepageHtml), false)
  assert.equal(
    curiousJr.hasUnexpectedPublicJobsSignal('<a href="https://pwhr.darwinbox.in/ms/candidate/careers">Careers</a>'),
    true,
  )
})

test('CuriousJr run returns [] only while the verified brand surfaces and missing-route probes stay unchanged', async () => {
  const curiousJr = await loadCuriousJrModule()
  const requestedUrls = []
  const pageByUrl = new Map([
    [
      curiousJr.BRAND_HOME_URL,
      { status: 200, url: curiousJr.BRAND_HOME_URL, html: homepageHtml },
    ],
    [
      curiousJr.CONTACT_URL,
      { status: 200, url: curiousJr.CONTACT_URL, html: contactHtml },
    ],
    [
      curiousJr.PARENT_ABOUT_URL,
      { status: 200, url: curiousJr.PARENT_ABOUT_URL, html: parentAboutHtml },
    ],
    ...curiousJr.COMMON_CAREER_ROUTE_PROBES.map(({ url }) => [
      url,
      { status: 404, url, html: buildRoute404Html(new URL(url).pathname) },
    ]),
  ])

  const jobs = await curiousJr.createCuriousJrScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      const page = pageByUrl.get(url)
      if (!page) {
        throw new Error(`Unexpected URL: ${url}`)
      }

      return page
    },
  })

  assert.deepEqual(requestedUrls, [
    curiousJr.BRAND_HOME_URL,
    curiousJr.CONTACT_URL,
    curiousJr.PARENT_ABOUT_URL,
    ...curiousJr.COMMON_CAREER_ROUTE_PROBES.map(({ url }) => url),
  ])
  assert.deepEqual(jobs, [])
})

test('CuriousJr run fails closed when the brand surface or a common careers route starts exposing a public jobs surface', async () => {
  const curiousJr = await loadCuriousJrModule()

  await assert.rejects(
    curiousJr.createCuriousJrScraper().run({
      fetchPage: async (url) => {
        if (url === curiousJr.BRAND_HOME_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><a href="https://pwhr.darwinbox.in/ms/candidate/careers">Careers</a></body></html>',
          }
        }

        if (url === curiousJr.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === curiousJr.PARENT_ABOUT_URL) {
          return { status: 200, url, html: parentAboutHtml }
        }

        return { status: 404, url, html: buildRoute404Html(new URL(url).pathname) }
      },
    }),
    /verified curiousjr homepage no longer matches the known first-party surface/i,
  )

  await assert.rejects(
    curiousJr.createCuriousJrScraper().run({
      fetchPage: async (url) => {
        if (url === curiousJr.BRAND_HOME_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === curiousJr.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === curiousJr.PARENT_ABOUT_URL) {
          return { status: 200, url, html: parentAboutHtml }
        }

        if (url === curiousJr.COMMON_CAREER_ROUTE_PROBES[0].url) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Careers</h1><a href="/job/math-teacher">Apply now</a></body></html>',
          }
        }

        return { status: 404, url, html: buildRoute404Html(new URL(url).pathname) }
      },
    }),
    /common curiousjr career route changed/i,
  )
})

const clientContactShell = '<title>CuriousJr | Online Tuition Classes for 1st to 10th Kids</title><script src="/_next/static/chunks/pages/contact-us-16667945d63681e2.js"></script><script id="__NEXT_DATA__" type="application/json">{"page":"/contact-us","nextExport":true,"isFallback":false}</script>'
const contactBundle = '(window.__NEXT_P=window.__NEXT_P||[]).push(["/contact-us",function(){return n(78267)}]); Welcome to CuriousJr powered by Physicswallah! cjr_support@pw.live 8448828113'
const runClientContactFixture = async (bundle = contactBundle, shell = clientContactShell) => {
  const source = await loadCuriousJrModule()
  return source.createCuriousJrScraper().run({ fetchPage: async url => {
    if (url === source.BRAND_HOME_URL) return { status: 200, url, html: homepageHtml }
    if (url === source.CONTACT_URL) return { status: 200, url, html: shell }
    if (url === source.PARENT_ABOUT_URL) return { status: 200, url, html: parentAboutHtml }
    if (url === 'https://www.curiousjr.com/_next/static/chunks/pages/contact-us-16667945d63681e2.js') return { status: 200, url, html: bundle }
    return { status: 404, url, html: buildRoute404Html(new URL(url).pathname) }
  } })
}

test('CuriousJr validates the official client contact bundle when its static export omits contact text', async () => {
  assert.deepEqual(await runClientContactFixture(), [])
})

test('CuriousJr rejects an unrelated shell, missing contact data and new public jobs in the contact bundle', async () => {
  for (const bundle of [contactBundle.replace('8448828113', '0000000000'), contactBundle.replace('["/contact-us"', '["/different-page"'), contactBundle + ' https://jobs.lever.co/curiousjr']) {
    await assert.rejects(runClientContactFixture(bundle), /CuriousJr.*contact/i)
  }
  await assert.rejects(runClientContactFixture(contactBundle, clientContactShell.replace('/_next/static/', 'https://other.example/_next/static/')), /CuriousJr.*contact/i)
})
