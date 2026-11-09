import assert from 'node:assert/strict'
import test from 'node:test'

import {
  extractJobDetail,
  hasOfficialHomepageSignal,
  hasOfficialJobsBoardSignal,
} from './script.js'

const homepageHtml = `<!doctype html>
<html lang="en-US">
<head>
  <title>NewSpace Research and Technologies - Engineering tomorrow&#039;s missions, today</title>
</head>
<body>
  <nav>
    <a href="https://newspace.co.in/#about_us" class="menu-link">About Us</a>
    <a href="https://newspace.co.in/#product" class="menu-link">Products</a>
    <a href="https://newspace.co.in/#founders" class="menu-link">Founders</a>
    <a href="https://newspace.co.in/#contact" class="menu-link">Contact Us</a>
  </nav>
  <section>Engineering tomorrow's missions, today</section>
  <section>Reach us at info@newspace.co.in</section>
</body>
</html>`

const jobsBoardHtml = `<!doctype html>
<html>
<head>
  <title>Careers</title>
</head>
<body>
  <meta property="og:title" content="Careers - NewSpace Research &amp; Technologies" />
  <div data-portal-role="engineering">
    <h3>Open Positions</h3>
    <p>#56 Jobs</p>
    <a href="/jobs/opaque-id/flight-control-engineer">Flight Control Engineer</a>
  </div>
  <section>Who we are:</section>
</body>
</html>`

test('New Space Research Technologies accepts the current mixed-case official homepage navigation', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
})

test('New Space Research Technologies still recognizes the current Freshteam public jobs board', () => {
  assert.equal(hasOfficialJobsBoardSignal(jobsBoardHtml), true)
})

test('New Space Research Technologies marks broken Freshteam detail pages as publicly checked and recovers explicit years from the visible summary', () => {
  const job = extractJobDetail(`
    <!doctype html>
    <html>
      <body>
        <h1>Embedded QC ML Engineer</h1>
        <div>Work Type: Full Time</div>
        <a>Apply Now</a>
        <div>Liquid error: undefined method \`public_fields' for nil:NilClass</div>
      </body>
    </html>
  `, {
    title: 'Embedded QC ML Engineer',
    summary: 'Seeking a Senior software Engineer with 4+ years of experience in edge AI and TinyML solutions.',
    detailUrl: 'https://newspace-talent.freshteam.com/jobs/example/embedded-qc-ml-engineer',
    jobId: 'example',
    slug: 'embedded-qc-ml-engineer',
    locationText: 'Bengaluru',
    employmentType: 'Full Time',
  })

  assert.equal(job.jobDescription, 'Seeking a Senior software Engineer with 4+ years of experience in edge AI and TinyML solutions.')
  assert.equal(job.experienceRequired, '4+ years')
  assert.equal(job.publicExperienceChecked, true)
})

test('New Space Research Technologies still marks placeholder public descriptions as checked when the public detail page exposes no usable experience', () => {
  const job = extractJobDetail(`
    <!doctype html>
    <html>
      <body>
        <h1>Associate - UGV Program</h1>
        <div>Work Type: Full Time</div>
        <a>Apply Now</a>
        <div>NA</div>
        <div>Liquid error: undefined method \`public_fields' for nil:NilClass</div>
      </body>
    </html>
  `, {
    title: 'Associate - UGV Program',
    summary: 'NA...',
    detailUrl: 'https://newspace-talent.freshteam.com/jobs/example/associate-ugv-program',
    jobId: 'example',
    slug: 'associate-ugv-program',
    locationText: 'Bengaluru',
    employmentType: 'Full Time',
  })

  assert.equal(job.experienceRequired, null)
  assert.equal(job.publicExperienceChecked, true)
})
