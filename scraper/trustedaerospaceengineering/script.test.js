import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  VERIFIED_ON,
  createTrustedAerospaceEngineeringScraper,
  extractIndiaJobs,
  fetchCareersPageText,
  hasOfficialCareersSignal,
} from './script.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Our Team at TASE | Career Opportunities in Precision CNC Manufacturing</title>
  </head>
  <body>
    <h1>Trusted Aerospace &amp; Engineering Pvt. Ltd.</h1>
    <script>
      function fetch_id(id) {
        document.querySelector('#job_id').value = id;
      }
    </script>
    <input type="hidden" name="job_id" id="job_id" value="">
    <button onclick="submitForm('.modal-body', 'career_mail.php')">Send</button>
    <section>
      <h5 class="coun">INDIA</h5>
      <div class="accordion-item">
        <button class="accordion-button">MULTI-AXIS MILLING MACHINE SETTER / OPERATORS</button>
        <div class="accordion-body">
          5+ years’ work experience in precision aerospace manufacturing.
          <button onclick="fetch_id(9)">Apply Now</button>
        </div>
      </div>
      <div class="accordion-item">
        <button class="accordion-button">SENIOR ENGINEER - CAM</button>
        <div class="accordion-body">
          6+ years of experience in programming and validation.
          <button onclick="fetch_id(13)">Apply Now</button>
        </div>
      </div>
      <div class="accordion-item">
        <button class="accordion-button">PRODUCTION PLANNING CONTROLLER / SHIFT SUPERVISOR</button>
        <div class="accordion-body">
          7+ years of experience in aerospace production planning.
          <button onclick="fetch_id(14)">Apply Now</button>
        </div>
      </div>
      <h5 class="coun">USA</h5>
      <div class="accordion-item">
        <button class="accordion-button">Sample USA Role</button>
      </div>
    </section>
  </body>
</html>
`

test('Trusted Aerospace parser keeps the verified India accordion roles on the official careers page', () => {
  assert.equal(SOURCE, 'trustedaerospaceengineering')
  assert.equal(COMPANY, 'Trusted Aerospace Engineering Private Limited')
  assert.equal(VERIFIED_ON, '2026-08-14')
  assert.equal(CAREERS_URL, 'https://www.taseglobal.com/career.php')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(extractIndiaJobs(careersHtml), [
    {
      title: 'MULTI-AXIS MILLING MACHINE SETTER / OPERATORS',
      company: 'Trusted Aerospace Engineering Private Limited',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '9',
      requisitionId: '9',
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: '5+ years’ work experience',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '5+ years’ work experience in precision aerospace manufacturing.',
      remoteStatus: 'On-site',
    },
    {
      title: 'SENIOR ENGINEER - CAM',
      company: 'Trusted Aerospace Engineering Private Limited',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '13',
      requisitionId: '13',
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: '6+ years of experience',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '6+ years of experience in programming and validation.',
      remoteStatus: 'On-site',
    },
    {
      title: 'PRODUCTION PLANNING CONTROLLER / SHIFT SUPERVISOR',
      company: 'Trusted Aerospace Engineering Private Limited',
      location: 'India',
      city: null,
      country: 'India',
      jobId: '14',
      requisitionId: '14',
      sourceUrl: CAREERS_URL,
      applyUrl: CAREERS_URL,
      employmentType: null,
      experienceRequired: '7+ years of experience',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '7+ years of experience in aerospace production planning.',
      remoteStatus: 'On-site',
    },
  ])
})

test('Trusted Aerospace uses verified TLS and returns normalized India jobs', async () => {
  let capturedUrl = null
  let capturedOptions = null

  const html = await fetchCareersPageText(CAREERS_URL, {
    fetchPage: async (url, options) => {
      capturedUrl = url
      capturedOptions = options
      return {
        status: 200,
        url,
        html: careersHtml,
      }
    },
  })

  assert.equal(html, careersHtml)
  assert.equal(capturedUrl, CAREERS_URL)
  assert.equal(Object.hasOwn(capturedOptions, 'allowInsecureTlsHosts'), false)

  const jobs = await createTrustedAerospaceEngineeringScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.ok(jobs.every((job) => job.source === SOURCE))
  assert.ok(jobs.every((job) => job.link === CAREERS_URL))
  assert.ok(jobs.every((job) => typeof job.scrapedAt === 'string' && job.scrapedAt.length > 0))
})

test('Trusted Aerospace fails closed when the verified careers page or India accordion changes materially', async () => {
  await assert.rejects(
    createTrustedAerospaceEngineeringScraper().run({
      fetchText: async () => '<html><body>unexpected</body></html>',
    }),
    /verified official careers surface changed/i,
  )

  await assert.rejects(
    createTrustedAerospaceEngineeringScraper().run({
      fetchText: async () => careersHtml.replaceAll('Apply Now', 'Learn More'),
    }),
    /verified India openings changed or disappeared/i,
  )
})
