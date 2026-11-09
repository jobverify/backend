import assert from 'node:assert/strict'
import test from 'node:test'

const officialContactHtml = `
  <html><head><title>Joyalukkas B2B - Contact Us</title></head>
  <body><h1>Joyalukkas India Limited</h1><p>Bangalore, India</p></body></html>
`

const publicJobsHtml = `
  <html><head><title>Joyalukkas Careers</title></head>
  <body><h1>Current Openings</h1><a href="/jobs/sales-executive">Apply now</a></body></html>
`

test('Joyalukkas pins the official India contact surface as no-public-jobs', async () => {
  const scraperModule = await import('../../scraper/joyalukkas/script.js')

  assert.equal(scraperModule.SOURCE, 'joyalukkas')
  assert.equal(scraperModule.COMPANY_NAME, 'Joyalukkas')
  assert.equal(scraperModule.OFFICIAL_CAREERS_URL, 'https://b2b.joyalukkas.com/contact')
  assert.equal(scraperModule.VERIFIED_ON, '2026-07-25')
  assert.equal(scraperModule.hasVerifiedOfficialSurface(officialContactHtml), true)
  assert.equal(scraperModule.hasVerifiedOfficialSurface(publicJobsHtml), false)

  const jobs = await scraperModule.createJoyalukkasScraper().run({
    fetchText: async () => officialContactHtml,
  })
  assert.deepEqual(jobs, [])
})

test('Joyalukkas fails closed if the first-party surface exposes jobs', async () => {
  const scraperModule = await import('../../scraper/joyalukkas/script.js')

  await assert.rejects(
    scraperModule.createJoyalukkasScraper().run({
      fetchText: async () => publicJobsHtml,
    }),
    /surface changed materially/i,
  )
})
