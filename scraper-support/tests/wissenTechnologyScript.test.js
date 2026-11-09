import assert from 'node:assert/strict'
import test from 'node:test'

const loadWissenModule = async () => {
  try {
    return await import('../../scraper/wissentechnology/script.js')
  } catch {
    assert.fail('Expected Wissen Technology scraper module at ../../scraper/wissentechnology/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Opportunities at Wissen Technology</h1>
    <p>Important Notice - Fraudulent Job Offers in the Name of Wissen Technology Pvt. Ltd.</p>
    <p>All legitimate job openings are published only on our official website www.wissen.com in the career section.</p>
    <div role="listitem" class="cms-job-item w-dyn-item">
      <div data-w-id="c8425af0-bf9a-e406-5bdb-095373138cc6" class="job-item">
        <div class="container">
          <div class="w-layout-grid grid mn0">
            <div class="job-title-column">
              <p class="job-title-1">Angular/UI Developer</p>
              <p class="opacity-70">Do you like this work? Don't hesitate to check this out.</p>
              <a href="/job/angular-ui-developer" class="main-button w-inline-block">
                <p class="main-button-title w-dyn-bind-empty"></p>
                <div class="scroll-down-line"></div>
              </a>
            </div>
            <div class="job-desciption-column">
              <div class="job-desciption">
                <p class="job-paragraph">Wissen Technology is now hiring for Core UI developers with relevant experience in Angular 2 &amp; above across multiple levels.</p>
                <div class="job-salary">
                  <p class="job-salary-title w-dyn-bind-empty"></p>
                  <p class="job-salary-number">Full-time</p>
                </div>
                <div class="job-salary w-condition-invisible">
                  <p class="job-salary-title">Salary</p>
                  <p class="job-salary-number w-dyn-bind-empty"></p>
                </div>
                <div class="job-salary">
                  <p class="job-salary-title">Location</p>
                  <p class="job-salary-number"> Bengaluru/Pune/Mumbai</p>
                </div>
                <div class="job-buttons">
                  <p class="job-salary-title">Job application</p>
                  <a href="/contact/writetous" class="main-button red-version w-inline-block">
                    <p class="main-button-title">Send resume now</p>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div role="listitem" class="cms-job-item w-dyn-item">
      <div data-w-id="c8425af0-bf9a-e406-5bdb-095373138cc6" class="job-item">
        <div class="container">
          <div class="w-layout-grid grid mn0">
            <div class="job-title-column">
              <p class="job-title-1">Uipath Developer</p>
              <p class="opacity-70">Do you like this work? Don't hesitate to check this out.</p>
              <a href="/job/uipath-developer" class="main-button w-inline-block">
                <p class="main-button-title w-dyn-bind-empty"></p>
                <div class="scroll-down-line"></div>
              </a>
            </div>
            <div class="job-desciption-column">
              <div class="job-desciption">
                <p class="job-paragraph">Wissen Technology is now hiring for a Uipath Developer.</p>
                <div class="job-salary">
                  <p class="job-salary-title w-dyn-bind-empty"></p>
                  <p class="job-salary-number">Full-time</p>
                </div>
                <div class="job-salary w-condition-invisible">
                  <p class="job-salary-title">Salary</p>
                  <p class="job-salary-number w-dyn-bind-empty"></p>
                </div>
                <div class="job-salary">
                  <p class="job-salary-title">Location</p>
                  <p class="job-salary-number">Mumbai</p>
                </div>
                <div class="job-buttons">
                  <p class="job-salary-title">Job application</p>
                  <a href="/contact/writetous" class="main-button red-version w-inline-block">
                    <p class="main-button-title">Send resume now</p>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const angularUiDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main class="main">
      <section class="section overflow-visibile">
        <div class="job-title-block">
          <h1 class="heading job-title-2">Angular/UI Developer</h1>
          <p class="paragraph medium">Wissen Technology is now hiring for Core UI developers with relevant experience in Angular 2 &amp; above across multiple levels.</p>
        </div>
        <div class="job-item">
          <div class="job-about-column-2">
            <div class="rich-text w-richtext">
              <p><strong>Skills required:</strong></p>
              <ul role="list">
                <li>Experience - 7 to 12 Years</li>
                <li>Angular is a must and UI design patterns</li>
                <li>Strong oral and written communication skills</li>
              </ul>
            </div>
          </div>
          <div class="job-about-column-1">
            <div class="job-desciption-sticky">
              <div class="job-salary">
                <p class="job-salary-title">Job Type</p>
                <p class="job-salary-number">Full-time</p>
              </div>
              <div class="job-salary">
                <p class="job-salary-title">Location</p>
                <p class="job-salary-number"> Bengaluru/Pune/Mumbai</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="section bg-gray-c0">
        <h2>Other job vacancies</h2>
      </section>
    </main>
  </body>
</html>
`

const uipathDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main class="main">
      <section class="section overflow-visibile">
        <div class="job-title-block">
          <h1 class="heading job-title-2">Uipath Developer</h1>
          <p class="paragraph medium">Wissen Technology is now hiring for a Uipath Developer.</p>
        </div>
        <div class="job-item">
          <div class="job-about-column-2">
            <div class="rich-text w-richtext">
              <p><strong>Required Skills:</strong></p>
              <ul role="list">
                <li>Experience - 5 to 12 years.</li>
                <li>Design, code, test automation workflows using UiPath. Minimum 2 years' experience in UiPath.</li>
                <li>Strong written/verbal communication skills.</li>
              </ul>
            </div>
          </div>
          <div class="job-about-column-1">
            <div class="job-desciption-sticky">
              <div class="job-salary">
                <p class="job-salary-title">Job Type</p>
                <p class="job-salary-number">Full-time</p>
              </div>
              <div class="job-salary">
                <p class="job-salary-title">Location</p>
                <p class="job-salary-number">Mumbai</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="section bg-gray-c0">
        <h2>Other job vacancies</h2>
      </section>
    </main>
  </body>
</html>
`

test('Wissen Technology extracts public detail-page experience from the verified first-party job pages', async () => {
  const wissen = await loadWissenModule()

  assert.equal(wissen.SOURCE, 'wissentechnology')
  assert.equal(wissen.COMPANY, 'Wissen Technology')
  assert.equal(
    wissen.CAREERS_URL,
    'https://www.wissen.com/career/opportunities-wissen-technology',
  )
  assert.equal(wissen.hasOfficialCareersSignal(officialCareersHtml), true)

  const listings = wissen.extractVisibleJobs(officialCareersHtml)
  assert.equal(listings.length, 2)
  assert.equal(listings[0].sourceUrl, 'https://www.wissen.com/job/angular-ui-developer')

  const angularDetail = wissen.extractJobDetail(angularUiDeveloperDetailHtml)
  assert.equal(angularDetail.experienceRequired, '7 - 12 years')
  assert.equal(angularDetail.location, 'Bengaluru/Pune/Mumbai')
  assert.equal(angularDetail.employmentType, 'Full-time')
  assert.ok(angularDetail.jobDescription.includes('Angular is a must and UI design patterns'))
  assert.equal(angularDetail.publicExperienceChecked, true)
})

test('Wissen Technology run enriches verified listings with detail-page experience', async () => {
  const wissen = await loadWissenModule()
  const requestedUrls = []

  const jobs = await wissen.createWissenTechnologyScraper({
    now: () => '2026-08-06T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === wissen.CAREERS_URL) return officialCareersHtml
      if (url === 'https://www.wissen.com/job/angular-ui-developer') return angularUiDeveloperDetailHtml
      if (url === 'https://www.wissen.com/job/uipath-developer') return uipathDeveloperDetailHtml
      throw new Error(`Unexpected Wissen URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    wissen.CAREERS_URL,
    'https://www.wissen.com/job/angular-ui-developer',
    'https://www.wissen.com/job/uipath-developer',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Angular/UI Developer')
  assert.equal(jobs[0].experienceRequired, '7 - 12 years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].title, 'Uipath Developer')
  assert.equal(jobs[1].experienceRequired, '5 - 12 years')
  assert.equal(jobs[1].publicExperienceChecked, true)
})
