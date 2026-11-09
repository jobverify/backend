import assert from 'node:assert/strict'
import test from 'node:test'

const loadSmartworksModule = async () => {
  try {
    return await import('../../scraper/smartworks/script.js')
  } catch {
    assert.fail('Expected Smartworks scraper module at ../../scraper/smartworks/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Smartworks</title>
  </head>
  <body>
    <main>
      <h1>Careers at Smartworks</h1>
      <p>Build the future of managed workspaces with us.</p>
      <a href="https://www.smartworksoffice.com/careers/smartworks-latest-jobs-opening">View Open Positions</a>
      <a href="mailto:careers@sworks.co.in">careers@sworks.co.in</a>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at Smartworks - Join Our Innovative Team | Smartworks Jobs Opening</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Your journey to grow, innovate, and make an impact starts here.</p>
      <p>At Smartworks, every idea counts, and every talent is celebrated.</p>
      <a href="#join-now">Join Now</a>
      <p>Equal Opportunity Employer</p>
      <p>Diverse &amp; Inclusive</p>
      <p>Learning &amp; Development</p>
      <a href="https://www.smartworksoffice.com/careers/smartworks-latest-jobs-opening">View Open Positions</a>
      <h2>Life @Smartworks</h2>
    </main>
  </body>
</html>
`

test('extractSearchResults returns no jobs when Smartworks only exposes a generic careers CTA and email apply flow', async () => {
  const smartworks = await loadSmartworksModule()

  assert.equal(smartworks.CAREERS_URL, 'https://www.smartworksoffice.com/careers/')
  assert.equal(smartworks.JOBS_URL, 'https://www.smartworksoffice.com/careers/smartworks-latest-jobs-opening')
  assert.equal(smartworks.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(smartworks.hasPublicJobBoardSignal(careersHtml), false)
  assert.deepEqual(smartworks.extractSearchResults(careersHtml), [])
})

test('Smartworks accepts the current official careers landing page shell', async () => {
  const smartworks = await loadSmartworksModule()

  assert.equal(smartworks.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(smartworks.hasPublicJobBoardSignal(currentCareersHtml), false)
})

test('run validates the verified Smartworks careers surface and returns an empty result set', async () => {
  const smartworks = await loadSmartworksModule()
  const requestedUrls = []

  const jobs = await smartworks.createSmartworksScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === smartworks.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Smartworks fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [smartworks.CAREERS_URL])
  assert.deepEqual(jobs, [])
})
