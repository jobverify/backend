import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_SURFACE_HTML = `
  <html>
    <head>
      <title>Career | Join Our Team</title>
      <meta
        name="description"
        content="Explore career opportunities and join our team."
      />
    </head>
    <body>
      <main>
        <section>
          <h1>About ZOOP</h1>
          <p>
            At ZOOP, we're building smart, secure solutions that make it easier
            for businesses to grow.
          </p>
        </section>
        <section>
          <h2>Do Work That Matters. With People Who Care.</h2>
          <h2>Why Join Us?</h2>
          <p>Come for the mission, stay for the ownership and growth.</p>
          <p>View Openings</p>
        </section>
        <section>
          <a href="https://forms.gle/zoop-ml-lead">
            <h3>ML Lead</h3>
            <span>Engineering</span>
            <span>6-8 years</span>
            <span>Pune</span>
            <span>Full Time</span>
          </a>
        </section>
      </main>
    </body>
  </html>
`

const VERIFIED_BRAND_ONLY_HTML = `
  <html>
    <head>
      <title>Career | Join Our Team</title>
    </head>
    <body>
      <main>
        <section>
          <h1>About ZOOP</h1>
          <h2>Do Work That Matters. With People Who Care.</h2>
          <h2>Why Join Us?</h2>
          <p>View Openings</p>
        </section>
      </main>
    </body>
  </html>
`

const CURRENT_EMPTY_SHELL_HTML = `
  <html>
    <head>
      <title>Career | Join Our Team</title>
    </head>
    <body>
      <main>
        <section>
          <h1>About ZOOP</h1>
          <h2>Why Join Us?</h2>
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

const loadZoopPlusIndiaModule = async () => {
  try {
    return await import('../../scraper/zoopplusindia/script.js')
  } catch {
    assert.fail(
      'Expected ZoopPlus India scraper module at ../../scraper/zoopplusindia/script.js',
    )
  }
}

test('ZoopPlus India validates the verified ZOOP careers surface and maps rendered role cards', async () => {
  const zoopPlusIndia = await loadZoopPlusIndiaModule()
  let requestedUrl = null

  const jobs = await zoopPlusIndia.run({
    fetchHtml: async (url) => {
      requestedUrl = url
      return VERIFIED_SURFACE_HTML
    },
    fetchBrowserHtml: async () => {
      throw new Error('Browser fallback was not expected for the verified fixture')
    },
    now: () => '2026-08-02T00:00:00.000Z',
  })

  assert.equal(requestedUrl, zoopPlusIndia.CAREERS_URL)
  assert.equal(zoopPlusIndia.SOURCE, 'zoopplusindia')
  assert.equal(zoopPlusIndia.COMPANY, 'ZoopPlus India')
  assert.equal(zoopPlusIndia.OFFICIAL_BRAND, 'ZOOP')
  assert.equal(zoopPlusIndia.CAREERS_URL, 'https://www.zoop.one/career')
  assert.equal(
    zoopPlusIndia.DISPOSITION,
    'verified-official-brand-careers-surface-with-current-empty-shell',
  )
  assert.match(zoopPlusIndia.VERIFIED_SURFACE_SUMMARY, /Friday, August 14, 2026/)
  assert.deepEqual(jobs, [
    {
      title: 'ML Lead',
      company: 'ZoopPlus India',
      department: 'Engineering',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'ml-lead-engineering-pune-full-time',
      requisitionId: null,
      sourceUrl: 'https://www.zoop.one/career',
      applyUrl: 'https://forms.gle/zoop-ml-lead',
      employmentType: 'Full Time',
      experienceRequired: '6-8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the official ZOOP careers page for ML Lead (Engineering, 6-8 years, Pune).',
      source: 'zoopplusindia',
      link: 'https://forms.gle/zoop-ml-lead',
      scrapedAt: '2026-08-02T00:00:00.000Z',
    },
  ])
})

test('ZoopPlus India extracts rendered first-party role cards from the verified careers surface', async () => {
  const zoopPlusIndia = await loadZoopPlusIndiaModule()

  assert.deepEqual(zoopPlusIndia.extractRenderedRoleCards(VERIFIED_SURFACE_HTML), [
    {
      title: 'ML Lead',
      department: 'Engineering',
      experienceRequired: '6-8 years',
      city: 'Pune',
      employmentType: 'Full Time',
      applyUrl: 'https://forms.gle/zoop-ml-lead',
    },
  ])
})

test('ZoopPlus India rejects when the verified ZOOP careers surface markers disappear', async () => {
  const zoopPlusIndia = await loadZoopPlusIndiaModule()
  const brokenHtml = `
    <html>
      <body>
        <main>
          <h1>Careers</h1>
          <p>Explore opportunities with us.</p>
        </main>
      </body>
    </html>
  `

  await assert.rejects(
    zoopPlusIndia.run({
      fetchHtml: async () => brokenHtml,
      fetchBrowserHtml: async () => brokenHtml,
    }),
    /verified official brand careers surface changed/i,
  )
})

test('ZoopPlus India rejects when the verified brand shell remains but rendered role cards disappear', async () => {
  const zoopPlusIndia = await loadZoopPlusIndiaModule()

  await assert.doesNotReject(
    zoopPlusIndia.run({
      fetchHtml: async () => CURRENT_EMPTY_SHELL_HTML,
      fetchBrowserHtml: async () => CURRENT_EMPTY_SHELL_HTML,
    }),
  )
})
