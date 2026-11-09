import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
  <html>
    <head>
      <title>Explore Career Opportunities | Asteria</title>
    </head>
    <body>
      <h1>Careers</h1>
      <p>Make the right move. Join us.</p>
      <p>Write to us at careers@asteria.co.in</p>
      <section>
        <h2>Featured Roles</h2>
        <p>We are always looking for mission-driven builders.</p>
      </section>
    </body>
  </html>
`

const loadAsteriaModule = async () => {
  try {
    return await import('../../scraper/asteriaaerospace/script.js')
  } catch {
    assert.fail('Expected Asteria Aerospace scraper module at ../../scraper/asteriaaerospace/script.js')
  }
}

test('Asteria Aerospace sentinels recognize the verified email-only careers page', async () => {
  const asteria = await loadAsteriaModule()

  assert.equal(asteria.SOURCE, 'asteriaaerospace')
  assert.equal(asteria.COMPANY, 'Asteria Aerospace')
  assert.equal(asteria.CAREERS_URL, 'https://asteria.co.in/careers')
  assert.equal(asteria.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(asteria.extractApplicationEmail(careersHtml), 'careers@asteria.co.in')
  assert.equal(asteria.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Asteria Aerospace returns no jobs while the verified email-only careers page holds', async () => {
  const asteria = await loadAsteriaModule()
  const requestedUrls = []

  const jobs = await asteria.createAsteriaAerospaceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [asteria.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Asteria Aerospace fails closed when the careers page changes materially or exposes openings', async () => {
  const asteria = await loadAsteriaModule()

  await assert.rejects(
    asteria.createAsteriaAerospaceScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified email-only careers surface/i,
  )

  await assert.rejects(
    asteria.createAsteriaAerospaceScraper().run({
      fetchText: async () => careersHtml.replace('careers@asteria.co.in', 'jobs@asteria.co.in'),
    }),
    /verified careers application email/i,
  )

  await assert.rejects(
    asteria.createAsteriaAerospaceScraper().run({
      fetchText: async () => `${careersHtml}<a href="/careers/senior-ae">Apply Now</a>`,
    }),
    /now exposes public jobs/i,
  )
})

test('Asteria Aerospace can recover with a browser-backed careers page when direct requests fail', async () => {
  const asteria = await loadAsteriaModule()
  const browserUrls = []

  const jobs = await asteria.createAsteriaAerospaceScraper().run({
    fetchText: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserText: async (url) => {
      browserUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(browserUrls, [asteria.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

for(const status of [401,403,429,451])test('Asteria retains HTTP '+status+' as an access failure without a browser retry',async()=>{
  const asteria=await loadAsteriaModule()
  let browserReads=0
  await assert.rejects(asteria.run({fetchText:async()=>{throw Error('HTTP '+status+' for public careers')},
    fetchBrowserText:async()=>{browserReads++;return careersHtml}}),new RegExp('HTTP '+status))
  assert.equal(browserReads,0)
})
