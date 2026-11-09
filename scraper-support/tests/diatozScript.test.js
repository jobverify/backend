import assert from 'node:assert/strict'
import test from 'node:test'

const loadDiatozModule = async () => {
  try {
    return await import('../../scraper/diatoz/script.js')
  } catch {
    assert.fail('Expected DIATOZ scraper module at ../../scraper/scraper/diatoz/script.js')
  }
}

const careerPageHtml = `
  <html>
    <head>
      <title>Careers | DIATOZ</title>
    </head>
    <body>
      <section>
        <h2>Ready to Build With Us?</h2>
        <p>We'd love to hear from you.</p>
        <button>Apply Now</button>
      </section>
    </body>
  </html>
`

test('run returns no jobs when DIATOZ exposes an apply page without public opening records', async () => {
  const diatoz = await loadDiatozModule()
  const requestedUrls = []

  assert.equal(diatoz.hasCareerPageSignal(careerPageHtml), true)

  const jobs = await diatoz.createDiatozScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, diatoz.CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [diatoz.CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
