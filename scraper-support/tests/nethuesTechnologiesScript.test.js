import assert from 'node:assert/strict'
import test from 'node:test'

const loadNethuesModule = async () => {
  try {
    return await import('../../scraper/nethuestechnologies/script.js')
  } catch {
    assert.fail('Expected Nethues Technologies scraper module at ../../scraper/nethuestechnologies/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html>
  <body>
    <div class="positionsContainer">
      <div class="posinav one">
        <div class="posnav_header active" id="list1">
          <p><strong class="blockTxt">Full Stack Developer  (Laravel + Vue.Js)</strong>North Delhi (Rohini)<br><small>Posted On 17 June, 2024</small></p>
        </div>
        <div class="posnav_header" id="list2">
          <p><strong class="blockTxt">Golang Developer</strong>Rohini<br><small>Posted On 17 September, 2024</small></p>
        </div>
      </div>
      <div class="positionsouter">
        <div class="positions list1 active">
          <div class="pos_header">
            <p><strong class="blockTxt">Full Stack Developer  (Laravel + Vue.Js)</strong>North Delhi (Rohini)<small class="blockTxt orange">No. of Positions: 1</small></p>
            <span class="posdate">Posted On 17 June, 2024</span>
          </div>
          <div class="pos_description">
            <p><strong>Job Description:</strong></p>
            <p><strong>Responsibilities:</strong></p>
            <ul>
              <li>Develop and implement Backend components using Laravel ensuring scalability.</li>
              <li>Build responsive and intuitive user interfaces using Vue.js.</li>
            </ul>
            <p><strong>Requirements:</strong></p>
            <ul>
              <li>Proven experience as a Full Stack Developer or similar role.</li>
            </ul>
            <p><strong>Minimum Experience:</strong> 3 Years</p>
            <p><strong>Compensation:</strong> Best as per industry</p>
            <p><strong>Working Days:</strong> 5 Days working, Sat-Sun fixed off</p>
            <p><strong>Email:</strong> <a href="mailto:hr@nethues.com">hr@nethues.com</a></p>
          </div>
        </div>
        <div class="positions list2">
          <div class="pos_header">
            <p><strong class="blockTxt">Golang Developer</strong>Rohini<small class="blockTxt orange">No. of Positions: </small></p>
            <span class="posdate">Posted On 17 September, 2024</span>
          </div>
          <div class="pos_description">
            <p><strong>Job Description:</strong></p>
            <p><strong>Responsibilities</strong></p>
            <ul>
              <li>Write clean, efficient, and maintainable code in Golang for Backend development.</li>
              <li>Develop user interfaces using React.</li>
            </ul>
            <p><strong>Requirements</strong></p>
            <ul>
              <li>Proven experience as a Golang Developer with a strong portfolio of past projects.</li>
            </ul>
            <p><strong>Minimum Experience:</strong> 3</p>
            <p><strong>Compensation:</strong> Best as per industry</p>
            <p><strong>Working Days:</strong> 5 Days working, Sat-Sun fixed off</p>
            <p><strong>Email:</strong> <a href="mailto:hr@nethues.com">hr@nethues.com</a></p>
          </div>
        </div>
      </div>
    </div>
    <button type="button" class="largeBtn" id="applyNow"><span>Apply Now</span></button>
  </body>
</html>
`

test('extractSearchResults maps the Nethues inline openings sections into scraper jobs', async () => {
  const nethues = await loadNethuesModule()

  const jobs = nethues.extractSearchResults(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Full Stack Developer (Laravel + Vue.Js)',
    company: 'Nethues Technologies',
    department: null,
    location: 'North Delhi (Rohini), India',
    city: 'Rohini',
    state: null,
    country: 'India',
    jobId: 'list1',
    requisitionId: 'list1',
    sourceUrl: 'https://www.nethues.com/careers/#list1',
    applyUrl: 'https://www.nethues.com/careers/#applyNow',
    employmentType: null,
    experienceRequired: '3 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2024-06-17',
    closingDate: null,
    jobDescription: 'Job Description: Responsibilities: Develop and implement Backend components using Laravel ensuring scalability. Build responsive and intuitive user interfaces using Vue.js. Requirements: Proven experience as a Full Stack Developer or similar role. Compensation: Best as per industry Working Days: 5 Days working, Sat-Sun fixed off Email: hr@nethues.com',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'Golang Developer')
  assert.equal(jobs[1].city, 'Rohini')
  assert.equal(jobs[1].postingDate, '2024-09-17')
})

test('run fetches the Nethues careers page and decorates the inline openings', async () => {
  const nethues = await loadNethuesModule()
  const requestedUrls = []

  const jobs = await nethues.createNethuesTechnologiesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, ['https://www.nethues.com/careers/'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'nethuestechnologies')
  assert.equal(jobs[0].link, 'https://www.nethues.com/careers/#applyNow')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
