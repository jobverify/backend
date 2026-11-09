import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Gupshup | Shape the Future of Conversations</title>
  </head>
  <body>
    <main>
      <h1>Join Gupshup’s Global Team</h1>
      <h2>Your Next Career Move Is Just a Message Away</h2>
      <p>Join forces with brilliant minds across 5 continents who are reshaping the world of customer engagement, one conversation at a time.</p>
      <a href="https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number">Explore Opportunities</a>
      <p>Your global career starts here – explore exciting opportunities at Gupshup across India, UAE, Saudi Arabia, Brazil, Mexico, Africa and beyond</p>
      <p>sales@gupshup.ai</p>
    </main>
  </body>
</html>
`

const CURRENT_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Gupshup | Shape the Future of Conversations</title>
  </head>
  <body>
    <main>
      <h1>Join Gupshup’s Global Team</h1>
      <h2>Your Next Career Move Is Just a Message Away</h2>
      <p>Join forces with brilliant minds across 5 continents who are reshaping the world of customer engagement, one conversation at a time.</p>
      <a href="https://api.whatsapp.com/send?phone=+919873865178&text=Hi+&type=phone_number&app_absent=0">Explore Opportunities</a>
      <p>Your global career starts here – explore exciting opportunities at Gupshup across India, UAE, Saudi Arabia, Brazil, Mexico, Africa and beyond</p>
      <p>sales@gupshup.ai</p>
    </main>
  </body>
</html>
`

const ABOUT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Gupshup</title>
  </head>
  <body>
    <main>
      <h1>Billions of global conversations, powered by one purpose</h1>
      <p>Born in India, Gupshup’s conversational philosophy now resonates across the globe—empowering better, smarter, and more human connections in every language.</p>
      <section>Our People</section>
      <p>900 Strong global team</p>
      <p>12 Global offices</p>
      <p>India Offices</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/gupshup/script.js')
  } catch {
    assert.fail('Expected Gupshup scraper module at ../../scraper/gupshup/script.js')
  }
}

test('Gupshup pins the verified careers page, WhatsApp handoff, and about-page signals', async () => {
  const gupshup = await loadModule()

  assert.equal(gupshup.SOURCE, 'gupshup')
  assert.equal(gupshup.COMPANY, 'Gupshup')
  assert.equal(gupshup.OFFICIAL_BRAND_NAME, 'Gupshup')
  assert.equal(gupshup.VERIFIED_ON, '2026-07-17')
  assert.equal(gupshup.HOMEPAGE_URL, 'https://www.gupshup.ai/en/')
  assert.equal(gupshup.CAREERS_URL, 'https://www.gupshup.ai/en/careers')
  assert.equal(gupshup.ABOUT_US_URL, 'https://www.gupshup.ai/about-us')
  assert.equal(
    gupshup.WHATSAPP_HANDOFF_URL,
    'https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number',
  )
  assert.equal(gupshup.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(gupshup.hasOfficialCareersPageSignal(CURRENT_CAREERS_HTML), true)
  assert.equal(gupshup.hasOfficialAboutPageSignal(ABOUT_HTML), true)
  assert.equal(
    gupshup.extractWhatsAppHandoffUrl(CAREERS_HTML),
    gupshup.WHATSAPP_HANDOFF_URL,
  )
  assert.equal(
    gupshup.pageExposesPublicJobsSignal('<html><body><a href="https://jobs.lever.co/gupshup">Apply now</a></body></html>'),
    true,
  )
})

test('Gupshup run verifies the official careers page and WhatsApp handoff before returning []', async () => {
  const gupshup = await loadModule()
  const requestedUrls = []

  const jobs = await gupshup.createGupshupScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === gupshup.CAREERS_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      if (url === gupshup.ABOUT_US_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      throw new Error(`Unexpected Gupshup URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [gupshup.CAREERS_URL, gupshup.ABOUT_US_URL])
  assert.deepEqual(jobs, [])
})

test('Gupshup accepts the current careers title variant and reordered WhatsApp handoff query', async () => {
  const gupshup = await loadModule()

  const jobs = await gupshup.createGupshupScraper().run({
    fetchPage: async (url) => {
      if (url === gupshup.CAREERS_URL) {
        return { status: 200, url, html: CURRENT_CAREERS_HTML }
      }

      if (url === gupshup.ABOUT_US_URL) {
        return { status: 200, url, html: ABOUT_HTML }
      }

      throw new Error(`Unexpected Gupshup URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Gupshup fails closed when the verified careers handoff or about page drifts', async () => {
  const gupshup = await loadModule()

  await assert.rejects(
    gupshup.createGupshupScraper().run({
      fetchPage: async (url) => {
        if (url === gupshup.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML.replace(
              'https://api.whatsapp.com/send?app_absent=0&phone=+919873865178&text=Hi+&type=phone_number',
              'https://jobs.lever.co/gupshup',
            ),
          }
        }

        if (url === gupshup.ABOUT_US_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        throw new Error(`Unexpected Gupshup URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    gupshup.createGupshupScraper().run({
      fetchPage: async (url) => {
        if (url === gupshup.CAREERS_URL) {
          return { status: 200, url, html: CAREERS_HTML }
        }

        if (url === gupshup.ABOUT_US_URL) {
          return {
            status: 200,
            url,
            html: ABOUT_HTML.replace('Born in India', 'Built for global conversations'),
          }
        }

        throw new Error(`Unexpected Gupshup URL: ${url}`)
      },
    }),
    /verified about page/i,
  )

  await assert.rejects(
    gupshup.createGupshupScraper().run({
      fetchPage: async (url) => {
        if (url === gupshup.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: CAREERS_HTML.replace('Your Next Career Move Is Just a Message Away', 'Open Jobs'),
          }
        }

        if (url === gupshup.ABOUT_US_URL) {
          return { status: 200, url, html: ABOUT_HTML }
        }

        throw new Error(`Unexpected Gupshup URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )
})
