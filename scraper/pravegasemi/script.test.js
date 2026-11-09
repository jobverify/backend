import assert from 'node:assert/strict'
import test from 'node:test'

const loadPravegaSemiModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <label>Name</label>
      <label>Email</label>
      <label>Phone Number</label>
      <label>Department</label>
      <p>AMS Verification Digital Verification RTL Analog Layout Design DFT Physical Design Embedded Design</p>
      <label>Experience</label>
      <p>Fresher 1 year 2 years 3 years</p>
      <label>Upload your CV</label>
      <h3>Join us for exiting careers in cutting-edge semiconductor technology and engineering.</h3>
      <p>Reach out to us with your CV/resume, and we will get back to you if your profile matches our requirements.</p>
      <p>Email: career@pravegasemi.com</p>
      <p>Phone Number: +91 90363 98006</p>
    </main>
  </body>
</html>
`

const officialContactHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Contact Us</h1>
      <p>PravegaSemi Private Limited</p>
      <p>Bhive Workspace, HSR Layout, Bengaluru, Karnataka 560102</p>
      <p>sales@pravegasemi.com</p>
      <p>career@pravegasemi.com</p>
    </main>
  </body>
</html>
`

test('PravegaSemi validates the verified resume-drop careers surface and first-party identity', async () => {
  const pravegaSemi = await loadPravegaSemiModule()
  assert.ok(pravegaSemi, 'Expected PravegaSemi scraper module at ./script.js')

  assert.equal(pravegaSemi.CAREERS_URL, 'https://pravegasemi.com/careers/')
  assert.equal(pravegaSemi.CONTACT_URL, 'https://pravegasemi.com/contact/')
  assert.equal(pravegaSemi.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(pravegaSemi.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(pravegaSemi.hasOfficialIdentitySignal(officialContactHtml), true)
  assert.equal(pravegaSemi.hasOfficialIdentitySignal('<html><body><p>Contact</p></body></html>'), false)
  assert.equal(pravegaSemi.hasPublicJobBoardSignal(officialCareersHtml), false)
  assert.equal(
    pravegaSemi.hasPublicJobBoardSignal('<html><body><a href="/jobs/soc-design-engineer">Apply Now</a></body></html>'),
    true,
  )
})

test('PravegaSemi returns no jobs for the verified resume-drop careers surface', async () => {
  const pravegaSemi = await loadPravegaSemiModule()
  assert.ok(pravegaSemi, 'Expected PravegaSemi scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await pravegaSemi.createPravegaSemiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return url === pravegaSemi.CAREERS_URL ? officialCareersHtml : officialContactHtml
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://pravegasemi.com/careers/',
    'https://pravegasemi.com/contact/',
  ])
  assert.deepEqual(jobs, [])
})

test('PravegaSemi fails closed when the careers surface changes, the identity page changes, or public jobs appear', async () => {
  const pravegaSemi = await loadPravegaSemiModule()
  assert.ok(pravegaSemi, 'Expected PravegaSemi scraper module at ./script.js')

  await assert.rejects(
    pravegaSemi.createPravegaSemiScraper().run({
      fetchText: async (url) =>
        url === pravegaSemi.CAREERS_URL
          ? '<html><body><h1>Careers</h1><p>Placeholder</p></body></html>'
          : officialContactHtml,
    }),
    /PravegaSemi careers page no longer matches the verified public no-listings surface/i,
  )

  await assert.rejects(
    pravegaSemi.createPravegaSemiScraper().run({
      fetchText: async (url) =>
        url === pravegaSemi.CAREERS_URL
          ? `
            <html>
              <body>
                <label>Upload your CV</label>
                <p>Digital Verification</p>
                <p>Physical Design</p>
                <h3>Join us for exiting careers in cutting-edge semiconductor technology and engineering.</h3>
                <p>Reach out to us with your CV/resume.</p>
                <p>career@pravegasemi.com</p>
                <a href="/jobs/soc-design-engineer">Apply Now</a>
              </body>
            </html>
          `
          : officialContactHtml,
    }),
    /PravegaSemi careers page now appears to expose public job listings/i,
  )

  await assert.rejects(
    pravegaSemi.createPravegaSemiScraper().run({
      fetchText: async (url) =>
        url === pravegaSemi.CAREERS_URL
          ? officialCareersHtml
          : '<html><body><h1>Contact</h1><p>sales@pravegasemi.com</p></body></html>',
    }),
    /PravegaSemi contact page no longer confirms the verified first-party company identity/i,
  )
})
