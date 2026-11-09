import assert from 'node:assert/strict'
import test from 'node:test'
import { billEaseNativeOptions, billEaseIndiaRole } from './fixtures/billEaseNativeOptions.js'

const loadBillEaseModule = async () => {
  try {
    return await import('../../scraper/billease/script.js')
  } catch {
    assert.fail('Expected BillEase scraper module at ../../scraper/billease/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Billease. Get your purchase on installments now. No credit card needed!</title>
    <script src="/_nuxt/pages/careers.34578c8.js"></script>
  </head>
  <body>
    <main>
      <iframe src="https://billease.careers-page.com/"></iframe>
    </main>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:site_name" content="Manatal" />
    <title>Careers at BillEase</title>
  </head>
  <body>
    <script id="header-script" data-domain_slug="billease"></script>
    <section id="company-banner">
      <h3>Careers at BillEase</h3>
    </section>
    <main id="page-content">
      <h4>Jobs at BillEase</h4>
      <article class="job-card">
        <a
          href="/jobs/c95f53d6-6e57-4699-93e7-8adc088d143e"
          class="job-title-link"
          data-job-id="c95f53d6-6e57-4699-93e7-8adc088d143e"
          data-job-title="Engineering Manager"
          data-job-city="Bengaluru"
          data-job-country="India"
        >
          <h6>Engineering Manager</h6>
        </a>
        <a class="btn btn-primary" href="jobs/c95f53d6-6e57-4699-93e7-8adc088d143e/apply" data-type="apply">Apply now</a>
        <ul aria-label="Job details">
          <li>Bengaluru, Karnataka, India</li>
        </ul>
      </article>
      <article class="job-card">
        <a
          href="/jobs/other-role"
          class="job-title-link"
          data-job-id="other-role"
          data-job-title="Collections Associate"
          data-job-city="Makati"
          data-job-country="Philippines"
        >
          <h6>Collections Associate</h6>
        </a>
        <a class="btn btn-primary" href="jobs/other-role/apply" data-type="apply">Apply now</a>
        <ul aria-label="Job details">
          <li>Makati, Metro Manila, Philippines</li>
        </ul>
      </article>
    </main>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main id="page-content">
      <div class="single-job-content">
        <div class="single-job-header-row mb-0">
          <h4 class="single-job-title">Engineering Manager</h4>
        </div>
        <div class="job-location mt-4">
          <ul class="text-quarterary list-unstyled">
            <li>Bengaluru, Karnataka, India</li>
            <li>Full-Time</li>
            <li>Hybrid</li>
          </ul>
          <a class="btn btn-primary d-block" href="../../scraper/jobs/c95f53d6-6e57-4699-93e7-8adc088d143e/apply">Apply now</a>
        </div>
        <div class="job-post-description">
          <p>Lead engineering teams building credit products.</p>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('BillEase verifies the official careers page plus the embedded Manatal board surface', async () => {
  const billease = await loadBillEaseModule()

  assert.equal(billease.CAREERS_URL, 'https://billease.ph/careers/')
  assert.equal(billease.CAREERS_BOARD_URL, 'https://billease.careers-page.com/')
  assert.equal(billease.hasOfficialCareersPageSignal(officialCareersHtml), true)
  assert.equal(billease.hasOfficialBoardSignal(boardHtml), true)
})

test('BillEase extracts India jobs from the public board and detail page', async () => {
  const billease = await loadBillEaseModule()

  assert.equal(billease.extractListings(boardHtml).length, 1)
  const job = billease.extractJobDetail(detailHtml, billease.extractListings(boardHtml)[0])

  assert.equal(job.title, 'Engineering Manager')
  assert.equal(job.location, 'Bengaluru, Karnataka, India')
  assert.equal(job.city, 'Bengaluru')
  assert.equal(job.country, 'India')
  assert.equal(job.employmentType, 'Full-time')
  assert.equal(job.remoteStatus, 'Hybrid')
})

test('BillEase run follows the current corporate and paginated native surfaces and decorates final jobs', async () => {
  const billease = await loadBillEaseModule()
  const options = billEaseNativeOptions(packet => billEaseIndiaRole(packet))
  const jobs = await billease.createBillEaseScraper().run({
    ...options,
    now: () => '2026-10-26T12:00:00.000Z',
  })
  assert.ok(options.calls.includes(billease.CAREERS_BOARD_URL + '?page=2'))
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'billease')
  assert.equal(jobs[0].scrapedAt, '2026-10-26T12:00:00.000Z')
})
