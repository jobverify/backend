import assert from 'node:assert/strict'
import test from 'node:test'

const loadAaravModule = async () => {
  try {
    return await import('../../scraper/aaravunmannedsystems/script.js')
  } catch {
    return null
  }
}

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About</title>
  </head>
  <body>
    <main>
      <p>
        Aereo is the trailblazer in India's integrated drone solutions landscape.
        Formerly known as Aarav Unmanned Systems, Aereo was founded in 2013.
      </p>
      <a href="https://aereo.io/careers/">Careers</a>
    </main>
  </body>
</html>
`

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Purpose Driven Careers for Challenge-Seekers</h1>
      <section>
        <h2>Ready to Join the Ranks?</h2>
        <a id="apply-job-top-btn" class="button" href="https://hire.aereonauts.aereo.io" target="_blank">
          Apply for Job
        </a>
      </section>
    </main>
  </body>
</html>
`

const hiringBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="new-dashboard">
      <section class="AAuditsection pssrecruit maincontent" id="pageContent">
        <div class="container-fluid">
          <div class="row" id="all-openings-div">
            <div class="col-md-3">
              <div class="card-header b-bottom">
                <div class="f-18">Filter Job Opportunities</div>
              </div>
            </div>

            <div class="col-md-9" id="listingjob">
              <div class="recruitcard p-4" id="job-8836">
                <div class="d-flex justify-space-between">
                  <div class="Job-title text-left">Intern- Software Development (Frontend) (QC08836)</div>
                  <div class="recruit text-right">
                    <a
                      class="btn btn-submit apply_btn"
                      title="Apply"
                      target="_blank"
                      rel="nofollow"
                      href="company_career/token-frontend">
                      Apply
                    </a>
                  </div>
                </div>
                <div class="job-properties">
                  <div class="job-location"><i class="fal fa-map-marker-alt" aria-hidden="true"></i></div>
                  <div class="job-contract-type"><i class="fal fa-clock-o" aria-hidden="true"></i> 08-Jul-2026 </div>
                  <div class="job-industry"><i class="fal fa-industry"></i> Product </div>
                  <div class="job-function ml-3"><i class="fal fa-object-ungroup" aria-hidden="true"></i> Engineering </div>
                </div>
                <div class="Job-Description">
                  <p>The role pertains to the Platform Team in Aereo Cloud.</p>
                  <p><strong>Responsibilities</strong></p>
                  <p>&bull; Design and maintain end-to-end test cases using Playwright and TypeScript.</p>
                  <p>&bull; Collaborate with developers to improve testability and application quality.</p>
                  <p><strong>Duration</strong>: 6 Months</p>
                  <p><strong>Location: </strong>Work From Office (WFO), Bangalore</p>
                </div>
              </div>

              <div class="recruitcard p-4" id="job-8695">
                <div class="d-flex justify-space-between">
                  <div class="Job-title text-left">General Manager - Mining &amp; Metals Sales (QC08695)</div>
                  <div class="recruit text-right">
                    <a
                      class="btn btn-submit apply_btn"
                      title="Apply"
                      target="_blank"
                      rel="nofollow"
                      href="/company_career/token-mining">
                      Apply
                    </a>
                  </div>
                </div>
                <div class="job-properties">
                  <div class="job-location"><i class="fal fa-map-marker-alt" aria-hidden="true"></i> Delhi, Kolkata </div>
                  <div class="job-contract-type"><i class="fal fa-clock-o" aria-hidden="true"></i> 17-Jun-2026 </div>
                  <div class="job-industry"><i class="fal fa-industry"></i> Business Development </div>
                  <div class="job-function ml-3"><i class="fal fa-object-ungroup" aria-hidden="true"></i> Sales </div>
                </div>
                <div class="Job-Description">
                  <p>Lead mining and metals growth for enterprise drone solutions.</p>
                  <ul>
                    <li>Own strategic mining and metals sales pursuits.</li>
                    <li>Build customer relationships across Delhi and Kolkata.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    <p>Aereo - Current Openings</p>
  </body>
</html>
`

test('Aarav Unmanned Systems validates the verified Aereo rebrand surfaces and extracts first-party hiring-board job cards', async () => {
  const aarav = await loadAaravModule()

  assert.ok(
    aarav,
    'Expected Aarav Unmanned Systems scraper module at ../../scraper/aaravunmannedsystems/script.js',
  )

  assert.equal(aarav.ABOUT_URL, 'https://aereo.io/about/')
  assert.equal(aarav.CAREERS_URL, 'https://aereo.io/careers/')
  assert.equal(aarav.HIRING_BOARD_URL, 'https://hire.aereonauts.aereo.io/')
  assert.equal(aarav.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(aarav.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(aarav.hasOfficialHiringBoardSignal(hiringBoardHtml), true)

  const listings = aarav.extractHiringBoardListings(hiringBoardHtml)

  assert.deepEqual(
    listings.map((listing) => ({
      jobId: listing.jobId,
      requisitionId: listing.requisitionId,
      title: listing.title,
      department: listing.department,
      location: listing.location,
      city: listing.city,
      country: listing.country,
      employmentType: listing.employmentType,
      postingDate: listing.postingDate,
      sourceUrl: listing.sourceUrl,
      applyUrl: listing.applyUrl,
      requiredSkills: listing.requiredSkills,
    })),
    [
      {
        jobId: '8836',
        requisitionId: 'QC08836',
        title: 'Intern- Software Development (Frontend)',
        department: 'Product',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        employmentType: 'Internship',
        postingDate: '2026-07-08',
        sourceUrl: 'https://hire.aereonauts.aereo.io/company_career/token-frontend',
        applyUrl: 'https://hire.aereonauts.aereo.io/company_career/token-frontend',
        requiredSkills: [
          'Design and maintain end-to-end test cases using Playwright and TypeScript.',
          'Collaborate with developers to improve testability and application quality.',
        ],
      },
      {
        jobId: '8695',
        requisitionId: 'QC08695',
        title: 'General Manager - Mining & Metals Sales',
        department: 'Business Development',
        location: 'Delhi, Kolkata, India',
        city: null,
        country: 'India',
        employmentType: null,
        postingDate: '2026-06-17',
        sourceUrl: 'https://hire.aereonauts.aereo.io/company_career/token-mining',
        applyUrl: 'https://hire.aereonauts.aereo.io/company_career/token-mining',
        requiredSkills: [
          'Own strategic mining and metals sales pursuits.',
          'Build customer relationships across Delhi and Kolkata.',
        ],
      },
    ],
  )
  assert.match(listings[0].jobDescription, /Platform Team in Aereo Cloud/i)
})

test('Aarav Unmanned Systems run validates the verified first-party surfaces and returns India jobs from the hiring board', async () => {
  const aarav = await loadAaravModule()
  assert.ok(aarav)

  const requestedUrls = []
  const jobs = await aarav.createAaravUnmannedSystemsScraper({
    now: () => '2026-07-14T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aarav.ABOUT_URL) {
        return { status: 200, url, html: aboutHtml }
      }

      if (url === aarav.CAREERS_URL) {
        return { status: 200, url, html: careersLandingHtml }
      }

      if (url === aarav.HIRING_BOARD_URL) {
        return { status: 200, url, html: hiringBoardHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    aarav.ABOUT_URL,
    aarav.CAREERS_URL,
    aarav.HIRING_BOARD_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.source, job.link, job.scrapedAt]),
    [
      [
        'Intern- Software Development (Frontend)',
        'aaravunmannedsystems',
        'https://hire.aereonauts.aereo.io/company_career/token-frontend',
        '2026-07-14T00:00:00.000Z',
      ],
      [
        'General Manager - Mining & Metals Sales',
        'aaravunmannedsystems',
        'https://hire.aereonauts.aereo.io/company_career/token-mining',
        '2026-07-14T00:00:00.000Z',
      ],
    ],
  )
})

test('Aarav Unmanned Systems fails closed when the verified rebrand, careers handoff, or hiring board surface drifts', async () => {
  const aarav = await loadAaravModule()
  assert.ok(aarav)

  await assert.rejects(
    aarav.createAaravUnmannedSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.ABOUT_URL) {
          return { status: 200, url, html: '<html><body><h1>Aereo</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified about page/i,
  )

  await assert.rejects(
    aarav.createAaravUnmannedSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === aarav.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersLandingHtml.replace('https://hire.aereonauts.aereo.io', 'https://example.com/jobs'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers landing/i,
  )

  await assert.rejects(
    aarav.createAaravUnmannedSystemsScraper().run({
      fetchPage: async (url) => {
        if (url === aarav.ABOUT_URL) {
          return { status: 200, url, html: aboutHtml }
        }

        if (url === aarav.CAREERS_URL) {
          return { status: 200, url, html: careersLandingHtml }
        }

        if (url === aarav.HIRING_BOARD_URL) {
          return { status: 200, url, html: '<html><body><h1>No openings</h1></body></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party hiring board/i,
  )
})
