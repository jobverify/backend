import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ubayog | AI-Native Asset Marketplace</title>
  </head>
  <body>
    <header>
      <a href="/about">About Us</a>
      <a href="/contact">Contact Us</a>
      <a href="/how-it-works">How Ubayog Works</a>
    </header>
    <main>
      <h1>Turn your unused things into income</h1>
      <p>Find what you need. List what you don't. The autonomous AI ecosystem that works 24/7.</p>
      <p>Hi! I'm Yogu, your AI marketplace guide.</p>
      <p>From professional expertise to heavy machinery - every idle asset has a home on Ubayog.</p>
      <p>Yogu helps you earn more.</p>
    </main>
    <footer>
      <p>India's AI-native asset marketplace. List what you don't use. Find what you need.</p>
      <p>© 2026 Ubayog · Loveall Innovations Pvt Ltd · All rights reserved.</p>
    </footer>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ubayog | AI-Native Asset Marketplace</title>
  </head>
  <body>
    <main>
      <h1>Understanding Ubayog</h1>
      <h2>What is Ubayog?</h2>
      <p>Ubayog is India's first AI-native asset marketplace - a living ecosystem where idle assets meet intelligent automation.</p>
      <p>Think of it as your personal AI broker, lawyer, negotiator, and logistics manager, all in one.</p>
      <p>Verified users and secure communication make every interaction safer.</p>
      <p>Multiple business models support rentals, leases, and more.</p>
      <p>Aadhaar-linked KYC, Ubayog secure payments, and real-time Trust Scores keep every deal safe.</p>
      <p>Every rental or lease is a step toward circular economy - less waste, more wealth.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ubayog | AI-Native Asset Marketplace</title>
  </head>
  <body>
    <main>
      <h1>Let's Connect</h1>
      <p>Have questions about Ubayog? Need help setting up an AI agent?</p>
      <p>Our team is ready to help you turn your idle assets into active income.</p>
      <p>Call Us Mon-Fri from 9am to 6pm</p>
      <p>+91 8050850580</p>
      <p>Email Us</p>
      <p>support@ubayog.com</p>
      <p>Need quick answers? Check out our FAQs or ask our AI chatbot directly from the bottom right corner.</p>
    </main>
    <footer>
      <p>© 2026 Ubayog · Loveall Innovations Pvt Ltd · All rights reserved.</p>
    </footer>
  </body>
</html>
`

const route404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ubayog | AI-Native Asset Marketplace</title>
  </head>
  <body>
    <main>
      <p>404</p>
      <h1>Oops! Page not found</h1>
      <p>Yogu searched everywhere but couldn't find this page.</p>
      <p>Let's get you back on track.</p>
      <a href="/">Go Home</a>
      <a href="/browse">Explore Marketplace</a>
    </main>
  </body>
</html>
`

const liveJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Ubayog Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/ubayog/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Ubayog scraper module at ./script.js')
  }
}

test('Ubayog sentinel recognizes the verified first-party non-listing surfaces', async () => {
  const ubayog = await loadModule()

  assert.equal(ubayog.SOURCE, 'ubayog')
  assert.equal(ubayog.COMPANY, 'Ubayog')
  assert.equal(ubayog.HOMEPAGE_URL, 'https://ubayog.com/')
  assert.equal(ubayog.ABOUT_URL, 'https://ubayog.com/about')
  assert.equal(ubayog.CONTACT_URL, 'https://ubayog.com/contact')
  assert.deepEqual(ubayog.NON_LISTING_ROUTE_URLS, [
    'https://ubayog.com/careers',
    'https://ubayog.com/career',
    'https://ubayog.com/jobs',
    'https://ubayog.com/hiring',
    'https://ubayog.com/join-us',
    'https://ubayog.com/openings',
    'https://ubayog.com/work-with-us',
  ])

  assert.equal(ubayog.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ubayog.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(ubayog.hasOfficialContactSignal(contactHtml), true)
  assert.equal(ubayog.hasVerifiedNotFoundSignal(route404Html), true)
  assert.equal(ubayog.hasUnexpectedPublicJobsSignal(homepageHtml), false)
  assert.equal(ubayog.hasUnexpectedPublicJobsSignal(aboutHtml), false)
  assert.equal(ubayog.hasUnexpectedPublicJobsSignal(contactHtml), false)
  assert.equal(ubayog.hasUnexpectedPublicJobsSignal(route404Html), false)
})

test('Ubayog sentinel returns no jobs only while the verified official non-listing surface remains unchanged', async () => {
  const ubayog = await loadModule()
  const requestedUrls = []

  const jobs = await ubayog.createUbayogScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === ubayog.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === ubayog.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === ubayog.CONTACT_URL) {
        return { status: 200, url, html: contactHtml }
      }

      if (ubayog.NON_LISTING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: route404Html }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ubayog.HOMEPAGE_URL,
    ubayog.ABOUT_URL,
    ubayog.CONTACT_URL,
    ...ubayog.NON_LISTING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Ubayog sentinel fails closed when the verified non-listing surface drifts', async () => {
  const ubayog = await loadModule()

  await assert.rejects(
    ubayog.createUbayogScraper().run({
      fetchPage: async (url) => {
        if (url === ubayog.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Placeholder</h1></body></html>' }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    ubayog.createUbayogScraper().run({
      fetchPage: async (url) => {
        if (url === ubayog.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ubayog.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === ubayog.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (url === ubayog.NON_LISTING_ROUTE_URLS[0]) {
          return { status: 200, url, html: liveJobsHtml }
        }

        if (ubayog.NON_LISTING_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: route404Html }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /non-listing route/i,
  )

  await assert.rejects(
    ubayog.createUbayogScraper().run({
      fetchPage: async (url) => {
        if (url === ubayog.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === ubayog.ABOUT_URL) {
          return {
            status: 200,
            url,
            html: aboutHtml.replace(
              'What is Ubayog?',
              'What jobs are open right now?',
            ),
          }
        }

        if (url === ubayog.CONTACT_URL) {
          return { status: 200, url, html: contactHtml }
        }

        if (ubayog.NON_LISTING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: route404Html }
        }

        throw new Error(`Unexpected page URL: ${url}`)
      },
    }),
    /about page|public jobs/i,
  )
})
