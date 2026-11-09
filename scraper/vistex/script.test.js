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
    <title>Revenue Management Solutions & Services - Vistex, Inc</title>
  </head>
  <body>
    <nav>
      <a href="https://www.vistex.com/about-us/">Company</a>
      <a href="https://www.vistex.com/contact/">Contact</a>
    </nav>
    <main>
      <h1>Stronger Revenue. Optimized Margins. Financial Insights.</h1>
      <p>With Vistex AI-driven enterprise software and services.</p>
      <p>Vistex AI-driven enterprise software helps businesses take control of revenue-generating programs.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Vistex, Inc</title>
  </head>
  <body>
    <main>
      <h1>Careers at Vistex.</h1>
      <h2>Be Our Colleague.</h2>
      <p>We are looking for team members who expect and deliver the extraordinary.</p>
      <h3>Find Your Opportunity</h3>
      <a href="https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?o=postedDateDesc&q=">India</a>
      <a href="https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?o=postedDateDesc&q=">View All Opportunities</a>
    </main>
  </body>
</html>
`

const liveCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Vistex, Inc</title>
  </head>
  <body>
    <main>
      <h1>Careers at Vistex.</h1>
      <h2>Be Our Colleague.</h2>
      <h3>Find Your Opportunity</h3>
      <a href="/careers/careers-in-india/">India</a>
      <a href="https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?q=&amp;o=postedDateDesc">View All Opportunities</a>
    </main>
  </body>
</html>
`

const indiaHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in India - Vistex, Inc.</title>
  </head>
  <body>
    <main>
      <h1>Careers in India</h1>
      <p>We develop enterprise business solutions for the largest companies in the world</p>
      <a href="https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?o=postedDateDesc&q=">FIND YOUR OPPORTUNITY</a>
      <p>Vistex Asia Pacific Pvt Ltd.</p>
      <p>Chennai, Tamil Nadu 603103</p>
      <p>Pune, Maharashtra 411045</p>
      <p>Mumbai, Maharashtra 400059, India</p>
    </main>
  </body>
</html>
`

const liveIndiaHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers in India - Vistex, Inc.</title>
  </head>
  <body>
    <main>
      <h1>Careers in India</h1>
      <p>We develop enterprise business solutions for the largest companies in the world</p>
      <a href="https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?q=&amp;o=postedDateDesc&amp;f4=AFRPpIe5p0uCZgc2LdGixQ">FIND YOUR OPPORTUNITY</a>
      <p>Vistex Asia Pacific Pvt Ltd.</p>
      <p>Mumbai, Maharashtra 400059, India</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Vistex, Inc</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>Vistex AI-driven enterprise software helps businesses take control of revenue-generating programs and deliver exceptional business results.</p>
      <p>Gain visibility and control of complex pricing, trade, royalty and incentive programs.</p>
    </main>
  </body>
</html>
`

const liveAboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Vistex, Inc</title>
  </head>
  <body>
    <main>
      <h1>About Us</h1>
      <p>When you can’t account for everything, there’s Vistex. Now it all adds up.</p>
      <p>Vistex solutions help businesses take control of mission critical processes.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>General Inquiry - Vistex, Inc.</title>
  </head>
  <body>
    <main>
      <h1>CONTACT US</h1>
      <p>Vistex Logo</p>
      <p>General Inquiry</p>
    </main>
  </body>
</html>
`

const liveContactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>General Inquiry - Vistex, Inc.</title>
  </head>
  <body>
    <main>
      <h1>How Can We Help You?</h1>
      <p>General Inquiry</p>
    </main>
  </body>
</html>
`

const ultiproBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <p>https://www.vistex.com/careers/</p>
    <h2>You are using an unsupported browser.</h2>
    <p>To use this site, please use a supported browser.</p>
  </body>
</html>
`

test('Vistex validates the verified homepage, careers pages, about page, contact page, and exact UKG board handoff', async () => {
  const vistex = await loadModule()
  assert.ok(vistex, 'Vistex scraper module should load')

  assert.equal(vistex.SOURCE, 'vistex')
  assert.equal(vistex.COMPANY, 'Vistex')
  assert.equal(vistex.HOMEPAGE_URL, 'https://www.vistex.com/')
  assert.equal(vistex.CAREERS_URL, 'https://www.vistex.com/careers/')
  assert.equal(vistex.INDIA_CAREERS_URL, 'https://www.vistex.com/careers/careers-in-india/')
  assert.equal(vistex.ABOUT_URL, 'https://www.vistex.com/about-us/')
  assert.equal(vistex.CONTACT_URL, 'https://www.vistex.com/contact/')
  assert.equal(
    vistex.ULTIPRO_BOARD_URL,
    'https://recruiting2.ultipro.com/VIS1012VISX/JobBoard/23e64b4e-ff01-4579-9e5a-835480ac7a51/?o=postedDateDesc&q=',
  )
  assert.equal(vistex.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vistex.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(vistex.hasOfficialCareersSignal(liveCareersHtml), true)
  assert.equal(vistex.hasOfficialIndiaCareersSignal(indiaHtml), true)
  assert.equal(vistex.hasOfficialIndiaCareersSignal(liveIndiaHtml), true)
  assert.equal(vistex.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(vistex.hasOfficialAboutSignal(liveAboutHtml), true)
  assert.equal(vistex.hasOfficialContactSignal(contactHtml), true)
  assert.equal(vistex.hasOfficialContactSignal(liveContactHtml), true)
  assert.equal(vistex.extractOfficialUltiproUrl(careersHtml), vistex.ULTIPRO_BOARD_URL)
  assert.equal(vistex.extractOfficialUltiproUrl(liveCareersHtml), vistex.ULTIPRO_BOARD_URL)
  assert.equal(vistex.extractOfficialUltiproUrl(indiaHtml), vistex.ULTIPRO_BOARD_URL)
  assert.equal(vistex.extractOfficialUltiproUrl(liveIndiaHtml), vistex.ULTIPRO_BOARD_URL)
  assert.equal(vistex.hasOfficialUltiproBoardSignal(ultiproBoardHtml), true)
})

test('Vistex run returns an empty list only while the verified official pages expose the same UKG handoff contract', async () => {
  const vistex = await loadModule()
  assert.ok(vistex, 'Vistex scraper module should load')

  const requestedUrls = []
  const jobs = await vistex.createVistexScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === vistex.HOMEPAGE_URL) return homepageHtml
      if (url === vistex.CAREERS_URL) return careersHtml
      if (url === vistex.INDIA_CAREERS_URL) return indiaHtml
      if (url === vistex.ABOUT_URL) return aboutHtml
      if (url === vistex.CONTACT_URL) return contactHtml
      if (url === vistex.ULTIPRO_BOARD_URL) return ultiproBoardHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vistex.HOMEPAGE_URL,
    vistex.CAREERS_URL,
    vistex.INDIA_CAREERS_URL,
    vistex.ABOUT_URL,
    vistex.CONTACT_URL,
    vistex.ULTIPRO_BOARD_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Vistex fails closed when the homepage, careers page, india page, about page, contact page, or UKG handoff changes materially', async () => {
  const vistex = await loadModule()
  assert.ok(vistex, 'Vistex scraper module should load')

  await assert.rejects(
    vistex.createVistexScraper().run({
      fetchText: async (url) => {
        if (url === vistex.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        if (url === vistex.CAREERS_URL) return careersHtml
        if (url === vistex.INDIA_CAREERS_URL) return indiaHtml
        if (url === vistex.ABOUT_URL) return aboutHtml
        if (url === vistex.CONTACT_URL) return contactHtml
        if (url === vistex.ULTIPRO_BOARD_URL) return ultiproBoardHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    vistex.createVistexScraper().run({
      fetchText: async (url) => {
        if (url === vistex.HOMEPAGE_URL) return homepageHtml
        if (url === vistex.CAREERS_URL) return '<html><body><h1>Jobs</h1></body></html>'
        if (url === vistex.INDIA_CAREERS_URL) return indiaHtml
        if (url === vistex.ABOUT_URL) return aboutHtml
        if (url === vistex.CONTACT_URL) return contactHtml
        if (url === vistex.ULTIPRO_BOARD_URL) return ultiproBoardHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    vistex.createVistexScraper().run({
      fetchText: async (url) => {
        if (url === vistex.HOMEPAGE_URL) return homepageHtml
        if (url === vistex.CAREERS_URL) return careersHtml
        if (url === vistex.INDIA_CAREERS_URL) return indiaHtml.replace(vistex.ULTIPRO_BOARD_URL, 'https://example.com')
        if (url === vistex.ABOUT_URL) return aboutHtml
        if (url === vistex.CONTACT_URL) return contactHtml
        if (url === vistex.ULTIPRO_BOARD_URL) return ultiproBoardHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /ultipro handoff/i,
  )

  await assert.rejects(
    vistex.createVistexScraper().run({
      fetchText: async (url) => {
        if (url === vistex.HOMEPAGE_URL) return homepageHtml
        if (url === vistex.CAREERS_URL) return careersHtml
        if (url === vistex.INDIA_CAREERS_URL) return indiaHtml
        if (url === vistex.ABOUT_URL) return aboutHtml
        if (url === vistex.CONTACT_URL) return contactHtml
        if (url === vistex.ULTIPRO_BOARD_URL) return '<html><body><p>Board unavailable</p></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /board/i,
  )
})
