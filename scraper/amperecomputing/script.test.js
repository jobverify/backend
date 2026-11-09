import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  INDIA_SEARCH_URL,
  SEARCH_URL,
  createAmpereComputingScraper,
  extractSearchResults,
  hasOfficialSearchResultsSignal,
  hasVerifiedCloudflareChallengeSignal,
} from './script.js'

const searchHtml = `
<main>
  <div class="job-card">
    <a class="job-title" href="/jobs/17948977-principal-cloud-and-devops-engineer">Principal Cloud &amp; DevOps Engineer</a>
    <span class="job-category">Information Technology</span>
    <span class="job-location">Pune, MH, India</span>
  </div>
  <div class="job-card">
    <a class="job-title" href="/jobs/17948978-principal-cloud-and-devops-engineer">Principal Cloud &amp; DevOps Engineer</a>
    <span class="job-category">Information Technology</span>
    <span class="job-location">Portland, OR, United States</span>
  </div>
</main>
`

const detailHtml = `
<html>
  <head>
    <script type="application/ld+json">
      {"@type":"JobPosting","title":"Principal Cloud & DevOps Engineer","description":"Build and operate cloud delivery systems.","datePosted":"2026-07-01","employmentType":"FULL_TIME","jobLocation":{"address":{"addressLocality":"Pune","addressRegion":"MH","addressCountry":"India"}}}
    </script>
  </head>
</html>
`

const blockedChallengePage = {
  status: 403,
  url: SEARCH_URL,
  headers: {
    server: 'cloudflare',
    'cf-ray': 'a2abc87858e29f61-MAA',
    'cf-mitigated': 'challenge',
  },
  html: `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Just a moment...</title>
  </head>
  <body>
    <noscript>
      <div>Enable JavaScript and cookies to continue</div>
    </noscript>
    <script src="https://challenges.cloudflare.com"></script>
  </body>
</html>
`,
}

const blockedIndiaChallengePage = {
  ...blockedChallengePage,
  url: INDIA_SEARCH_URL,
}

test('extractSearchResults keeps India jobs and maps official detail URLs', () => {
  assert.deepEqual(extractSearchResults(searchHtml), [
    {
      title: 'Principal Cloud & DevOps Engineer',
      category: 'Information Technology',
      location: 'Pune, MH, India',
      jobId: '17948977',
      sourceUrl: 'https://careers.amperecomputing.com/jobs/17948977-principal-cloud-and-devops-engineer',
    },
  ])
  assert.equal(hasOfficialSearchResultsSignal(searchHtml), true)
})

test('run rejects an unbound historical search sample even when it contains India cards and JSON-LD', async () => {
  await assert.rejects(createAmpereComputingScraper().run({fetchText:async url=>url===SEARCH_URL?searchHtml:detailHtml}), /Ampere native contract/)
  assert.equal(CAREER_PAGE_URL, 'https://careers.amperecomputing.com/')
})

test('run reports a blocked inventory when the configured Ampere search route returns a Cloudflare challenge', async () => {
  const requestedUrls = []
  const scraper = createAmpereComputingScraper()

  assert.equal(hasVerifiedCloudflareChallengeSignal(blockedChallengePage), true)

  await assert.rejects(scraper.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === SEARCH_URL) return blockedChallengePage
      if (url === INDIA_SEARCH_URL) return blockedIndiaChallengePage
      throw new Error(`Unexpected URL: ${url}`)
    },
  }), e=>e.failureKind==='blocked_or_access_denied'&&e.status===403)

  assert.deepEqual(requestedUrls, [SEARCH_URL])
})
