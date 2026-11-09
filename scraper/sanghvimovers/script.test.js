import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createSanghviMoversScraper,
  defaultFetchText,
  hasPublicJobSignals,
  hasVerifiedCareersPageSignal,
} from './script.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Sanghvi Movers | Join Asia's Largest Crane Leader</title>
  </head>
  <body>
    <main>
      <h1>Join Our Team</h1>
      <article>
        <h2>Fundraising &amp; Investment - Treasury</h2>
        <div>Position: Fundraising &amp; Investment - Treasury</div>
        <div>Reports To: Head of Treasurer</div>
        <div>Location: Pune, SML Corporate Office</div>
        <div>Job Type: Full-Time</div>
        <div>Job Summary: We are seeking a highly analytical and experienced person for our fundraising initiatives.</div>
        <div>Required Qualifications and Skills</div>
        <div>Education: MBA or CA</div>
        <div>Experience: 4-5+ years of experience in corporate treasury.</div>
        <div>Fundraising Expertise: Proven track record in securing debt/equity financing.</div>
        <a href="/apply">Apply Now</a>
      </article>
      <article>
        <h2>Electronics Engineer</h2>
        <div>Position: Electronics Engineer</div>
        <div>Location: Jamnagar, Gujarat</div>
        <div>Job Type: Full-Time</div>
        <div>Job Summary: Diagnose, repair, and maintain electronic systems used in cranes.</div>
        <div>Key Responsibilities :</div>
        <div>Maintain, calibrate, and repair electronic devices.</div>
        <a href="/apply">Apply Now</a>
      </article>
      <article>
        <h2>Manager / Dy Manager Learning and Development</h2>
        <div>Location: Pune Tathawade Pimpri Chinchwad</div>
        <div>Experience: 7yrs -14yrs .</div>
        <div>Job Role</div>
        <div>Design Training Modules.</div>
        <div>Training Need identification.</div>
        <div>Qualification: Graduation /Post Graduation in HR.</div>
        <div>Must have skills</div>
        <div>Good Knowledge of HR Process Norms.</div>
        <div>Good Communication skills both verbal and written.</div>
        <a href="/apply">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

test('Sanghvi Movers verifier recognizes the current careers page and public job markers', () => {
  assert.equal(hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.equal(hasPublicJobSignals(CAREERS_HTML), true)
})

test('Sanghvi Movers default text fetch is bounded by a timeout signal', async () => {
  let capturedInit = null

  const html = await defaultFetchText(CAREERS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        ok: true,
        status: 200,
        url,
        text: async () => '<html><body>Sanghvi Movers careers</body></html>',
      }
    },
  })

  assert.equal(html, '<html><body>Sanghvi Movers careers</body></html>')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Sanghvi Movers uses browser fallback when the direct fetch fails on a certificate error', async () => {
  const calls = []
  const scraper = createSanghviMoversScraper({
    now: () => '2026-08-04T00:00:00.000Z',
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      calls.push(['raw', url])
      throw new Error(`fetch failed | unable to verify the first certificate for ${url}`)
    },
    fetchBrowserText: async (url) => {
      calls.push(['browser', url])
      return CAREERS_HTML
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Fundraising & Investment - Treasury')
  assert.equal(jobs[0].location, 'Pune, SML Corporate Office')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
  assert.deepEqual(calls, [
    ['raw', CAREERS_URL],
    ['browser', CAREERS_URL],
  ])
})
