import assert from 'node:assert/strict'
import test from 'node:test'

const loadTuringGlobalIndiaModule = async () => {
  try {
    return await import('../../scraper/turingglobalindia/script.js')
  } catch {
    assert.fail('Expected Turing Global India scraper module at ../../scraper/turingglobalindia/script.js')
  }
}

const careersLandingHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <h1>Great people. Real impact.</h1>
      <p>At Turing, our mission is to accelerate superintelligence to drive real economic progress.</p>
      <a href="/roles">See Open Roles</a>
      <section>
        <h2>Turing Talent Network</h2>
        <p>Use your expertise to train the world's most advanced AI with flexible, well-paid remote work.</p>
      </section>
    </body>
  </html>
`

const zeroOpenRolesHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <p>Back to Careers page</p>
      <h2>Live Openings</h2>
      <div>Team</div>
      <div>Location</div>
      <p>0 Open Roles</p>
      <p>Sorry! There are no jobs for this category :(</p>
    </body>
  </html>
`

test('validates the official Turing careers landing and zero-open-roles surface before returning no jobs', async () => {
  const turingglobalindia = await loadTuringGlobalIndiaModule()
  const requestedUrls = []

  assert.equal(turingglobalindia.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(turingglobalindia.hasOfficialOpenRolesSignal(zeroOpenRolesHtml), true)
  assert.equal(turingglobalindia.extractOpenRolesCount(zeroOpenRolesHtml), 0)
  assert.equal(turingglobalindia.hasZeroOpenRolesSignal(zeroOpenRolesHtml), true)

  const jobs = await turingglobalindia.createTuringGlobalIndiaScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === turingglobalindia.CAREERS_URL) return careersLandingHtml
      if (url === turingglobalindia.OPEN_ROLES_URL) return zeroOpenRolesHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    turingglobalindia.CAREERS_URL,
    turingglobalindia.OPEN_ROLES_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('fails closed when the official Turing careers landing changes', async () => {
  const turingglobalindia = await loadTuringGlobalIndiaModule()

  await assert.rejects(
    turingglobalindia.createTuringGlobalIndiaScraper().run({
      fetchText: async (url) => {
        if (url === turingglobalindia.CAREERS_URL) return '<html><body>Unrelated site</body></html>'
        return zeroOpenRolesHtml
      },
    }),
    /verified official careers landing/i,
  )
})

test('fails closed when the Turing open-roles page starts exposing public openings', async () => {
  const turingglobalindia = await loadTuringGlobalIndiaModule()
  const rolesWithOpeningsHtml = zeroOpenRolesHtml
    .replace('0 Open Roles', '3 Open Roles')
    .replace('Sorry! There are no jobs for this category :(', 'Software Engineer')

  await assert.rejects(
    turingglobalindia.createTuringGlobalIndiaScraper().run({
      fetchText: async (url) => {
        if (url === turingglobalindia.CAREERS_URL) return careersLandingHtml
        if (url === turingglobalindia.OPEN_ROLES_URL) return rolesWithOpeningsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public openings/i,
  )
})
