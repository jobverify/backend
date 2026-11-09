import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Ausweg Info Controls - Industrial Automation, Robotics & IIoT Solutions</title>
  </head>
  <body>
    <h1>Careers</h1>
    <h2>Career Opportunities</h2>

    <h5>Admin Executive</h5>
    <p>Bangalore, Karanataka</p>
    <p>Job Description</p>
    <p>Company Descriptions</p>
    <p>Ausweg Info Controls Pvt Ltd seamlessly integrates Operational Technology (OT) and Information Technology (IT).</p>
    <p>About the Role</p>
    <p>Ausweg Info Controls Pvt Ltd is looking for a proactive and organized Admin Executive to support day-to-day office operations.</p>
    <p>Key Responsibilities</p>
    <p>• Manage daily office administrative activities</p>
    <p>• Handle documentation, filing, and record maintenance</p>
    <p>Skills &amp; Requirements</p>
    <p>• Basic knowledge of MS Office (Excel, Word, Outlook)</p>
    <p>• Good communication and coordination skills</p>
    <p>Job Type: Full-Time</p>
    <p>Experience: Fresher</p>
    <p>Qualification: BBA / B.Com / Diploma</p>
    <a href="https://forms.office.com/r/PsAiab6FFZ?origin=lprLink">Apply Now</a>

    <h5>Full Stack Developer</h5>
    <p>Coimbatore, Tamilnadu</p>
    <p>Job Description</p>
    <p>Company Description</p>
    <p>Ausweg Info Controls Pvt Ltd seamlessly integrates Operational Technology (OT) and Information Technology (IT).</p>
    <p>About the Role</p>
    <p>Ausweg Info Controls Pvt Ltd is looking for a skilled Full Stack Developer to design, develop, and maintain scalable web applications.</p>
    <p>Key Responsibilities</p>
    <p>• Build and integrate RESTful APIs and backend services.</p>
    <p>• Troubleshoot, debug, and upgrade existing systems.</p>
    <p>Skills &amp; Requirements</p>
    <p>• Strong knowledge of front-end technologies (HTML, CSS, JavaScript).</p>
    <p>• Knowledge of database systems (MySQL, PostgreSQL, MongoDB).</p>
    <p>Job Type: Full-Time</p>
    <p>Experience: Fresher</p>
    <p>Qualification: B.E / B.Tech / B.Sc / M.Sc in Computer Science / IT / Software Engineering or related field</p>
    <a href="https://forms.office.com/r/PsAiab6FFZ?origin=lprLink">Apply Now</a>
  </body>
</html>
`

const loadAuswegModule = async () => {
  try {
    return await import('../../scraper/ausweginfocontrols/script.js')
  } catch {
    assert.fail('Expected Ausweg Info Controls scraper module at ../../scraper/ausweginfocontrols/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified Ausweg careers surface', async () => {
  const ausweg = await loadAuswegModule()

  assert.equal(ausweg.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('extractPublicListings parses inline Ausweg job sections with a shared apply URL', async () => {
  const ausweg = await loadAuswegModule()

  assert.equal(ausweg.CAREERS_URL, 'https://ausweginfocontrols.com/careers/')
  assert.equal(ausweg.APPLY_URL, 'https://forms.office.com/r/PsAiab6FFZ?origin=lprLink')

  const jobs = ausweg.extractPublicListings(CAREERS_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Admin Executive',
    company: 'Ausweg Info Controls Pvt Ltd',
    department: null,
    location: 'Bangalore, Karanataka, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'ausweginfocontrols-admin-executive',
    requisitionId: 'ausweginfocontrols-admin-executive',
    sourceUrl: 'https://ausweginfocontrols.com/careers/#admin-executive',
    applyUrl: 'https://forms.office.com/r/PsAiab6FFZ?origin=lprLink',
    employmentType: 'Full-Time',
    experienceRequired: 'Fresher',
    minimumQualification: 'BBA / B.Com / Diploma',
    preferredQualification: null,
    requiredSkills: [
      'Manage daily office administrative activities',
      'Handle documentation, filing, and record maintenance',
      'Basic knowledge of MS Office (Excel, Word, Outlook)',
      'Good communication and coordination skills',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Ausweg Info Controls Pvt Ltd is looking for a proactive and organized Admin Executive to support day-to-day office operations. Manage daily office administrative activities Handle documentation, filing, and record maintenance Basic knowledge of MS Office (Excel, Word, Outlook) Good communication and coordination skills',
    remoteStatus: 'On-site',
  })

  assert.equal(jobs[1].title, 'Full Stack Developer')
  assert.equal(jobs[1].city, 'Coimbatore')
  assert.equal(jobs[1].employmentType, 'Full-Time')
  assert.match(jobs[1].jobDescription, /scalable web applications/i)
})

test('run fetches the Ausweg careers page and decorates runner fields', async () => {
  const ausweg = await loadAuswegModule()
  const requestedUrls = []

  const jobs = await ausweg.createAuswegInfoControlsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
    now: () => '2026-07-09T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://ausweginfocontrols.com/careers/'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'ausweginfocontrols')
  assert.equal(jobs[0].link, 'https://forms.office.com/r/PsAiab6FFZ?origin=lprLink')
  assert.equal(jobs[0].scrapedAt, '2026-07-09T12:00:00.000Z')
})

test('run fails closed when the Ausweg careers surface changes', async () => {
  const ausweg = await loadAuswegModule()

  await assert.rejects(
    ausweg.createAuswegInfoControlsScraper().run({
      fetchText: async () => '<html><body>No career opportunities here</body></html>',
    }),
    /verified Ausweg careers surface/i,
  )
})
