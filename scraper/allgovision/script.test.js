import assert from 'node:assert/strict'
import test from 'node:test'

const loadAllgovisionModule = async () => import('./script.js')

const careerPageHtml = `
<!doctype html>
<html>
  <body>
    <!--
    <div class="panel panel-default">
      <div class="panel-heading" id="hidden-role">
        <h4 class="panel-title">
          <a href="#hidden-role-body">Job Title: Hidden Role</a>
        </h4>
      </div>
      <div id="hidden-role-body" class="panel-collapse collapse">
        <div class="panel-body">
          <strong>Position:</strong> Hidden Role<br><br>
          <strong>Job Location:</strong> Hidden City<br><br>
        </div>
      </div>
    </div>
    -->
    <div class="panel panel-default">
      <div class="panel-heading" id="tech-support-mumbai">
        <h4 class="panel-title">
          <a href="#collapse-tech-support">Job Title: Technical Support Engineer - Mumbai</a>
        </h4>
      </div>
      <div id="collapse-tech-support" class="panel-collapse collapse">
        <div class="panel-body">
          <strong>Position:</strong> Technical Support Engineer<br><br>
          <strong>Experience:</strong> 2-4 years<br><br>
          <strong>Qualification:</strong> BE/MCA/BSC/Diploma with relevant experience<br><br>
          <strong>Location:</strong> Mumbai<br><br>
          <p><strong>Required Skills:</strong></p>
          <ul>
            <li>Customer-facing troubleshooting</li>
            <li>Linux administration</li>
          </ul>
          <p>Deployment of AI product and customer support.</p>
        </div>
      </div>
    </div>
    <div class="panel panel-default">
      <div class="panel-heading" id="sales-manager-delhi">
        <h4 class="panel-title">
          <a href="#collapse-sales-manager">Job Title: Sales Manager - North India Market</a>
        </h4>
      </div>
      <div id="collapse-sales-manager" class="panel-collapse collapse">
        <div class="panel-body">
          <strong>Position:</strong> Sales Manager - North India Market<br><br>
          <strong>Experience:</strong> 5-12 years<br><br>
          <strong>Qualification:</strong> BE/B Tech/MBA from a leading institute.<br><br>
          <strong>Job Location:</strong> Delhi<br><br>
          <p><strong>Skills:</strong></p>
          <ul>
            <li>B2B software sales</li>
            <li>North India market knowledge</li>
          </ul>
          <p>Build lead pipeline and manage key accounts.</p>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults parses visible AllGoVision openings from the public careers accordion', async () => {
  const allgovision = await loadAllgovisionModule()

  assert.equal(
    allgovision.CAREER_PAGE_URL,
    'https://www.allgovision.com/career.php',
  )

  const jobs = allgovision.extractSearchResults(careerPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Support Engineer',
    company: 'AllGoVision',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'tech-support-mumbai',
    requisitionId: 'tech-support-mumbai',
    sourceUrl: 'https://www.allgovision.com/career.php#collapse-tech-support',
    applyUrl: 'https://www.allgovision.com/career.php#collapse-tech-support',
    employmentType: null,
    experienceRequired: '2-4 years',
    minimumQualification: 'BE/MCA/BSC/Diploma with relevant experience',
    preferredQualification: null,
    requiredSkills: [
      'Customer-facing troubleshooting',
      'Linux administration',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Required Skills: Customer-facing troubleshooting Linux administration Deployment of AI product and customer support.',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'Sales Manager - North India Market')
  assert.equal(jobs[1].location, 'Delhi, India')
  assert.deepEqual(jobs[1].requiredSkills, [
    'B2B software sales',
    'North India market knowledge',
  ])
  assert.match(jobs[1].jobDescription, /Build lead pipeline and manage key accounts\./i)
})

test('run fetches the official AllGoVision careers page and decorates jobs with scraper metadata', async () => {
  const allgovision = await loadAllgovisionModule()
  const requestedUrls = []
  const scraper = allgovision.createAllgovisionScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === allgovision.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [allgovision.CAREER_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'allgovision')
  assert.equal(jobs[0].link, 'https://www.allgovision.com/career.php#collapse-tech-support')
  assert.equal(jobs[0].company, 'AllGoVision')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
