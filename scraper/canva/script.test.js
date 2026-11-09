import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  buildJobsPageUrl,
  createCanvaScraper,
  extractIndiaJobCardsFromPage,
  extractPaginationSummary,
  hasOfficialJobsPageSignal,
  hasVerifiedCloudflareChallengeSignal,
} from './script.js'

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Find Authentic Jobs | Canva Careers</title>
  </head>
  <body>
    <main>
      <h1>Find Authentic Jobs</h1>
      <div>Location Type</div>
      <div>Work Type</div>
      <div>1 of 2 Live Results</div>
      <article>
        <h2><a href="/en/jobs/7777777/software-engineer-platform/">Software Engineer, Platform</a></h2>
        <ul>
          <li>Bangalore, India</li>
          <li>Engineering</li>
        </ul>
      </article>
      <article>
        <h2><a href="/en/jobs/8888888/backend-engineer-london/">Backend Engineer</a></h2>
        <ul>
          <li>London, United Kingdom</li>
          <li>Engineering</li>
        </ul>
      </article>
    </main>
  </body>
</html>
`

const blockedChallengePage = {
  status: 403,
  url: CAREERS_URL,
  headers: {
    server: 'cloudflare',
    'cf-ray': 'a2abd7556e63f3fd-MAA',
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

const blockedSecondPage = {
  ...blockedChallengePage,
  url: buildJobsPageUrl({ page: 2 }),
}

test('Canva keeps verified first-party India job cards and canonical URLs', () => {
  assert.equal(buildJobsPageUrl(), CAREERS_URL)
  assert.equal(buildJobsPageUrl({ page: 2 }), 'https://www.lifeatcanva.com/en/jobs/?page=2')
  assert.equal(hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.deepEqual(extractPaginationSummary(jobsPageHtml), {
    currentPage: 1,
    totalPages: 1,
    hasNext: false,
    totalJobCount: 2,
  })
  assert.deepEqual(extractIndiaJobCardsFromPage(jobsPageHtml), [
    {
      title: 'Software Engineer, Platform',
      location: 'Bangalore, India',
      department: 'Engineering',
      sourceUrl: 'https://www.lifeatcanva.com/en/jobs/7777777/software-engineer-platform/',
      jobId: '7777777',
      requisitionId: '7777777',
    },
  ])
})

test('Canva run returns normalized India jobs from the verified first-party jobs page', async () => {
  const jobs = await createCanvaScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return jobsPageHtml
    },
    now: () => '2026-08-14T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Software Engineer, Platform',
      company: 'Canva',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      link: 'https://www.lifeatcanva.com/en/jobs/7777777/software-engineer-platform/',
      applyUrl: 'https://www.lifeatcanva.com/en/jobs/7777777/software-engineer-platform/',
      sourceUrl: 'https://www.lifeatcanva.com/en/jobs/7777777/software-engineer-platform/',
      source: 'canva',
      jobId: '7777777',
      requisitionId: '7777777',
      department: 'Engineering',
      employmentType: null,
      experienceRequired: null,
      jobDescription: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      remoteStatus: 'On-site',
      scrapedAt: '2026-08-14T00:00:00.000Z',
      sourceListingComplete: false,
      sourceScopeComplete: false,
      lifecycleCleanupAllowed: false,
    },
  ])
})

test('Canva stops on a verified Cloudflare challenge with unavailable inventory', async () => {
  const requestedUrls = []

  assert.equal(hasVerifiedCloudflareChallengeSignal(blockedChallengePage), true)

  assert.equal(hasVerifiedCloudflareChallengeSignal(blockedSecondPage), true)
  await assert.rejects(createCanvaScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return blockedChallengePage
      if (url === buildJobsPageUrl({ page: 2 })) return blockedSecondPage
      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => {
    assert.equal(error.status, 403)
    assert.equal(error.abortRetries, true)
    assert.equal(error.inventoryEvidence.status, 'coverage-gap')
    assert.equal(error.inventoryEvidence.listingComplete, false)
    assert.equal(error.inventoryEvidence.reportedTotal, null)
    assert.equal(error.inventoryEvidence.indiaFacetCount, null)
    return true
  })
  assert.deepEqual(requestedUrls, [CAREERS_URL])
})
