import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SRM Group of Companies scraper module at ./script.js')
  }
}

const officialGroupSurfaceHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Our Markets | Our Partners | SRM Technologies</title>
  </head>
  <body>
    <main>
      <p>Founded in 1998 as part of the SRM Group, SRM Technologies began as a technology services company and has evolved into a global engineering and digital transformation partner.</p>
      <h2>About SRM Group</h2>
      <p>A billion-dollar conglomerate with a formidable presence in the fields of education, transport, engineering, hospitality, infotainment and healthcare.</p>
      <p>SRM Group is known for its integrity, ethical practice and transparency, with its foundation built on deep-rooted values and ideas dedicated to building a collective and prosperous future.</p>
      <p>Healthcare | Advanced Tertiary Healthcare for a Healthier Tomorrow</p>
    </main>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Work Culture | SRM Technologies</title>
  </head>
  <body>
    <main>
      <h2>Become A Part Of Our Growth Journey</h2>
      <h3>Featured Roles</h3>
      <a href="https://careers.srmtech.com/jobs/Careers">View Open Positions</a>
      <h2>Why SRM Tech?</h2>
      <p>Join a Certified Great Place to Work!</p>
    </main>
  </body>
</html>
`

const officialSrmTechnologiesBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Job Opportunities | SRM Technologies</title>
  </head>
  <body>
    <input type="hidden" id="pageJson" value="{}">
    <input type="hidden" id="moduleMeta" value="[]">
    <input type="hidden" id="jobs" value="[]">
    <a href="https://careers.srmtech.com/jobs/Careers">Jobs</a>
    <p>SRM Technologies</p>
  </body>
</html>
`

test('SRM Group of Companies sentinel pins the verified group page, SRM Tech careers page, and SRM Technologies-branded public board mismatch', async () => {
  const srm = await loadModule()

  assert.equal(srm.SOURCE, 'srmgroupofcompanies')
  assert.equal(srm.COMPANY, 'SRM Group of Companies')
  assert.equal(srm.GROUP_SURFACE_URL, 'https://www.srmtech.com/who-we-are/')
  assert.equal(srm.CAREERS_PAGE_URL, 'https://www.srmtech.com/careers/')
  assert.equal(srm.CAREERS_HANDOFF_URL, 'https://careers.srmtech.com/jobs/Careers')
  assert.equal(srm.hasOfficialGroupSurfaceSignal(officialGroupSurfaceHtml), true)
  assert.equal(srm.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(srm.hasOfficialSrmTechnologiesBoardSignal(officialSrmTechnologiesBoardHtml), true)
})

test('SRM Group of Companies sentinel returns no jobs while the verified handoff still lands on the SRM Technologies-branded board', async () => {
  const srm = await loadModule()
  const requestedUrls = []

  const jobs = await srm.createSrmGroupOfCompaniesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === srm.GROUP_SURFACE_URL) {
        return officialGroupSurfaceHtml
      }

      if (url === srm.CAREERS_PAGE_URL) {
        return officialCareersHtml
      }

      if (url === srm.CAREERS_HANDOFF_URL) {
        return officialSrmTechnologiesBoardHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    srm.GROUP_SURFACE_URL,
    srm.CAREERS_PAGE_URL,
    srm.CAREERS_HANDOFF_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SRM Group of Companies default fetches are bounded by AbortSignals across the verified group, careers, and board checks', async () => {
  const srm = await loadModule()
  const originalFetch = globalThis.fetch
  const fetchCalls = []

  globalThis.fetch = async (url, options = {}) => {
    fetchCalls.push({ url, options })

    if (url === srm.GROUP_SURFACE_URL) {
      return {
        text: async () => officialGroupSurfaceHtml,
      }
    }

    if (url === srm.CAREERS_PAGE_URL) {
      return {
        text: async () => officialCareersHtml,
      }
    }

    if (url === srm.CAREERS_HANDOFF_URL) {
      return {
        text: async () => officialSrmTechnologiesBoardHtml,
      }
    }

    throw new Error(`Unexpected URL: ${url}`)
  }

  try {
    const jobs = await srm.createSrmGroupOfCompaniesScraper().run()

    assert.deepEqual(jobs, [])
    assert.deepEqual(fetchCalls.map((call) => call.url), [
      srm.GROUP_SURFACE_URL,
      srm.CAREERS_PAGE_URL,
      srm.CAREERS_HANDOFF_URL,
    ])
    assert.equal(fetchCalls.every((call) => call.options.signal instanceof AbortSignal), true)
    assert.equal(fetchCalls.every((call) => call.options.redirect === 'follow'), true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('SRM Group of Companies sentinel fails closed when the group, careers, or SRM Technologies-branded board surface drifts', async () => {
  const srm = await loadModule()

  await assert.rejects(
    srm.createSrmGroupOfCompaniesScraper().run({
      fetchText: async (url) => {
        if (url === srm.GROUP_SURFACE_URL) {
          return '<html><head><title>Unexpected</title></head><body>No SRM group markers</body></html>'
        }

        if (url === srm.CAREERS_PAGE_URL) {
          return officialCareersHtml
        }

        if (url === srm.CAREERS_HANDOFF_URL) {
          return officialSrmTechnologiesBoardHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified SRM Group surface/i,
  )

  await assert.rejects(
    srm.createSrmGroupOfCompaniesScraper().run({
      fetchText: async (url) => {
        if (url === srm.GROUP_SURFACE_URL) {
          return officialGroupSurfaceHtml
        }

        if (url === srm.CAREERS_PAGE_URL) {
          return '<html><body><h1>Careers</h1></body></html>'
        }

        if (url === srm.CAREERS_HANDOFF_URL) {
          return officialSrmTechnologiesBoardHtml
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified SRM careers page/i,
  )

  await assert.rejects(
    srm.createSrmGroupOfCompaniesScraper().run({
      fetchText: async (url) => {
        if (url === srm.GROUP_SURFACE_URL) {
          return officialGroupSurfaceHtml
        }

        if (url === srm.CAREERS_PAGE_URL) {
          return officialCareersHtml
        }

        if (url === srm.CAREERS_HANDOFF_URL) {
          return '<html><body><p>No board markers</p></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /brand-mismatch surface/i,
  )
})
