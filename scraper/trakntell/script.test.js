import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepagePage = {
  status: 200,
  url: 'https://www.trakntell.com/',
  html: `
    <html>
      <body>
        <h1>Experience India's 1st OEM GPS Vehicle Tracker</h1>
        <h2>GPS Vehicle Tracker</h2>
        <p>GPS Vehicle Tracker with Trak N Tell App</p>
        <p>Track your vehicle anywhere anytime</p>
        <p>Smart GPS Vehicle Tracker</p>
        <p>Trak N Tell Mobile App</p>
        <p>Need Support?</p>
        <p>Press</p>
        <p>EMI</p>
      </body>
    </html>
  `,
}

const contactPage = {
  status: 200,
  url: 'https://www.trakntell.com/contact-us/',
  html: `
    <html>
      <body>
        <h1>Contact Us</h1>
        <h2>Get in Touch</h2>
        <p>8010-80-8010</p>
        <a href="mailto:care@trakntell.com">care@trakntell.com</a>
        <p>Address- A20, Info Technology Park, Sector 34, Gurgaon, Haryana 122001</p>
      </body>
    </html>
  `,
}

const blockedPage = {
  status: null,
  url: 'https://www.trakntell.com/',
  html: null,
  errorKind: 'timeout',
  errorMessage: 'UND_ERR_CONNECT_TIMEOUT',
}

test('Trak N Tell returns [] for the verified product-only surface or the current all-routes timeout block', async () => {
  const trakntell = await loadModule()
  assert.ok(trakntell, 'Trak N Tell scraper module should load')

  assert.equal(trakntell.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(trakntell.hasOfficialContactSignal(contactPage), true)
  assert.equal(trakntell.isExpectedBlockedSurface(blockedPage), true)

  const reachableJobs = await trakntell.createTrakNTellScraper().run({
    fetchPage: async (url) => {
      if (url === trakntell.HOMEPAGE_URL) return homepagePage
      if (url === trakntell.CONTACT_URL) return contactPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  })
  assert.deepEqual(reachableJobs, [])

  const blockedJobs = await trakntell.createTrakNTellScraper().run({
    fetchPage: async (url) => ({ ...blockedPage, url }),
  })
  assert.deepEqual(blockedJobs, [])
})

test('Trak N Tell fails closed when a public jobs surface appears', async () => {
  const trakntell = await loadModule()
  assert.ok(trakntell, 'Trak N Tell scraper module should load')

  await assert.rejects(
    trakntell.createTrakNTellScraper().run({
      fetchPage: async (url) => {
        if (url === trakntell.HOMEPAGE_URL) {
          return {
            ...homepagePage,
            html: '<html><body><h1>Careers</h1><a href="/careers">Apply now</a></body></html>',
          }
        }

        return contactPage
      },
    }),
    /product-contact-only state/i,
  )
})
