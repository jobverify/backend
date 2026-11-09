import assert from 'node:assert/strict'
import test from 'node:test'

const loadSkillmineModule = async () => {
  try {
    return await import('../../scraper/skillminetechnologyconsulting/script.js')
  } catch {
    assert.fail('Expected Skillmine Technology Consulting scraper module at ../../scraper/skillminetechnologyconsulting/script.js')
  }
}

const careersHtml = `
  <html>
    <head>
      <title>Skillmine Careers | Find the Job Opportunities</title>
    </head>
    <body>
      <h1>Career</h1>
      <h2>Submit your Resume and Join us</h2>
      <h2>Current Open Positions</h2>
      <div class="job-grid-container">
        <div class="job-card">
          <h3>14785-Sr. Python &amp; Groovy Framework Developer</h3>
          <p><strong>Location:</strong> Bangalore</p>
          <p><strong>Experience:</strong> 2 to 4 years</p>
          <p><strong>Job Description:</strong> Mandatory Skills - Python, Pytest Framework, Continuous Integration and Continuous Delivery, Groovy Scripting Skill to Evaluate - Python, Pytest Framework,&hellip;</p>
          <p><strong>Updated At:</strong> 2026-07-09</p>
          <a class="apply-btn" onclick="openApplyPopup('14785-Sr. Python &amp; Groovy Framework Developer')">Apply Now</a>
        </div>
        <div class="job-card">
          <h3>Network Security Engg</h3>
          <p><strong>Location:</strong> Mumbai</p>
          <p><strong>Experience:</strong> 3 to 6 years</p>
          <p><strong>Job Description:</strong> Palo Alto with Checkpoint, Firewall Hardening, Rule reviews</p>
          <p><strong>Updated At:</strong> 2026-07-09</p>
          <a class="apply-btn" onclick="openApplyPopup('Network Security Engg ')">Apply Now</a>
        </div>
      </div>
      <div id="apply-popup" class="apply-popup">
        <div class="apply-popup-content">
          <h2><span id="job-title-display"></span></h2>
          <form id="spotlightForm" enctype="multipart/form-data">
            <input type="hidden" name="action" value="spotlight_apply">
            <input type="hidden" id="job_title_input" name="job_title">
            <button type="submit">Submit Application</button>
          </form>
        </div>
      </div>
      <script>
        function openApplyPopup(jobTitle) {
          document.getElementById("job_title_input").value = jobTitle
        }
      </script>
    </body>
  </html>
`

test('extractJobCards maps verified Skillmine career cards into shared scraper fields', async () => {
  const skillmine = await loadSkillmineModule()
  const jobs = skillmine.extractJobCards(careersHtml)

  assert.equal(skillmine.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(skillmine.hasSharedApplicationFormSignal(careersHtml), true)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: '14785-Sr. Python & Groovy Framework Developer',
    company: 'Skillmine Technology Consulting',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    jobId: 'skillminetechnologyconsulting-14785-sr-python-groovy-framework-developer-bangalore',
    requisitionId: '14785',
    sourceUrl: 'https://skill-mine.com/career/',
    applyUrl: 'https://skill-mine.com/career/',
    employmentType: null,
    experienceRequired: '2 to 4 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-09',
    closingDate: null,
    jobDescription: 'Mandatory Skills - Python, Pytest Framework, Continuous Integration and Continuous Delivery, Groovy Scripting Skill to Evaluate - Python, Pytest Framework,... Apply via the Skillmine careers page.',
  })
})

test('run fetches the official Skillmine careers page and decorates jobs', async () => {
  const skillmine = await loadSkillmineModule()
  const requestedUrls = []
  const scraper = skillmine.createSkillmineTechnologyConsultingScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === skillmine.CAREERS_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [skillmine.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'skillminetechnologyconsulting')
  assert.equal(jobs[0].link, 'https://skill-mine.com/career/')
  assert.equal(jobs[0].company, 'Skillmine Technology Consulting')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
