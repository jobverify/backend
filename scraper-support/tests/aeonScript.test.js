import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Personal Loan, Two wheeler loan and More | Aeon Credit</title>
  </head>
  <body>
    <nav>
      <a href="https://www.aeoncredit.co.in/careers">Careers</a>
    </nav>
    <h1>Aeon Credit - Personal Loan, Two wheeler loan and more</h1>
    <p>AEON Group is consisting of about 300 Subsidiary Companies.</p>
    <footer>AEON CREDIT SERVICE INDIA PVT. LTD.</footer>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Personal Loan, Two wheeler loan and More | Aeon Credit</title>
  </head>
  <body>
    <nav>
      <a href="/careers">Careers</a>
    </nav>
    <h1>Personal Loan, Two wheeler loan and More</h1>
    <p>Hot Offers from Aeon Credit.</p>
    <footer>AEON CREDIT SERVICE INDIA PVT. LTD.</footer>
  </body>
</html>
`

const careersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Top Finance Company in Mumbai| Careers @ AEON India</title>
  </head>
  <body>
    <h1>Careers @ AEON India</h1>
    <a href="https://www.aeoncredit.co.in/careers">Why Join Us</a>
    <a href="https://www.aeoncredit.co.in/careers/life-at-aeon">Life at ÆON</a>
    <a href="https://www.aeoncredit.co.in/careers/join-us">Join Us</a>
    <p>Fast Growing Organization</p>
  </body>
</html>
`

const currentCareersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Top Finance Company in Mumbai| Careers @ AEON India</title>
  </head>
  <body>
    <h1>Careers @ AEON India</h1>
    <a href="/careers">Why Join Us</a>
    <a href="/careers/life-at-aeon">Life at AEON</a>
    <a href="/careers/join-us">Join Us</a>
    <p>Fast Growing Organization</p>
  </body>
</html>
`

const joinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>JoinUs</title>
  </head>
  <body>
    <h2>Are you the right fit?</h2>
    <p>We're always looking for self - motivated and enthusiastic minds.</p>
    <a href="https://careers-aeoncredit.peoplestrong.com/job/joblist">View Job Vacancy</a>
    <p>Explore opportunities at Aeon Credit Service</p>
    <p>Interested candidates with 0-1 years of work experience can write to cv@aeoncredit.co.in</p>
  </body>
</html>
`

const currentJoinUsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>JoinUs</title>
  </head>
  <body>
    <h2>Are you the right fit?</h2>
    <p>We're always looking for self - motivated and enthusiastic minds.</p>
    <a href="https://careers-aeoncredit.peoplestrong.com/portal/home">View Job Vacancy</a>
    <p>Explore opportunities at Aeon Credit Service</p>
    <p>Interested candidates can write to cv@aeoncredit.co.in</p>
  </body>
</html>
`

const blockedPeopleStrongPage = {
  status: 403,
  url: 'https://careers-aeoncredit.peoplestrong.com/job/joblist',
  html: '<html><body><h1>403 Forbidden</h1><p>Request forbidden by administrative rules.</p></body></html>',
}

const loadAeonModule = async () => {
  try {
    return await import('../../scraper/aeon/script.js')
  } catch {
    assert.fail('Expected AEON scraper module at ../../scraper/aeon/script.js')
  }
}

test('AEON scraper constants stay pinned to the verified India careers hub and blocked PeopleStrong handoff', async () => {
  const aeon = await loadAeonModule()

  assert.equal(aeon.SOURCE, 'aeon')
  assert.equal(aeon.COMPANY, 'AEON')
  assert.equal(aeon.HOMEPAGE_URL, 'https://www.aeoncredit.co.in/')
  assert.equal(aeon.CAREERS_URL, 'https://www.aeoncredit.co.in/careers')
  assert.equal(aeon.JOIN_US_URL, 'https://www.aeoncredit.co.in/careers/join-us')
  assert.equal(aeon.PORTAL_ORIGIN, 'https://careers-aeoncredit.peoplestrong.com')
  assert.equal(aeon.JOB_LISTINGS_URL, 'https://careers-aeoncredit.peoplestrong.com/job/joblist')
  assert.equal(aeon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(aeon.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(aeon.hasOfficialCareersHubSignal(careersHubHtml), true)
  assert.equal(aeon.hasOfficialCareersHubSignal(currentCareersHubHtml), true)
  assert.equal(aeon.hasOfficialJoinUsSignal(joinUsHtml), true)
  assert.equal(
    aeon.extractJobListingsUrl(joinUsHtml),
    'https://careers-aeoncredit.peoplestrong.com/job/joblist',
  )
  assert.equal(
    aeon.extractJobListingsUrl(currentJoinUsHtml),
    'https://careers-aeoncredit.peoplestrong.com/portal/home',
  )
  assert.equal(
    aeon.isAcceptedJobListingsUrl('https://careers-aeoncredit.peoplestrong.com/portal/home'),
    true,
  )
  assert.equal(aeon.hasBlockedPublicJobListingsSignal(blockedPeopleStrongPage), true)
})

test('AEON reports the current blocked PeopleStrong portal/home handoff as unavailable', async () => {
  const aeon = await loadAeonModule()
  const requestedUrls = []

  await assert.rejects(aeon.createAeonScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aeon.HOMEPAGE_URL) {
        return { status: 200, url, html: currentHomepageHtml }
      }

      if (url === aeon.CAREERS_URL) {
        return { status: 200, url, html: careersHubHtml }
      }

      if (url === aeon.JOIN_US_URL) {
        return { status: 200, url, html: currentJoinUsHtml }
      }

      if (url === 'https://careers-aeoncredit.peoplestrong.com/portal/home') {
        return {
          status: 403,
          url,
          html: '<html><body><h1>403 Forbidden</h1><p>Request forbidden by administrative rules.</p></body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.status === 403 && error.abortRetries === true)

  assert.deepEqual(requestedUrls, [
    aeon.HOMEPAGE_URL,
    aeon.CAREERS_URL,
    aeon.JOIN_US_URL,
    'https://careers-aeoncredit.peoplestrong.com/portal/home',
  ])
})

test('AEON preserves unknown inventory when the legacy declared PeopleStrong joblist is blocked', async () => {
  const aeon = await loadAeonModule()
  const requestedUrls = []

  await assert.rejects(aeon.createAeonScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aeon.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aeon.CAREERS_URL) {
        return { status: 200, url, html: careersHubHtml }
      }

      if (url === aeon.JOIN_US_URL) {
        return { status: 200, url, html: joinUsHtml }
      }

      if (url === aeon.JOB_LISTINGS_URL) {
        return blockedPeopleStrongPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), error => error.status === 403 && error.abortRetries === true)

  assert.deepEqual(requestedUrls, [
    aeon.HOMEPAGE_URL,
    aeon.CAREERS_URL,
    aeon.JOIN_US_URL,
    aeon.JOB_LISTINGS_URL,
  ])
})

test('AEON fails closed when the homepage, careers hub, join-us handoff, or blocked PeopleStrong contract drifts', async () => {
  const aeon = await loadAeonModule()

  await assert.rejects(
    aeon.createAeonScraper().run({
      fetchPage: async (url) => {
        if (url === aeon.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        if (url === aeon.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        if (url === aeon.JOIN_US_URL) {
          return { status: 200, url, html: joinUsHtml }
        }

        return blockedPeopleStrongPage
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aeon.createAeonScraper().run({
      fetchPage: async (url) => {
        if (url === aeon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aeon.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml.replace('Life at ÆON', 'Work With Us') }
        }

        if (url === aeon.JOIN_US_URL) {
          return { status: 200, url, html: joinUsHtml }
        }

        return blockedPeopleStrongPage
      },
    }),
    /verified careers hub/i,
  )

  await assert.rejects(
    aeon.createAeonScraper().run({
      fetchPage: async (url) => {
        if (url === aeon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aeon.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        if (url === aeon.JOIN_US_URL) {
          return {
            status: 200,
            url,
            html: joinUsHtml.replace(
              'https://careers-aeoncredit.peoplestrong.com/job/joblist',
              'https://example.com/jobs',
            ),
          }
        }

        return blockedPeopleStrongPage
      },
    }),
    /verified public job vacancy handoff/i,
  )

  await assert.rejects(
    aeon.createAeonScraper().run({
      fetchPage: async (url) => {
        if (url === aeon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aeon.CAREERS_URL) {
          return { status: 200, url, html: careersHubHtml }
        }

        if (url === aeon.JOIN_US_URL) {
          return { status: 200, url, html: joinUsHtml }
        }

        if (url === aeon.JOB_LISTINGS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Candidate Portal</h1><a href="/job/detail/REQ-1">Apply Now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public job listings surface no longer matches the verified blocked state/i,
  )
})

test('AEON preserves the access denial after permitted browser transport recovery', async () => {
  const aeon = await loadAeonModule()
  const browserUrls = []

  await assert.rejects(aeon.createAeonScraper().run({
    fetchPage: async () => {
      throw new TypeError('fetch failed')
    },
    fetchBrowserPage: async (url) => {
      browserUrls.push(url)

      if (url === aeon.HOMEPAGE_URL) {
        return { status: 200, url, html: currentHomepageHtml }
      }

      if (url === aeon.CAREERS_URL) {
        return { status: 200, url, html: careersHubHtml }
      }

      if (url === aeon.JOIN_US_URL) {
        return { status: 200, url, html: currentJoinUsHtml }
      }

      if (url === 'https://careers-aeoncredit.peoplestrong.com/portal/home') {
        return {
          status: 403,
          url,
          html: '<html><body><h1>403 Forbidden</h1><p>Request forbidden by administrative rules.</p></body></html>',
        }
      }

      throw new Error(`Unexpected browser URL: ${url}`)
    },
  }), error => error.status === 403 && error.abortRetries === true)

  assert.deepEqual(browserUrls, [
    aeon.HOMEPAGE_URL,
    aeon.CAREERS_URL,
    aeon.JOIN_US_URL,
    'https://careers-aeoncredit.peoplestrong.com/portal/home',
  ])
})
