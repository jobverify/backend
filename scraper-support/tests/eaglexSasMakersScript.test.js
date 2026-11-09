import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <head><title>Eagle X | We Engineer Dominance</title></head>
    <body>
      <p>Elite software engineering studio systems</p>
      <h1>Eagle x</h1>
      <p>We Engineer Dominance</p>
      <p>Architecting ultra-resilient digital infrastructure for the next generation of unicorn founders.</p>
      <p>We build platforms that scale flawlessly from day one.</p>
      <p>Enterprise deployment</p>
      <p>eaglexdevelopment@gmail.com</p>
      <p>Indore, Madhya Pradesh, India</p>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <head><title>Eagle X | We Engineer Dominance</title></head>
    <body>
      <h1>System Identity</h1>
      <p>The Architects Of The New Order</p>
      <p>We are not just a dev shop.</p>
      <p>We are a high-performance engineering unit dedicated to building digital dominance.</p>
      <p>While others follow trends, we forge the infrastructure that defines them.</p>
      <p>50+ // Projects Deployed</p>
      <p>08+ // Global Partners</p>
      <p>Ready to Deploy? Join the elite.</p>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <head><title>Eagle X | We Engineer Dominance</title></head>
    <body>
      <h1>Get In Touch</h1>
      <p>Contact Us</p>
      <p>We'd love to hear from you. Send us a message and we'll get back to you within 24 hours.</p>
      <p>Delhi, India</p>
      <p>Support Team</p>
      <p>Send Message</p>
      <p>Building professional web solutions for early-stage startups.</p>
      <p>Part of our 2026 launch initiative supporting the entrepreneurial ecosystem.</p>
      <p>eaglexdevelopment@gmail.com</p>
    </body>
  </html>
`

const missingCareersHtml = `
  <html>
    <head><title>404: This page could not be found.</title></head>
    <body>
      <h1>404</h1>
      <p>This page could not be found.</p>
      <p>Building professional web solutions for early-stage startups.</p>
      <p>Part of our 2026 launch initiative supporting the entrepreneurial ecosystem.</p>
      <p>Email Us eaglexdevelopment@gmail.com</p>
      <p>Location Indore, Madhya Pradesh, India</p>
    </body>
  </html>
`

test('Eaglex accepts the current about-page marketing surface without the removed legacy "the operatives" copy', async () => {
  const eaglex = await import('../../scraper/eaglexsasmakerspvtltd/script.js')

  assert.equal(eaglex.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(eaglex.hasOfficialAboutPageSignal(aboutHtml), true)
  assert.equal(eaglex.hasOfficialContactPageSignal(contactHtml), true)
  assert.equal(
    eaglex.isVerifiedMissingCareersRoute({
      status: 404,
      html: missingCareersHtml,
    }),
    true,
  )
})

test('Eaglex returns [] when the verified marketing surfaces remain live and careers routes still 404', async () => {
  const eaglex = await import('../../scraper/eaglexsasmakerspvtltd/script.js')
  const pageMap = new Map([
    [eaglex.HOMEPAGE_URL, { status: 200, url: eaglex.HOMEPAGE_URL, html: homepageHtml }],
    [eaglex.ABOUT_URL, { status: 200, url: eaglex.ABOUT_URL, html: aboutHtml }],
    [eaglex.CONTACT_URL, { status: 200, url: eaglex.CONTACT_URL, html: contactHtml }],
    ...eaglex.CAREERS_ROUTE_URLS.map((url) => [url, { status: 404, url, html: missingCareersHtml }]),
  ])

  const jobs = await eaglex.createEaglexSasMakersScraper().run({
    fetchPage: async (url) => {
      const page = pageMap.get(url)
      if (!page) {
        throw new Error(`Unexpected Eaglex URL: ${url}`)
      }
      return page
    },
  })

  assert.deepEqual(jobs, [])
})


test('EagleX accepts its branded redesigned missing careers pages and rejects unverified replacements', async () => {
  const eaglex = await import('../../scraper/eaglexsasmakerspvtltd/script.js')
  const redesigned404 = missingCareersHtml.replace('Indore, Madhya Pradesh, India', 'Global / Remote Studio')
    .replace('</body>', '<p>EagleX | The Team That Builds, Guards &amp; Grows</p><script type="application/ld+json">{"@type":"Organization","@id":"https://eagle-x.in/#organization","name":"EagleX","alternateName":["Eagle X Systems"]}</script></body>')
  assert.equal(eaglex.isVerifiedMissingCareersRoute({ status: 404, html: redesigned404 }), true)
  assert.equal(eaglex.isVerifiedMissingCareersRoute({ status: 503, html: redesigned404 }), false)
  assert.equal(eaglex.isVerifiedMissingCareersRoute({ status: 404, html: redesigned404.replace('https://eagle-x.in/#organization', 'https://unrelated.example/#organization') }), false)
  assert.equal(eaglex.isVerifiedMissingCareersRoute({ status: 404, html: redesigned404 + '<a href="/jobs">Jobs</a>' }), false)
})
