import assert from 'node:assert/strict'
import test from 'node:test'

const loadSeoakModule = async () => {
  try {
    return await import('../../scraper/seoak/script.js')
  } catch {
    assert.fail('Expected SEOAK scraper module at ../../scraper/seoak/script.js')
  }
}

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <body>
    <div class="careers-container">
      <div class="careers-header">
        <div class="header-text">
          <h1>Discover Career</h1>
          <h1>Opportunities at SEOAK!</h1>
          <p>We're on a mission to deliver engaging, curated courses at a reasonable price.</p>
        </div>
      </div>
      <div class="open-position-section">
        <h1>Open Position</h1>
        <div class="career-cards-container web-view">
          <div class="career-card bg-light-4 cursor">
            <h2>Business Development Executive</h2>
            <div>Type: Business &amp; Sales</div>
            <div>Location: Work From Office</div>
          </div>
          <div class="career-card bg-light-4 cursor">
            <h2>Sales Manager</h2>
            <div>Type: Business &amp; Sales</div>
            <div>Location: Work From Office</div>
          </div>
        </div>
      </div>
      <div class="mob-view carousel">
        <div>
          <div class="career-card bg-light-4 cursor">
            <h2>Business Development Executive</h2>
            <div>Type: Business &amp; Sales</div>
            <div>Location: Work From Office</div>
          </div>
          <div class="career-card bg-light-4 cursor">
            <h2>Sales Manager</h2>
            <div>Type: Business &amp; Sales</div>
            <div>Location: Work From Office</div>
          </div>
        </div>
      </div>
      <div class="py-20 web-view">
        <div class="enroll-now cursor">Apply Now</div>
      </div>
      <a href="https://wa.me/919502549362">Chat Us</a>
      <div>©SEOAK INNOVATIONS PRIVATE LIMITED. All Rights Reserved 2026</div>
    </div>
  </body>
</html>
`

test('SEOAK scraper validates the official careers page and extracts the canonical public openings', async () => {
  const seoak = await loadSeoakModule()

  assert.equal(seoak.SOURCE, 'seoak')
  assert.equal(seoak.COMPANY, 'SEOAK Innovations Private Limited')
  assert.equal(seoak.CAREERS_URL, 'https://www.seoak.in/careers')
  assert.equal(seoak.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(seoak.extractOpenings(officialCareersHtml), [
    {
      title: 'Business Development Executive',
      department: 'Business & Sales',
      location: 'Work From Office, India',
      city: null,
      sourceUrl: 'https://www.seoak.in/careers',
      applyUrl: 'https://www.seoak.in/careers',
      employmentType: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Sales Manager',
      department: 'Business & Sales',
      location: 'Work From Office, India',
      city: null,
      sourceUrl: 'https://www.seoak.in/careers',
      applyUrl: 'https://www.seoak.in/careers',
      employmentType: null,
      remoteStatus: 'On-site',
    },
  ])
})

test('SEOAK run decorates the canonical openings with shared scraper metadata', async () => {
  const seoak = await loadSeoakModule()

  const requestedUrls = []
  const jobs = await seoak.createSeoakScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [seoak.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'SEOAK Innovations Private Limited')
  assert.equal(jobs[0].source, 'seoak')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('SEOAK fails closed when the verified official public careers surface changes', async () => {
  const seoak = await loadSeoakModule()

  await assert.rejects(
    seoak.createSeoakScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official public careers surface/i,
  )
})
