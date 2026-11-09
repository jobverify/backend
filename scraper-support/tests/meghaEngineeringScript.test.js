import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Meil | Megha Engineering &amp; Infrastructures Ltd (MEIL)</title>
      <link rel="canonical" href="https://meil.in/">
    </head>
    <body>
      <header>
        <a href="/careers">Careers</a>
      </header>
      <main>
        <h1>Know About Meil</h1>
        <p>Megha Engineering &amp; Infrastructures Ltd (MEIL) is a $5bn multi-sector infrastructure company from India taking giant strides globally.</p>
        <p>Touching Lives Through Engineering</p>
      </main>
    </body>
  </html>
`

const verifiedCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | Meil</title>
      <link rel="canonical" href="https://meil.in/careers">
    </head>
    <body>
      <main>
        <h1>Join Our Journey, Shape Your Future</h1>
        <p>Build your Career with Learning &amp; Development</p>
        <h2>Apply for the Job</h2>
        <img src="/assets/careers-banner.jpg" alt="Apply for the Job">
      </main>
    </body>
  </html>
`

const loadMeghaEngineeringModule = async () => {
  try {
    return await import('../../scraper/meghaengineering/script.js')
  } catch {
    assert.fail('Expected Megha Engineering scraper module at ../../scraper/meghaengineering/script.js')
  }
}

test('Megha Engineering validates the verified homepage and careers page', async () => {
  const meghaEngineering = await loadMeghaEngineeringModule()

  assert.equal(meghaEngineering.SOURCE, 'meghaengineering')
  assert.equal(meghaEngineering.COMPANY, 'Megha Engineering')
  assert.equal(meghaEngineering.HOMEPAGE_URL, 'https://meil.in/')
  assert.equal(meghaEngineering.CAREERS_URL, 'https://meil.in/careers')
  assert.equal(meghaEngineering.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(meghaEngineering.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(meghaEngineering.hasPublicJobsSignal(verifiedHomepageHtml), false)
  assert.equal(meghaEngineering.hasPublicJobsSignal(verifiedCareersHtml), false)
  assert.equal(
    meghaEngineering.hasOfficialCareersSignal(
      '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/meil">Open positions</a></body></html>',
    ),
    false,
  )
})

test('Megha Engineering returns no jobs only while the verified homepage and careers page remain unchanged', async () => {
  const meghaEngineering = await loadMeghaEngineeringModule()
  const requestedUrls = []

  const jobs = await meghaEngineering.createMeghaEngineeringScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === meghaEngineering.HOMEPAGE_URL) {
        return verifiedHomepageHtml
      }

      if (url === meghaEngineering.CAREERS_URL) {
        return verifiedCareersHtml
      }

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    meghaEngineering.HOMEPAGE_URL,
    meghaEngineering.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Megha Engineering fails closed when the homepage or careers page contract changes', async () => {
  const meghaEngineering = await loadMeghaEngineeringModule()

  await assert.rejects(
    meghaEngineering.createMeghaEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === meghaEngineering.HOMEPAGE_URL) {
          return '<html><body><h1>Unexpected homepage</h1></body></html>'
        }

        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    meghaEngineering.createMeghaEngineeringScraper().run({
      fetchText: async (url) => {
        if (url === meghaEngineering.HOMEPAGE_URL) {
          return verifiedHomepageHtml
        }

        return '<html><body><h1>Careers</h1><a href="https://jobs.lever.co/meil">Open positions</a></body></html>'
      },
    }),
    /careers page no longer matches the verified first-party empty state/i,
  )
})
