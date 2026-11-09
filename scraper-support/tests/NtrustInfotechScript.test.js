import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>NTrust - Revolutionizing Commercial Real Estate Management</title>
  </head>
  <body>
    <h1>Join the team real estate runs on.</h1>
    <span>View Open Roles</span>
    <p>live openings are listed in our applicant tracking system.</p>
    <a href="#" class="role-card"><div class="role-meta">All regions</div><h3>Lease Abstraction &amp; Administration</h3><span class="role-link">View openings</span></a>
    <a href="#" class="role-card"><div class="role-meta">All regions</div><h3>Engineering &amp; Data Science</h3><span class="role-link">View openings</span></a>
    <p class="ats-note">Live positions across Irvine, London, Chennai, Mumbai, and Manila are listed in our applicant tracking system.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ntrustinfotech/script.js')
  } catch {
    assert.fail('Expected Ntrust Infotech scraper module at ../../scraper/ntrustinfotech/script.js')
  }
}

test('Ntrust Infotech sentinel helpers stay pinned to the verified generic ATS role-card shell', async () => {
  const ntrust = await loadModule()

  assert.equal(ntrust.hasVerifiedCareersSignal(CAREERS_HTML), true)
  assert.equal(ntrust.hasOnlyGenericAtsRoleCards(CAREERS_HTML), true)
  assert.equal(
    ntrust.pageExposesDirectJobLinks('<html><body><a class="role-card" href="/jobs/data-engineer">Data Engineer</a></body></html>'),
    true,
  )
})

test('Ntrust Infotech run validates the first-party ATS handoff shell before returning []', async () => {
  const ntrust = await loadModule()
  const requestedUrls = []

  const jobs = await ntrust.createNtrustInfotechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [ntrust.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Ntrust Infotech fails closed when direct job links appear on the first-party page', async () => {
  const ntrust = await loadModule()

  await assert.rejects(
    ntrust.createNtrustInfotechScraper().run({
      fetchText: async () =>
        '<html><body><h1>Join the team</h1><a class="role-card" href="/jobs/data-engineer">Data Engineer</a></body></html>',
    }),
    /direct public jobs/i,
  )
})
