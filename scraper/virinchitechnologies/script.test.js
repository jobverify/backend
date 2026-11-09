import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createVirinchiTechnologiesScraper,
  hasNoPublicJobListingsSignal,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
  <html>
    <head><title>.:: Welcome to Virinchi ::.</title></head>
    <body>
      <div>Contact Us | Sitemap Careers</div>
      <div>Corporate Website Join Us Products and Solutions Services Investor Relations</div>
      <h1>Welcome to Virinchi! Your Extended IT Arm</h1>
      <p>Virinchi is always looking to recruit exceptionally bright and outstanding people.</p>
      <a href="http://www.virinchigroup.com/ksoft/profSignup.php">Profile Sign Up</a>
      <p>SEND YOUR RESUME TO: virinchi2015@gmail.com</p>
    </body>
  </html>
`

test('Virinchi recognizes the current corporate careers shell and stays fail-closed without public job listings', async () => {
  assert.equal(CAREERS_URL, 'https://www.virinchi.com/careers.php')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasNoPublicJobListingsSignal(careersHtml), true)

  const jobs = await createVirinchiTechnologiesScraper().run({
    fetchText: async () => careersHtml,
  })

  assert.deepEqual(jobs, [])
})
