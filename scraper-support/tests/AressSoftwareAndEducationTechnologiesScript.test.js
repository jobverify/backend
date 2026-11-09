import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Aress Software</title>
  </head>
  <body>
    <main>
      <h1>Join the Aress team</h1>
      <h2>Current Openings</h2>
      <section>
        <h3>Digital Division</h3>
        <p>No jobs available</p>
      </section>
      <section>
        <h3>Business Development</h3>
        <article class="opening">
          <h4>Digital Marketing Executive</h4>
          <p>Openings 2</p>
          <p>Location: Nashik</p>
          <p>Experience: 1-3 Years</p>
          <p>Jobcode: Digital Marketing Executive - Hiring 2026</p>
          <a href="/careers/digital-marketing-executive/">More Details</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const accordionCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Aress Software</title>
  </head>
  <body>
    <main>
      <h1>Join the Aress team</h1>
      <h2>Current Openings</h2>
      <div class="accordion-item business-development">
        <h2 class="accordion-header" id="heading_6">
          <button class="accordion-button" type="button">
            <span class="job-icon"></span>Business Development
          </button>
        </h2>
        <div class="accordion-collapse collapse">
          <div class="accordion-body">
            <div class="job-item">
              <div class="job-title">
                <h3>Digital Marketing Executive</h3>
                <div class="vacancy-count">
                  <span>Openings</span> 2
                </div>
              </div>
              <div class="job-description">
                <div class="container p-0">
                  <div class="row">
                    <div class="col-md-2 job-label"><p>Location:</p></div>
                    <div class="col-md-10 job-value"><p>Nashik</p></div>
                  </div>
                  <div class="row">
                    <div class="col-md-2 job-label"><p>Experience:</p></div>
                    <div class="col-md-10 job-value"><p>1-3 Years</p></div>
                  </div>
                  <div class="row">
                    <div class="col-md-2 job-label"><p>Jobcode:</p></div>
                    <div class="col-md-10 job-value"><p>Digital Marketing Executive - Hiring 2026</p></div>
                  </div>
                </div>
                <a href="https://www.aress.com/careers/job_details/NDA=" class="btn more-details-btn">More Details</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/aresssoftwareandeducationtechnologies/script.js')
  } catch {
    assert.fail('Expected Aress Software and Education Technologies scraper module at ../../scraper/aresssoftwareandeducationtechnologies/script.js')
  }
}

test('Aress Software and Education Technologies extracts the verified first-party opening card', async () => {
  const aress = await loadModule()

  assert.equal(aress.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(aress.extractJobCards(careersHtml), [
    {
      title: 'Digital Marketing Executive',
      department: 'Business Development',
      openings: '2',
      location: 'Nashik, India',
      city: 'Nashik',
      experience: '1-3 Years',
      jobCode: 'Digital Marketing Executive - Hiring 2026',
      detailUrl: 'https://www.aress.com/careers/digital-marketing-executive/',
    },
  ])

  const jobs = await aress.createAressSoftwareAndEducationTechnologiesScraper().run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.department, job.jobId, job.requisitionId]),
    [[
      'Digital Marketing Executive',
      'Nashik, India',
      'Business Development',
      'digital-marketing-executive-hiring-2026',
      'Digital Marketing Executive - Hiring 2026',
    ]],
  )
})

test('Aress Software and Education Technologies extracts the current accordion-based first-party opening card', async () => {
  const aress = await loadModule()

  assert.equal(aress.hasOfficialCareersSignal(accordionCareersHtml), true)

  assert.deepEqual(aress.extractJobCards(accordionCareersHtml), [
    {
      title: 'Digital Marketing Executive',
      department: 'Business Development',
      openings: '2',
      location: 'Nashik, India',
      city: 'Nashik',
      experience: '1-3 Years',
      jobCode: 'Digital Marketing Executive - Hiring 2026',
      detailUrl: 'https://www.aress.com/careers/job_details/NDA=',
    },
  ])
})

test('Aress Software and Education Technologies fails closed if the verified careers shell drifts', async () => {
  const aress = await loadModule()

  await assert.rejects(
    aress.createAressSoftwareAndEducationTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified aress careers page/i,
  )
})
