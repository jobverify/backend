import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadCognizantModule = async () => {
  try {
    return await import('../../scraper/cognizant/script.js')
  } catch {
    assert.fail('Expected Cognizant scraper module at ../../scraper/scraper/cognizant/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'cognizant',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('buildSearchUrl keeps Cognizant listings on the public India jobs route', async () => {
  const { CAREER_PAGE_URL, buildSearchUrl } = await loadCognizantModule()

  assert.equal(CAREER_PAGE_URL, 'https://careers.cognizant.com/india-en/jobs/')
  assert.equal(buildSearchUrl(), 'https://careers.cognizant.com/india-en/jobs/')
  assert.equal(buildSearchUrl({ page: 2 }), 'https://careers.cognizant.com/india-en/jobs/?page=2')
})

test('extractSearchResults keeps Cognizant India jobs from the public listing page', async () => {
  const { extractSearchResults, extractPaginationSummary } = await loadCognizantModule()
  const html = readFixture('search-results-page-1.html')
  const jobs = extractSearchResults(html)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Project Manager',
    company: 'Cognizant',
    department: 'Technology & Engineering',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '00069407792',
    requisitionId: '00069407792',
    sourceUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
    applyUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  })
  assert.equal(jobs[1].jobId, '00069407791')
  assert.equal(jobs[1].department, 'Technology & Engineering')

  assert.deepEqual(extractPaginationSummary(html), {
    currentPage: 1,
    totalPages: 201,
    totalJobCount: 2003,
    hasNext: true,
    nextPage: 2,
  })
})

test('extractJobDetail reads Cognizant detail metadata, apply links, and JSON-LD description', async () => {
  const { extractJobDetail } = await loadCognizantModule()
  const html = readFixture('job-detail-00069407792.html')
  const detail = extractJobDetail(html, {
    title: 'Project Manager',
    company: 'Cognizant',
    department: 'Technology & Engineering',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '00069407792',
    requisitionId: '00069407792',
    sourceUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
    applyUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
  })

  assert.equal(detail.title, 'Project Manager')
  assert.equal(detail.jobId, '00069407792')
  assert.equal(detail.requisitionId, '00069407792')
  assert.equal(detail.department, 'Technology & Engineering')
  assert.equal(detail.location, 'Hyderabad, Telangana, India; Gurgaon, Haryana, India; Noida, Uttar Pradesh, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, '2026-06-27')
  assert.equal(detail.closingDate, null)
  assert.equal(
    detail.applyUrl,
    'https://talent.cognizant.com/4681/?RRID=00069407792&TenantID=1&STID=1000000004',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
  )
  assert.match(detail.jobDescription, /Job Description:/i)
  assert.match(detail.jobDescription, /Strong hands-on AEP: XDM schema design/i)
  assert.match(detail.jobDescription, /Understanding of data privacy, consent frameworks/i)
})

test('extractJobDetail supports Cognizant pages whose JSON-LD script type is HTML-encoded', async () => {
  const { extractJobDetail } = await loadCognizantModule()
  const detail = extractJobDetail(`
    <h1 class="hero-heading pt-0">Project Manager</h1>
    <a class="js-apply-now btn btn-primary" id="js-apply-external" href="https://talent.cognizant.com/4681/?RRID=00069407792&amp;TenantID=1&amp;STID=1000000004">Apply now</a>
    <script id="js-job-posting" type="application/ld&#x2B;json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Project Manager","description":"\\u003Cp\\u003ECloudflare-safe payload\\u003C/p\\u003E","identifier":"00069407792","url":"https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/","datePosted":"2026-06-27","employmentType":"FULL_TIME","industry":"Technology \\u0026 Engineering","jobLocation":[{"@type":"Place","address":{"@type":"PostalAddress","addressCountry":"India","addressLocality":"Hyderabad","addressRegion":"Telangana"}}]}
    </script>
  `, {
    title: 'Project Manager',
    company: 'Cognizant',
    department: 'Technology & Engineering',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    jobId: '00069407792',
    requisitionId: '00069407792',
    sourceUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
    applyUrl: 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
  })

  assert.equal(detail.jobId, '00069407792')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.postingDate, '2026-06-27')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.match(detail.jobDescription, /Cloudflare-safe payload/i)
})

test('run paginates Cognizant listing pages, fetches details, and decorates shared runner fields', async () => {
  const { buildSearchUrl, createCognizantScraper } = await loadCognizantModule()
  const page1Html = readFixture('search-results-page-1.html')
  const page2Html = readFixture('search-results-page-2.html')
  const detailHtml = readFixture('job-detail-00069407792.html')
  const requests = []
  const scraper = createCognizantScraper({ maxPages: 2, maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === buildSearchUrl()) return page1Html
      if (url === buildSearchUrl({ page: 2 })) return page2Html
      if (url === 'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/') return detailHtml
      if (url === 'https://careers.cognizant.com/india-en/jobs/00069407791/project-manager/') return detailHtml.replaceAll('00069407792', '00069407791')

      throw new Error(`Unexpected Cognizant URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    buildSearchUrl(),
    'https://careers.cognizant.com/india-en/jobs/00069407792/project-manager/',
    'https://careers.cognizant.com/india-en/jobs/00069407791/project-manager/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cognizant')
  assert.equal(jobs[0].company, 'Cognizant')
  assert.ok(jobs.every((job) => job.link === job.applyUrl))
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('createDefaultFetchText falls back to curl when the default fetch path has a transport failure', async () => {
  const { createDefaultFetchText } = await loadCognizantModule()
  const calls = []
  const fetchText = createDefaultFetchText({
    fetchImpl: async () => {
      throw new Error('fetch failed')
    },
    execFileImpl: (command, args, callback) => {
      calls.push({ type: 'execFile', command, args })
      callback(null, '<html>ok</html>', '')
    },
  })

  const html = await fetchText('https://careers.cognizant.com/india-en/jobs/')

  assert.equal(html, '<html>ok</html>')
  assert.equal(calls[0].type, 'execFile')
  assert.match(calls[0].command, /curl(\.exe)?$/i)
  assert.ok(calls[0].args.includes('https://careers.cognizant.com/india-en/jobs/'))
})

test('createDefaultFetchText treats Cognizant Cloudflare challenge pages as upstream blocks', async () => {
  const { createDefaultFetchText } = await loadCognizantModule()
  const calls = []
  const fetchText = createDefaultFetchText({
    fetchImpl: async (url, options) => {
      calls.push({ type: 'fetch', url, options })
      return {
        status: 403,
        ok: false,
        headers: {
          get(name) {
            const normalized = String(name).toLowerCase()
            if (normalized === 'server') return 'cloudflare'
            if (normalized === 'cf-ray') return 'abc123'
            return null
          },
        },
        text: async () => '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Please enable JavaScript and cookies to continue <script src="https://challenges.cloudflare.com/turnstile.js"></script></body></html>',
      }
    },
    execFileImpl: (command, args, callback) => {
      calls.push({ type: 'execFile', command, args })
      callback(null, '<html>ok</html>', '')
    },
  })

  await assert.rejects(
    fetchText('https://careers.cognizant.com/india-en/jobs/'),
    (error) => {
      assert.match(error.message, /HTTP 403 Cloudflare challenge/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.abortRetries, true)
      return true
    },
  )

  assert.equal(calls.length, 1)
  assert.equal(calls[0].type, 'fetch')
})

test('run returns [] when the live Cognizant careers route matches the verified Cloudflare challenge shell', async () => {
  const { CAREER_PAGE_URL, createCognizantScraper } = await loadCognizantModule()
  const requestedPages = []
  const scraper = createCognizantScraper({ maxPages: 1 })

  const jobs = await scraper.run({
    fetchText: async () => {
      const error = new Error(`Cognizant careers page returned HTTP 403 Cloudflare challenge (Just a moment...) for ${CAREER_PAGE_URL}`)
      error.softFailure = true
      error.upstreamOutage = true
      error.failureKind = 'blocked_or_access_denied'
      error.abortRetries = true
      throw error
    },
    fetchPage: async (url) => {
      requestedPages.push(url)
      return {
        status: 403,
        url,
        headers: {
          server: 'cloudflare',
          'cf-ray': 'a2abdc0e7f7c28bc-MAA',
          'cf-mitigated': 'challenge',
        },
        html: '<!DOCTYPE html><html><head><title>Just a moment...</title></head><body>Enable JavaScript and cookies to continue <script src="https://challenges.cloudflare.com"></script></body></html>',
      }
    },
  })

  assert.deepEqual(requestedPages, [CAREER_PAGE_URL])
  assert.deepEqual(jobs, [])
})
