import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <a href="#positions">Open Positions</a>
    <h2>Open Positions</h2>
    <div id="positions">
      <div id="jobylon-jobs-widget"></div>
      <script type="text/javascript">
        const widgets = [{
          target: 'jobylon-jobs-widget-1',
          version: 'v4',
          id: 1,
        }];
        var el = document.createElement('script');
        el.src = 'https://cdn.jobylon.com/embedder.js';
      </script>
    </div>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Open Positions</h2>
    <a href="https://jobs.jobylon.com/jobs/123-senior-engineer">Senior Engineer</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/basware/script.js')
  } catch {
    assert.fail('Expected Basware scraper module at ../../scraper/basware/script.js')
  }
}

test('Basware legacy shell detectors remain available without supplying current inventory authority', async () => {
  const basware = await loadModule()

  assert.equal(basware.SOURCE, 'basware')
  assert.equal(basware.COMPANY, 'Basware')
  assert.equal(basware.OFFICIAL_BRAND_NAME, 'Basware')
  assert.equal(basware.VERIFIED_ON, null)
  assert.equal(basware.CAREERS_URL, 'https://careers.basware.com/')
  assert.equal(basware.hasOfficialJobylonShellSignal(CAREERS_PAGE_HTML), true)
  assert.equal(basware.hasPublicJobsSignal(CAREERS_PAGE_HTML), false)
  assert.equal(basware.hasPublicJobsSignal(PUBLIC_JOBS_HTML), true)
})

test('Basware no longer accepts a widget shell without a current employer group binding as an empty inventory', async () => {
  const basware = await loadModule()
  const requestedUrls = []

  await assert.rejects(basware.createBaswareScraper().run({
    transport: async (url) => {
      requestedUrls.push(url)
      if (url === basware.CAREERS_URL) return { url, status: 200, headers: { 'content-type': 'text/html' },
        body: Buffer.from(CAREERS_PAGE_HTML), bodyComplete: true }
      throw new Error(`Unexpected Basware URL: ${url}`)
    },
  }), error => error.code === 'NATIVE_HTML_INCOMPLETE' && error.nativeEvidence.handoffVerified !== true)

  assert.deepEqual(requestedUrls, [basware.CAREERS_URL])
})

test('Basware rejects changed or unbound careers HTML without requesting a guessed feed', async () => {
  const basware = await loadModule()

  await assert.rejects(
    basware.createBaswareScraper().run({
      transport: async url => ({ url, status: 200, headers: { 'content-type': 'text/html' },
        body: Buffer.from('<html><body><h1>Careers</h1></body></html>'), bodyComplete: true }),
    }),
    error => error.code === 'NATIVE_HTML_INCOMPLETE',
  )

  await assert.rejects(
    basware.createBaswareScraper().run({
      transport: async url => ({ url, status: 200, headers: { 'content-type': 'text/html' },
        body: Buffer.from(PUBLIC_JOBS_HTML), bodyComplete: true }),
    }),
    error => error.code === 'NATIVE_HTML_INCOMPLETE',
  )
})
