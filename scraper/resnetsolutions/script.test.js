import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
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
      <title>Resnet Solutions</title>
      <script src="/_next/static/chunks/app/page-e74bc61766123d55.js" async></script>
    </head>
    <body>
      <header>
        <a href="/">Home</a>
        <a href="/services">Services</a>
        <a href="/about">About Us</a>
        <a href="/success-stories">Success Stories</a>
        <a href="/blog">Blog</a>
        <a href="/contact">Contact Us</a>
      </header>
      <main>
        <h1>Empowering Innovation, Delivering Excellence</h1>
        <p>ResNet - Your Premier Partner for Software, App Development, UI/UX Design, AI/ML Solutions, and Landing Page Development</p>
      </main>
      <footer>
        <a href="https://www.linkedin.com/company/resnet-solutions-private-limited/">LinkedIn</a>
        <p>© - 2024 Resnet Pvt Ltd | All Right Reserved</p>
      </footer>
    </body>
  </html>
`

const bundleText = `
  const nav=["Home","Services","About Us","Success Stories","Blog","Contact Us"];
  const brand="Resnet Solutions";
  const footer="Resnet Pvt Ltd";
`

const notFoundHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404: This page could not be found</title>
    </head>
    <body>
      <div id="__next">
        <h1>404</h1>
        <p>This page could not be found.</p>
      </div>
    </body>
  </html>
`

test('ResNet Solutions validates the official homepage, bundle, and branded missing careers routes', async () => {
  const resnetSolutions = await loadModule()
  assert.ok(resnetSolutions, 'ResNet Solutions scraper module should load')

  assert.equal(resnetSolutions.SOURCE, 'resnetsolutions')
  assert.equal(resnetSolutions.COMPANY, 'ResNet Solutions Private Limited')
  assert.equal(resnetSolutions.HOMEPAGE_URL, 'https://www.resnetsolution.com/')
  assert.deepEqual(resnetSolutions.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.resnetsolution.com/careers',
    'https://www.resnetsolution.com/career',
    'https://www.resnetsolution.com/jobs',
    'https://www.resnetsolution.com/join-us',
  ])
  assert.equal(resnetSolutions.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(resnetSolutions.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    resnetSolutions.extractBundleAssetPath(homepageHtml),
    '/_next/static/chunks/app/page-e74bc61766123d55.js',
  )
  assert.equal(resnetSolutions.hasVerifiedBundleSignal(bundleText), true)
  assert.equal(resnetSolutions.hasBundleJobsSignal(bundleText), false)
  assert.equal(
    resnetSolutions.isVerifiedMissingCareersRoute({
      status: 404,
      url: resnetSolutions.NO_PUBLIC_CAREERS_ROUTE_URLS[0],
      headers: {
        server: 'Vercel',
        xMatchedPath: '/404',
      },
      html: notFoundHtml,
    }),
    true,
  )
})

test('ResNet Solutions returns no jobs only while the verified no-public-careers contract remains intact', async () => {
  const resnetSolutions = await loadModule()
  assert.ok(resnetSolutions, 'ResNet Solutions scraper module should load')

  const requestedUrls = []
  const jobs = await resnetSolutions.createResNetSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === resnetSolutions.HOMEPAGE_URL) {
        return { status: 200, url, headers: {}, html: homepageHtml }
      }

      if (resnetSolutions.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) {
        return {
          status: 404,
          url,
          headers: {
            server: 'Vercel',
            xMatchedPath: '/404',
          },
          html: notFoundHtml,
        }
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://www.resnetsolution.com/_next/static/chunks/app/page-e74bc61766123d55.js') {
        return bundleText
      }

      throw new Error(`Unexpected fixture bundle URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.resnetsolution.com/',
    'https://www.resnetsolution.com/_next/static/chunks/app/page-e74bc61766123d55.js',
    ...resnetSolutions.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('ResNet Solutions fails closed when the homepage, bundle, or careers-route contract changes', async () => {
  const resnetSolutions = await loadModule()
  assert.ok(resnetSolutions, 'ResNet Solutions scraper module should load')

  await assert.rejects(
    resnetSolutions.createResNetSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === resnetSolutions.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        return {
          status: 404,
          url,
          headers: {
            server: 'Vercel',
            xMatchedPath: '/404',
          },
          html: notFoundHtml,
        }
      },
      fetchText: async () => bundleText,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    resnetSolutions.createResNetSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === resnetSolutions.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        return {
          status: 404,
          url,
          headers: {
            server: 'Vercel',
            xMatchedPath: '/404',
          },
          html: notFoundHtml,
        }
      },
      fetchText: async () => 'const nav=["Home","Careers","Jobs"];',
    }),
    /client bundle changed materially or now exposes a public jobs surface/i,
  )

  await assert.rejects(
    resnetSolutions.createResNetSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === resnetSolutions.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }

        if (url === resnetSolutions.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) {
          return {
            status: 200,
            url,
            headers: {
              server: 'Vercel',
              xMatchedPath: '/',
            },
            html: '<html><body><h1>Current Openings</h1><a href="/apply">Apply now</a></body></html>',
          }
        }

        return {
          status: 404,
          url,
          headers: {
            server: 'Vercel',
            xMatchedPath: '/404',
          },
          html: notFoundHtml,
        }
      },
      fetchText: async () => bundleText,
    }),
    /careers routes changed materially or now expose public jobs/i,
  )
})
