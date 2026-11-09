import assert from 'node:assert/strict'
import test from 'node:test'

const loadMapmyIndiaModule = async () => {
  try {
    return await import('../../scraper/mapmyindia/script.js')
  } catch {
    assert.fail('Expected MapmyIndia scraper module at ../../scraper/mapmyindia/script.js')
  }
}

const CAREERS_HTML = `
<!doctype html>
<html>
  <head>
    <title>MapmyIndia - India's best indigenous maps, location, IoT, navigation & geospatial services</title>
    <meta property="og:site_name" content="MapmyIndia" />
  </head>
  <body>
    <section>
      <h2>What brings us to MapmyIndia</h2>
      <p>Revolutionary location-based products, solutions, and services built on India's best maps.</p>
      <div class="jobCard-wraper d-none">
        <div class="jobCard">
          <div class="profile-name">
            <h4>Android Developer</h4>
          </div>
          <div class="jd">
            <div class="requirement">
              <p>2-4 Years</p>
            </div>
            <div class="requirement">
              <p>Delhi NCR</p>
            </div>
            <div class="profile-detail">
              <h3>Job Description:</h3>
              <p>
                Experience with LINUX <br>
                Experience with Android SDK... <br>
                <a href="#">Read more</a>
              </p>
            </div>
            <div class="apply-bt">
              <button>Apply now</button>
            </div>
          </div>
        </div>
        <div class="jobCard">
          <div class="profile-name">
            <h4>IOS Developer</h4>
          </div>
          <div class="jd">
            <div class="requirement">
              <p>2-4 Years</p>
            </div>
            <div class="requirement">
              <p>Delhi NCR</p>
            </div>
            <div class="profile-detail">
              <h3>Job Description:</h3>
              <p>
                Work on Mobile Platforms for IOS <br>
                including iPhone, iPad/apps...<br>
                <a href="#">Read more</a>
              </p>
            </div>
            <div class="apply-bt">
              <button>Apply now</button>
            </div>
          </div>
        </div>
        <div class="jobCard">
          <div class="profile-name">
            <h4>Inside Sales Executive</h4>
          </div>
          <div class="jd">
            <div class="requirement">
              <p>2-4 Years</p>
            </div>
            <div class="requirement">
              <p>Delhi NCR</p>
            </div>
            <div class="profile-detail">
              <h3>Job Description:</h3>
              <p>
                Identifying the need and proposing <br>
                digital advertisement helping...<br>
                <a href="#">Read more</a>
              </p>
            </div>
            <div class="apply-bt">
              <button>Apply now</button>
            </div>
          </div>
        </div>
      </div>
      <h3>Join MapmyIndia</h3>
      <h5>Drop your CV here or send it to <a href="mailto:hr@mapmyindia.com">hr@mapmyindia.com</a>.</h5>
      <p>C.E. Info Systems Ltd.</p>
    </section>
  </body>
</html>
`

const DRIFTED_JOB_CARD_HTML = `
<!doctype html>
<html>
  <head>
    <title>MapmyIndia Careers</title>
    <meta property="og:site_name" content="MapmyIndia" />
  </head>
  <body>
    <section>
      <h2>What brings us to MapmyIndia</h2>
      <p>C.E. Info Systems Ltd.</p>
      <h3>Join MapmyIndia</h3>
      <article class="current-opening jobCard">
        <div class="profile-name featured">
          <h4>Android Developer</h4>
        </div>
        <div class="jd">
          <div class="requirement highlighted">
            <span>Experience</span>
            <p>2-4 Years</p>
          </div>
          <div class="requirement highlighted">
            <span>Location</span>
            <p>Delhi NCR</p>
          </div>
          <div class="profile-detail collapsed">
            <h3>Job Description:</h3>
            <p>
              Experience with LINUX <br>
              Experience with Android SDK... <br>
              <a href="#">Read more</a>
            </p>
          </div>
          <div class="apply-bt sticky">
            <button>Apply now</button>
          </div>
        </div>
      </article>
      <p>Drop your CV here or send it to <a href="mailto:hr@mapmyindia.com">hr@mapmyindia.com</a>.</p>
      <h4>Inside Sales Executive</h4>
    </section>
  </body>
</html>
`

test('MapmyIndia helpers keep the verified first-party inline careers page contract stable', async () => {
  const mapmyindia = await loadMapmyIndiaModule()

  assert.equal(mapmyindia.COMPANY, 'MapmyIndia')
  assert.equal(mapmyindia.OFFICIAL_BRAND_NAME, 'C.E. Info Systems Ltd. (MapmyIndia)')
  assert.equal(mapmyindia.VERIFIED_ON, '2026-07-16')
  assert.equal(mapmyindia.HOMEPAGE_URL, 'https://www.mapmyindia.com/')
  assert.equal(mapmyindia.CAREERS_URL, 'https://www.mapmyindia.com/careers/')
  assert.equal(mapmyindia.PUBLIC_BOARD_URL, 'https://www.mapmyindia.com/careers/')
  assert.equal(mapmyindia.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(mapmyindia.extractApplicationContact(CAREERS_HTML), 'hr@mapmyindia.com')
})

test('extractSearchResults maps MapmyIndia inline job cards into shared scraper fields', async () => {
  const mapmyindia = await loadMapmyIndiaModule()
  const jobs = mapmyindia.extractSearchResults(CAREERS_HTML)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Android Developer',
    company: 'MapmyIndia',
    department: null,
    location: 'Delhi NCR, India',
    city: 'Delhi NCR',
    country: 'India',
    jobId: 'android-developer-delhi-ncr',
    requisitionId: 'android-developer-delhi-ncr',
    sourceUrl: 'https://www.mapmyindia.com/careers/',
    applyUrl: 'https://www.mapmyindia.com/careers/',
    employmentType: null,
    experienceRequired: '2-4 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Experience with LINUX Experience with Android SDK...',
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].jobId, 'ios-developer-delhi-ncr')
  assert.equal(jobs[1].title, 'IOS Developer')
  assert.equal(jobs[2].title, 'Inside Sales Executive')
  assert.match(jobs[2].jobDescription, /digital advertisement helping/i)
})

test('extractSearchResults tolerates harmless MapmyIndia job-card class and wrapper drift', async () => {
  const mapmyindia = await loadMapmyIndiaModule()
  const jobs = mapmyindia.extractSearchResults(DRIFTED_JOB_CARD_HTML)

  assert.equal(mapmyindia.hasOfficialCareersPageSignal(DRIFTED_JOB_CARD_HTML), true)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Android Developer',
    company: 'MapmyIndia',
    department: null,
    location: 'Delhi NCR, India',
    city: 'Delhi NCR',
    country: 'India',
    jobId: 'android-developer-delhi-ncr',
    requisitionId: 'android-developer-delhi-ncr',
    sourceUrl: 'https://www.mapmyindia.com/careers/',
    applyUrl: 'https://www.mapmyindia.com/careers/',
    employmentType: null,
    experienceRequired: '2-4 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Experience with LINUX Experience with Android SDK...',
    remoteStatus: 'On-site',
  })
})

test('run fetches the verified MapmyIndia careers page and decorates inline jobs', async () => {
  const mapmyindia = await loadMapmyIndiaModule()
  const requestedUrls = []
  const scraper = mapmyindia.createMapmyIndiaScraper({ maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mapmyindia.CAREERS_URL) return CAREERS_HTML
      throw new Error(`Unexpected MapmyIndia URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [mapmyindia.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'mapmyindia')
  assert.equal(jobs[0].link, 'https://www.mapmyindia.com/careers/')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.equal(jobs[1].jobId, 'ios-developer-delhi-ncr')
})
