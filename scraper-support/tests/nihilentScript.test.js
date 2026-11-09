import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Life At Nihilent | Passion For Performance | Nihilent</title></head>
  <body>
    <h1>We are Nihilentians</h1>
    <h2>Job Openings</h2>
    <a href="https://www.nihilent.com/job-openings/">view openings</a>
  </body>
</html>
`

const OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Job Openings | Open Positions | Nihilent</title></head>
  <body>
    <h1>Open Positions at Nihilent</h1>
    <article>
      <h2>ServiceNow Lead/ Architect</h2>
      <p>Designation: ServiceNow Lead/ Architect</p>
      <p>Location: Pune / Chennai / Kolkata</p>
      <p>Experience: 8+ Years</p>
      <p>About the Job Opening: Must have experience in ServiceNow Developement. Must have experience in End to End Implementation.</p>
      <a href="#apply">Apply now</a>
    </article>
    <article>
      <h2>Data Engineering (MS Fabric)</h2>
      <p>Designation: Data Engineering (MS Fabric)</p>
      <p>Location: Pune</p>
      <p>Experience: 8+ Years</p>
      <p>About the Job Opening: Design and build data pipelines, Lakehouse architectures, and semantic models in Microsoft Fabric.</p>
      <a href="#apply">Apply now</a>
    </article>
    <article>
      <h2>Service Desk Analyst</h2>
      <p>Designation: Service Desk Analyst</p>
      <p>Location: London</p>
      <p>Experience: 3-6 Years</p>
      <p>About the Job Opening: UK-only support role.</p>
      <a href="#apply">Apply now</a>
    </article>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nihilent/script.js')
  } catch {
    assert.fail('Expected Nihilent scraper module at ../../scraper/nihilent/script.js')
  }
}

test('Nihilent helpers stay pinned to the verified first-party careers handoff and India role cards from Saturday, July 18, 2026', async () => {
  const nihilent = await loadModule()

  assert.equal(nihilent.SOURCE, 'nihilent')
  assert.equal(nihilent.COMPANY, 'Nihilent')
  assert.equal(nihilent.OFFICIAL_BRAND_NAME, 'Nihilent')
  assert.equal(nihilent.VERIFIED_ON, '2026-07-18')
  assert.equal(nihilent.CAREERS_URL, 'https://www.nihilent.com/careers/')
  assert.equal(nihilent.OPENINGS_URL, 'https://www.nihilent.com/job-openings/')
  assert.equal(nihilent.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(nihilent.hasOfficialOpeningsSignal(OPENINGS_HTML), true)

  const jobs = nihilent.extractSearchResults(OPENINGS_HTML)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.title), [
    'ServiceNow Lead/ Architect',
    'Data Engineering (MS Fabric)',
  ])
})

test('Nihilent run returns India jobs from the verified first-party job openings page', async () => {
  const nihilent = await loadModule()
  const requestedUrls = []

  const jobs = await nihilent.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === nihilent.CAREERS_URL) return CAREERS_HTML
      if (url === nihilent.OPENINGS_URL) return OPENINGS_HTML
      throw new Error(`Unexpected Nihilent URL: ${url}`)
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [nihilent.CAREERS_URL, nihilent.OPENINGS_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs.map((job) => job.city), ['Pune', 'Pune'])
  assert.deepEqual(jobs.map((job) => job.source), ['nihilent', 'nihilent'])
})

test('Nihilent fails closed when the verified careers or openings surface drifts', async () => {
  const nihilent = await loadModule()

  await assert.rejects(
    nihilent.run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    nihilent.run({
      fetchText: async (url) => {
        if (url === nihilent.CAREERS_URL) return CAREERS_HTML
        return '<html><body><h1>Unexpected openings</h1></body></html>'
      },
    }),
    /verified first-party job openings page/i,
  )
})
