import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Edureka | Online Courses, PGP &amp; Degree Programs for Upskilling</title>
    <link rel="canonical" href="https://www.edureka.co/" />
  </head>
  <body>
    <a href="/all-courses">Courses</a>
    <a href="/careers">JOIN US</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <link rel="canonical" href="https://www.edureka.co/careers" />
  </head>
  <body>
    <li class="active"><a href="/careers">JOIN US</a></li>
    <div class="career_page_move">
      <button><a href="/careers/job_details">Click To View Openings</a></button>
      <h4 class="openpostitle">OPEN POSITIONS</h4>
      <p class="openmaincontent">
        Drop us a mail at <a href="mailto:career@edureka.co">career@edureka.co</a>.
        Alternatively, choose from our list of openings and apply for the one you're ready to take head on.
      </p>
      <a href="/openpositions/2/2" target="_blank">Internship - Research Analyst</a>
      <a href="/openpositions/2/47" target="_blank">Associate Performance Marketing</a>
      <a href="/openpositions/2/48" target="_blank">Associate Research Analyst</a>
      <a href="/openpositions/3/15" target="_blank">Associate Inside Sales Manager</a>
      <a href="/openpositions/4/6" target="_blank">Enterprise Business Manager</a>
    </div>
  </body>
</html>
`

const brokenOpeningsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Internal Server Error</title>
    <meta name="robots" content="noindex">
  </head>
  <body>
    <h1>Sorry, We're unable to serve your request.</h1>
    <a href="https://www.edureka.co/">Go to Homepage</a>
  </body>
</html>
`

const detailPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Associate Performance Marketing, Edureka</title>
    <meta
      name="description"
      content="We are seeking to join our fun,fast growing team in Bangalore.You get a chance to work with ex-executives from companies based out of Silicon Valley."
    />
  </head>
  <body>
    <div class="jobdetail">
      <h1>Associate Performance Marketing</h1>
      <h4>Roles and Responsibilities:</h4>
      <ul>
        <li>Handle, review, and perform daily account responsibilities associated with Paid campaigns.</li>
        <li>Optimize campaigns across digital channels.</li>
      </ul>
      <h4>Requirements:</h4>
      <ul>
        <li>Preferred with a minimum of 6 months of experience in Digital Marketing.</li>
      </ul>
      <button class="applyposs formfocus">SUBMIT APPLICATION</button>
      <form id="jobapplyform" onsubmit="return false;">
        <h4 class="sideh4apply">Apply Now</h4>
        <input class="inputapply" type="text" placeholder="Name*" id="jobapplicantname" name="appname" />
        <input class="inputapply" type="email" placeholder="Email*" id="jobapplicantemail" name="appemail" />
        <input class="inputapply" type="text" placeholder="Mobile Number*" id="jobapplicantmob" name="appmobile" />
      </form>
      <a href="mailto:career@edureka.co">career@edureka.co</a>
    </div>
  </body>
</html>
`

const detailPageHtml2 = `
<!doctype html>
<html lang="en">
  <head>
    <title>Enterprise Business Manager, Edureka</title>
    <meta
      name="description"
      content="We are seeking to join our fast growing team in Bangalore and drive enterprise learning partnerships."
    />
  </head>
  <body>
    <div class="jobdetail">
      <h1>Enterprise Business Manager</h1>
      <h4>Roles and Responsibilities:</h4>
      <ul>
        <li>Own enterprise account growth.</li>
      </ul>
      <button class="applyposs formfocus">SUBMIT APPLICATION</button>
      <form id="jobapplyform" onsubmit="return false;">
        <h4 class="sideh4apply">Apply Now</h4>
        <input class="inputapply" type="text" placeholder="Name*" id="jobapplicantname" name="appname" />
      </form>
      <a href="mailto:career@edureka.co">career@edureka.co</a>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/edureka/script.js')
  } catch {
    assert.fail('Expected Edureka scraper module at ../../scraper/edureka/script.js')
  }
}

test('Edureka helpers stay pinned to the verified homepage, careers page, broken handoff, and first-party detail pages', async () => {
  const edureka = await loadModule()

  assert.equal(edureka.SOURCE, 'edureka')
  assert.equal(edureka.COMPANY, 'Edureka')
  assert.equal(edureka.OFFICIAL_BRAND_NAME, 'Edureka')
  assert.equal(edureka.VERIFIED_ON, '2026-07-15')
  assert.equal(edureka.ROOT_URL, 'https://www.edureka.co/')
  assert.equal(edureka.CAREERS_URL, 'https://www.edureka.co/careers')
  assert.equal(edureka.BROKEN_OPENINGS_ROUTE_URL, 'https://www.edureka.co/careers/job_details')
  assert.equal(edureka.APPLICATION_EMAIL, 'career@edureka.co')
  assert.equal(edureka.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(edureka.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(edureka.hasBrokenOpeningsRouteSignal(brokenOpeningsPageHtml), true)
  assert.equal(edureka.hasOfficialDetailSignal(detailPageHtml), true)
  assert.deepEqual(edureka.extractOpeningLinks(careersHtml), [
    { title: 'Internship - Research Analyst', url: 'https://www.edureka.co/openpositions/2/2' },
    { title: 'Associate Performance Marketing', url: 'https://www.edureka.co/openpositions/2/47' },
    { title: 'Associate Research Analyst', url: 'https://www.edureka.co/openpositions/2/48' },
    { title: 'Associate Inside Sales Manager', url: 'https://www.edureka.co/openpositions/3/15' },
    { title: 'Enterprise Business Manager', url: 'https://www.edureka.co/openpositions/4/6' },
  ])

  const normalized = edureka.extractJobFromDetailPage(detailPageHtml, {
    title: 'Associate Performance Marketing',
    url: 'https://www.edureka.co/openpositions/2/47',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(normalized, {
    jobId: 'edureka-associate-performance-marketing',
    requisitionId: '2-47',
    title: 'Associate Performance Marketing',
    company: 'Edureka',
    department: null,
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
    link: 'https://www.edureka.co/openpositions/2/47',
    applyUrl: 'https://www.edureka.co/openpositions/2/47#jobapplyform',
    sourceUrl: 'https://www.edureka.co/openpositions/2/47',
    source: 'edureka',
    employmentType: null,
    experienceRequired: '6 months',
    jobDescription: [
      'Associate Performance Marketing',
      'Roles and Responsibilities:',
      'Handle, review, and perform daily account responsibilities associated with Paid campaigns.',
      'Optimize campaigns across digital channels.',
      'Requirements:',
      'Preferred with a minimum of 6 months of experience in Digital Marketing.',
    ].join('\n'),
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })
})

test('Edureka run verifies the official careers pages and enriches the first-party opening details', async () => {
  const edureka = await loadModule()
  const requestedUrls = []

  const jobs = await edureka.createEdurekaScraper({
    maxJobs: 2,
    now: () => '2026-07-15T09:30:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === edureka.ROOT_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === edureka.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (url === edureka.BROKEN_OPENINGS_ROUTE_URL) {
        return { status: 200, url, html: brokenOpeningsPageHtml }
      }

      if (url === 'https://www.edureka.co/openpositions/2/2') {
        return { status: 200, url, html: detailPageHtml.replaceAll('Associate Performance Marketing', 'Internship - Research Analyst').replaceAll('2/47', '2/2') }
      }

      if (url === 'https://www.edureka.co/openpositions/2/47') {
        return { status: 200, url, html: detailPageHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    edureka.ROOT_URL,
    edureka.CAREERS_URL,
    edureka.BROKEN_OPENINGS_ROUTE_URL,
    'https://www.edureka.co/openpositions/2/2',
    'https://www.edureka.co/openpositions/2/47',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Edureka')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T09:30:00.000Z')
  assert.equal(jobs[1].title, 'Associate Performance Marketing')
})

test('Edureka fails closed when the verified homepage, careers page, broken handoff, or detail contract drifts', async () => {
  const edureka = await loadModule()

  await assert.rejects(
    edureka.createEdurekaScraper().run({
      fetchPage: async (url) => {
        if (url === edureka.ROOT_URL) {
          return { status: 200, url, html: '<html><body>No careers link</body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    edureka.createEdurekaScraper().run({
      fetchPage: async (url) => {
        if (url === edureka.ROOT_URL) return { status: 200, url, html: homepageHtml }
        if (url === edureka.CAREERS_URL) {
          return { status: 200, url, html: careersHtml.replace('/openpositions/2/47', '/jobs/42') }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    edureka.createEdurekaScraper().run({
      fetchPage: async (url) => {
        if (url === edureka.ROOT_URL) return { status: 200, url, html: homepageHtml }
        if (url === edureka.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === edureka.BROKEN_OPENINGS_ROUTE_URL) {
          return { status: 200, url, html: '<html><body><h1>Current Openings</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /broken job_details handoff/i,
  )

  await assert.rejects(
    edureka.createEdurekaScraper({ maxJobs: 1 }).run({
      fetchPage: async (url) => {
        if (url === edureka.ROOT_URL) return { status: 200, url, html: homepageHtml }
        if (url === edureka.CAREERS_URL) return { status: 200, url, html: careersHtml }
        if (url === edureka.BROKEN_OPENINGS_ROUTE_URL) return { status: 200, url, html: brokenOpeningsPageHtml }
        if (url === 'https://www.edureka.co/openpositions/2/2') {
          return { status: 200, url, html: '<html><body><h1>Internship - Research Analyst</h1></body></html>' }
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
