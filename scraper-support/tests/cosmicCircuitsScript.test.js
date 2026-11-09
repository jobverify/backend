import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedCadenceCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Careers | Cadence</title>
    </head>
    <body>
      <nav>
        <a href="https://cadence.wd1.myworkdayjobs.com/External_Careers">Explore Jobs</a>
      </nav>
      <main>
        <h1>Careers</h1>
        <h2>Make your mark at Cadence</h2>
        <section>
          <h3>Find Your Role with Us</h3>
          <p>We are hiring for a number of different technical and business roles.</p>
          <a href="https://cadence.wd1.myworkdayjobs.com/External_Careers">Explore JOBS</a>
        </section>
      </main>
      <footer>Cadence Design Systems, Inc.</footer>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/cosmiccircuits/script.js')
  } catch {
    assert.fail('Expected Cosmic Circuits scraper module at ../../scraper/cosmiccircuits/script.js')
  }
}

test('Cosmic Circuits pins the verified Cadence parent careers surface and generic Workday handoff', async () => {
  const cosmic = await loadModule()

  assert.equal(cosmic.SOURCE, 'cosmiccircuits')
  assert.equal(cosmic.COMPANY, 'Cosmic Circuits')
  assert.equal(cosmic.PARENT_COMPANY, 'Cadence Design Systems')
  assert.equal(
    cosmic.CAREERS_URL,
    'https://www.cadence.com/en_US/home/company/life-at-cadence/careers.html',
  )
  assert.equal(cosmic.WORKDAY_HANDOFF_HOST, 'cadence.wd1.myworkdayjobs.com')
  assert.equal(cosmic.hasOfficialParentCareersSignal(verifiedCadenceCareersHtml), true)
  assert.equal(cosmic.hasCosmicCircuitsBrandSignal(verifiedCadenceCareersHtml), false)
  assert.deepEqual(
    cosmic.extractWorkdayHandoffUrls(verifiedCadenceCareersHtml),
    ['https://cadence.wd1.myworkdayjobs.com/External_Careers'],
  )
})

test('Cosmic Circuits returns no jobs while only the generic Cadence parent careers surface is publicly available', async () => {
  const cosmic = await loadModule()
  const requestedUrls = []

  const jobs = await cosmic.createCosmicCircuitsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return verifiedCadenceCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [cosmic.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Cosmic Circuits falls back to browser text when the verified parent careers page blocks plain fetches', async () => {
  const cosmic = await loadModule()
  const requested = []

  const jobs = await cosmic.createCosmicCircuitsScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      requested.push({ type: 'browser', url })
      return verifiedCadenceCareersHtml
    },
  })

  assert.deepEqual(requested, [
    { type: 'text', url: cosmic.CAREERS_URL },
    { type: 'browser', url: cosmic.CAREERS_URL },
  ])
  assert.deepEqual(jobs, [])
})

test('Cosmic Circuits returns [] when the verified parent careers page remains Cloudflare-blocked after fallback', async () => {
  const cosmic = await loadModule()
  const requested = []

  const fetchPageCalls = []
  const jobs = await cosmic.createCosmicCircuitsScraper().run({
    fetchText: async (url) => {
      requested.push({ type: 'text', url })
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      requested.push({ type: 'browser', url })
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchPage: async (url) => {
      fetchPageCalls.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2abf7655991a91a-MAA',
          'cf-mitigated': 'challenge',
        },
        html: `
          <!DOCTYPE html>
          <html>
            <head><title>Just a moment...</title></head>
            <body>
              <main class="main-content">
                <h1>Enable JavaScript and cookies to continue</h1>
              </main>
            </body>
          </html>
        `,
      }
    },
  })

  assert.deepEqual(requested, [
    { type: 'text', url: cosmic.CAREERS_URL },
    { type: 'browser', url: cosmic.CAREERS_URL },
  ])
  assert.deepEqual(fetchPageCalls, [cosmic.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Cosmic Circuits fails closed when the parent careers surface drifts or becomes brand-specific', async () => {
  const cosmic = await loadModule()

  await assert.rejects(
    cosmic.createCosmicCircuitsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected careers page</h1></body></html>',
    }),
    /Cadence parent careers surface changed/i,
  )

  const noHandoffHtml = verifiedCadenceCareersHtml.replace(
    /https:\/\/cadence\.wd1\.myworkdayjobs\.com\/External_Careers/g,
    'https://www.cadence.com/contact-us',
  )

  await assert.rejects(
    cosmic.createCosmicCircuitsScraper().run({
      fetchText: async () => noHandoffHtml,
    }),
    /Cadence careers handoff changed/i,
  )

  const brandSpecificHtml = `${verifiedCadenceCareersHtml}
    <section>
      <h2>Cosmic Circuits analog IP openings in India</h2>
      <a href="https://cadence.wd1.myworkdayjobs.com/External_Careers/job/123">Apply now</a>
    </section>
  `

  await assert.rejects(
    cosmic.createCosmicCircuitsScraper().run({
      fetchText: async () => brandSpecificHtml,
    }),
    /brand-specific jobs surface/i,
  )
})
