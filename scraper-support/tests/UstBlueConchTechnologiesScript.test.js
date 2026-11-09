import assert from 'node:assert/strict'
import test from 'node:test'

const ustBlockedHtml = `
<!doctype html>
<html>
  <head>
    <title>Attention Required! | Cloudflare</title>
  </head>
  <body>
    <div id="cf-wrapper"></div>
    <h1>Please enable cookies.</h1>
    <p>Sorry, you have been blocked</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ustblueconchtechnologies/script.js')
  } catch {
    assert.fail('Expected UST BlueConch Technologies scraper module at ../../scraper/ustblueconchtechnologies/script.js')
  }
}

test('UST BlueConch Technologies returns [] while both verified first-party routes are Cloudflare-blocked', async () => {
  const blueConch = await loadModule()

  assert.equal(blueConch.hasCloudflareBlockedUstSignal(ustBlockedHtml), true)
  assert.equal(blueConch.pageExposesBlueConchSpecificJobs(ustBlockedHtml), false)

  const jobs = await blueConch.createUstBlueConchTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === blueConch.BLUECONCH_REFERENCE_URL) return ustBlockedHtml
      if (url === blueConch.UST_CAREERS_URL) return ustBlockedHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('UST BlueConch Technologies fails closed when a BlueConch-specific public jobs surface appears', async () => {
  const blueConch = await loadModule()

  await assert.rejects(
    blueConch.createUstBlueConchTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === blueConch.BLUECONCH_REFERENCE_URL) return ustBlockedHtml
        if (url === blueConch.UST_CAREERS_URL) {
          return `${ustBlockedHtml}<section><h2>UST BlueConch Open Positions</h2><a href="/blueconch/software-engineer">Apply Now</a></section>`
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /blueconch-specific public jobs surface/i,
  )
})
