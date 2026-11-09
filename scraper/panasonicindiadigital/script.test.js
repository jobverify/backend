import assert from 'node:assert/strict'
import test from 'node:test'

const INDIA_HOME_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Panasonic Home Appliances &amp; Consumer Electronics in India</title>
  </head>
  <body>
    <h1>Panasonic India</h1>
    <p>Create Today. Enrich Tomorrow.</p>
    <a href="https://www.panasoniccareersindia.in/">
      Careers
    </a>
  </body>
</html>
`

const CORPORATE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us - Panasonic India</title>
  </head>
  <body>
    <h1>About Panasonic India</h1>
    <p>Corporate information for Panasonic India.</p>
    <a href="https://www.panasoniccareersindia.in/" target="_blank" rel="noopener">
      <span>Careers</span>
    </a>
    <a href="https://holdings.panasonic/global/corporate/careers.html">
      Careers [Global site]
    </a>
  </body>
</html>
`

const EXPIRED_CERT_PAGE = {
  status: 0,
  html: '',
  errorCode: 'CERT_HAS_EXPIRED',
  errorMessage: 'certificate has expired',
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

test('Panasonic India Digital pins the current India careers handoff and treats the expired-cert handoff as fail-closed', async () => {
  const panasonic = await loadModule()
  assert.ok(panasonic, 'Panasonic India Digital scraper module should load')

  assert.equal(panasonic.SOURCE, 'panasonicindiadigital')
  assert.equal(panasonic.COMPANY, 'Panasonic India Digital')
  assert.equal(panasonic.PUBLIC_SURFACE_URL, 'https://www.panasonic.com/in/')
  assert.equal(panasonic.CORPORATE_URL, 'https://www.panasonic.com/in/corporate.html')
  assert.equal(panasonic.INDIA_CAREERS_URL, 'https://www.panasoniccareersindia.in/')
  assert.equal(panasonic.hasVerifiedIndiaPublicSurface(INDIA_HOME_HTML), true)
  assert.equal(panasonic.hasVerifiedCorporateSurface(CORPORATE_HTML), true)
  assert.equal(
    panasonic.findVerifiedIndiaCareersHandoff(CORPORATE_HTML, panasonic.CORPORATE_URL)?.url?.toString(),
    panasonic.INDIA_CAREERS_URL,
  )

  const jobs = await panasonic.createPanasonicIndiaDigitalScraper().run({
    fetchPage: async (url) => {
      if (url === panasonic.PUBLIC_SURFACE_URL) {
        return { status: 200, url, html: INDIA_HOME_HTML }
      }

      if (url === panasonic.CORPORATE_URL) {
        return { status: 200, url, html: CORPORATE_HTML }
      }

      if (url === panasonic.INDIA_CAREERS_URL) {
        return { ...EXPIRED_CERT_PAGE, url }
      }

      throw new Error(`Unexpected Panasonic India Digital URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Panasonic India Digital persists dry-run results to jobs.json when --dry-run is requested', async () => {
  const panasonic = await loadModule()
  assert.ok(panasonic, 'Panasonic India Digital scraper module should load')

  const calls = []

  await panasonic.persistScrapeResults({
    argv: ['node', 'script.js', '--dry-run'],
    runImpl: async () => [],
    saveToFileImpl: async (jobs, filePath) => {
      calls.push({ type: 'file', jobs, filePath })
    },
    saveToDBImpl: async () => {
      calls.push({ type: 'db' })
    },
  })

  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, 'file')
  assert.deepEqual(calls[0].jobs, [])
  assert.match(calls[0].filePath, /panasonicindiadigital[\\/]jobs\.json$/i)
})
