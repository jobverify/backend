import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; BUDDI.AI &#8211; Healthcare AI Automation Platform</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>You're in good company</p>

    <div class="blurbs">
      <p class="pink-header">Healthcare</p>
      <h2 class="white-subheader">Team Leader</h2>
      <p class="white-description careers">
        Specializations: Surgery, ED, EM, Pathology, Radiology.<br>
        Location: Chennai,India<br>
        No. of openings: 1
      </p>
    </div>

    <div class="blurbs">
      <p class="pink-header">Healthcare</p>
      <h2 class="white-subheader">Manager</h2>
      <p class="white-description careers">
        Specializations: Radiology, Pathology, ED, EM, HCC<br>
        Location: Chennai,India<br>
        No. of openings: 1
      </p>
    </div>

    <div class="blurbs">
      <p class="pink-header">Healthcare</p>
      <h2 class="white-subheader">Medical Coders</h2>
      <p class="white-description careers">
        Specializations: Pathology, Radiology, Surgery, IVR, EM UAE, HCC<br>
        Location: Chennai,India
      </p>
    </div>

    <div class="blurbs">
      <p class="pink-header">Engineering</p>
      <h2 class="white-subheader">Principle Software<br/>Application Architect</h2>
      <p class="white-description careers">San Francisco, California, United States of America</p>
      <a class="btn btn-light">Learn more</a>
    </div>

    <p>Hello Automation, Goodbye Complexity.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/buddiai/script.js')
  } catch {
    assert.fail('Expected BUDDI.AI scraper module at ../../scraper/buddiai/script.js')
  }
}

test('BUDDI.AI helpers stay pinned to the verified first-party static careers page and India role filter', async () => {
  const buddi = await loadModule()

  assert.equal(buddi.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(buddi.extractJobs(careersHtml), [
    {
      title: 'Team Leader',
      company: 'BUDDI.AI',
      department: 'Healthcare',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'team-leader',
      requisitionId: 'team-leader',
      sourceUrl: 'https://buddi.ai/careers.html#team-leader',
      applyUrl: 'https://buddi.ai/careers.html#team-leader',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Specializations: Surgery, ED, EM, Pathology, Radiology.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Manager',
      company: 'BUDDI.AI',
      department: 'Healthcare',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'manager',
      requisitionId: 'manager',
      sourceUrl: 'https://buddi.ai/careers.html#manager',
      applyUrl: 'https://buddi.ai/careers.html#manager',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Specializations: Radiology, Pathology, ED, EM, HCC',
      remoteStatus: 'On-site',
    },
    {
      title: 'Medical Coders',
      company: 'BUDDI.AI',
      department: 'Healthcare',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'medical-coders',
      requisitionId: 'medical-coders',
      sourceUrl: 'https://buddi.ai/careers.html#medical-coders',
      applyUrl: 'https://buddi.ai/careers.html#medical-coders',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Specializations: Pathology, Radiology, Surgery, IVR, EM UAE, HCC',
      remoteStatus: 'On-site',
    },
  ])
})

test('BUDDI.AI run validates the verified careers page and emits only India roles', async () => {
  const buddi = await loadModule()
  const jobs = await buddi.createBuddiAiScraper({
    now: () => '2026-08-01T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, buddi.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'buddiai')
  assert.match(jobs[0].scrapedAt, /^2026-08-01T00:00:00\.000Z$/)
  assert.equal(jobs.some((job) => /San Francisco/i.test(job.location)), false)
})

test('BUDDI.AI fails closed when the verified careers surface drifts materially', async () => {
  const buddi = await loadModule()

  await assert.rejects(
    buddi.createBuddiAiScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified buddi\.ai careers surface/i,
  )
})
