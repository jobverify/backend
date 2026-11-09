import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Careers - Evalueserve</title>
</head>
<body>
  <section>
    <h1>Impact Starts Here.</h1>
    <a href="https://www.evalueserve.com/jobs/">Explore jobs</a>
    <a href="https://www.evalueserve.com/jobs/">Open Positions</a>
  </section>
</body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
<head>
  <title>Grow Your Career with Evalueserve</title>
  <meta property="og:title" content="Jobs at Evalueserve" />
</head>
<body>
  <div class='db-filters'>
    <div class='db-dropdown'>
      <h4 class="dropbtn">Country</h4>
      <label for='India'><input type='checkbox' id='India' rel='India'><span class='checkbox-name'>India</span></label>
      <label for='UnitedStates'><input type='checkbox' id='UnitedStates' rel='UnitedStates'><span class='checkbox-name'>United States</span></label>
    </div>
  </div>
  <div id='db-main' class='db-jobs-wrap'>
    <div class='India senior-level db-single-job-wrap'>
      <div class='India' style='display:flex; flex-direction: column;'>
        <div class='db-location-country'><h6>Gurgaon, Haryana, India</h6></div>
        <div class='db-job-title'><h4>Senior Trainer — AI/ML & Analytics</h4></div>
        <div class='db-busniess-unit'><h6> Evalueserve is seeking a(n) Senior Trainer — AI/ML & Analytics within the Human Resources department.</h6></div>
        <div class='learn-more-bottom db-two-columns'>
          <div class='db-experience-level'><h6> EXP: <strong>Senior-level</strong> </h6></div>
          <div class='db-job-link'><a href=https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a target=_blank>Learn More</a></div>
        </div>
      </div>
    </div>
    <div class='India mid-level db-single-job-wrap'>
      <div class='India' style='display:flex; flex-direction: column;'>
        <div class='db-location-country'><h6>Bangalore, Karnataka, India</h6></div>
        <div class='db-job-title'><h4>Consultant-Devops</h4></div>
        <div class='db-busniess-unit'><h6> Evalueserve is seeking a(n) Consultant-Devops within the Data Analytics department.</h6></div>
        <div class='learn-more-bottom db-two-columns'>
          <div class='db-experience-level'><h6> EXP: <strong>Mid-level</strong> </h6></div>
          <div class='db-job-link'><a href=https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a target=_blank>Learn More</a></div>
        </div>
      </div>
    </div>
    <div class='UnitedStates mid-level db-single-job-wrap'>
      <div class='UnitedStates' style='display:flex; flex-direction: column;'>
        <div class='db-location-country'><h6>Raleigh, North Carolina, United States</h6></div>
        <div class='db-job-title'><h4>Senior Analyst</h4></div>
        <div class='db-busniess-unit'><h6> Evalueserve is seeking a(n) Senior Analyst within the Corporate Investment Banking department.</h6></div>
        <div class='learn-more-bottom db-two-columns'>
          <div class='db-experience-level'><h6> EXP: <strong>Mid-level</strong> </h6></div>
          <div class='db-job-link'><a href=https://lighthouse.darwinbox.com/ms/candidate/careers/a6a4fbc38a4ea7 target=_blank>Learn More</a></div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
`

const loadEvalueserveModule = async () => {
  try {
    return await import('../../scraper/evalueserve/script.js')
  } catch {
    assert.fail('Expected Evalueserve scraper module at ../../scraper/evalueserve/script.js')
  }
}

test('Evalueserve helpers stay pinned to the verified first-party careers and jobs page contracts', async () => {
  const evalueserve = await loadEvalueserveModule()

  assert.equal(evalueserve.SOURCE, 'evalueserve')
  assert.equal(evalueserve.COMPANY, 'Evalueserve')
  assert.equal(evalueserve.OFFICIAL_BRAND_NAME, 'Evalueserve')
  assert.equal(evalueserve.VERIFIED_ON, '2026-07-15')
  assert.equal(evalueserve.HOMEPAGE_URL, 'https://www.evalueserve.com/')
  assert.equal(evalueserve.CAREERS_URL, 'https://www.evalueserve.com/careers/')
  assert.equal(evalueserve.JOBS_URL, 'https://www.evalueserve.com/jobs/')
  assert.equal(evalueserve.DARWINBOX_BASE_URL, 'https://lighthouse.darwinbox.com/')
  assert.equal(evalueserve.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    evalueserve.extractJobsPageUrl(careersHtml),
    'https://www.evalueserve.com/jobs/',
  )
  assert.equal(evalueserve.hasOfficialJobsPageSignal(jobsHtml), true)
})

test('Evalueserve extracts only India job cards from the verified first-party jobs page', async () => {
  const evalueserve = await loadEvalueserveModule()

  const jobs = evalueserve.extractJobCards(jobsHtml)
  assert.deepEqual(jobs, [
    {
      title: 'Senior Trainer — AI/ML & Analytics',
      company: 'Evalueserve',
      department: 'Human Resources',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'a6a44d6b6ef79a',
      requisitionId: 'a6a44d6b6ef79a',
      sourceUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
      applyUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
      employmentType: null,
      experienceRequired: 'Senior-level',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      publicExperienceChecked: true,
      jobDescription: 'Evalueserve is seeking a(n) Senior Trainer — AI/ML & Analytics within the Human Resources department.',
      remoteStatus: null,
    },
    {
      title: 'Consultant-Devops',
      company: 'Evalueserve',
      department: 'Data Analytics',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'a6a2a6185d752a',
      requisitionId: 'a6a2a6185d752a',
      sourceUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a',
      applyUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a',
      employmentType: null,
      experienceRequired: 'Mid-level',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      publicExperienceChecked: true,
      jobDescription: 'Evalueserve is seeking a(n) Consultant-Devops within the Data Analytics department.',
      remoteStatus: null,
    },
  ])
})

test('run validates the verified first-party careers handoff and returns India jobs from the public jobs page', async () => {
  const evalueserve = await loadEvalueserveModule()
  const requestedUrls = []

  const jobs = await evalueserve.createEvalueserveScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === evalueserve.CAREERS_URL) return careersHtml
      if (url === evalueserve.JOBS_URL) return jobsHtml

      throw new Error(`Unexpected Evalueserve URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.evalueserve.com/careers/',
    'https://www.evalueserve.com/jobs/',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Trainer — AI/ML & Analytics',
      company: 'Evalueserve',
      department: 'Human Resources',
      location: 'Gurgaon, Haryana, India',
      city: 'Gurgaon',
      country: 'India',
      jobId: 'a6a44d6b6ef79a',
      requisitionId: 'a6a44d6b6ef79a',
      sourceUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
      applyUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
      employmentType: null,
      experienceRequired: 'Senior-level',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      publicExperienceChecked: true,
      jobDescription: 'Evalueserve is seeking a(n) Senior Trainer — AI/ML & Analytics within the Human Resources department.',
      remoteStatus: null,
      source: 'evalueserve',
      link: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Consultant-Devops',
      company: 'Evalueserve',
      department: 'Data Analytics',
      location: 'Bangalore, Karnataka, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'a6a2a6185d752a',
      requisitionId: 'a6a2a6185d752a',
      sourceUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a',
      applyUrl: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a',
      employmentType: null,
      experienceRequired: 'Mid-level',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      publicExperienceChecked: true,
      jobDescription: 'Evalueserve is seeking a(n) Consultant-Devops within the Data Analytics department.',
      remoteStatus: null,
      source: 'evalueserve',
      link: 'https://lighthouse.darwinbox.com/ms/candidate/careers/a6a2a6185d752a',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run fails closed when the verified Evalueserve careers or jobs page contract drifts materially', async () => {
  const evalueserve = await loadEvalueserveModule()

  await assert.rejects(
    evalueserve.createEvalueserveScraper().run({
      fetchText: async () => careersHtml.replace('Open Positions', 'Browse opportunities'),
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    evalueserve.createEvalueserveScraper().run({
      fetchText: async (url) => {
        if (url === evalueserve.CAREERS_URL) return careersHtml
        return jobsHtml.replace('https://lighthouse.darwinbox.com/ms/candidate/careers/a6a44d6b6ef79a', 'https://example.com/jobs/a6a44d6b6ef79a')
      },
    }),
    /verified first-party jobs surface/i,
  )
})
