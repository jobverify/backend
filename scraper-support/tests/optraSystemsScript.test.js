import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_PORTFOLIO_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Optra Ventures</title>
  </head>
  <body>
    <section>
      <h2>Portfolio Companies</h2>
      <article>
        <h3>Optra Systems</h3>
        <p>A product engineering venture supporting medical devices and lab instrumentation product companies on design, development, prototyping, manufacturing and regulatory.</p>
        <p>www.optrasystems.com</p>
      </article>
      <article>
        <h3>Optra HEALTH</h3>
        <p>World's first Conversational AI platform for Digital Genetic Assistance.</p>
      </article>
    </section>
  </body>
</html>
`

const PUBLIC_JOBS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Optra Systems Careers</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="/apply/process-engineer">Apply Now</a>
  </body>
</html>
`

const changedPortfolioHtml = VERIFIED_PORTFOLIO_HTML.replace('www.optrasystems.com', 'www.optra.example')

const unresolvedPrimaryError = Object.assign(
  new Error('getaddrinfo ENOTFOUND optrasystems.com'),
  { code: 'ENOTFOUND' },
)

const unresolvedWwwError = new Error('Could not resolve host: www.optrasystems.com')

const loadOptraSystemsModule = async () => {
  try {
    return await import('../../scraper/optrasystems/script.js')
  } catch {
    assert.fail('Expected Optra Systems scraper module at ../../scraper/optrasystems/script.js')
  }
}

test('Optra Systems helpers pin the official portfolio reference and unresolved exact-name domain contract', async () => {
  const optraSystems = await loadOptraSystemsModule()

  assert.equal(optraSystems.SOURCE, 'optrasystems')
  assert.equal(optraSystems.COMPANY, 'Optra Systems')
  assert.equal(optraSystems.PRIMARY_DOMAIN_URL, 'https://optrasystems.com/')
  assert.equal(optraSystems.WWW_DOMAIN_URL, 'https://www.optrasystems.com/')
  assert.equal(optraSystems.PORTFOLIO_URL, 'https://www.optraventures.com/')
  assert.equal(optraSystems.VERIFIED_ON, '2026-07-17')
  assert.equal(optraSystems.hasOfficialPortfolioSignal(VERIFIED_PORTFOLIO_HTML), true)
  assert.equal(optraSystems.hasPublicJobSignals(PUBLIC_JOBS_HTML), true)
  assert.equal(optraSystems.isExactNameResolutionFailure(unresolvedPrimaryError), true)
  assert.equal(optraSystems.isExactNameResolutionFailure(unresolvedWwwError), true)
})

test('Optra Systems returns [] only while the exact-name domains stay unresolved and the official portfolio reference remains stable', async () => {
  const optraSystems = await loadOptraSystemsModule()
  const requests = []

  const jobs = await optraSystems.createOptraSystemsScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === optraSystems.PORTFOLIO_URL) return VERIFIED_PORTFOLIO_HTML
      if (url === optraSystems.PRIMARY_DOMAIN_URL) throw unresolvedPrimaryError
      if (url === optraSystems.WWW_DOMAIN_URL) throw unresolvedWwwError
      throw new Error(`Unexpected Optra Systems URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    optraSystems.PORTFOLIO_URL,
    optraSystems.PRIMARY_DOMAIN_URL,
    optraSystems.WWW_DOMAIN_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Optra Systems fails closed when the exact-name domain or official portfolio evidence changes materially', async () => {
  const optraSystems = await loadOptraSystemsModule()

  await assert.rejects(
    optraSystems.createOptraSystemsScraper().run({
      fetchText: async (url) => {
        if (url === optraSystems.PORTFOLIO_URL) return VERIFIED_PORTFOLIO_HTML
        if (url === optraSystems.PRIMARY_DOMAIN_URL) return PUBLIC_JOBS_HTML
        if (url === optraSystems.WWW_DOMAIN_URL) throw unresolvedWwwError
        throw new Error(`Unexpected Optra Systems URL: ${url}`)
      },
    }),
    /public jobs surface/i,
  )

  await assert.rejects(
    optraSystems.createOptraSystemsScraper().run({
      fetchText: async (url) => {
        if (url === optraSystems.PORTFOLIO_URL) return changedPortfolioHtml
        if (url === optraSystems.PRIMARY_DOMAIN_URL) throw unresolvedPrimaryError
        if (url === optraSystems.WWW_DOMAIN_URL) throw unresolvedWwwError
        throw new Error(`Unexpected Optra Systems URL: ${url}`)
      },
    }),
    /portfolio/i,
  )

  await assert.rejects(
    optraSystems.createOptraSystemsScraper().run({
      fetchText: async (url) => {
        if (url === optraSystems.PORTFOLIO_URL) return VERIFIED_PORTFOLIO_HTML
        if (url === optraSystems.PRIMARY_DOMAIN_URL) return '<html><body>Optra Systems</body></html>'
        if (url === optraSystems.WWW_DOMAIN_URL) throw unresolvedWwwError
        throw new Error(`Unexpected Optra Systems URL: ${url}`)
      },
    }),
    /exact-name domain/i,
  )
})
