import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rephrase AI | Free AI Rephraser for Better Writing</title>
  </head>
  <body>
    <header>
      <a href="https://www.rephraseai.com/tools">Tools</a>
      <a href="https://www.rephraseai.com/features">Features</a>
      <a href="https://www.rephraseai.com/pricing">Pricing</a>
      <a href="mailto:support@rephraseai.com">support@rephraseai.com</a>
    </header>
    <main>
      <h1>Rephrase smarter with AI</h1>
      <p>AI writing assistant for rewriting, summarizing, and editing.</p>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rephrase AI | Free AI Rephraser for Better Writing</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Oops! The page you're looking for doesn't exist.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rephrase AI Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/rephraseai/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const vercelSecurityCheckpointHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Vercel Security Checkpoint</title>
  </head>
  <body>
    <main>
      <h1>Vercel Security Checkpoint</h1>
      <p>Your request has been flagged by Vercel.</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rephraseai/script.js')
  } catch {
    assert.fail('Expected Rephrase.ai scraper module at ../../scraper/rephraseai/script.js')
  }
}

test('Rephrase.ai sentinel stays pinned to the verified exact-name first-party homepage and missing careers routes', async () => {
  const rephraseAi = await loadModule()

  assert.equal(rephraseAi.SOURCE, 'rephraseai')
  assert.equal(rephraseAi.COMPANY, 'Rephrase.ai')
  assert.equal(rephraseAi.OFFICIAL_BRAND_NAME, 'Rephrase AI')
  assert.equal(rephraseAi.VERIFIED_ON, '2026-08-13')
  assert.equal(rephraseAi.HOMEPAGE_URL, 'https://www.rephraseai.com/')
  assert.equal(rephraseAi.ABOUT_URL, 'https://www.rephraseai.com/about')
  assert.equal(rephraseAi.CAREERS_URL, 'https://www.rephraseai.com/careers')
  assert.equal(rephraseAi.JOBS_URL, 'https://www.rephraseai.com/jobs')
  assert.equal(rephraseAi.hasHomepageSignal(homepageHtml), true)
  assert.equal(rephraseAi.hasVercelSecurityCheckpointSignal(vercelSecurityCheckpointHtml), true)
  assert.equal(rephraseAi.hasHomepageSignal('<html><title>Other</title></html>'), false)
  assert.equal(rephraseAi.hasNotFoundSignal(notFoundHtml), true)
  assert.equal(rephraseAi.hasNotFoundSignal(publicJobsHtml), false)
  assert.deepEqual(rephraseAi.extractSuspiciousCareerLinks(homepageHtml), [])
  assert.deepEqual(
    rephraseAi.extractSuspiciousCareerLinks(publicJobsHtml),
    ['https://jobs.lever.co/rephraseai/software-engineer'],
  )
})

test('Rephrase.ai sentinel returns [] only while the verified homepage stays job-free and common careers routes remain 404s', async () => {
  const rephraseAi = await loadModule()
  const requestedUrls = []

  const jobs = await rephraseAi.createRephraseAiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return url === rephraseAi.HOMEPAGE_URL ? homepageHtml : notFoundHtml
    },
  })

  assert.deepEqual(requestedUrls, [
    rephraseAi.HOMEPAGE_URL,
    rephraseAi.ABOUT_URL,
    rephraseAi.CAREERS_URL,
    rephraseAi.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Rephrase.ai sentinel returns [] while the site stays behind the verified Vercel checkpoint on Thursday, August 13, 2026', async () => {
  const rephraseAi = await loadModule()
  const requestedUrls = []

  const jobs = await rephraseAi.createRephraseAiScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return {
        status: 429,
        url,
        html: vercelSecurityCheckpointHtml,
      }
    },
  })

  assert.deepEqual(requestedUrls, [
    rephraseAi.HOMEPAGE_URL,
    rephraseAi.ABOUT_URL,
    rephraseAi.CAREERS_URL,
    rephraseAi.JOBS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Rephrase.ai sentinel fails closed when the homepage or missing-route assumptions drift into a public jobs surface', async () => {
  const rephraseAi = await loadModule()

  await assert.rejects(
    rephraseAi.createRephraseAiScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /homepage no longer matches the verified public surface/i,
  )

  await assert.rejects(
    rephraseAi.createRephraseAiScraper().run({
      fetchText: async (url) => {
        if (url === rephraseAi.HOMEPAGE_URL) return homepageHtml
        if (url === rephraseAi.CAREERS_URL) return publicJobsHtml
        return notFoundHtml
      },
    }),
    /verified no-public-careers surface|public jobs links/i,
  )
})
