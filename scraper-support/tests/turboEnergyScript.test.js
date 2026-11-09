import assert from 'node:assert/strict'
import test from 'node:test'

const loadTurboEnergyModule = async () => {
  try {
    return await import('../../scraper/turboenergy/script.js')
  } catch {
    assert.fail('Expected Turbo Energy scraper module at ../../scraper/turboenergy/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Turbochargers | Turbocharger Manufacturers India | Turbocharging Systems | Air Management | Charging & Engine Boosting Systems India - Turbo Energy Private Ltd (TEL)</title>
  </head>
  <body>
    <main>
      <p>TURBO ENERGY PRIVATE LIMITED (TEL), a leading name in the manufacturing of turbochargers, has become synonymous with quality, affordability and dependability.</p>
    </main>
    <footer>
      <a href="https://www.turboenergy.co.in/careers/">Careers</a>
      <p>COPYRIGHT © 2025 TURBO ENERGY PRIVATE LIMITED</p>
    </footer>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - TURBO ENERGY PRIVATE LIMITED</title>
  </head>
  <body>
    <header>
      <a href="/">Home</a>
      <a href="/company/about-tel/">About TEL</a>
      <a href="/company/manufacturing-and-quality/">Manufacturing and Quality</a>
      <a href="/company/sustainability-and-csr/">Sustainability and CSR</a>
      <a href="/contact-us/">CONTACT US</a>
    </header>
    <main></main>
    <footer>
      <h2>Company</h2>
      <a href="/company/about-tel/">About TEL</a>
      <a href="/company/manufacturing-and-quality/">Manufacturing and Quality</a>
      <a href="/company/sustainability-and-csr/">Sustainability and CSR</a>
      <h2>PRODUCT &amp; TECHNOLOGY</h2>
      <h2>Partner Zone</h2>
      <a href="/careers/">Careers</a>
      <a href="/contact-us/">CONTACT US</a>
      <p>COPYRIGHT © 2025 TURBO ENERGY PRIVATE LIMITED</p>
    </footer>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; TURBO ENERGY PRIVATE LIMITED</title>
  </head>
  <body>
    <header>
      <a href="/">Home</a>
      <a href="/company/about-tel/">About TEL</a>
      <a href="/company/manufacturing-and-quality/">Manufacturing and Quality</a>
      <a href="/company/sustainability-and-csr/">Sustainability and CSR</a>
      <a href="/product-and-technology/">Product and Technology</a>
      <a href="/partner-zone/">Partner Zone</a>
      <a href="/contact-us/">CONTACT US</a>
    </header>
    <main>
      <p>The success story of https://au-clubhouse.com begins with a consistent focus on the needs of players.</p>
      <p>Cashback promotions refund a percentage of losses at the end of the gaming week.</p>
    </main>
    <footer>
      <h2>Company</h2>
      <a href="/company/about-tel/">About TEL</a>
      <a href="/company/manufacturing-and-quality/">Manufacturing and Quality</a>
      <a href="/company/sustainability-and-csr/">Sustainability and CSR</a>
      <h2>Product and Technology</h2>
      <a href="/aftermarket/">Aftermarket</a>
      <a href="/careers/">Careers</a>
      <a href="/awards/">Awards</a>
      <a href="/downloads/">Downloads</a>
      <a href="/vendor-opportunities/">Vendor Opportunities</a>
      <a href="/contact-us/">CONTACT US</a>
      <p>COPYRIGHT © 2025 TURBO ENERGY PRIVATE LIMITED</p>
    </footer>
  </body>
</html>
`

const careersWithPublicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - TURBO ENERGY PRIVATE LIMITED</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="/careers/senior-design-engineer/">Senior Design Engineer</a>
      <a href="/careers/apply-now/">Apply now</a>
    </main>
    <footer>
      <p>COPYRIGHT © 2025 TURBO ENERGY PRIVATE LIMITED</p>
    </footer>
  </body>
</html>
`

test('Turbo Energy validates the verified homepage identity and empty careers shell', async () => {
  const turboEnergy = await loadTurboEnergyModule()

  assert.equal(turboEnergy.SOURCE, 'turboenergy')
  assert.equal(turboEnergy.COMPANY, 'Turbo Energy')
  assert.equal(turboEnergy.HOMEPAGE_URL, 'https://www.turboenergy.co.in/')
  assert.equal(turboEnergy.CAREERS_URL, 'https://www.turboenergy.co.in/careers/')
  assert.equal(turboEnergy.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(turboEnergy.hasOfficialCareersShellSignal(officialCareersHtml), true)
  assert.equal(turboEnergy.hasOfficialCareersShellSignal(currentCareersHtml), true)
  assert.equal(turboEnergy.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(turboEnergy.hasPublicJobBoardSignal(careersWithPublicJobsHtml), true)
})

test('Turbo Energy returns no jobs while the official careers page stays in the verified empty-shell state', async () => {
  const turboEnergy = await loadTurboEnergyModule()
  const requestedUrls = []

  const jobs = await turboEnergy.createTurboEnergyScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === turboEnergy.HOMEPAGE_URL) return officialHomepageHtml
      if (url === turboEnergy.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    turboEnergy.HOMEPAGE_URL,
    turboEnergy.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Turbo Energy returns no jobs while the current August 20, 2026 careers shell stays public-job-free', async () => {
  const turboEnergy = await loadTurboEnergyModule()

  const jobs = await turboEnergy.createTurboEnergyScraper().run({
    fetchText: async (url) => {
      if (url === turboEnergy.HOMEPAGE_URL) return officialHomepageHtml
      if (url === turboEnergy.CAREERS_URL) return currentCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Turbo Energy fails closed when the homepage identity breaks or the careers page starts listing jobs', async () => {
  const turboEnergy = await loadTurboEnergyModule()

  await assert.rejects(
    turboEnergy.createTurboEnergyScraper().run({
      fetchText: async (url) => {
        if (url === turboEnergy.HOMEPAGE_URL) {
          return '<html><head><title>Another Company</title></head><body><p>Unrelated homepage</p></body></html>'
        }
        if (url === turboEnergy.CAREERS_URL) {
          return officialCareersHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Turbo Energy homepage no longer matches the verified careers handoff/i,
  )

  await assert.rejects(
    turboEnergy.createTurboEnergyScraper().run({
      fetchText: async (url) => {
        if (url === turboEnergy.HOMEPAGE_URL) return officialHomepageHtml
        if (url === turboEnergy.CAREERS_URL) return careersWithPublicJobsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Turbo Energy careers page now appears to expose public job listings/i,
  )
})
