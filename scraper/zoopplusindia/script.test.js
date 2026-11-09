import assert from 'node:assert/strict'
import test from 'node:test'

const loadZoopPlusIndiaModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected ZoopPlus India scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Career | Join Our Team</h1>
      <p>Do Work That Matters. With People Who Care.</p>
      <a href="#open-positions">View Openings</a>
      <section>About ZOOP</section>
      <section>Why Join Us?</section>
    </main>
  </body>
</html>
`

const renderedCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Career | Join Our Team</h1>
      <p>Do Work That Matters. With People Who Care.</p>
      <a href="#open-positions">View Openings</a>
      <section>About ZOOP</section>
      <section>Why Join Us?</section>
      <a target="_blank" rel="noopener noreferrer" href="https://forms.gle/5UCs1YZiSugpu6La6">
        <div>
          <h3>ML Lead</h3>
          <div>
            <span>Zoop.one</span>
            <span>7+ Years experience</span>
          </div>
          <div>
            <span>Pune</span>
            <span>Full Time</span>
          </div>
        </div>
      </a>
      <a target="_blank" rel="noopener noreferrer" href="https://forms.gle/5UCs1YZiSugpu6La6">
        <div>
          <h3>Quality Analyst</h3>
          <div>
            <span>Zoop Solution</span>
            <span>4-6 Years experience</span>
          </div>
          <div>
            <span>Pune</span>
            <span>Full Time</span>
          </div>
        </div>
      </a>
    </main>
  </body>
</html>
`

const currentEmptyShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Join Our Team</title>
  </head>
  <body>
    <main>
      <section>
        <h1>About ZOOP</h1>
        <p>Why Join Us?</p>
        <p>View Openings</p>
      </section>
      <footer>
        <p>Tower B, Panchsheel Business Park, Clover Park, Viman Nagar, Pune, Maharashtra 411014</p>
        <p>sales@zoop.one</p>
        <p>For any grievance related issues contact us at: grievance@zoop.one</p>
        <p>Join our journey today!</p>
        <p>Quagga Tech Pvt. Ltd.</p>
      </footer>
    </main>
  </body>
</html>
`

test('ZoopPlus India extracts rendered first-party role cards', async () => {
  const zoop = await loadZoopPlusIndiaModule()
  const cards = zoop.extractRenderedRoleCards(renderedCareersHtml)

  assert.deepEqual(cards, [
    {
      title: 'ML Lead',
      department: 'Zoop.one',
      experienceRequired: '7+ Years experience',
      city: 'Pune',
      employmentType: 'Full Time',
      applyUrl: 'https://forms.gle/5UCs1YZiSugpu6La6',
    },
    {
      title: 'Quality Analyst',
      department: 'Zoop Solution',
      experienceRequired: '4-6 Years experience',
      city: 'Pune',
      employmentType: 'Full Time',
      applyUrl: 'https://forms.gle/5UCs1YZiSugpu6La6',
    },
  ])
})

test('ZoopPlus India falls back to browser-rendered HTML when static fetch does not expose cards', async () => {
  const zoop = await loadZoopPlusIndiaModule()
  const requestedStaticUrls = []
  const requestedBrowserUrls = []

  const jobs = await zoop.createZoopPlusIndiaScraper().run({
    fetchHtml: async (url) => {
      requestedStaticUrls.push(url)
      return officialCareersHtml
    },
    fetchBrowserHtml: async (url) => {
      requestedBrowserUrls.push(url)
      return renderedCareersHtml
    },
    now: () => '2026-08-02T20:00:00.000Z',
  })

  assert.deepEqual(requestedStaticUrls, [zoop.CAREERS_URL])
  assert.deepEqual(requestedBrowserUrls, [zoop.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'ZoopPlus India')
  assert.equal(jobs[0].location, 'Pune, India')
  assert.equal(jobs[0].applyUrl, 'https://forms.gle/5UCs1YZiSugpu6La6')
  assert.equal(jobs[0].scrapedAt, '2026-08-02T20:00:00.000Z')
})

test('ZoopPlus India returns an empty list for the current verified branded shell without role cards', async () => {
  const zoop = await loadZoopPlusIndiaModule()

  const jobs = await zoop.createZoopPlusIndiaScraper().run({
    fetchHtml: async () => currentEmptyShellHtml,
    fetchBrowserHtml: async () => currentEmptyShellHtml,
  })

  assert.deepEqual(jobs, [])
})
