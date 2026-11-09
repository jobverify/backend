import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Meditab</title>
  </head>
  <body>
    <main>
      <h1>Find your Next Career</h1>
      <h2>Students and recent graduates</h2>
      <p>We are currently looking for brilliant individuals who can make an impact on health care.</p>
      <p>Apply Now</p>
      <h2>Technology professionals</h2>
      <p>We are currently looking for a brilliant project manager for our rapidly growing health care technology business.</p>
      <p>Apply Now</p>
      <h3>Careers India</h3>
      <p>If interested, forward your resume to recruitment@meditab.com</p>
      <p>Call us +91 9099996849/ +91 9099996813</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/meditabsoftware/script.js')
  } catch {
    assert.fail('Expected Meditab Software scraper module at ../../scraper/meditabsoftware/script.js')
  }
}

test('Meditab Software helpers stay pinned to the verified first-party careers page with no public job records', async () => {
  const meditabSoftware = await loadModule()

  assert.equal(meditabSoftware.SOURCE, 'meditabsoftware')
  assert.equal(meditabSoftware.COMPANY, 'Meditab Software')
  assert.equal(meditabSoftware.CAREERS_URL, 'https://www.meditab.com/company/our-careers')
  assert.equal(meditabSoftware.VERIFIED_ON, '2026-07-17')
  assert.equal(meditabSoftware.hasVerifiedCareersSignal(verifiedCareersHtml), true)
  assert.equal(meditabSoftware.hasNoPublicJobRecordsSignal(verifiedCareersHtml), true)
})

test('Meditab Software returns no jobs while the verified careers page remains an intake-only surface', async () => {
  const meditabSoftware = await loadModule()
  const requestedUrls = []

  const jobs = await meditabSoftware.createMeditabSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [meditabSoftware.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Meditab Software fails closed when the verified page drifts or starts exposing public job records', async () => {
  const meditabSoftware = await loadModule()

  await assert.rejects(
    meditabSoftware.createMeditabSoftwareScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified Meditab careers page/i,
  )

  await assert.rejects(
    meditabSoftware.createMeditabSoftwareScraper().run({
      fetchText: async () => verifiedCareersHtml.replace(
        '<p>Apply Now</p>',
        '<a href="https://jobs.example.com/project-manager">Apply Now</a>',
      ),
    }),
    /public job records/i,
  )
})
