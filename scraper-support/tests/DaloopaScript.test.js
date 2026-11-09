import assert from 'node:assert/strict'
import test from 'node:test'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>We're here to solve tough challenges with great people.</p>
    <a href="/demo">Request a Demo</a>
    <a href="/signup">Create Free Account</a>
    <a href="/login">Log In</a>
    <p>hello@daloopa.com</p>
    <p>122 East 42nd St, 14th Floor, New York, NY 10168</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/daloopa/script.js')
  } catch {
    assert.fail('Expected Daloopa scraper module at ../../scraper/daloopa/script.js')
  }
}

test('Daloopa sentinel stays pinned to the verified careers landing page without public role cards', async () => {
  const daloopa = await loadModule()

  assert.equal(daloopa.SOURCE, 'daloopa')
  assert.equal(daloopa.COMPANY, 'Daloopa')
  assert.equal(daloopa.OFFICIAL_BRAND_NAME, 'Daloopa')
  assert.equal(daloopa.CAREERS_URL, 'https://daloopa.com/careers')
  assert.equal(daloopa.VERIFIED_ON, '2026-07-17')
  assert.equal(daloopa.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(daloopa.hasPublicJobsSignal(careersPageHtml), false)
  assert.equal(
    daloopa.hasPublicJobsSignal('<a href="https://daloopa.com/careers/software-engineer">Apply now</a>'),
    true,
  )
})

test('Daloopa sentinel returns [] only while the verified careers page has no public role cards', async () => {
  const daloopa = await loadModule()
  const jobs = await daloopa.createDaloopaScraper().run({
    fetchText: async (url) => {
      assert.equal(url, daloopa.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('Daloopa sentinel fails closed when public job cards appear on the verified first-party page', async () => {
  const daloopa = await loadModule()

  await assert.rejects(
    daloopa.createDaloopaScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Careers</h1>
            <a href="/careers/software-engineer">Software Engineer</a>
            <a href="/careers/software-engineer/apply">Apply now</a>
          </body>
        </html>
      `,
    }),
    /verified Daloopa careers page/i,
  )
})
