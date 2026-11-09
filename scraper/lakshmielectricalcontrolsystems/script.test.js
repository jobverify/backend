import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CONTACT_URL,
  HOMEPAGE_URL,
  createLakshmiElectricalControlSystemsScraper,
  hasOfficialContactSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const HOMEPAGE_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Control Panel Manufacturers | Smart meter Manufacturers - LECS Ltd</title>
</head>
<body>
  <h1>Lakshmi Electrical Control Systems Limited (LECS)</h1>
  <section>Control Panels</section>
  <section>Engineering Plastic Components</section>
  <section>Smart Meters</section>
  <section>Industries We Serve</section>
  <section>Factory Address Lakshmi Electrical Control Systems Limited</section>
  <section>Arasur, Coimbatore - 641 407 Tamilnadu, India</section>
  <section>info@lecsindia.com</section>
</body>
</html>`

const CONTACT_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Circuit breaker Manufacturers | Plastic parts Manufacturers - Contact Us</title>
</head>
<body>
  <h1>Contact Us</h1>
  <section>Get in touch</section>
  <section>Factory Address</section>
  <section>Arasur, Coimbatore - 641 407 Tamilnadu, India</section>
  <section>Phone: +91-422-6616500</section>
  <section>info@lecsindia.com</section>
</body>
</html>`

const CAREERS_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>Careers | LECS India</title>
</head>
<body>
  <nav>Menu Home About Us Product Industries Investors Partner with Us Photo Gallery Careers News Contact Us LECS</nav>
  <h1>Careers | LECS India</h1>
</body>
</html>`

test('Lakshmi Electrical Control Systems verifies the official homepage and contact shells', () => {
  assert.equal(hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(hasOfficialContactSignal(CONTACT_HTML), true)
})

test('Lakshmi Electrical Control Systems falls back to the extended-timeout fetch on timeout errors', async () => {
  const requestedByExtendedFetch = []

  const scraper = createLakshmiElectricalControlSystemsScraper()
  const jobs = await scraper.run({
    fetchText: async () => {
      throw new Error('The operation was aborted due to timeout')
    },
    fetchTextWithExtendedTimeout: async (url) => {
      requestedByExtendedFetch.push(url)
      if (url === HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === CAREERS_URL) return CAREERS_HTML
      if (url === CONTACT_URL) return CONTACT_HTML
      throw new Error(`Unexpected extended-timeout fetch for ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedByExtendedFetch, [HOMEPAGE_URL, CAREERS_URL, CONTACT_URL])
})
