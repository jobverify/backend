import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/yalamanchilisoftwareexports/script.js')
  } catch {
    assert.fail('Expected Yalamanchili Software Exports scraper module at ../../scraper/yalamanchilisoftwareexports/script.js')
  }
}

test('Yalamanchili Software Exports validates the verified exact-name sentinel surfaces', async () => {
  const yalamanchili = await loadModule()

  assert.equal(yalamanchili.isExpectedDormantSurface({ errorKind: 'timeout' }), true)
  assert.equal(yalamanchili.isExpectedDormantSurface({ status: 404, html: '<html><body>Not Found</body></html>' }), true)
  assert.equal(
    yalamanchili.isExpectedRedirectedHomepageSurface({
      status: 200,
      finalUrl: 'https://www.ysppayments.com/',
      html: `
        <html>
          <head>
            <title>YSP | Yalamanchili Solutions for Payments</title>
            <script>window.__asset = "/jobs/runtime.js"</script>
          </head>
          <body>
            <main>
              <h1>One Platform, Infinite Solutions</h1>
              <p>Providing enterprise class customizable and scalable end-to-end payment solutions since 1998.</p>
            </main>
          </body>
        </html>
      `,
    }),
    true,
  )
  assert.equal(yalamanchili.isExpectedDormantSurface({ errorKind: 'dns' }), false)
  assert.equal(yalamanchili.isUnexpectedReachableSurface({ status: 200, html: '<html><body>Careers</body></html>' }), true)
})

test('Yalamanchili Software Exports run verifies the exact-name root and common careers routes before returning []', async () => {
  const yalamanchili = await loadModule()
  const requestedUrls = []

  const jobs = await yalamanchili.createYalamanchiliSoftwareExportsScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      return {
        url,
        finalUrl: url,
        status: null,
        html: null,
        errorKind: 'timeout',
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.yalamanchili.co.in/',
    'https://www.ysppayments.com/',
    'https://www.yalamanchili.co.in/careers',
    'https://www.yalamanchili.co.in/jobs',
    'https://www.yalamanchili.co.in/careers.html',
    'https://www.ysppayments.com/career',
    'https://www.ysppayments.com/careers',
    'https://www.ysppayments.com/jobs',
  ])
  assert.deepEqual(jobs, [])
})

test('Yalamanchili Software Exports fails closed when an exact-name surface becomes reachable', async () => {
  const yalamanchili = await loadModule()

  await assert.rejects(
    yalamanchili.createYalamanchiliSoftwareExportsScraper().run({
      probeUrl: async (url) => ({
        url,
        finalUrl: url,
        status: 200,
        html: '<html><body><a href="/apply">Apply now</a></body></html>',
        errorKind: null,
      }),
    }),
    /public jobs surface/i,
  )
})
