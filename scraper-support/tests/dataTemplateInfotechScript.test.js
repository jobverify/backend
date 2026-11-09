import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Data Template | Build Your Future With Us</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Filters - All Current openings Build your future with us Life at Data Template</p>
      <p>Reach us at careers@datatemplate.com</p>
      <h2>Current openings</h2>
      <p>Ready to grow, innovate, and make an impact?</p>
      <p>Explore opportunities at Data Template and discover a workplace where you can learn, contribute, and grow with purpose.</p>
      <p>Data Template Infotech</p>
      <p>Bangalore 560068, India</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/datatemplateinfotech/script.js')
  } catch {
    assert.fail('Expected Data Template Infotech scraper module at ../../scraper/datatemplateinfotech/script.js')
  }
}

test('Data Template Infotech helpers stay pinned to the verified first-party careers page with no public job records', async () => {
  const dataTemplateInfotech = await loadModule()

  assert.equal(dataTemplateInfotech.SOURCE, 'datatemplateinfotech')
  assert.equal(dataTemplateInfotech.COMPANY, 'Data Template Infotech')
  assert.equal(dataTemplateInfotech.CAREERS_URL, 'https://www.datatemplate.com/en/careers/')
  assert.equal(dataTemplateInfotech.VERIFIED_ON, '2026-07-17')
  assert.equal(dataTemplateInfotech.hasVerifiedCareersSignal(verifiedCareersHtml), true)
  assert.equal(dataTemplateInfotech.hasNoPublicJobRecordsSignal(verifiedCareersHtml), true)
})

test('Data Template Infotech returns no jobs while the verified first-party careers page still lacks public job records', async () => {
  const dataTemplateInfotech = await loadModule()
  const requestedUrls = []

  const jobs = await dataTemplateInfotech.createDataTemplateInfotechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [dataTemplateInfotech.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Data Template Infotech fails closed when the verified page drifts or starts exposing public job records', async () => {
  const dataTemplateInfotech = await loadModule()

  await assert.rejects(
    dataTemplateInfotech.createDataTemplateInfotechScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Data Template Infotech careers page/i,
  )

  await assert.rejects(
    dataTemplateInfotech.createDataTemplateInfotechScraper().run({
      fetchText: async () => verifiedCareersHtml.replace(
        '<p>Ready to grow, innovate, and make an impact?</p>',
        '<a href="/jobs/devops-engineer">DevOps Engineer</a>',
      ),
    }),
    /public job records/i,
  )
})
