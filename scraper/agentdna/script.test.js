import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>AgentDNA - Build Smarter AI Agents</title>
    </head>
    <body>
      <nav>
        <a href="/">AgentDNA</a>
        <a href="/blog">Blog</a>
        <a href="/app">Get started free</a>
      </nav>
      <main>
        <p>The modular gene system for AI agents</p>
        <h1>Build AI agents from composable genes</h1>
        <p>Start building smarter agents today</p>
      </main>
    </body>
  </html>
`

const currentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>AgentDNA - Build Smarter AI Agents</title>
      <meta name="description" content="The modular gene system for composable AI agents. Define skills, wire up tools, encode personality -- then ship agents that actually work.">
    </head>
    <body>
      <main>
        <span>The modular gene system for AI agents</span>
        <h1>Build AI agents from<!-- --> <span>composable genes</span></h1>
        <p>AgentDNA gives you a modular system to create, manage, and share AI agent components.</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>AgentDNA - Build Smarter AI Agents</title>
    </head>
    <body>
      <nav>
        <a href="/">AgentDNA</a>
        <a href="/blog">Blog</a>
        <a href="/app">Get started free</a>
      </nav>
      <main>
        <p>The modular gene system for AI agents</p>
        <h1>Build AI agents from composable genes</h1>
        <p>Create free account</p>
      </main>
    </body>
  </html>
`

const missingCareersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>404: This page could not be found.</title>
    </head>
    <body>
      <h1>404</h1>
      <p>This page could not be found.</p>
      <p>AgentDNA - Build Smarter AI Agents</p>
    </body>
  </html>
`

test('AgentDNA scraper module loads and validates the official branded no-listings surface', async () => {
  const agentdna = await loadModule()
  assert.ok(agentdna, 'AgentDNA scraper module should load')

  const {
    CAREERS_URL,
    HOMEPAGE_URL,
    hasOfficialAgentDnaSignal,
    hasPublicJobBoardSignal,
    matchesBrandedExperience,
    validateJobResults,
  } = agentdna

  assert.equal(HOMEPAGE_URL, 'https://www.agentdna.ai/')
  assert.equal(CAREERS_URL, 'https://www.agentdna.ai/careers')
  assert.equal(hasOfficialAgentDnaSignal(homepageHtml), true)
  assert.equal(hasOfficialAgentDnaSignal(currentHomepageHtml), true)
  assert.equal(hasOfficialAgentDnaSignal(careersHtml), true)
  assert.equal(matchesBrandedExperience(homepageHtml, careersHtml), true)
  assert.equal(hasPublicJobBoardSignal(homepageHtml), false)
  assert.equal(hasPublicJobBoardSignal(careersHtml), false)
  assert.deepEqual(validateJobResults([]), [])
})

test('AgentDNA scraper returns no jobs when the careers route is the current branded 404 without job signals', async () => {
  const agentdna = await loadModule()
  assert.ok(agentdna, 'AgentDNA scraper module should load')

  const { CAREERS_URL, HOMEPAGE_URL, createAgentDnaScraper } = agentdna

  const requests = []
  const jobs = await createAgentDnaScraper().run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === HOMEPAGE_URL) return currentHomepageHtml
      if (url === CAREERS_URL) return missingCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    CAREERS_URL,
    CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('AgentDNA scraper returns no jobs when the public careers route matches the branded site shell without a job board', async () => {
  const agentdna = await loadModule()
  assert.ok(agentdna, 'AgentDNA scraper module should load')

  const { CAREERS_URL, HOMEPAGE_URL, createAgentDnaScraper } = agentdna

  const requests = []
  const jobs = await createAgentDnaScraper().run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    CAREERS_URL,
    CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('AgentDNA scraper rejects a careers route that starts exposing a public job board', async () => {
  const agentdna = await loadModule()
  assert.ok(agentdna, 'AgentDNA scraper module should load')

  const { createAgentDnaScraper } = agentdna

  await assert.rejects(
    createAgentDnaScraper().run({
      fetchText: async (url) => {
        if (url.endsWith('/careers')) {
          return `
            <html>
              <head><title>AgentDNA Careers</title></head>
              <body>
                <h1>Careers</h1>
                <h2>Open Roles</h2>
                <a href="/jobs/founding-ai-engineer">Apply Now</a>
              </body>
            </html>
          `
        }

        return homepageHtml
      },
    }),
    /public careers route now exposes unreviewed job/i,
  )
})


for (const route of ['configured careers']) {
  for (const [status, failureKind] of [[503, 'network_or_timeout'], [403, 'blocked_or_access_denied']]) {
    test('AgentDNA classifies HTTP ' + status + ' on ' + route + ' as an upstream failure', async () => {
      const { createAgentDnaScraper, CAREERS_URL } = await import('./script.js')
      const { classifyScraperError } = await import('../../scraper-support/utils/failureClassification.js')
      await assert.rejects(createAgentDnaScraper().run({
        fetchPage: async (url) => {
          assert.equal(url,CAREERS_URL)
          return { status, url, html:'The deployment is currently unavailable\nDEPLOYMENT_PAUSED' }
        },
      }), (error) => {
        assert.deepEqual(classifyScraperError(error), { softFailure: true, upstreamOutage: true, failureKind })
        return true
      })
    })
  }
}
