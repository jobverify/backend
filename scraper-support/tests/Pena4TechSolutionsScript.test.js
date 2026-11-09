import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/pena4techsolutions/script.js')
  } catch {
    assert.fail('Expected Pena4 Tech Solutions scraper module at ../../scraper/pena4techsolutions/script.js')
  }
}

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Pena4 | Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <h2>Submit your resume and become a part of our team</h2>
      <ul class="regions">
        <li>U.S.A</li>
        <li>Canada</li>
        <li>India</li>
      </ul>
      <a href="https://www.indeed.com/jobs?q=Pena4">View jobs on indeed</a>
      <a href="https://www.linkedin.com/company/pena4/jobs/">View jobs on linkedin</a>

      <div class="job-listing">
        <div class="job-header">
          <h3>Quality Reviewers</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; The Quality Reviewer is responsible for ensuring accuracy and integrity of ICD-10-CM/PCS coding and DRG assignment for inpatient encounters for other payers (not Medicare/Managed Medicare). This requires critical thinking, and a skill set above what is expected as a coder.</p>
          <p><span>Position Details:</span></p>
          <ul>
            <li>Start: 1-2 weeks</li>
            <li>Pay: 1099 assignment. Pay based on experience.</li>
          </ul>
        </div>
      </div>

      <div class="job-listing">
        <div class="job-header">
          <h3>Inpatient Medical Coder</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; Seeking experienced Inpatient Medical Coders. Positions are 100% remote. Both full time and part time positions are available. Applicants must have 5+ years of IP PCS coding experience and an active CCS certification from AHIMA.</p>
          <p><span>Position Details:</span></p>
          <ul>
            <li>Start: Immediately</li>
            <li>Pay: 1099 assignments</li>
          </ul>
        </div>
      </div>

      <p>Currently, there are no job openings available in this location. Please check back later or explore opportunities in other regions.</p>

      <section>
        <h2>Job Application Form</h2>
        <form action="/jobs.php" method="post">
          <input type="text" name="name" />
          <button type="submit">Apply Now</button>
        </form>
      </section>
    </main>
  </body>
</html>
`

const liveJobsHtmlWithCommentedListings = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Pena4 | Join Our Team</title>
  </head>
  <body>
    <main>
      <h1>Jobs</h1>
      <h2>Submit your resume and become a part of our team</h2>
      <a href="https://www.indeed.com/jobs?q=Pena4">View jobs on indeed</a>
      <a href="https://www.linkedin.com/company/pena4/jobs/">View jobs on linkedin</a>

      <!--<div class="job-box">
        <div class="job-head">
          <h3>Quality Reviewers</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; The Quality Reviewer is responsible for ensuring accuracy and integrity of ICD-10-CM/PCS coding and DRG assignment for inpatient encounters for other payers (not Medicare/Managed Medicare). This requires critical thinking, and a skill set above what is expected as a coder.</p>
        </div>
      </div>-->

      <!--<div class="job-box">
        <div class="job-head">
          <h3>Quality Improvement Coordinator (IP)</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; Seeking experienced Coding and Quality Auditor, Quality Improvement Coordinator, with inpatient coding and quality experience, to join our US team.</p>
        </div>
      </div>-->

      <!--<div class="job-box">
        <div class="job-head">
          <h3>Clinical Documentation Integrity Specialist (CDIS)</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; The Clinical Documentation Integrity Specialist (CDIS) plays a crucial role in ensuring the accuracy, completeness, and integrity of clinical documentation for inpatient hospitalizations across a not-for-profit 1000+ bed trauma, academic health system that includes 4 hospitals (3 trauma level 2 academic medical centers) and 1 children’s hospital.</p>
        </div>
      </div>-->

      <div class="job-box">
        <div class="job-head">
          <h3>Inpatient Medical Coder</h3>
          <a href="javascript:void(0);" class="orange-btn"><span>Submit Your Resume Now!</span></a>
        </div>
        <div class="job-desc">
          <p><span>Description:</span>&nbsp; Seeking experienced Inpatient Medical Coders. Positions are 100% remote. Both full time and part time positions are available. Applicants must have 5+ years of IP PCS coding experience and an active CCS certification from AHIMA.</p>
          <p><span>Position Details:</span></p>
          <ul>
            <li>Start: Immediately</li>
            <li>Pay: 1099 assignments</li>
          </ul>
        </div>
      </div>

      <h3>Currently, there are no job openings available in this location. Please check back later or explore opportunities in other regions.</h3>

      <section>
        <h2>Job Application Form</h2>
        <form action="/jobs.php" method="post">
          <input type="text" name="name" />
          <button type="submit">Apply Now</button>
        </form>
      </section>
    </main>
  </body>
</html>
`

test('Pena4 Tech Solutions validates the verified first-party jobs page and extracts India-facing openings', async () => {
  const pena4 = await loadModule()

  assert.equal(pena4.hasOfficialJobsPageSignal(jobsHtml), true)

  assert.deepEqual(pena4.extractJobCards(jobsHtml), [
    {
      title: 'Quality Reviewers',
      location: 'India',
      employmentType: null,
      remoteType: null,
      sourceUrl: 'https://www.pena4.com/jobs.php',
      applyUrl: 'https://www.pena4.com/jobs.php',
      jobDescription: 'The Quality Reviewer is responsible for ensuring accuracy and integrity of ICD-10-CM/PCS coding and DRG assignment for inpatient encounters for other payers (not Medicare/Managed Medicare). This requires critical thinking, and a skill set above what is expected as a coder.',
    },
    {
      title: 'Inpatient Medical Coder',
      location: 'India',
      employmentType: 'Full Time or Part Time',
      remoteType: 'Remote',
      sourceUrl: 'https://www.pena4.com/jobs.php',
      applyUrl: 'https://www.pena4.com/jobs.php',
      jobDescription: 'Seeking experienced Inpatient Medical Coders. Positions are 100% remote. Both full time and part time positions are available. Applicants must have 5+ years of IP PCS coding experience and an active CCS certification from AHIMA.',
    },
  ])
})

test('Pena4 Tech Solutions ignores commented-out legacy job cards on the live jobs page', async () => {
  const pena4 = await loadModule()

  assert.equal(pena4.hasOfficialJobsPageSignal(liveJobsHtmlWithCommentedListings), true)

  assert.deepEqual(pena4.extractJobCards(liveJobsHtmlWithCommentedListings), [
    {
      title: 'Inpatient Medical Coder',
      location: 'India',
      employmentType: 'Full Time or Part Time',
      remoteType: 'Remote',
      sourceUrl: 'https://www.pena4.com/jobs.php',
      applyUrl: 'https://www.pena4.com/jobs.php',
      jobDescription: 'Seeking experienced Inpatient Medical Coders. Positions are 100% remote. Both full time and part time positions are available. Applicants must have 5+ years of IP PCS coding experience and an active CCS certification from AHIMA.',
    },
  ])
})

test('Pena4 Tech Solutions run returns normalized jobs from the verified first-party jobs page', async () => {
  const pena4 = await loadModule()
  const jobs = await pena4.run({
    fetchText: async (url) => {
      assert.equal(url, pena4.JOBS_URL)
      return jobsHtml
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Quality Reviewers',
      company: 'Pena4 Tech Solutions',
      location: 'India',
      country: 'India',
      employmentType: null,
      remoteType: null,
      sourceUrl: 'https://www.pena4.com/jobs.php',
      applyUrl: 'https://www.pena4.com/jobs.php',
      link: 'https://www.pena4.com/jobs.php',
      jobDescription: 'The Quality Reviewer is responsible for ensuring accuracy and integrity of ICD-10-CM/PCS coding and DRG assignment for inpatient encounters for other payers (not Medicare/Managed Medicare). This requires critical thinking, and a skill set above what is expected as a coder.',
      source: 'pena4techsolutions',
      scrapedAt: '2026-08-04T00:00:00.000Z',
    },
    {
      title: 'Inpatient Medical Coder',
      company: 'Pena4 Tech Solutions',
      location: 'India',
      country: 'India',
      employmentType: 'Full Time or Part Time',
      remoteType: 'Remote',
      sourceUrl: 'https://www.pena4.com/jobs.php',
      applyUrl: 'https://www.pena4.com/jobs.php',
      link: 'https://www.pena4.com/jobs.php',
      jobDescription: 'Seeking experienced Inpatient Medical Coders. Positions are 100% remote. Both full time and part time positions are available. Applicants must have 5+ years of IP PCS coding experience and an active CCS certification from AHIMA.',
      source: 'pena4techsolutions',
      scrapedAt: '2026-08-04T00:00:00.000Z',
    },
  ])
})

test('Pena4 Tech Solutions fails closed when the verified jobs page drifts', async () => {
  const pena4 = await loadModule()

  await assert.rejects(
    pena4.run({
      fetchText: async () => '<html><body><h1>Contact us</h1></body></html>',
    }),
    /verified first-party jobs page/i,
  )
})
