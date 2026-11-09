import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Work at Haptik!</h1>
    <p>Our Values: Ownership, Perseverance, Agility, Impact, Integrity</p>
    <a href="https://haptik.freshteam.com/jobs">Explore All Open Positions</a>
  </body>
</html>
`

const careersHtmlWithTrackedFreshteamLink = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Work at Haptik!</h1>
    <p>Our Values: Ownership, Perseverance, Agility, Impact, Integrity</p>
    <a href="https://haptik.freshteam.com/jobs?utm_source=haptik&amp;hsCtaTracking=abc123">Explore All Open Positions</a>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Haptik Careers</h4>
    <h3>Open Positions</h3>
    <a href="/jobs/8RrzHwmKvc5h/software-engineer-backend">
      <span>Software Engineer - Backend</span>
      <span>Mumbai, Maharashtra</span>
      <span>Full Time</span>
    </a>
    <a href="/jobs/XjoJUGgeIgji/software-engineer-backend-l3-python">
      <span>Software Engineer, Backend - L3 (Python)</span>
      <span>Mumbai, Maharashtra</span>
      <span>Full Time</span>
    </a>
    <a href="/jobs/HVivFopqkiC1/voice-ai-engineer-hybrid">
      <span>Voice AI Engineer (Hybrid)</span>
      <span>Mumbai, Maharashtra</span>
      <span>Full Time</span>
    </a>
    <a href="/jobs/us0000000001/global-alliances-manager">
      <span>Global Alliances Manager</span>
      <span>New York, New York</span>
      <span>Full Time</span>
    </a>
  </body>
</html>
`

const backendDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Engineering</h4>
    <h1>Software Engineer - Backend</h1>
    <p>Mumbai, Maharashtra</p>
    <p>Work Type: Full Time</p>
    <h2>What we want to accomplish and why we need you?</h2>
    <p>Haptik is one of the world's largest Conversational AI companies.</p>
    <p>As a Software Engineer - Backend, you will be working in a fast-paced agile environment.</p>
    <p>2-6 years of experience in developing and integrating scalable products.</p>
    <h2>Submit Your Application</h2>
  </body>
</html>
`

const l3DetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Engineering</h4>
    <h1>Software Engineer, Backend - L3 (Python)</h1>
    <p>Mumbai, Maharashtra</p>
    <p>Work Type: Full Time</p>
    <p>Design, build, and maintain high-performance, scalable, and secure backend services that power Haptik’s conversational AI products.</p>
    <h2>Submit Your Application</h2>
  </body>
</html>
`

const voiceDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Engineering</h4>
    <h1>Voice AI Engineer (Hybrid)</h1>
    <p>Mumbai, Maharashtra</p>
    <p>Work Type: Full Time</p>
    <p>We are looking for a Voice & AI Engineer to build and scale intelligent voice solutions for our customers.</p>
    <h2>Submit Your Application</h2>
  </body>
</html>
`

const usDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Business Development and Sales</h4>
    <h1>Global Alliances Manager</h1>
    <p>New York, New York</p>
    <p>Work Type: Full Time</p>
    <p>This non-India role should be ignored.</p>
    <h2>Submit Your Application</h2>
  </body>
</html>
`

const loadHaptikModule = async () => {
  try {
    return await import('../../scraper/haptik/script.js')
  } catch {
    assert.fail('Expected Haptik scraper module at ../../scraper/haptik/script.js')
  }
}

test('Haptik verifies the official careers handoff and Freshteam board constants', async () => {
  const haptik = await loadHaptikModule()

  assert.equal(haptik.CAREERS_URL, 'https://www.haptik.ai/careers')
  assert.equal(haptik.LISTING_URL, 'https://haptik.freshteam.com/jobs')
  assert.equal(
    haptik.buildDetailUrl('8RrzHwmKvc5h', 'software-engineer-backend'),
    'https://haptik.freshteam.com/jobs/8RrzHwmKvc5h/software-engineer-backend',
  )
  assert.equal(haptik.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(haptik.extractFreshteamJobsUrl(careersHtml), haptik.LISTING_URL)
  assert.equal(
    haptik.extractFreshteamJobsUrl(careersHtmlWithTrackedFreshteamLink),
    haptik.LISTING_URL,
  )
  assert.equal(haptik.hasOfficialJobsBoardSignal(boardHtml), true)
})

test('Haptik extracts India roles from the Freshteam board and enriches them from detail pages', async () => {
  const haptik = await loadHaptikModule()

  const listings = haptik.extractListingCards(boardHtml)
  assert.equal(listings.length, 4)
  assert.deepEqual(
    listings.map((listing) => ({
      title: listing.title,
      detailUrl: listing.detailUrl,
      locationHint: listing.locationHint,
    })),
    [
      {
        title: 'Software Engineer - Backend',
        detailUrl: 'https://haptik.freshteam.com/jobs/8RrzHwmKvc5h/software-engineer-backend',
        locationHint: 'Mumbai, Maharashtra',
      },
      {
        title: 'Software Engineer, Backend - L3 (Python)',
        detailUrl: 'https://haptik.freshteam.com/jobs/XjoJUGgeIgji/software-engineer-backend-l3-python',
        locationHint: 'Mumbai, Maharashtra',
      },
      {
        title: 'Voice AI Engineer (Hybrid)',
        detailUrl: 'https://haptik.freshteam.com/jobs/HVivFopqkiC1/voice-ai-engineer-hybrid',
        locationHint: 'Mumbai, Maharashtra',
      },
      {
        title: 'Global Alliances Manager',
        detailUrl: 'https://haptik.freshteam.com/jobs/us0000000001/global-alliances-manager',
        locationHint: 'New York, New York',
      },
    ],
  )

  const job = haptik.extractJobDetail(backendDetailHtml, listings[0])
  assert.deepEqual(job, {
    title: 'Software Engineer - Backend',
    company: 'Haptik',
    department: 'Engineering',
    location: 'Mumbai, Maharashtra, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '8RrzHwmKvc5h',
    requisitionId: '8RrzHwmKvc5h',
    sourceUrl: 'https://haptik.freshteam.com/jobs/8RrzHwmKvc5h/software-engineer-backend',
    applyUrl: 'https://haptik.freshteam.com/jobs/8RrzHwmKvc5h/software-engineer-backend',
    employmentType: 'Full-time',
    experienceRequired: '2-6 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "Haptik is one of the world's largest Conversational AI companies. As a Software Engineer - Backend, you will be working in a fast-paced agile environment. 2-6 years of experience in developing and integrating scalable products.",
    remoteStatus: 'On-site',
  })
})

test('Haptik runtime reconciles every native detail before applying an output cap', async () => {
  const haptik = await loadHaptikModule()
  const { haptikNativeOptions } = await import('./fixtures/haptikNativeOptions.js')
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  const settings = haptikNativeOptions(), jobs = await haptik.createHaptikScraper({ maxJobs: 2 }).run(settings)
  assert.equal(jobs.length, 2)
  assert.equal(settings.calls.length, 19)
  assert.equal(jobs[0].source, 'haptik')
  assert.equal(jobs[0].scrapedAt, settings.now())
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Haptik fails closed when the current active careers handoff disappears', async () => {
  const haptik = await loadHaptikModule()
  await assert.rejects(haptik.createHaptikScraper().run({
    fetchPage: async url => ({ status: 200, url, html: '<html><h1>Unexpected</h1></html>' }),
  }), /active first-party careers handoff/)
})
