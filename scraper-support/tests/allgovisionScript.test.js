import assert from 'node:assert/strict'
import test from 'node:test'

const loadAllgovisionModule = async () => {
  try {
    return await import('../../scraper/allgovision/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <div class="current-openings">
      <div class="panel-group" id="accordion">
        <!--
        <div class="panel panel-default">
          <div class="panel-heading" role="tab" id="headingOld">
            <h4 class="panel-title">
              <a class="collapsed" href="#collapseOld">Job Title: Old Hidden Role</a>
            </h4>
          </div>
          <div id="collapseOld" class="panel-collapse collapse">
            <div class="panel-body">
              <p><strong>Position:</strong> Hidden Role<br/><br/></p>
            </div>
          </div>
        </div>
        -->
        <div class="panel panel-default">
          <div class="panel-heading" role="tab" id="headingOne">
            <h4 class="panel-title">
              <a class="collapsed" href="#collapseOne">Job Title: Technical Support Engineer - Mumbai</a>
            </h4>
          </div>
          <div id="collapseOne" class="panel-collapse collapse">
            <div class="panel-body">
              <p>
                <strong>Position:</strong> Technical Support Engineer<br/><br/>
                <strong>Experience:</strong> 2-4 years<br/><br/>
                <strong>Qualification:</strong> BE/MCA/BSC/Diploma with relevant experience<br/><br/>
                <strong>Location:</strong> Mumbai<br/><br/>
                <strong>Travel:</strong> Should be prepared to travel within India and abroad<br/><br/>
              </p>
              <p><strong>Work profile:</strong></p>
              <ul class="list1">
                <li>Deployment of AI product of AllGoVision Video Analytics.</li>
                <li>Work closely with Sales and Engineering team.</li>
              </ul>
              <p><strong>Required Skills:</strong></p>
              <ul class="list1">
                <li>Linux administration</li>
                <li>Customer management</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="panel panel-default">
          <div class="panel-heading" role="tab" id="headingTwo">
            <h4 class="panel-title">
              <a class="collapsed" href="#collapseTwo">Job Title: Sales Manager - North India Market</a>
            </h4>
          </div>
          <div id="collapseTwo" class="panel-collapse collapse">
            <div class="panel-body">
              <p>
                <strong>Position:</strong> Sales Manager - North India Market<br/><br/>
                <strong>Experience:</strong> 5-12 years<br/><br/>
                <strong>Qualification:</strong> BE/B Tech/MBA from a leading institute<br/><br/>
                <strong>Job Location:</strong> Delhi<br/><br/>
              </p>
              <p><strong>Work profile:</strong></p>
              <ul class="list1">
                <li>Build lead pipeline and convert to sales.</li>
              </ul>
              <p><strong>Skills:</strong></p>
              <ul class="list1">
                <li>Exposure to surveillance/security market.</li>
                <li>Good communication.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps visible AllGoVision openings and ignores commented jobs', async () => {
  const allgovision = await loadAllgovisionModule()
  assert.ok(allgovision)

  const jobs = allgovision.extractSearchResults(careerPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Technical Support Engineer',
    company: 'AllGoVision',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'headingOne',
    requisitionId: 'headingOne',
    sourceUrl: 'https://www.allgovision.com/career.php#collapseOne',
    applyUrl: 'https://www.allgovision.com/career.php#collapseOne',
    employmentType: null,
    experienceRequired: '2-4 years',
    minimumQualification: 'BE/MCA/BSC/Diploma with relevant experience',
    preferredQualification: null,
    requiredSkills: ['Linux administration', 'Customer management'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Travel: Should be prepared to travel within India and abroad Work profile: Deployment of AI product of AllGoVision Video Analytics. Work closely with Sales and Engineering team. Required Skills: Linux administration Customer management',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'Sales Manager - North India Market')
  assert.equal(jobs[1].location, 'Delhi, India')
  assert.equal(jobs[1].city, 'Delhi')
  assert.deepEqual(jobs[1].requiredSkills, [
    'Exposure to surveillance/security market.',
    'Good communication.',
  ])
})

test('run fetches the AllGoVision careers page and decorates current openings', async () => {
  const allgovision = await loadAllgovisionModule()
  assert.ok(allgovision)

  const requestedTexts = []
  const scraper = allgovision.createAllgovisionScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedTexts.push(url)
      if (url === allgovision.CAREER_PAGE_URL) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedTexts, [allgovision.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'allgovision')
  assert.equal(jobs[0].link, 'https://www.allgovision.com/career.php#collapseOne')
  assert.equal(jobs[0].company, 'AllGoVision')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run marks AllGoVision 5xx responses as upstream soft failures', async () => {
  const allgovision = await loadAllgovisionModule()
  assert.ok(allgovision)

  await assert.rejects(
    allgovision.createAllgovisionScraper().run({
      fetchText: async (url) => {
        throw new Error(`HTTP 502 for ${url}`)
      },
    }),
    (error) => {
      assert.match(error.message, /HTTP 502/i)
      assert.equal(error.softFailure, true)
      assert.equal(error.upstreamOutage, true)
      return true
    },
  )
})
