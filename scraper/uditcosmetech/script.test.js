import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no"/>
    <meta name="theme-color" content="#0d6efd"/>
    <meta name="description" content="UDIT Cosmetech - Empowering Digital Growth through Technology, Creativity, and Innovation."/>
    <meta name="keywords" content="UDIT Cosmetech, Web Development, React, Technology, Software, IT Services, Digital Solutions"/>
    <meta name="author" content="UDIT Cosmetech"/>
    <meta property="og:title" content="UDIT Cosmetech"/>
    <meta property="og:description" content="We build modern digital experiences with React, Ionic, and cutting-edge web technologies."/>
    <meta property="og:image" content="/11.png"/>
    <meta property="og:url" content="https://uditcosmetics.com"/>
    <meta property="og:type" content="website"/>
    <meta name="twitter:card" content="summary_large_image"/>
    <meta name="twitter:title" content="UDIT Cosmetech"/>
    <meta name="twitter:description" content="Empowering Digital Growth through Technology and Innovation."/>
    <meta name="twitter:image" content="/11.png"/>
    <link rel="icon" href="/11.png"/>
    <link rel="apple-touch-icon" href="/11.png"/>
    <link rel="manifest" href="/manifest.json"/>
    <title>UDIT Cosmetech</title>
    <script defer="defer" src="/static/js/main.2c565de5.js"></script>
    <link href="/static/css/main.18207dbb.css" rel="stylesheet">
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const robotsTxt = `
# https://www.robotstxt.org/robotstxt.html
User-agent: *
Disallow:
`

const bundleJs = `
const marketing = {
  company: 'UDIT Cosmetech',
  whatWeDo: 'What We Do',
  serviceA: 'Healthcare Application Development',
  serviceB: 'Cloud & DevOps Engineering',
  serviceC: 'Cosmetic Research & Innovation',
  journey: 'Join Us on Our Journey',
  contactHeading: 'Drop us a line!',
  supportEmail: 'support@uditcosmetics.com',
  address: '7/111E, Plot No. 80/1, P&K Nest, Chil SEZ IT Park Rd, Coimbatore North, Coimbatore, Tamil Nadu, India - 641035',
  hoursOpen: 'Open today',
  hoursStart: '09:00 am',
  hoursEnd: '05:00 pm',
  poweredBy: 'Powered by UditCosmetech',
  joinText: 'Whether you\\'re a healthcare professional, a tech enthusiast, or someone looking to make a positive impact, UDIT CosmeTech welcomes you to collaborate and innovate with us.',
  gmailCompose: 'https://mail.google.com/mail/?view=cm&fs=1&to=support@uditcosmetics.com',
  whatsapp: 'https://wa.me/918688767603?text=Hello%20UDIT%20CosmeTech%20Team',
}
`

const publicJobsBundleJs = `
${bundleJs}
const careers = {
  heading: 'Current Openings',
  apply: 'Apply now',
  ats: 'https://jobs.lever.co/uditcosmetech/frontend-engineer',
}
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected UDITCosmetech scraper module at ./script.js')
  }
}

test('UDITCosmetech sentinel recognizes the verified first-party non-listing shell, bundle, and robots surface', async () => {
  const udit = await loadModule()

  assert.equal(udit.SOURCE, 'uditcosmetech')
  assert.equal(udit.COMPANY, 'UDITCosmetech')
  assert.equal(udit.HOMEPAGE_URL, 'https://uditcosmetech.com/')
  assert.equal(udit.ROBOTS_URL, 'https://uditcosmetech.com/robots.txt')
  assert.equal(udit.BUNDLE_URL, 'https://uditcosmetech.com/static/js/main.2c565de5.js')
  assert.deepEqual(udit.NON_LISTING_ROUTE_URLS, [
    'https://uditcosmetech.com/careers',
    'https://uditcosmetech.com/career',
    'https://uditcosmetech.com/jobs',
    'https://uditcosmetech.com/join-us',
    'https://uditcosmetech.com/work-with-us',
    'https://uditcosmetech.com/sitemap.xml',
  ])

  assert.equal(udit.extractBundlePath(homepageHtml), '/static/js/main.2c565de5.js')
  assert.equal(udit.hasOfficialShellSignal(homepageHtml), true)
  assert.equal(udit.hasVerifiedRobotsSignal(robotsTxt), true)
  assert.equal(udit.hasOfficialBundleSignal(bundleJs), true)
  assert.equal(udit.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(udit.hasPublicJobsSignal(bundleJs), false)
})

test('UDITCosmetech sentinel returns no jobs only while the verified official non-listing surface remains unchanged', async () => {
  const udit = await loadModule()
  const requestedUrls = []

  const jobs = await udit.createUDITCosmetechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === udit.HOMEPAGE_URL) return homepageHtml
      if (url === udit.ROBOTS_URL) return robotsTxt
      if (url === udit.BUNDLE_URL) return bundleJs
      if (udit.NON_LISTING_ROUTE_URLS.includes(url)) return homepageHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    udit.HOMEPAGE_URL,
    udit.ROBOTS_URL,
    udit.BUNDLE_URL,
    ...udit.NON_LISTING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('UDITCosmetech sentinel fails closed when the verified first-party non-listing surface drifts into jobs or changes materially', async () => {
  const udit = await loadModule()

  await assert.rejects(
    udit.createUDITCosmetechScraper().run({
      fetchText: async (url) => {
        if (url === udit.HOMEPAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official shell/i,
  )

  await assert.rejects(
    udit.createUDITCosmetechScraper().run({
      fetchText: async (url) => {
        if (url === udit.HOMEPAGE_URL) return homepageHtml
        if (url === udit.ROBOTS_URL) return robotsTxt
        if (url === udit.BUNDLE_URL) return publicJobsBundleJs
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /bundle now appears to expose public jobs/i,
  )

  await assert.rejects(
    udit.createUDITCosmetechScraper().run({
      fetchText: async (url) => {
        if (url === udit.HOMEPAGE_URL) return homepageHtml
        if (url === udit.ROBOTS_URL) return robotsTxt
        if (url === udit.BUNDLE_URL) return bundleJs
        if (url === udit.NON_LISTING_ROUTE_URLS[0]) {
          return homepageHtml.replace('/static/js/main.2c565de5.js', '/static/js/main.changed.js')
        }
        if (udit.NON_LISTING_ROUTE_URLS.slice(1).includes(url)) return homepageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /non-listing route changed materially/i,
  )
})
