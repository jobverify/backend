import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Infiniti Software Solutions scraper module at ./script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Travel Tech Jobs &amp; Careers at Infiniti Software Solutions</title>
  </head>
  <body>
    <h1>Dream Bold. Fly Higher. With Infiniti.</h1>
    <h2>Explore Job Opportunities</h2>

    <div class="elementor-widget-heading">
      <h2 class="elementor-heading-title elementor-size-default">Customer Success Manager</h2>
    </div>
    <div class="elementor-widget-text-editor">
      <p>Build long-term customer relationships and drive adoption.</p>
    </div>
    <div class="elementor-icon-box-title"><span>10+ Years</span></div>
    <div class="elementor-icon-box-title"><span>Chennai</span></div>
    <a class="elementor-button" href="https://app.goodfit.so/apply/G540dcuX">Apply</a>

    <div class="elementor-widget-heading">
      <h2 class="elementor-heading-title elementor-size-default">Business Development Manager</h2>
    </div>
    <div class="elementor-widget-text-editor">
      <p>Drive growth through strategic partnerships and client acquisition.</p>
    </div>
    <div class="elementor-icon-box-title"><span>5 - 8 Years</span></div>
    <div class="elementor-icon-box-title"><span>Mumbai</span></div>
    <a class="elementor-button" href="https://app.goodfit.so/apply/oJTXLABJ">Apply</a>
  </body>
</html>
`

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Travel Tech Jobs &amp; Careers at Infiniti Software Solutions</title>
  </head>
  <body>
    <h1>Explore Job Opportunities</h1>
    <a href="https://app.goodfit.so/apply/G540dcuX">Apply</a>
  </body>
</html>
`

test('Infiniti Software Solutions validates the current first-party shell and parses live-style job cards', async () => {
  const infiniti = await loadModule()

  assert.equal(infiniti.SOURCE, 'infinitisoftwaresolutions')
  assert.equal(infiniti.COMPANY, 'Infiniti Software Solutions')
  assert.equal(infiniti.CAREERS_URL, 'https://www.infinitisoftware.net/careers/')
  assert.equal(infiniti.hasOfficialCareersSignal(careersHtml), true)

  const jobs = infiniti.extractJobs(careersHtml)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Customer Success Manager')
  assert.equal(jobs[0].location, 'Chennai, India')
  assert.equal(jobs[0].jobId, 'G540dcuX')
  assert.equal(jobs[1].location, 'Mumbai, India')
})

test('Infiniti Software Solutions fails clearly when its HTTP careers request fails', async () => {
  const infiniti = await loadModule()
  const requestedPrimaryUrls = []

  await assert.rejects(
    infiniti.createInfinitiSoftwareSolutionsScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedPrimaryUrls.push(url)
      throw new TypeError('fetch failed | Connect Timeout Error')
    },
    }),
    /Infiniti Software Solutions API-only scraper could not fetch its careers page: fetch failed \| Connect Timeout Error/,
  )

  assert.deepEqual(requestedPrimaryUrls, [infiniti.CAREERS_URL])
})

test('Infiniti Software Solutions fails clearly when HTTP returns a JavaScript-only careers shell', async () => {
  const infiniti = await loadModule()

  await assert.rejects(
    infiniti.createInfinitiSoftwareSolutionsScraper().run({
      fetchText: async () => careersShellHtml,
    }),
    /Infiniti Software Solutions API-only scraper received an unusable JavaScript-only careers shell/,
  )
})
