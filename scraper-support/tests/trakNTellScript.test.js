import assert from 'node:assert/strict'
import test from 'node:test'

const homepagePage = {
  status: 200,
  url: 'https://www.trakntell.com/',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Experience India's 1st OEM GPS Vehicle Tracker</h1>
          <p>Learn More</p>
          <h2>GPS Vehicle Tracker</h2>
          <p>GPS Vehicle Tracker with Trak N Tell App</p>
          <p>Track your vehicle anywhere anytime</p>
          <p>Smart GPS Vehicle Tracker</p>
          <p>TRAK N TELL MOBILE APP</p>
          <p>Need Support?</p>
          <a href="/press/">Press</a>
          <a href="/emi/">EMI</a>
        </main>
      </body>
    </html>
  `,
}

const contactPage = {
  status: 200,
  url: 'https://www.trakntell.com/contact-us/',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Contact Us</h1>
          <h2>Get In touch</h2>
          <p>8010-80-8010</p>
          <p>care@TrakNTell.com</p>
          <p>Address- A20, Info Technology Park, Sector 34, Gurugram, Haryana 122001</p>
        </main>
      </body>
    </html>
  `,
}

const jobsSignalPage = {
  status: 200,
  url: 'https://www.trakntell.com/contact-us/',
  html: `
    <!doctype html>
    <html lang="en">
      <body>
        <main>
          <h1>Careers</h1>
          <h2>Open Positions</h2>
          <a href="/careers/software-engineer">Apply Now</a>
        </main>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/trakntell/script.js')
  } catch {
    assert.fail('Expected Trak N Tell scraper module at ../../scraper/trakntell/script.js')
  }
}

test('Trak N Tell helpers stay pinned to the verified first-party product and contact surfaces from September 3, 2026', async () => {
  const trakNTell = await loadModule()

  assert.equal(trakNTell.SOURCE, 'trakntell')
  assert.equal(trakNTell.COMPANY, 'Trak N Tell')
  assert.equal(trakNTell.HOMEPAGE_URL, 'https://www.trakntell.com/')
  assert.equal(trakNTell.CONTACT_URL, 'https://www.trakntell.com/contact-us/')
  assert.equal(trakNTell.VERIFIED_ON, '2026-09-03')
  assert.equal(trakNTell.hasOfficialHomepageSignal(homepagePage), true)
  assert.equal(trakNTell.hasOfficialContactSignal(contactPage), true)
  assert.equal(trakNTell.hasPublicJobsSignal(jobsSignalPage.html), true)
})

test('Trak N Tell returns no jobs only while the verified first-party site remains product and contact only', async () => {
  const trakNTell = await loadModule()
  const requestedUrls = []

  const jobs = await trakNTell.createTrakNTellScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === trakNTell.HOMEPAGE_URL) return homepagePage
      if (url === trakNTell.CONTACT_URL) return contactPage

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    trakNTell.HOMEPAGE_URL,
    trakNTell.CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Trak N Tell fails closed when the verified product shell drifts or a public jobs surface appears', async () => {
  const trakNTell = await loadModule()

  await assert.rejects(
    trakNTell.createTrakNTellScraper().run({
      fetchPage: async (url) => {
        if (url === trakNTell.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        return contactPage
      },
    }),
    /verified Trak N Tell homepage/i,
  )

  await assert.rejects(
    trakNTell.createTrakNTellScraper().run({
      fetchPage: async (url) => {
        if (url === trakNTell.HOMEPAGE_URL) return homepagePage
        if (url === trakNTell.CONTACT_URL) {
          return { status: 200, url, html: '<html><body><h1>Contact</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified Trak N Tell contact page/i,
  )

  await assert.rejects(
    trakNTell.createTrakNTellScraper().run({
      fetchPage: async (url) => {
        if (url === trakNTell.HOMEPAGE_URL) return homepagePage
        if (url === trakNTell.CONTACT_URL) return jobsSignalPage

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified product-contact-only state/i,
  )
})
