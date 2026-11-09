import assert from 'node:assert/strict'
import test from 'node:test'

const loadSouthIndianBankModule = async () => {
  try {
    return await import('../../scraper/southindianbank/script.js')
  } catch {
    assert.fail('Expected South Indian Bank scraper module at ../../scraper/southindianbank/script.js')
  }
}

const OPENINGS_HTML = `
  <html lang="en">
    <head>
      <title>Current Openings - South Indian Bank</title>
    </head>
    <body>
      <nav>
        <a href="https://www.southindianbank.bank.in/about-us/careers">Careers</a>
      </nav>
      <h1 class="hero-title">Current Job Openings</h1>
      <div class="job-feed">
        <article class="job-card">
          <div class="job-card-header">
            <img src="/RDC/Notification/118072026.jpg" alt="Job Image" class="job-card-image">
          </div>
          <div class="job-card-body">
            <div class="job-metadata">
              <span class="metadata-item start">Start Date:</span>
              <span class="metadata-item-1 start">22-07-2026</span>
              <span class="metadata-item end">End Date:</span>
              <span class="metadata-item-1 end">29-07-2026</span>
            </div>
          </div>
          <div class="job-card-footer">
            <button
              id="118072026"
              class="btn btn-apply"
              data-modal-target="#apply-modal-content"
              data-job-title="RECRUITMENT OF PROBATIONARY OFFICER (CA)"
            >
              Apply Now
            </button>
            <div class="job-card-footer-links">
              <div align="right" class="tooltip-container" id="pdf_118072026">
                <button class="jd_btn-icon bookmark-icon">
                  <i class="fa-solid fa-file-pdf"></i>
                </button>
                <span class="metadata-item-1 end jd-link-text">View Job Notification</span>
              </div>
            </div>
          </div>
        </article>
      </div>
    </body>
  </html>
`

const NO_OPENINGS_HTML = `
  <html lang="en">
    <head>
      <title>South Indian Bank Careers - South Indian Bank</title>
    </head>
    <body>
      <nav>
        <a href="https://www.southindianbank.bank.in/about-us/careers">Careers</a>
      </nav>
      <h1>Recruitment Drive Portal</h1>
      <div class="rdc-logo">South Indian Bank</div>
      <section id="current-openings">
        <p>Currently, there are no job openings.</p>
      </section>
    </body>
  </html>
`

test('South Indian Bank scraper recognizes both the live openings page and the verified no-openings RDC surface', async () => {
  const southIndianBank = await loadSouthIndianBankModule()

  assert.equal(southIndianBank.CAREERS_URL, 'https://recruit.southindianbank.bank.in/RDC/')
  assert.equal(southIndianBank.hasOfficialCareersSignal(OPENINGS_HTML), true)
  assert.equal(southIndianBank.hasOfficialCareersSignal(NO_OPENINGS_HTML), true)
  assert.equal(southIndianBank.hasEmptyOpeningsSignal(OPENINGS_HTML), false)
  assert.equal(southIndianBank.hasEmptyOpeningsSignal(NO_OPENINGS_HTML), true)
})

test('South Indian Bank extracts the live RDC job cards into the shared job shape', async () => {
  const southIndianBank = await loadSouthIndianBankModule()
  const jobs = southIndianBank.extractOpenings(OPENINGS_HTML, {
    now: () => '2026-07-26T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'RECRUITMENT OF PROBATIONARY OFFICER (CA)',
      company: 'South Indian Bank',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: '118072026',
      requisitionId: '118072026',
      sourceUrl: 'https://recruit.southindianbank.bank.in/RDC/',
      applyUrl: 'https://recruit.southindianbank.bank.in/RDC/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-07-22',
      closingDate: '2026-07-29',
      jobDescription: null,
      source: 'southindianbank',
      link: 'https://recruit.southindianbank.bank.in/RDC/',
      scrapedAt: '2026-07-26T00:00:00.000Z',
    },
  ])
})

test('run returns public openings when the RDC page exposes job cards, and [] when it goes back to the verified empty state', async () => {
  const southIndianBank = await loadSouthIndianBankModule()

  const liveJobs = await southIndianBank.createSouthIndianBankScraper().run({
    fetchText: async (url) => {
      assert.equal(url, southIndianBank.CAREERS_URL)
      return OPENINGS_HTML
    },
    now: () => '2026-07-26T00:00:00.000Z',
  })

  assert.equal(liveJobs.length, 1)
  assert.equal(liveJobs[0].title, 'RECRUITMENT OF PROBATIONARY OFFICER (CA)')
  assert.equal(liveJobs[0].postingDate, '2026-07-22')

  const emptyJobs = await southIndianBank.createSouthIndianBankScraper().run({
    fetchText: async (url) => {
      assert.equal(url, southIndianBank.CAREERS_URL)
      return NO_OPENINGS_HTML
    },
  })

  assert.deepEqual(emptyJobs, [])
})

test('run fails closed when the South Indian Bank public careers surface changes away from both supported contracts', async () => {
  const southIndianBank = await loadSouthIndianBankModule()

  await assert.rejects(
    southIndianBank.createSouthIndianBankScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
    }),
    /verified official public surface/i,
  )

  await assert.rejects(
    southIndianBank.createSouthIndianBankScraper().run({
      fetchText: async () => `
        <html>
          <head><title>Current Openings - South Indian Bank</title></head>
          <body>
            <a href="https://www.southindianbank.bank.in/about-us/careers">Careers</a>
            <h1>Current Job Openings</h1>
            <p>Portal maintenance window.</p>
          </body>
        </html>
      `,
    }),
    /public jobs or no-openings surface/i,
  )
})
