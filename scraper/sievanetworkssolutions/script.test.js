import assert from 'node:assert/strict'
import test from 'node:test'

const loadSievaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>sievanetworks :: company</title>
    <meta name="author" content="Shirin" />
  </head>
  <body id="home">
    <div id="topmenu">
      <ul class="superfish nav sf-js-enabled">
        <li class="current_page_item"><a href="#" id="homelink"><span>Home</span></a></li>
        <li class="cat-item cat-item-1">
          <a href="#">Products</a>
          <ul>
            <li><a href="canopus.html">Canopus</a></li>
          </ul>
        </li>
        <li class="page_item page-item-2"><a href="ipportfolio.html">IP Portfolio</a></li>
        <li class="page_item page-item-3"><a href="mailto:sales@sievanetworks.com">Contact</a></li>
      </ul>
    </div>
    <div id="featured-wrap">
      <div class="service about">
        <h3 class="title"><a href="#">About the Company</a></h3>
        <p>
          Based out of San Francisco Bay area and with locations in three continents, Sieva Networks has a global reach.
          The management team consists of highly successful and well known entrepreneurs. We are a privately held company.
        </p>
      </div>
    </div>
    <div id="recent-posts-2" class="sidebar-block widget_recent_entries contact">
      <h3 class="title">Contact</h3>
      <ul>
        <li><a href="mailto:info@sievanetworks.com">info@sievanetworks.com.</a></li>
      </ul>
    </div>
    <div id="footer">
      <a href="#">Copyright 2011 Sieva Networks. All rights reserved.</a>
    </div>
  </body>
</html>
`

const canopusHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>sievanetworks :: company</title>
  </head>
  <body id="home">
    <div id="top-box">
      <h2>CANOPUS</h2>
      <p>
        Canopus forms the core of Sieva Network's low power transceiver chipsets.
        Please contact <a href="#">sales@sievanetworks</a> for detailed pricing information.
      </p>
      <a href="http://www.sievanetworks.com/Canopus Core.pdf" class="featured-button"><span>Download Brochure</span></a>
      <a href="mailto:sales@sievanetworks.com" class="featured-button"><span>Contact Sales</span></a>
    </div>
    <div id="featured">
      <div class="slide clearfix" style="display: block;">
        <h2 class="title"><a href="#">CANOPUS CORE</a></h2>
        <p>Wireless Telemetry<br/>RFID<br/>Smart Meters</p>
        <a href="http://www.sievanetworks.com/Canopus Core.pdf" class="readmore"><span>DOWNLOAD SPEC</span></a>
      </div>
      <div class="slide clearfix" style="display: none;">
        <h2 class="title"><a href="#">CANOPUS CS</a></h2>
      </div>
    </div>
    <div id="footer">
      <a href="#">Copyright 2011 Sieva Networks. All rights reserved.</a>
    </div>
  </body>
</html>
`

const ipPortfolioHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>sievanetworks :: company</title>
  </head>
  <body id="home">
    <div id="content-left">
      <h2>Ultra Low Power IP Circuit Blocks</h2>
      <p>
        Sieva Networks provides a number of blocks for RF and baseband circuitry such as LNA's, mixers, VCO's, PLL's.
        For more information, please contact sales@sievanetworks.
      </p>
      <h2>Voltage Controlled Oscillator (VCO)</h2>
      <h3 class="title"><a href="#">SN040</a></h3>
      <a href="http://www.sievanetworks.com/sn040.pdf" class="readmore"><span>DATASHEET</span></a>
      <h2>Low Noise Amplifier (LNA)</h2>
    </div>
    <div id="footer">
      <a href="#">Copyright 2011 Sieva Networks. All rights reserved.</a>
    </div>
  </body>
</html>
`

const liveLikeIpPortfolioHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>sievanetworks :: company</title>
  </head>
  <body id="home">
    <div id="content-left">
      <h2>Ultra Low Power IP Circuit Blocks</h2>
      <p>
        Sieva Networks provides a number of blocks for RF and baseband circuitry such as LNA's, mixers, VCO's, PLL's, op amps, log domain filters, micropower amplifiers, voltage regulators, bandgaps.
        The focus is on very low power consumption and generally most circuits consume less than 500uA of current at 1.8 nominal voltage.
      </p>
      <h2>Voltage Controlled Oscillator (VCO)</h2>
      <h3 class="title"><a href="#">SN040</a></h3>
      <a href="http://www.sievanetworks.com/sn040.pdf" class="readmore"><span>DATASHEET</span></a>
      <h2>Low Noise Amplifier (LNA)</h2>
    </div>
    <div id="footer">
      <a href="#">Copyright 2011 Sieva Networks. All rights reserved.</a>
    </div>
  </body>
</html>
`

const missingCareerRoutePage = {
  status: 404,
  url: 'https://www.sievanetworks.com/careers',
  html: `
    <!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
    <html>
      <head>
        <title>404 Not Found</title>
      </head>
      <body>
        <h1>Not Found</h1>
        <p>The requested URL was not found on this server.</p>
        <p>Additionally, a 404 Not Found error was encountered while trying to use an ErrorDocument to handle the request.</p>
      </body>
    </html>
  `,
}

const blockedCareerRoutePage = {
  status: 406,
  url: 'https://www.sievanetworks.com/careers',
  html: `
    <html>
      <head><title>Not Acceptable!</title></head>
      <body><h1>Not Acceptable!</h1></body>
    </html>
  `,
}

const publicJobsPage = {
  status: 200,
  url: 'https://www.sievanetworks.com/careers',
  html: `
    <html>
      <head>
        <title>Sieva Networks Careers</title>
      </head>
      <body>
        <h1>Current Openings</h1>
        <a href="https://jobs.lever.co/sievanetworks/founding-rf-engineer">Apply now</a>
      </body>
    </html>
  `,
}

test('Sieva Networks Solutions sentinel recognizes the verified official pages and missing careers routes', async () => {
  const sieva = await loadSievaModule()
  assert.ok(sieva, 'Expected scraper module at ./script.js')

  assert.equal(sieva.SOURCE, 'sievanetworkssolutions')
  assert.equal(sieva.COMPANY, 'Sieva Networks Solutions')
  assert.equal(sieva.HOMEPAGE_URL, 'https://www.sievanetworks.com/')
  assert.equal(sieva.CANOPUS_URL, 'https://www.sievanetworks.com/canopus.html')
  assert.equal(sieva.IP_PORTFOLIO_URL, 'https://www.sievanetworks.com/ipportfolio.html')
  assert.deepEqual(sieva.NO_PUBLIC_CAREERS_ROUTE_URLS, [
    'https://www.sievanetworks.com/careers',
    'https://www.sievanetworks.com/careers/',
    'https://www.sievanetworks.com/jobs',
    'https://www.sievanetworks.com/jobs/',
    'https://www.sievanetworks.com/join-us',
    'https://www.sievanetworks.com/openings',
    'https://www.sievanetworks.com/work-with-us',
  ])

  assert.equal(sieva.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(sieva.hasOfficialCanopusSignal(canopusHtml), true)
  assert.equal(sieva.hasOfficialIpPortfolioSignal(ipPortfolioHtml), true)
  assert.equal(sieva.hasOfficialIpPortfolioSignal(liveLikeIpPortfolioHtml), true)
  assert.equal(sieva.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(sieva.isVerifiedMissingCareerRoute(missingCareerRoutePage), true)
})

test('Sieva Networks Solutions sentinel returns no jobs only while the verified first-party surface remains careers-free', async () => {
  const sieva = await loadSievaModule()
  assert.ok(sieva, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await sieva.createSievaNetworksSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === sieva.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === sieva.CANOPUS_URL) return { status: 200, url, html: canopusHtml }
      if (url === sieva.IP_PORTFOLIO_URL) return { status: 200, url, html: ipPortfolioHtml }
      if (sieva.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sieva.HOMEPAGE_URL,
    sieva.CANOPUS_URL,
    sieva.IP_PORTFOLIO_URL,
    ...sieva.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Sieva Networks Solutions default fetch is bounded by a timeout signal', async () => {
  const sieva = await loadSievaModule()
  assert.ok(sieva, 'Expected scraper module at ./script.js')

  let capturedInit = null
  const page = await sieva.defaultFetchPage(sieva.HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => homepageHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, sieva.HOMEPAGE_URL)
  assert.equal(page.html, homepageHtml)
  assert.equal(capturedInit.redirect, 'follow')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Sieva Networks Solutions sentinel can recover with a browser-backed fetch when direct requests only return 406 block pages', async () => {
  const sieva = await loadSievaModule()
  assert.ok(sieva, 'Expected scraper module at ./script.js')

  const browserUrls = []
  const jobs = await sieva.createSievaNetworksSolutionsScraper().run({
    fetchPage: async (url) => ({ ...blockedCareerRoutePage, url }),
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)
      if (url === sieva.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === sieva.CANOPUS_URL) return { status: 200, url, html: canopusHtml }
      if (url === sieva.IP_PORTFOLIO_URL) return { status: 200, url, html: ipPortfolioHtml }
      if (sieva.NO_PUBLIC_CAREERS_ROUTE_URLS.includes(url)) return { ...missingCareerRoutePage, url }
      throw new Error(`Unexpected browser URL: ${url}`)
    },
  })

  assert.deepEqual(browserUrls, [
    sieva.HOMEPAGE_URL,
    sieva.CANOPUS_URL,
    sieva.IP_PORTFOLIO_URL,
    ...sieva.NO_PUBLIC_CAREERS_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Sieva Networks Solutions sentinel fails closed when the verified no-public-careers surface drifts', async () => {
  const sieva = await loadSievaModule()
  assert.ok(sieva, 'Expected scraper module at ./script.js')

  await assert.rejects(
    sieva.createSievaNetworksSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === sieva.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage/i,
  )

  await assert.rejects(
    sieva.createSievaNetworksSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === sieva.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === sieva.CANOPUS_URL) return { status: 200, url, html: canopusHtml }
        if (url === sieva.IP_PORTFOLIO_URL) return { status: 200, url, html: ipPortfolioHtml }
        if (url === sieva.NO_PUBLIC_CAREERS_ROUTE_URLS[0]) return publicJobsPage
        if (sieva.NO_PUBLIC_CAREERS_ROUTE_URLS.slice(1).includes(url)) return { ...missingCareerRoutePage, url }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no-public-careers route changed/i,
  )
})
