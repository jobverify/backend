import assert from 'node:assert/strict'
import test from 'node:test'

const redirectedHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Your Trusted IT Solutions and Digital Transformation Company</title>
    <meta
      name="description"
      content="Innova Solutions is a trusted digital transformation solutions company that leverages AI to bring about digital business transformation for it's clients."
    />
  </head>
  <body>
    <main>
      <h1>Innova Solutions</h1>
      <p>Innova Solutions is a trusted digital transformation solutions company.</p>
      <select id="job-location">
        <option value="itcareer">India</option>
      </select>
      <script>
        var gotojobslocationurl = 'https://innovaindia.workllama.com/atsuser/';
      </script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ggktechnologies/script.js')
  } catch {
    assert.fail('Expected GGK Technologies scraper module at ../../scraper/ggktechnologies/script.js')
  }
}

test('GGK Technologies helpers stay pinned to the verified redirect target from Saturday, July 18, 2026', async () => {
  const ggk = await loadModule()

  assert.equal(ggk.SOURCE, 'ggktechnologies')
  assert.equal(ggk.COMPANY, 'GGK Technologies')
  assert.equal(ggk.HOMEPAGE_URL, 'https://ggktech.com/')
  assert.equal(ggk.REDIRECT_TARGET_URL, 'https://innovasolutions.com/')
  assert.equal(ggk.VERIFIED_ON, '2026-07-18')
  assert.equal(ggk.hasRedirectedHomepageSignal(redirectedHomepageHtml), true)
  assert.equal(ggk.pageExposesGgkJobListings(redirectedHomepageHtml), false)
})

test('GGK Technologies returns [] while the first-party domain only redirects to another brand homepage', async () => {
  const ggk = await loadModule()
  const requestedUrls = []

  const jobs = await ggk.createGGKTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ggk.HOMEPAGE_URL) return redirectedHomepageHtml
      throw new Error(`Unexpected GGK Technologies URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [ggk.HOMEPAGE_URL])
  assert.deepEqual(jobs, [])
})

test('GGK Technologies fails closed when the redirect contract drifts or GGK job listings appear', async () => {
  const ggk = await loadModule()

  await assert.rejects(
    ggk.createGGKTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>GGK Technologies</h1></body></html>',
    }),
    /redirect target/i,
  )

  await assert.rejects(
    ggk.createGGKTechnologiesScraper().run({
      fetchText: async () => `${redirectedHomepageHtml}<a href="https://ggktech.com/careers/software-engineer">GGK Careers</a>`,
    }),
    /GGK-branded public job listings/i,
  )
})


test('GGK referral metadata on the verified Innova redirect does not imply GGK job listings', async () => {
  const ggk = await loadModule()
  const html = redirectedHomepageHtml + '<input type="hidden" name="url_referer" value="http://ggktech.com">'
  assert.equal(ggk.pageExposesGgkJobListings(html), false)
  assert.deepEqual(await ggk.run({fetchText: async () => html}), [])
  assert.equal(ggk.pageExposesGgkJobListings(html + '<a href="https://ggktech.com/careers/software-engineer">GGK Careers</a>'), true)
})
