import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Droom: Automotive E-Commerce Platform to Buy and Sell Vehicles</title>
    <link rel="canonical" href="https://droom.in/" />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/career">Career</a>
    </nav>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career</title>
    <link rel="canonical" href="https://droom.in/career" />
  </head>
  <body>
    <div class="careertabs">
      <ul class="nav nav-tabs main-tabs tab-spacing">
        <li id="careerAtDroomLi" class="active"><a href="#careerAtDroom">Career</a></li>
        <li id="jobsAtDroomLi"><a href="#jobsAtDroom">Jobs</a></li>
        <li id="campusHiringLi"><a href="#campushiring">Campus Hiring</a></li>
      </ul>
    </div>
    <div class="tab-content d-padding-top-30">
      <div id="jobsAtDroom" class="tab-pane fade">
        <div class="pnlnewatdroom tab-spacing">
          <h2>Now Hiring</h2>
          <div class="card d-border-gray-light d-border-1 d-border-radius-10 d-margin-bottom-20">
            <div class="card-body">
              <div class="row">
                <div class="col-sm-9">
                  <h3 class="d-font-size-16 d-margin-top-10">Team Lead - Software Engineering (PHP)</h3>
                  <ul class="list-inline d-text-gray">
                    <li><i class="career-pin"></i> <span>Gurgaon</span></li>
                    <li><i class="career-xperience"></i> <span>5-8 Years</span></li>
                    <li><i class="career-time"></i> <span>Full Time</span></li>
                  </ul>
                </div>
                <div class="col-sm-3 action text-center">
                  <a href="javascript:void(0)" class="btn btn-primary btn-sm apply-btn d-margin-top-8">Apply Now</a><br />
                  <a class="collapsed d-font-size-12 d-margin-top-5 d-display-inline-block btn-link" role="button" data-toggle="collapse" data-parent="#accordion_engineering" href="#collapseLeadSEphp" aria-expanded="false" aria-controls="collapseLeadSEphp">View Details</a>
                </div>
                <div id="collapseLeadSEphp" class="panel-collapse collapse" role="tabpanel" aria-labelledby="headingLeadSEphp">
                  <div class="panel-body d-font-size-12">
                    <p>Want to be part of the most disruptive, innovative mobile commerce start-up in India?</p>
                    <p>As Team Lead, you will be working with cutting edge technology and product development using PHP/MVC framework either Laravel or Symfony.</p>
                    <ol class="d-padding-left-20">
                      <li>5+ years of experience developing consumer internet technologies using PHP/MVC framework.</li>
                      <li>Experience in developing Web services in REST or SOAP.</li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-footer d-padding-10">
              <div class="row">
                <div class="col-xs-9">
                  <p class="d-margin-0 d-font-size-12">Posted Date: 25 Sep 2021</p>
                </div>
              </div>
            </div>
          </div>
          <div class="card d-border-gray-light d-border-1 d-border-radius-10 d-margin-bottom-20">
            <div class="card-body">
              <div class="row">
                <div class="col-sm-9">
                  <h3 class="d-font-size-16 d-margin-top-10">Program Manager</h3>
                  <ul class="list-inline d-text-gray">
                    <li><i class="career-pin"></i> <span>Gurgaon</span></li>
                    <li><i class="career-xperience"></i> <span>1-2 Years</span></li>
                    <li><i class="career-time"></i> <span>Full Time</span></li>
                  </ul>
                </div>
                <div class="col-sm-3 action text-center">
                  <a href="javascript:void(0)" class="btn btn-primary btn-sm apply-btn d-margin-top-8">Apply Now</a><br />
                  <a class="collapsed d-font-size-12 d-margin-top-5 d-display-inline-block btn-link" role="button" data-toggle="collapse" data-parent="#accordion_engineering" href="#collapseProgramManager" aria-expanded="false" aria-controls="collapseProgramManager">View Details</a>
                </div>
                <div id="collapseProgramManager" class="panel-collapse collapse" role="tabpanel" aria-labelledby="headingProgramManager">
                  <div class="panel-body d-font-size-12">
                    <p>Program Managers at Droom keep cross-functional launches moving across product, operations, and customer experience.</p>
                    <ul class="d-padding-left-20">
                      <li>Track delivery milestones and risks.</li>
                      <li>Coordinate across business, product, and engineering teams.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            <div class="card-footer d-padding-10">
              <div class="row">
                <div class="col-xs-9">
                  <p class="d-margin-0 d-font-size-12">Posted Date: 03 June 2024</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div class="form-main d-position-relative text-center clearfix" id="career-form">
      <div class="apply-form d-padding-top-30">
        <h2>Apply at Droom</h2>
        <form action="https://droom.in/career" method="post" enctype="multipart/form-data" role="form" class="career_form" id="careerForm">
          <input type="hidden" name="position" id="position_field" />
          <input id="career_position" type="hidden" value="" name="career_position" />
          <input type="file" name="cv" />
        </form>
      </div>
    </div>
  </body>
</html>
`

const careersHtmlWithoutCards = careersHtml.replace(
  /<div class="card d-border-gray-light[\s\S]*?<div class="form-main/s,
  '<div class="form-main',
)

const careersHtmlWithoutForm = careersHtml.replace(
  /<div class="form-main[\s\S]*?<\/form>[\s\S]*?<\/div>\s*<\/div>/i,
  '',
)

const careers404Html = `
<!doctype html>
<html lang="en">
  <head>
    <title>Error 404</title>
  </head>
  <body>
    <h1>Error 404</h1>
    <p>Buy Automobile</p>
    <a href="https://droom.in/cars">Car</a>
    <a href="https://droom.in/career">Career</a>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Droom Jobs</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://droom.in/apply/principal-engineer">Apply now</a>
  </body>
</html>
`

const loadDroomModule = async () => {
  try {
    return await import('../../scraper/droom/script.js')
  } catch {
    assert.fail('Expected Droom scraper module at ../../scraper/droom/script.js')
  }
}

test('Droom scraper helpers stay pinned to the verified first-party homepage, inline jobs tab, and shared form', async () => {
  const droom = await loadDroomModule()

  assert.equal(droom.SOURCE, 'droom')
  assert.equal(droom.COMPANY, 'Droom')
  assert.equal(droom.OFFICIAL_BRAND_NAME, 'Droom')
  assert.equal(droom.VERIFIED_ON, '2026-08-02')
  assert.equal(droom.HOMEPAGE_URL, 'https://droom.in/')
  assert.equal(droom.CAREERS_URL, 'https://droom.in/career')
  assert.equal(droom.APPLICATION_FORM_URL, 'https://droom.in/career#career-form')
  assert.deepEqual(droom.VERIFIED_404_ROUTE_URLS, [
    'https://droom.in/careers',
    'https://droom.in/jobs',
    'https://droom.in/join-us',
    'https://droom.in/openings',
  ])
  assert.match(droom.VERIFIED_SURFACE_SUMMARY, /Now Hiring/i)
  assert.equal(droom.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(droom.extractHomepageCareerUrl(homepageHtml), 'https://droom.in/career')
  assert.equal(droom.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(droom.hasSharedApplicationFormSignal(careersHtml), true)
  assert.deepEqual(droom.extractJobCards(careersHtml), [
    {
      title: 'Team Lead - Software Engineering (PHP)',
      location: 'Gurgaon',
      experienceRequired: '5-8 Years',
      employmentType: 'Full Time',
      detailAnchor: '#collapseLeadSEphp',
      detailId: 'collapseLeadSEphp',
      postingDate: '25 Sep 2021',
      detailHtml:
        '<p>Want to be part of the most disruptive, innovative mobile commerce start-up in India?</p>\n'
        + '<p>As Team Lead, you will be working with cutting edge technology and product development using PHP/MVC framework either Laravel or Symfony.</p>\n'
        + '<ol class="d-padding-left-20">\n'
        + '<li>5+ years of experience developing consumer internet technologies using PHP/MVC framework.</li>\n'
        + '<li>Experience in developing Web services in REST or SOAP.</li>\n'
        + '</ol>',
    },
    {
      title: 'Program Manager',
      location: 'Gurgaon',
      experienceRequired: '1-2 Years',
      employmentType: 'Full Time',
      detailAnchor: '#collapseProgramManager',
      detailId: 'collapseProgramManager',
      postingDate: '03 June 2024',
      detailHtml:
        '<p>Program Managers at Droom keep cross-functional launches moving across product, operations, and customer experience.</p>\n'
        + '<ul class="d-padding-left-20">\n'
        + '<li>Track delivery milestones and risks.</li>\n'
        + '<li>Coordinate across business, product, and engineering teams.</li>\n'
        + '</ul>',
    },
  ])

  const normalized = droom.normalizeJobCard(droom.extractJobCards(careersHtml)[0], {
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(normalized, {
    jobId: 'droom-team-lead-software-engineering-php',
    requisitionId: 'collapseLeadSEphp',
    title: 'Team Lead - Software Engineering (PHP)',
    company: 'Droom',
    department: null,
    location: 'Gurgaon',
    city: 'Gurgaon',
    country: 'India',
    link: 'https://droom.in/career#collapseLeadSEphp',
    applyUrl: 'https://droom.in/career#career-form',
    sourceUrl: 'https://droom.in/career#collapseLeadSEphp',
    source: 'droom',
    employmentType: 'Full-time',
    experienceRequired: '5-8 Years',
    jobDescription:
      'Want to be part of the most disruptive, innovative mobile commerce start-up in India?\n'
      + 'As Team Lead, you will be working with cutting edge technology and product development using PHP/MVC framework either Laravel or Symfony.\n'
      + '5+ years of experience developing consumer internet technologies using PHP/MVC framework.\n'
      + 'Experience in developing Web services in REST or SOAP.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '25 Sep 2021',
    closingDate: null,
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(
    droom.isMissingCareerRoute({
      status: 404,
      url: 'https://droom.in/jobs',
      html: careers404Html,
    }),
    true,
  )
})

test('Droom run validates the verified first-party surface and returns normalized inline jobs', async () => {
  const droom = await loadDroomModule()
  const requestedUrls = []

  const jobs = await droom.createDroomScraper({
    now: () => '2026-07-15T09:30:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === droom.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === droom.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (droom.VERIFIED_404_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: careers404Html }
      }

      throw new Error(`Unexpected Droom URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    droom.HOMEPAGE_URL,
    droom.CAREERS_URL,
    ...droom.VERIFIED_404_ROUTE_URLS,
  ])
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Team Lead - Software Engineering (PHP)', 'Program Manager'],
  )
  assert.equal(jobs[0].company, 'Droom')
  assert.equal(jobs[0].location, 'Gurgaon')
  assert.equal(jobs[0].city, 'Gurgaon')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].postingDate, '25 Sep 2021')
  assert.equal(jobs[0].applyUrl, 'https://droom.in/career#career-form')
  assert.equal(jobs[0].sourceUrl, 'https://droom.in/career#collapseLeadSEphp')
  assert.equal(jobs[0].link, 'https://droom.in/career#collapseLeadSEphp')
  assert.match(jobs[0].jobDescription, /cutting edge technology/i)
  assert.equal(jobs[0].scrapedAt, '2026-07-15T09:30:00.000Z')
  assert.equal(jobs[1].postingDate, '03 June 2024')
  assert.match(jobs[1].jobDescription, /cross-functional launches/i)
})

test('Droom fails closed when the verified homepage, careers page, shared form, or alternate routes drift', async () => {
  const droom = await loadDroomModule()

  await assert.rejects(
    droom.createDroomScraper().run({
      fetchPage: async (url) => {
        if (url === droom.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Droom URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    droom.createDroomScraper().run({
      fetchPage: async (url) => {
        if (url === droom.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === droom.CAREERS_URL) {
          return { status: 200, url, html: '<html><title>Broken</title></html>' }
        }

        throw new Error(`Unexpected Droom URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    droom.createDroomScraper().run({
      fetchPage: async (url) => {
        if (url === droom.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === droom.CAREERS_URL) {
          return { status: 200, url, html: careersHtmlWithoutForm }
        }

        throw new Error(`Unexpected Droom URL: ${url}`)
      },
    }),
    /application form/i,
  )

  await assert.rejects(
    droom.createDroomScraper().run({
      fetchPage: async (url) => {
        if (url === droom.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === droom.CAREERS_URL) {
          return { status: 200, url, html: careersHtmlWithoutCards }
        }

        throw new Error(`Unexpected Droom URL: ${url}`)
      },
    }),
    /job cards/i,
  )

  await assert.rejects(
    droom.createDroomScraper().run({
      fetchPage: async (url) => {
        if (url === droom.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === droom.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === droom.VERIFIED_404_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        return { status: 404, url, html: careers404Html }
      },
    }),
    /alternate route/i,
  )
})
