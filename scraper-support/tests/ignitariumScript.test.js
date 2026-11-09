import assert from 'node:assert/strict'
import test from 'node:test'

const loadIgnitariumModule = async () => {
  try {
    return await import('../../scraper/ignitarium/script.js')
  } catch {
    assert.fail('Expected Ignitarium scraper module at ../../scraper/ignitarium/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Job openings</h1>
      <p>Explore opportunities within the walls of Neurealm</p>
      <h2>Protect Yourself from Job Scams</h2>

      <article class="job-card">
        <time>07 Jul 2026</time>
        <h4>Server Hardware Support</h4>
        <p>5-10 Years</p>
        <p>Chennai</p>
        <a href="https://www.neurealm.com/about-us/openings/server-hardware-support/">View Job</a>
      </article>

      <article class="job-card">
        <time>06 Jul 2026</time>
        <h4>LDD</h4>
        <p>3-9 Years</p>
        <p>Bangalore</p>
        <a href="/about-us/openings/ldd/">View Job</a>
      </article>
    </main>
  </body>
</html>
`

test('Ignitarium scraper recognizes the verified official careers surface and extracts public job cards', async () => {
  const ignitarium = await loadIgnitariumModule()

  assert.equal(ignitarium.SOURCE, 'ignitarium')
  assert.equal(ignitarium.COMPANY, 'Ignitarium')
  assert.equal(ignitarium.CAREERS_URL, 'https://ignitarium.com/careers/')
  assert.equal(ignitarium.NEUREALM_BASE_URL, 'https://www.neurealm.com')
  assert.equal(ignitarium.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(ignitarium.extractJobCards(careersPageHtml), [
    {
      title: 'Server Hardware Support',
      location: 'Chennai, India',
      city: 'Chennai',
      experienceRequired: '5-10 Years',
      postingDate: '2026-07-07',
      sourceUrl: 'https://www.neurealm.com/about-us/openings/server-hardware-support/',
      applyUrl: 'https://www.neurealm.com/about-us/openings/server-hardware-support/',
    },
    {
      title: 'LDD',
      location: 'Bangalore, India',
      city: 'Bangalore',
      experienceRequired: '3-9 Years',
      postingDate: '2026-07-06',
      sourceUrl: 'https://www.neurealm.com/about-us/openings/ldd/',
      applyUrl: 'https://www.neurealm.com/about-us/openings/ldd/',
    },
  ])
})

test('run validates the official Ignitarium careers redirect surface and decorates public jobs', async () => {
  const ignitarium = await loadIgnitariumModule()

  const requestedUrls = []
  const jobs = await ignitarium.createIgnitariumScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ignitarium.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://ignitarium.com/careers/'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Ignitarium')
  assert.equal(jobs[0].source, 'ignitarium')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('run fails closed when the verified Ignitarium careers surface disappears', async () => {
  const ignitarium = await loadIgnitariumModule()

  await assert.rejects(
    ignitarium.createIgnitariumScraper().run({
      fetchText: async () => '<main><h1>Careers</h1><p>No verified Neurealm openings here</p></main>',
    }),
    /verified official public careers surface/i,
  )
})
