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
      <title>Get Pure Water Filters Online | Best RO UV Purifiers - ZeroB</title>
    </head>
    <body>
      <main>
        <p>#BharatKaPaani</p>
        <h1>Multiple Options, One Destination</h1>
        <h2>India Grew up on ZeroB Purity, Quite Literally!</h2>
        <p>Our product range is vibrant mix, thoughtfully crafted to suit your unique needs.</p>
        <p>Registered office and Corporate office</p>
        <p>Manufacturer/ Importer Details</p>
        <p>Ion Exchange (India) Ltd.</p>
        <p>zerob@ionexchange.co.in</p>
        <a href="https://www.zerobonline.com/our-story/">Our Story</a>
        <a href="https://ionexchangeglobal.com/careers/">Careers</a>
      </main>
    </body>
  </html>
`

const storyHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h1>Our Story</h1>
        <p>in the buzzing world of water tech, there was Ion Exchange, a legend since 1964. Fast forward to 1986, and boom– ZeroB was born.</p>
        <p>Manufacturer/ Importer Details</p>
        <p>Ion Exchange (India) Ltd.</p>
        <p>zerob@ionexchange.co.in</p>
        <p>ZeroB a flagship brand of Ion Exchange has pioneered many path-breaking innovations in the field of technology.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers - Ion Exchange</title>
    </head>
    <body>
      <main>
        <h1>Careers</h1>
        <h2>Aspiring to make a difference, just like us?</h2>
        <p>Join Us!</p>
        <p>For over six decades, it has been our mission to conserve our planet’s most precious resource – WATER, through our 360° Water and Environment Management Solutions and we need you!</p>
        <p>At Ion Exchange, you will get a chance to work on numerous exciting yet challenging projects.</p>
        <a href="https://careers.ionindia.com/jobs">Explore jobs</a>
        <p>Drop Your Resume Here</p>
        <p>recruit@ionexchange.co.in</p>
      </main>
    </body>
  </html>
`

test('ION EXCHANGE ZERO B sentinel validates the verified ZeroB homepage, story page, and Ion Exchange careers handoff page', async () => {
  const ionexchangezerob = await loadModule()
  assert.ok(ionexchangezerob, 'ION EXCHANGE ZERO B scraper module should load')

  assert.equal(ionexchangezerob.SOURCE, 'ionexchangezerob')
  assert.equal(ionexchangezerob.COMPANY, 'ION EXCHANGE ZERO B')
  assert.equal(ionexchangezerob.HOMEPAGE_URL, 'https://www.zerobonline.com/')
  assert.equal(ionexchangezerob.STORY_URL, 'https://www.zerobonline.com/our-story/')
  assert.equal(ionexchangezerob.CAREERS_URL, 'https://ionexchangeglobal.com/careers/')
  assert.equal(ionexchangezerob.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(ionexchangezerob.hasOfficialStorySignal(storyHtml), true)
  assert.equal(ionexchangezerob.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(ionexchangezerob.extractOutboundCareersUrl(careersHtml), 'https://careers.ionindia.com/jobs')
  assert.equal(ionexchangezerob.extractEmailApplyHandoff(careersHtml), 'recruit@ionexchange.co.in')
  assert.equal(ionexchangezerob.hasPublicJobListingSignal(careersHtml), false)
})

test('ION EXCHANGE ZERO B run returns an empty list while the verified first-party careers page exposes only a nonlisting handoff', async () => {
  const ionexchangezerob = await loadModule()
  assert.ok(ionexchangezerob, 'ION EXCHANGE ZERO B scraper module should load')

  const requestedUrls = []
  const jobs = await ionexchangezerob.createIonExchangeZeroBScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ionexchangezerob.HOMEPAGE_URL) return homepageHtml
      if (url === ionexchangezerob.STORY_URL) return storyHtml
      if (url === ionexchangezerob.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected ION EXCHANGE ZERO B URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.zerobonline.com/',
    'https://www.zerobonline.com/our-story/',
    'https://ionexchangeglobal.com/careers/',
  ])
  assert.deepEqual(jobs, [])
})

test('ION EXCHANGE ZERO B fails closed when the trusted pages change materially or public job records appear', async () => {
  const ionexchangezerob = await loadModule()
  assert.ok(ionexchangezerob, 'ION EXCHANGE ZERO B scraper module should load')

  await assert.rejects(
    ionexchangezerob.createIonExchangeZeroBScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified zerob homepage/i,
  )

  await assert.rejects(
    ionexchangezerob.createIonExchangeZeroBScraper().run({
      fetchText: async (url) => {
        if (url === ionexchangezerob.HOMEPAGE_URL) return homepageHtml
        if (url === ionexchangezerob.STORY_URL) return storyHtml
        return careersHtml.replace(
          '</main>',
          '<script type="application/ld+json">{"@type":"JobPosting"}</script></main>',
        )
      },
    }),
    /now appears to expose public job records/i,
  )
})
