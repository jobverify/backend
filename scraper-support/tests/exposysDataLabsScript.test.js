import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1 align="center">Our current openings.</h1>
    <li><b>Software Developer- Python, Django- Full Stack- 1+ years of experience. (Bangalore)</b></li>
    <li><b>Designer-3d Animator- Full Stack- Fresher. (Bangalore)</b></li>
    <li><b>Web Developer-Fresher (Bangaluru)</b></li>
    <li><b>6 Months of Internship is always open for deserving candidates. (Bangalore)</b></li>
    <a href="mailto:hr@exposysdata.com">We invite you to join us!</a>
  </body>
</html>
`

const loadExposysModule = async () => {
  try {
    return await import('../../scraper/exposysdatalabs/script.js')
  } catch {
    assert.fail('Expected Exposys Data Labs scraper module at ../../scraper/exposysdatalabs/script.js')
  }
}

test('extractCareerJobs maps Exposys Data Labs public current openings and internship handoff', async () => {
  const exposys = await loadExposysModule()

  assert.equal(exposys.CAREERS_PAGE_URL, 'https://exposysdata.com/careers.html')
  assert.equal(exposys.INTERNSHIP_PAGE_URL, 'https://exposysdata.com/internship.html')
  assert.equal(exposys.REGISTRATION_URL, 'https://exposysdata.com/registration.php')
  assert.equal(exposys.APPLICATION_EMAIL, 'hr@exposysdata.com')
  assert.deepEqual(exposys.extractCareerJobs(careersHtml), [{
    title: 'Software Developer- Python, Django- Full Stack- 1+ years of experience.',
    company: 'Exposys Data Labs',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'exposysdatalabs-software-developer-python-django-full-stack-1-years-of-experience',
    requisitionId: 'exposysdatalabs-software-developer-python-django-full-stack-1-years-of-experience',
    sourceUrl: 'https://exposysdata.com/careers.html',
    applyUrl: 'mailto:hr@exposysdata.com',
    employmentType: null,
    experienceRequired: '1+ years of experience',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply by emailing hr@exposysdata.com.',
    remoteStatus: 'On-site',
  }, {
    title: 'Designer-3d Animator- Full Stack- Fresher.',
    company: 'Exposys Data Labs',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'exposysdatalabs-designer-3d-animator-full-stack-fresher',
    requisitionId: 'exposysdatalabs-designer-3d-animator-full-stack-fresher',
    sourceUrl: 'https://exposysdata.com/careers.html',
    applyUrl: 'mailto:hr@exposysdata.com',
    employmentType: null,
    experienceRequired: 'Fresher',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply by emailing hr@exposysdata.com.',
    remoteStatus: 'On-site',
  }, {
    title: 'Web Developer-Fresher',
    company: 'Exposys Data Labs',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'exposysdatalabs-web-developer-fresher',
    requisitionId: 'exposysdatalabs-web-developer-fresher',
    sourceUrl: 'https://exposysdata.com/careers.html',
    applyUrl: 'mailto:hr@exposysdata.com',
    employmentType: null,
    experienceRequired: 'Fresher',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply by emailing hr@exposysdata.com.',
    remoteStatus: 'On-site',
  }, {
    title: '6 Months of Internship is always open for deserving candidates.',
    company: 'Exposys Data Labs',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'exposysdatalabs-6-months-of-internship-is-always-open-for-deserving-candidates',
    requisitionId: 'exposysdatalabs-6-months-of-internship-is-always-open-for-deserving-candidates',
    sourceUrl: 'https://exposysdata.com/internship.html',
    applyUrl: 'https://exposysdata.com/registration.php',
    employmentType: 'Internship',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Apply through the Exposys Data Labs internship registration form.',
    remoteStatus: 'On-site',
  }])
})

test('run fetches the official Exposys Data Labs careers page and decorates runner fields', async () => {
  const exposys = await loadExposysModule()

  const jobs = await exposys.createExposysDataLabsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, exposys.CAREERS_PAGE_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'exposysdatalabs')
  assert.equal(jobs[0].link, 'mailto:hr@exposysdata.com')
  assert.equal(jobs[3].link, 'https://exposysdata.com/registration.php')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
