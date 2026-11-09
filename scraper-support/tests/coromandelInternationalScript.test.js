import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head>
      <title>Careers: Explore Job Opportunities at Coromandel &#8211; Join Us</title>
    </head>
    <body>
      <h1>Work With Us</h1>
      <p>
        We strive to create a meaningful work environment where real growth takes place at every level,
        where hard work and teamwork are the keys to achieving goals, yours and ours.
      </p>
      <style>.awsm_job_openings { padding: 120px!important; }</style>
      <h2>Visit Our Linkedin Page</h2>
      <p>To see the latest developments and to stay connected with us, follow us on LinkedIn.</p>
      <a href="https://www.linkedin.com/company/coromandel-international-limited/">Follow Us On</a>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/coromandelinternational/script.js')
  } catch {
    assert.fail('Expected Coromandel International scraper module at ../../scraper/coromandelinternational/script.js')
  }
}

test('Coromandel sentinel validates the verified first-party careers shell', async () => {
  const coromandel = await loadModule()

  assert.equal(coromandel.SOURCE, 'coromandelinternational')
  assert.equal(coromandel.COMPANY, 'Coromandel International')
  assert.equal(coromandel.CAREERS_URL, 'https://www.coromandel.biz/careers/')
  assert.equal(coromandel.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(coromandel.hasRenderedJobsSignal(careersHtml), false)
})

test('Coromandel sentinel returns no jobs while the first-party shell still exposes only the awsmjobs shortcode', async () => {
  const coromandel = await loadModule()
  const requestedUrls = []

  const jobs = await coromandel.createCoromandelInternationalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [coromandel.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Coromandel sentinel fails closed if the verified careers shell drifts', async () => {
  const coromandel = await loadModule()

  await assert.rejects(
    coromandel.createCoromandelInternationalScraper().run({
      fetchText: async () => '<html><body><h1>Work With Us</h1></body></html>',
    }),
    /verified first-party careers shell/i,
  )
})
