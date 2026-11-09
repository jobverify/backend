import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers At Securden | Opportunities in Cybersecurity</title>
  </head>
  <body>
    <main>
      <section>
        <h1>Careers</h1>
        <p>Opportunities in Cybersecurity</p>
      </section>
      <div class="col-lg-6 career-box">
        <p class="h4">Python-Django Developer</p>
        <p class="pr-4 career-box-content">We are looking to recruit experienced Python Developers to join our engineering team.</p>
        <div class="place-time-btn">
          <span class="sec-icon-map"><img src="../images/map.png" alt="location"/>Chennai</span>
          <span class="sec-icon-time"><img src="../images/time.png" alt="Time"/>Full Time</span>
        </div>
        <div class="career-view-more"><a href="python-developers.html">View more</a></div>
      </div>
      <div class="col-lg-6 career-box">
        <p class="h4">Talent Acquisition Specialist</p>
        <p class="pr-4 career-box-content">We are growing fast and need to ramp up our team across streams.</p>
        <div class="place-time-btn">
          <span class="sec-icon-map"><img src="../images/map.png" alt="location"/>Chennai</span>
          <span class="sec-icon-time"><img src="../images/time.png" alt="Time"/>Full Time</span>
        </div>
        <div class="career-view-more"><a href="talent-acquisition-specialist.html">View more</a></div>
      </div>
      <a href="https://www.linkedin.com/company/securden-inc/" class="f-linkedin-logo">LinkedIn</a>
    </main>
  </body>
</html>
`

const pythonDeveloperHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Python Django Developer | Careers At Securden</title>
  </head>
  <body>
    <main>
      <div class="message aligncenter">
        <h1 class="main-content__title">Python-Django Developer</h1>
      </div>
      <div class="place-time-btn">
        <span class="sec-icon-map">
          <img src="../images/map.png" alt="location"/>
          <p>Chennai</p>
        </span>
        <span class="sec-icon-time">
          <img src="../images/time.png" alt="Time"/>
          <p>Full Time</p>
        </span>
      </div>
      <section id="about-feature" class="career-details-content">
        <p>We are looking to recruit experienced Python Developers to join our engineering team. Candidates should have a sound knowledge of programming concepts and hands on development experience.</p>
        <p><b>Experience</b>: 2 to 8 years</p>
        <p><b>Location</b>: Chennai</p>
        <p>If you have any questions, please write to us at <a href="mailto:careers@securden.com">careers@securden.com</a>.</p>
      </section>
    </main>
  </body>
</html>
`

const talentAcquisitionHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Talent Acquisition Specialist | Careers At Securden</title>
  </head>
  <body>
    <main>
      <div class="message aligncenter">
        <h1 class="main-content__title">Talent Acquisition Specialist</h1>
      </div>
      <div class="place-time-btn">
        <span class="sec-icon-map">
          <img src="../images/map.png" alt="location"/>
          <p>Chennai</p>
        </span>
        <span class="sec-icon-time">
          <img src="../images/time.png" alt="Time"/>
          <p>Full Time</p>
        </span>
      </div>
      <section id="about-feature" class="career-details-content">
        <p>We are growing fast and need to ramp up our team across streams. We are looking for a talent acquisition specialist specialized in tech hiring.</p>
        <p><b>Experience</b>: 2-6 years</p>
        <p><b>Location</b>: Chennai</p>
        <p>If you have any questions, please write to us at <a href="mailto:careers@securden.com">careers@securden.com</a>.</p>
      </section>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Page Not Found | Securden</title>
  </head>
  <body>
    <main>
      <h1>404</h1>
      <p>Page not found</p>
    </main>
  </body>
</html>
`

const loadSecurdenModule = async () => {
  try {
    return await import('../../scraper/securden/script.js')
  } catch {
    assert.fail('Expected Securden scraper module at ../../scraper/securden/script.js')
  }
}

test('Securden recognizes the verified careers page and extracts first-party job cards', async () => {
  const securden = await loadSecurdenModule()

  assert.equal(securden.SOURCE, 'securden')
  assert.equal(securden.COMPANY, 'Securden')
  assert.equal(securden.CAREERS_URL, 'https://www.securden.com/careers/')
  assert.deepEqual(securden.MISSING_ROUTE_URLS, [
    'https://www.securden.com/jobs/',
    'https://www.securden.com/company/careers/',
  ])
  assert.equal(securden.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(securden.isVerifiedMissingRoute({ status: 404, html: notFoundHtml }), true)
  assert.deepEqual(securden.extractJobCards(careersHtml), [
    {
      title: 'Python-Django Developer',
      summary: 'We are looking to recruit experienced Python Developers to join our engineering team.',
      location: 'Chennai',
      employmentType: 'Full Time',
      detailUrl: 'https://www.securden.com/careers/python-developers.html',
    },
    {
      title: 'Talent Acquisition Specialist',
      summary: 'We are growing fast and need to ramp up our team across streams.',
      location: 'Chennai',
      employmentType: 'Full Time',
      detailUrl: 'https://www.securden.com/careers/talent-acquisition-specialist.html',
    },
  ])
})

test('Securden scraper returns public openings while the verified first-party detail pages stay stable', async () => {
  const securden = await loadSecurdenModule()
  const requestedUrls = []

  const jobs = await securden.createSecurdenScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === securden.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }
      if (url === 'https://www.securden.com/careers/python-developers.html') {
        return { status: 200, url, html: pythonDeveloperHtml }
      }
      if (url === 'https://www.securden.com/careers/talent-acquisition-specialist.html') {
        return { status: 200, url, html: talentAcquisitionHtml }
      }
      if (securden.MISSING_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    securden.CAREERS_URL,
    'https://www.securden.com/careers/python-developers.html',
    'https://www.securden.com/careers/talent-acquisition-specialist.html',
    ...securden.MISSING_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Python-Django Developer',
      company: 'Securden',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'python-developers',
      requisitionId: 'python-developers',
      sourceUrl: 'https://www.securden.com/careers/python-developers.html',
      applyUrl: 'mailto:careers@securden.com',
      employmentType: 'Full Time',
      experienceRequired: '2 to 8 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are looking to recruit experienced Python Developers to join our engineering team. Candidates should have a sound knowledge of programming concepts and hands on development experience.',
      remoteStatus: null,
      source: 'securden',
      link: 'mailto:careers@securden.com',
    },
    {
      title: 'Talent Acquisition Specialist',
      company: 'Securden',
      department: null,
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'talent-acquisition-specialist',
      requisitionId: 'talent-acquisition-specialist',
      sourceUrl: 'https://www.securden.com/careers/talent-acquisition-specialist.html',
      applyUrl: 'mailto:careers@securden.com',
      employmentType: 'Full Time',
      experienceRequired: '2-6 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'We are growing fast and need to ramp up our team across streams. We are looking for a talent acquisition specialist specialized in tech hiring.',
      remoteStatus: null,
      source: 'securden',
      link: 'mailto:careers@securden.com',
    },
  ])
})

test('Securden scraper fails closed when the verified first-party contract changes', async () => {
  const securden = await loadSecurdenModule()

  await assert.rejects(
    securden.createSecurdenScraper().run({
      fetchPage: async (url) => {
        if (url === securden.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified securden careers page/i,
  )

  await assert.rejects(
    securden.createSecurdenScraper().run({
      fetchPage: async (url) => {
        if (url === securden.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }
        if (url === 'https://www.securden.com/careers/python-developers.html') {
          return {
            status: 200,
            url,
            html: pythonDeveloperHtml
              .replace(/mailto:careers@securden\.com/gi, 'mailto:hello@example.com')
              .replace(/careers@securden\.com/gi, 'hello@example.com'),
          }
        }
        if (url === 'https://www.securden.com/careers/talent-acquisition-specialist.html') {
          return { status: 200, url, html: talentAcquisitionHtml }
        }
        if (securden.MISSING_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail page changed materially/i,
  )
})
