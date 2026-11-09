import assert from 'node:assert/strict'
import test from 'node:test'

const loadScioModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SCIO Management Solutions scraper module at ./script.js')
  }
}

const placeholderShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>SCIO Management Solutions - Intelligent, Automated RCM Services</title>
    <link rel="canonical" href="https://www.scioms.com/index.php" />
  </head>
  <body>
    <main>
      <h1>Request a Consultation</h1>
      <button type="submit">Submit</button>
      <button type="button">Close</button>
    </main>
  </body>
</html>
`

test('SCIO sentinel pins the current canonical placeholder shells', async () => {
  const scio = await loadScioModule()

  assert.equal(scio.SOURCE, 'sciomanagementsolutions')
  assert.equal(scio.COMPANY, 'SCIO Management Solutions')
  assert.equal(scio.CAREERS_URL, 'https://scioms.com/careers.php')
  assert.equal(scio.APPLY_URL, 'https://scioms.com/apply-now.php')
  assert.equal(scio.VERIFIED_ON, '2026-08-14')

  assert.equal(scio.hasVerifiedPlaceholderShellSignal(placeholderShellHtml), true)
  assert.equal(scio.hasVerifiedCareersSignal(placeholderShellHtml), true)
  assert.equal(scio.hasVerifiedApplyFormSignal(placeholderShellHtml), true)
  assert.deepEqual(scio.extractPositionOptions(placeholderShellHtml), [])
  assert.equal(scio.hasPublicJobListingsSignal(placeholderShellHtml), false)
})

test('SCIO sentinel detects real public job signals once positions or job routes appear', async () => {
  const scio = await loadScioModule()

  assert.equal(
    scio.hasPublicJobListingsSignal(
      '<main><h1>Current Openings</h1><a href="/job/senior-analyst-rcm">Senior Analyst - RCM</a></main>',
    ),
    true,
  )
  assert.equal(scio.hasPublicJobListingsSignal('<div>Job ID: SCIO-101</div>'), true)
})

test('SCIO sentinel returns [] while the canonical careers and apply routes stay on the verified placeholder shell', async () => {
  const scio = await loadScioModule()
  const requested = []

  const jobs = await scio.createScioManagementSolutionsScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === scio.CAREERS_URL) return placeholderShellHtml
      if (url === scio.APPLY_URL) return placeholderShellHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [scio.CAREERS_URL, scio.APPLY_URL])
  assert.deepEqual(jobs, [])
})

test('SCIO falls back to the lenient transport when direct HTTP parsing breaks', async () => {
  const scio = await loadScioModule()
  const protocolError = new TypeError('fetch failed')
  protocolError.cause = new Error(
    'Response does not match the HTTP/1.1 protocol (Invalid header value char)',
  )

  const requested = []
  const jobs = await scio.createScioManagementSolutionsScraper().run({
    fetchText: async () => {
      throw protocolError
    },
    fetchLenientText: async (url) => {
      requested.push(url)
      if (url === scio.CAREERS_URL) return placeholderShellHtml
      if (url === scio.APPLY_URL) return placeholderShellHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [scio.CAREERS_URL, scio.APPLY_URL])
  assert.deepEqual(jobs, [])
})

test('SCIO sentinel fails closed when the verified shell drifts or positions appear', async () => {
  const scio = await loadScioModule()

  await assert.rejects(
    scio.createScioManagementSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === scio.CAREERS_URL) {
          return '<html><body><h1>SCIO Careers</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified SCIO Management Solutions careers shell/i,
  )

  await assert.rejects(
    scio.createScioManagementSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === scio.CAREERS_URL) return placeholderShellHtml
        if (url === scio.APPLY_URL) {
          return '<html><body><h1>Current Openings</h1><a href="/job/associate-coding">Associate, Coding</a></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /exposes public positions/i,
  )
})
