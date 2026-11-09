import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
  <html lang="en">
    <head>
      <title>Join Our Team | Careers at Khazana Jewellery</title>
    </head>
    <body>
      <h3>OUR POLICY</h3>
      <p>To recruit a deserving candidate who performs with active retention measures through professional training.</p>
      <h3>COME JOIN US!</h3>
      <p>You can contact careers@khazanajewellery.com to apply at Khazana Jewellery Pvt. Ltd.</p>
    </body>
  </html>
`

const cloudflareInterstitialHtml = `
  <html lang="en">
    <head>
      <title>Just a moment...</title>
    </head>
    <body>
      <h1>Enable JavaScript and cookies to continue</h1>
      <script>window._cf_chl_opt = { cZone: 'www.khazanajewellery.com' }</script>
    </body>
  </html>
`

const currentCareersPageHtml = `
  <html lang="en">
    <head>
      <title>Join Our Team | Careers at Khazana Jewellery</title>
      <meta
        name="description"
        content="Explore exciting job openings, career growth opportunities, and work culture at Khazana Jewellery across India."
      />
    </head>
    <body>
      <h3>OUR POLICY</h3>
      <p>To recruit a deserving candidate who performs with active retention measures through professional training.</p>
      <h3>COME JOIN US!</h3>
      <p>You can contact careers@khazanajewellery.com to apply at Khazana Jewellery Pvt. Ltd.</p>
    </body>
  </html>
`

const maintenancePageHtml = `
  <html lang="en">
    <body>
      <h1>We&rsquo;ll be back soon</h1>
      <p>Khazana Jewellery is currently down for scheduled maintenance until 11:59 PM on 16th August 2026.</p>
    </body>
  </html>
`

const publicJobsHtml = `
  <html lang="en">
    <head>
      <title>Khazana Jewellery Careers</title>
    </head>
    <body>
      <h1>Current Openings</h1>
      <a href="/jobs/sales-associate">Apply now</a>
    </body>
  </html>
`

const loadKhazanaJewelleryModule = async () => {
  try {
    return await import('../../scraper/khazanajewellery/script.js')
  } catch {
    assert.fail('Expected Khazana Jewellery scraper module at ../../scraper/khazanajewellery/script.js')
  }
}

test('Khazana Jewellery pins the verified email-only careers surface and Cloudflare fallback contract', async () => {
  const khazanaJewellery = await loadKhazanaJewelleryModule()

  assert.equal(khazanaJewellery.SOURCE, 'khazanajewellery')
  assert.equal(khazanaJewellery.COMPANY_NAME, 'Khazana Jewellery')
  assert.equal(khazanaJewellery.OFFICIAL_BRAND_NAME, 'Khazana Jewellery')
  assert.equal(khazanaJewellery.HOMEPAGE_URL, 'https://www.khazanajewellery.com/')
  assert.equal(khazanaJewellery.OFFICIAL_CAREERS_URL, 'https://www.khazanajewellery.com/careers.html')
  assert.equal(khazanaJewellery.CAREERS_APPLY_EMAIL, 'careers@khazanajewellery.com')
  assert.equal(khazanaJewellery.VERIFIED_ON, '2026-08-17')
  assert.equal(khazanaJewellery.hasKhazanaCareersSignal(careersPageHtml), true)
  assert.equal(khazanaJewellery.hasKhazanaCareersSignal(currentCareersPageHtml), true)
  assert.equal(khazanaJewellery.hasKhazanaCareersSignal('<html><body>Contact us</body></html>'), false)
  assert.equal(khazanaJewellery.isCloudflareInterstitial(cloudflareInterstitialHtml), true)
  assert.equal(khazanaJewellery.isCloudflareInterstitial(careersPageHtml), false)
  assert.equal(khazanaJewellery.hasScheduledMaintenanceSignal(maintenancePageHtml), true)
  assert.equal(khazanaJewellery.hasPublicJobsSignal(careersPageHtml), false)
  assert.equal(khazanaJewellery.hasPublicJobsSignal(currentCareersPageHtml), false)
  assert.equal(khazanaJewellery.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Khazana Jewellery returns [] while the verified first-party careers surface exposes no structured public jobs', async () => {
  const khazanaJewellery = await loadKhazanaJewelleryModule()
  const requestedUrls = []

  const jobs = await khazanaJewellery.createKhazanaJewelleryScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === khazanaJewellery.OFFICIAL_CAREERS_URL) return currentCareersPageHtml
      throw new Error(`Unexpected Khazana Jewellery URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [khazanaJewellery.OFFICIAL_CAREERS_URL])
  assert.deepEqual(jobs, [])

  const cloudflareJobs = await khazanaJewellery.createKhazanaJewelleryScraper().run({
    fetchText: async () => cloudflareInterstitialHtml,
  })

  assert.deepEqual(cloudflareJobs, [])

  const maintenanceJobs = await khazanaJewellery.createKhazanaJewelleryScraper().run({
    fetchText: async () => maintenancePageHtml,
  })

  assert.deepEqual(maintenanceJobs, [])
})

test('Khazana Jewellery fails closed if the verified careers page turns into a public jobs surface', async () => {
  const khazanaJewellery = await loadKhazanaJewelleryModule()

  await assert.rejects(
    khazanaJewellery.createKhazanaJewelleryScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /appears to expose public jobs/i,
  )
})
