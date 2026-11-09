import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Enterprise-grade AI-native Customer eXperience platform for revenue growth | Engati</title>
  </head>
  <body>
    <h1>Drive Revenue Growth across your Customer eXperience lifecycle</h1>
    <a href="https://www.engati.com/careers">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Engati</title>
  </head>
  <body>
    <p>Check out our current openings or drop us a note at <a href="mailto:careers@engati.com">careers@engati.com</a></p>
    <form action="/search"><input type="search" name="query"></form>
    <div class="w-dyn-empty"><div>No items found.</div></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/engati/script.js')
  } catch {
    assert.fail('Expected Engati scraper module at ../../scraper/engati/script.js')
  }
}

test('Engati validates the current homepage and zero-openings careers surface', async () => {
  const engati = await loadModule()

  assert.equal(engati.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(engati.hasCareersShellSignal(careersHtml), true)
  assert.equal(engati.hasNoJobsSignal(careersHtml), true)
  assert.equal(engati.hasVisibleOpeningsSignal(careersHtml), false)

  const jobs = await engati.createEngatiScraper().run({
    fetchText: async (url) => {
      if (url === engati.HOMEPAGE_URL) return homepageHtml
      if (url === engati.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Engati fails closed if the careers page starts exposing visible openings', async () => {
  const engati = await loadModule()

  await assert.rejects(
    engati.createEngatiScraper().run({
      fetchText: async (url) => {
        if (url === engati.HOMEPAGE_URL) return homepageHtml
        if (url === engati.CAREERS_URL) {
          return `
            ${careersHtml}
            <div class="apply-job-wrapper">
              <div class="w-dyn-list">
                <div role="list" class="w-dyn-items">
                  <div class="w-dyn-item">
                    <h2>AI Solutions Engineer</h2>
                    <a href="https://www.engati.ai/careers/ai-solutions-engineer">Learn more</a>
                  </div>
                </div>
              </div>
            </div>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /empty-state public surface/i,
  )
})
