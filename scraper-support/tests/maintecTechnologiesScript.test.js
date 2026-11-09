import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_URL = 'https://maintec.com/jobs/'
const FEED_URL = 'https://maintec.com/jobs/feed/'
const PAGE_URL = 'https://maintec.com/jobs/page/'
const CICS_URL = 'https://maintec.com/jobs/cics-system-programmer/'
const DB2_URL = 'https://maintec.com/jobs/db2-system-programmer/'
const MAINFRAME_DB2_DBA_URL = 'https://maintec.com/jobs/mainframe-db2-dba/'

const ARCHIVE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Openings - Maintec</title>
  </head>
  <body>
    <h1>Job Openings</h1>
    <p>CICS System programmer</p>
    <p>DB2 System programmer</p>
    <p>Mainframe DB2 DBA</p>
    <p>India Office</p>
    <p>Bengaluru</p>
    <a href="${FEED_URL}">Feed</a>
    <a href="${PAGE_URL}">Page</a>
    <a href="${CICS_URL}">CICS</a>
    <a href="${DB2_URL}">DB2</a>
    <a href="${MAINFRAME_DB2_DBA_URL}">DBA</a>
  </body>
</html>
`

const CICS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>CICS System programmer - Maintec</title>
  </head>
  <body>
    <main>
      <h1>CICS System programmer</h1>
      <p>Work Hours- US Eastern hours</p>
      <p>Apply for this position</p>
      <footer>
        <p>US Office</p>
        <p>India Office</p>
      </footer>
    </main>
  </body>
</html>
`

const DB2_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>DB2 System programmer - Maintec</title>
  </head>
  <body>
    <main>
      <h1>DB2 System programmer</h1>
      <p>Must be available during US Eastern business hours.</p>
      <p>Apply for this position</p>
      <footer>
        <p>US Office</p>
        <p>India Office</p>
      </footer>
    </main>
  </body>
</html>
`

const MAINFRAME_DB2_DBA_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mainframe DB2 DBA - Maintec</title>
  </head>
  <body>
    <main>
      <h1>Mainframe DB2 DBA</h1>
      <p>We are seeking an experienced Mainframe DB2 DBA to support mission-critical databases.</p>
      <p>Apply for this position</p>
      <footer>
        <p>US Office</p>
        <p>India Office</p>
      </footer>
    </main>
  </body>
</html>
`

const INDIA_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Platform Engineer - Maintec</title>
  </head>
  <body>
    <main>
      <h1>Platform Engineer</h1>
      <p>Location: Bengaluru, India</p>
      <p>Apply for this position</p>
      <footer>
        <p>US Office</p>
        <p>India Office</p>
      </footer>
    </main>
  </body>
</html>
`

const loadMaintecModule = async () => import('../../scraper/maintectechnologies/script.js')

test('Maintec Technologies filters archive noise links and recognizes the current archive signals', async () => {
  const maintec = await loadMaintecModule()

  assert.equal(maintec.SOURCE, 'maintectechnologies')
  assert.equal(maintec.CAREERS_URL, CAREERS_URL)
  assert.equal(maintec.hasOfficialJobsArchiveSignal(ARCHIVE_HTML), true)
  assert.deepEqual(maintec.extractJobLinks(ARCHIVE_HTML), [
    CICS_URL,
    DB2_URL,
    MAINFRAME_DB2_DBA_URL,
  ])
})

test('Maintec Technologies returns [] when the live archive only exposes ambiguous or US-hours detail pages', async () => {
  const maintec = await loadMaintecModule()
  const requestedUrls = []

  const jobs = await maintec.createMaintecTechnologiesScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return ARCHIVE_HTML
      if (url === CICS_URL) return CICS_HTML
      if (url === DB2_URL) return DB2_HTML
      if (url === MAINFRAME_DB2_DBA_URL) return MAINFRAME_DB2_DBA_HTML
      throw new Error(`Unexpected Maintec Technologies URL: ${url}`)
    },
  }).run()

  assert.deepEqual(requestedUrls, [CAREERS_URL, CICS_URL, DB2_URL, MAINFRAME_DB2_DBA_URL])
  assert.deepEqual(jobs, [])
})

test('Maintec Technologies refuses to ignore explicit India job metadata on a detail page', async () => {
  const maintec = await loadMaintecModule()

  await assert.rejects(
    () => maintec.createMaintecTechnologiesScraper({
      fetchText: async (url) => {
        if (url === CAREERS_URL) return ARCHIVE_HTML
        if (url === CICS_URL) return INDIA_DETAIL_HTML
        if (url === DB2_URL) return DB2_HTML
        if (url === MAINFRAME_DB2_DBA_URL) return MAINFRAME_DB2_DBA_HTML
        throw new Error(`Unexpected Maintec Technologies URL: ${url}`)
      },
    }).run(),
    /Maintec Technologies now exposes trustworthy India job metadata; re-verify before scraping/,
  )
})
