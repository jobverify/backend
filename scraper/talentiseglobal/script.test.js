import assert from 'node:assert/strict'
import test from 'node:test'

const loadTalentiseGlobalModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Talentise Global scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Talentise Global Pvt. Ltd</title>
  </head>
  <body>
    <header>
      <a href="https://talentiseglobal.com/front/login">Login</a>
      <a href="https://talentiseglobal.com/student-registration">Talent Pro +</a>
      <a href="https://talentiseglobal.com/careers">Careers</a>
      <a href="mailto:teamtalentise@talentiseglobal.com">teamtalentise@talentiseglobal.com</a>
    </header>
    <main>
      <h1>Home</h1>
      <h2>Who We Are</h2>
      <h3>Services</h3>
      <p>Talent Acquisition &amp; Related Solutions</p>
      <p>Employer Branding Strategies</p>
      <p>Examination Management Systems</p>
      <p>Learning &amp; Development Services</p>
      <p>Testimonials</p>
      <p>Institute Event Gallery</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>TGPL | Careers</title>
  </head>
  <body>
    <main>
      <h1>Latest Career Opportunities</h1>
      <article>
        <h2>Teacher</h2>
        <p>Campus recruitment is the strategy to source, engage and hire young talents for entry-level positions.</p>
        <p>Kolkata</p>
        <a href="https://talentiseglobal.com/career-details/teacher">Read More</a>
      </article>
    </main>
  </body>
</html>
`

const detailHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Teacher</title>
  </head>
  <body>
    <main>
      <h1>Teacher</h1>
      <p>Qualification : 12th</p>
      <p>Department : Computer, AI &amp; Robotics</p>
      <p>Experience : 5</p>
      <p>Job Location : Kolkata</p>
      <p>Employment Type : Full time</p>
      <p>Job Description : Campus recruitment is the strategy to source, engage and hire young talents for entry-level positions.</p>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>TGPL | Careers</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Search jobs across our public hiring board.</p>
      <p>Job ID: TG-101</p>
      <a href="https://talentiseglobal.com/career-details/teacher">Apply now</a>
    </main>
  </body>
</html>
`

test('Talentise Global exports the refreshed first-party public careers contract', async () => {
  const talentiseGlobal = await loadTalentiseGlobalModule()

  assert.equal(talentiseGlobal.SOURCE, 'talentiseglobal')
  assert.equal(talentiseGlobal.COMPANY, 'TALENTISE GLOBAL')
  assert.equal(talentiseGlobal.HOMEPAGE_URL, 'https://talentiseglobal.com/')
  assert.equal(talentiseGlobal.CAREERS_URL, 'https://talentiseglobal.com/careers')
  assert.equal(talentiseGlobal.CANDIDATE_LOGIN_URL, 'https://talentiseglobal.com/front/login')
  assert.equal(talentiseGlobal.CANDIDATE_SIGNUP_URL, 'https://talentiseglobal.com/student-registration')
  assert.equal(talentiseGlobal.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(talentiseGlobal.hasPublicCareersSignal(careersHtml), true)
  assert.deepEqual(talentiseGlobal.extractCareerListings(careersHtml), [
    {
      title: 'Teacher',
      location: 'Kolkata',
      detailUrl: 'https://talentiseglobal.com/career-details/teacher',
    },
  ])
  assert.deepEqual(talentiseGlobal.extractCareerDetail(detailHtml, {
    title: 'Teacher',
    location: 'Kolkata',
    detailUrl: 'https://talentiseglobal.com/career-details/teacher',
  }), {
    title: 'Teacher',
    department: 'Computer, AI & Robotics',
    experienceRequired: '5',
    location: 'Kolkata, India',
    city: 'Kolkata',
    employmentType: 'Full-time',
    minimumQualification: '12th',
    jobDescription: 'Campus recruitment is the strategy to source, engage and hire young talents for entry-level positions.',
    applyUrl: 'https://talentiseglobal.com/career-details/teacher',
    sourceUrl: 'https://talentiseglobal.com/career-details/teacher',
  })
  assert.equal(talentiseGlobal.hasPublicJobListingsSignal(officialHomepageHtml), false)
  assert.equal(talentiseGlobal.hasPublicJobListingsSignal(publicJobsHtml), true)
})

test('Talentise Global returns India jobs from the public careers surface', async () => {
  const talentiseGlobal = await loadTalentiseGlobalModule()
  const requestedUrls = []

  const jobs = await talentiseGlobal.createTalentiseGlobalScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === talentiseGlobal.HOMEPAGE_URL) {
        return { status: 200, url, html: officialHomepageHtml }
      }

      if (url === talentiseGlobal.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === 'https://talentiseglobal.com/career-details/teacher') {
        return { status: 200, url, html: detailHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    talentiseGlobal.HOMEPAGE_URL,
    talentiseGlobal.CAREERS_URL,
    'https://talentiseglobal.com/career-details/teacher',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Teacher')
  assert.equal(jobs[0].location, 'Kolkata, India')
  assert.equal(jobs[0].minimumQualification, '12th')
})

test('Talentise Global fails closed when the homepage, careers list, or detail contract drifts', async () => {
  const talentiseGlobal = await loadTalentiseGlobalModule()

  await assert.rejects(
    talentiseGlobal.createTalentiseGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === talentiseGlobal.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    talentiseGlobal.createTalentiseGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === talentiseGlobal.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === talentiseGlobal.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public careers page/i,
  )

  await assert.rejects(
    talentiseGlobal.createTalentiseGlobalScraper().run({
      fetchPage: async (url) => {
        if (url === talentiseGlobal.HOMEPAGE_URL) {
          return { status: 200, url, html: officialHomepageHtml }
        }

        if (url === talentiseGlobal.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === 'https://talentiseglobal.com/career-details/teacher') {
          return { status: 200, url, html: '<html><head><title>Teacher</title></head><body><main><h1>Teacher</h1></main></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career detail page/i,
  )
})


test('Talentise validates its current Talent Pro signup route without changing public role extraction', async () => {
  const source = await loadTalentiseGlobalModule()
  const currentHome = officialHomepageHtml.replace('/student-registration', '/talent-pro-register')
  assert.equal(source.hasOfficialHomepageSignal(currentHome), true)
  assert.equal(source.hasOfficialHomepageSignal(currentHome.replace('/talent-pro-register', '/unverified-signup')), false)
  const jobs = await source.run({fetchPage: async url => ({status:200,url,html:url === source.HOMEPAGE_URL ? currentHome : url === source.CAREERS_URL ? careersHtml : detailHtml})})
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].city, 'Kolkata')
})
