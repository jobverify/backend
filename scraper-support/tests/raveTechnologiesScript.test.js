import assert from 'node:assert/strict'
import test from 'node:test'

const SUCCESSOR_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head><title>NEC Software Solutions - Orchestrating a Brighter World</title></head>
  <body>
    <h1>NEC Software Solutions</h1>
    <a href="https://www.necsws.com/india/careers/">Careers</a>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Careers - NEC Software Solutions</title></head>
  <body>
    <h1>Careers</h1>
    <a href="https://jobs.smartrecruiters.com/NECSWS/123-solution-architect">View jobs</a>
  </body>
</html>
`

const SMARTRECRUITERS_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Careers at NECSWS</title></head>
  <body>
    <script>window._jsErrorTrackerOptions = {}</script>
    <main id="career-site-ui">Open roles</main>
  </body>
</html>
`

const DETAIL_URL = 'https://api.smartrecruiters.com/v1/companies/NECSWS/postings/job-123'

const LISTING_PAYLOAD = {
  totalFound: 1,
  content: [
    {
      id: 'job-123',
      name: 'Solution Architect - Early joiners',
      visibility: 'PUBLIC',
      company: { identifier: 'NECSWS' },
      ref: DETAIL_URL,
      postingUrl: 'https://jobs.smartrecruiters.com/NECSWS/job-123-solution-architect-early-joiners',
      applyUrl: 'https://jobs.smartrecruiters.com/NECSWS/job-123-solution-architect-early-joiners?oga=true',
      location: {
        fullLocation: 'Mumbai, Maharashtra, India',
        city: 'Mumbai',
        country: 'in',
      },
      function: { label: 'Technology' },
      typeOfEmployment: { label: 'Full-time' },
      experienceLevel: { label: 'Mid-Senior Level' },
      refNumber: 'REF-123',
      releasedDate: '2026-09-01',
    },
  ],
}

const DETAIL_PAYLOAD = {
  ...LISTING_PAYLOAD.content[0],
  id: 'job-123',
  name: 'Solution Architect - Early joiners',
  jobAd: {
    sections: {
      jobDescription: { text: '<p>Design NEC public-sector software solutions.</p>' },
      qualifications: { text: '<p>Strong solution architecture experience.</p>' },
    },
  },
}

const loadModule = async () => {
  try {
    return await import('../../scraper/ravetechnologies/script.js')
  } catch {
    assert.fail('Expected Rave Technologies scraper module at ../../scraper/ravetechnologies/script.js')
  }
}

test('Rave Technologies requests the canonical NEC careers route directly before reading SmartRecruiters', async () => {
  const rave = await loadModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await rave.createRaveTechnologiesScraper({ maxJobs: 1 }).run({
    now: () => '2026-09-13T00:00:00.000Z',
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === 'https://www.necsws.com/india/') return SUCCESSOR_HOMEPAGE_HTML
      if (url === 'https://www.necsws.com/india') throw Object.assign(new Error(`HTTP 301 for ${url}`), { status: 301 })
      if (/^https:\/\/www\.necsws\.com\/careers\/?$/.test(url)) return CAREERS_HTML
      if (url === rave.SMARTRECRUITERS_BOARD_URL) return SMARTRECRUITERS_BOARD_HTML
      throw new Error(`Unexpected Rave text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === DETAIL_URL) return DETAIL_PAYLOAD
      if (url.startsWith(rave.SMARTRECRUITERS_LISTING_API_URL)) return LISTING_PAYLOAD
      throw new Error(`Unexpected Rave JSON URL: ${url}`)
    },
  })

  assert.equal(rave.CAREERS_URL, 'https://www.necsws.com/careers/')
  assert.deepEqual(requestedTextUrls, [
    'https://www.necsws.com/india/',
    'https://www.necsws.com/careers/',
    rave.SMARTRECRUITERS_BOARD_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    'https://api.smartrecruiters.com/v1/companies/NECSWS/postings?limit=100&country=in&offset=0',
    DETAIL_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Solution Architect - Early joiners')
  assert.equal(jobs[0].source, 'ravetechnologies')
})

test('Rave Technologies reports a typed blocked failure when the NEC careers route serves HTTP 307', async () => {
  const rave = await loadModule()
  const redirectChallenge = Object.assign(
    new Error(`HTTP 307 for ${rave.CAREERS_URL}`),
    { status: 307 },
  )

  await assert.rejects(
    rave.createRaveTechnologiesScraper({ maxJobs: 1 }).run({
      fetchText: async (url) => {
        if (url === rave.SUCCESSOR_HOMEPAGE_URL) return SUCCESSOR_HOMEPAGE_HTML
        if (url === rave.CAREERS_URL) throw redirectChallenge
        throw new Error(`Unexpected Rave text URL: ${url}`)
      },
      fetchJson: async () => {
        throw new Error('Rave should not request SmartRecruiters JSON after a blocked careers route')
      },
    }),
    (error) => {
      assert.match(error.message, /Rave Technologies NEC careers route is currently blocked/i)
      assert.equal(error.cause, redirectChallenge)
      assert.equal(error.failureKind, 'blocked_or_access_denied')
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      assert.equal(error.abortRetries, true)
      return true
    },
  )
})
