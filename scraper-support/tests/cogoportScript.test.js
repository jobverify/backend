import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head><title>Join Cogoport for a fulfilling careers</title></head>
    <body>
      <h1>Join Team Cogoport</h1>
      <p>At Cogoport, we are re-defining Global Trade to make it simple for everyone.</p>
      <p>To apply for an opening, send your CV/Resume to careers@cogoport.com and put the role you are applying for as a subject.</p>
      <p>We are always looking for strong operators, engineers, and business builders.</p>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cogoport/script.js')
  } catch {
    assert.fail('Expected Cogoport scraper module at ../../scraper/cogoport/script.js')
  }
}

test('Cogoport sentinel validates the verified email-only careers surface', async () => {
  const cogoport = await loadModule()

  assert.equal(cogoport.CAREERS_URL, 'https://www.cogoport.com/company/careers')
  assert.equal(cogoport.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(cogoport.hasPublicJobBoardSignal(careersHtml), false)
})

test('Cogoport sentinel returns no jobs while the official page stays email-only', async () => {
  const cogoport = await loadModule()
  const requestedUrls = []

  const jobs = await cogoport.createCogoportScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [cogoport.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Cogoport sentinel fails closed when the official page starts exposing a public jobs board', async () => {
  const cogoport = await loadModule()

  await assert.rejects(
    cogoport.createCogoportScraper().run({
      fetchText: async () => '<html><body><a href="https://jobs.lever.co/cogoport">Apply now</a></body></html>',
    }),
    /verified email-apply public surface|public job board/i,
  )
})
