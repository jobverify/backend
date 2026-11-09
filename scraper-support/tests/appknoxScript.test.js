import assert from 'node:assert/strict'
import test from 'node:test'

const loadAppknoxModule = async () => import('../../scraper/appknox/script.js')

const careersHtml = `
<!doctype html>
<html>
  <head><title>Careers | Appknox</title></head>
  <body>
    <a href="https://cutshort.io/company/appknox-(xysec-labs-pte-ltd)-j2I4OU56">View Open Positions</a>
    <h2>Let's Work Together!</h2>
    <div class="departments" id="department_1">
      <h2>Sales</h2>
      <div class="row-fluid openning-details">
        <li class="job_type">Bengaluru (Bangalore)</li><li class="experience">1 - 3 Years</li><li class="time">Full Time</li>
        <h4 class="openning_title">Sales Development Representative</h4>
        <a class="apply-now" href="https://cutshort.io/job/Sales-Development-Representative-Bengaluru-Bangalore-Appknox-bPancPsM">Apply Now</a>
      </div>
      <div class="row-fluid openning-details">
        <li class="job_type">Bengaluru (Bangalore)</li><li class="experience">4 - 5 Years</li><li class="time">Full Time</li>
        <h4 class="openning_title">Sales Account Executive</h4>
        <a class="apply-now" href="https://cutshort.io/job/Sales-Account-Executive-Bengaluru-Bangalore-Appknox-kiynNryf">Apply Now</a>
      </div>
    </div>
    <div class="departments" id="department_2">
      <h2>Security</h2>
      <div class="row-fluid openning-details">
        <li class="job_type">Bengaluru (Bangalore)</li><li class="experience">2 - 4 Years</li><li class="time">Full Time</li>
        <h4 class="openning_title">Security Researcher</h4>
        <a class="apply-now" href="https://cutshort.io/job/Security-Researcher-Bengaluru-Bangalore-Appknox-hn1SaGOF">Apply Now</a>
      </div>
    </div>
  </body>
</html>
`

test('Appknox extracts current first-party careers cards and ignores untrusted links', async () => {
  const appknox = await loadAppknoxModule()

  assert.equal(appknox.SOURCE, 'appknox')
  assert.equal(appknox.VERIFIED_ON, '2026-07-25')
  assert.equal(appknox.hasTrustedCareersSignal(careersHtml), true)
  assert.deepEqual(appknox.extractJobs(careersHtml), [
    {
      title: 'Sales Development Representative',
      department: 'Sales',
      location: 'Bengaluru (Bangalore)',
      city: 'Bengaluru',
      employmentType: 'Full Time',
      experienceRequired: '1 - 3 Years',
      link: 'https://cutshort.io/job/Sales-Development-Representative-Bengaluru-Bangalore-Appknox-bPancPsM',
      applyUrl: 'https://cutshort.io/job/Sales-Development-Representative-Bengaluru-Bangalore-Appknox-bPancPsM',
      source: 'appknox',
    },
    {
      title: 'Sales Account Executive',
      department: 'Sales',
      location: 'Bengaluru (Bangalore)',
      city: 'Bengaluru',
      employmentType: 'Full Time',
      experienceRequired: '4 - 5 Years',
      link: 'https://cutshort.io/job/Sales-Account-Executive-Bengaluru-Bangalore-Appknox-kiynNryf',
      applyUrl: 'https://cutshort.io/job/Sales-Account-Executive-Bengaluru-Bangalore-Appknox-kiynNryf',
      source: 'appknox',
    },
    {
      title: 'Security Researcher',
      department: 'Security',
      location: 'Bengaluru (Bangalore)',
      city: 'Bengaluru',
      employmentType: 'Full Time',
      experienceRequired: '2 - 4 Years',
      link: 'https://cutshort.io/job/Security-Researcher-Bengaluru-Bangalore-Appknox-hn1SaGOF',
      applyUrl: 'https://cutshort.io/job/Security-Researcher-Bengaluru-Bangalore-Appknox-hn1SaGOF',
      source: 'appknox',
    },
  ])
})

test('Appknox fails closed when the verified first-party careers contract drifts', async () => {
  const appknox = await loadAppknoxModule()

  await assert.rejects(
    appknox.createAppknoxScraper().run({
      fetchText: async () => '<html><body>Unexpected</body></html>',
    }),
    /verified careers page/i,
  )
})
