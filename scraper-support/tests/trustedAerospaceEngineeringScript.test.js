import assert from 'node:assert/strict'
import test from 'node:test'

const loadTrustedAerospaceEngineeringModule = async () => {
  try {
    return await import('../../scraper/trustedaerospaceengineering/script.js')
  } catch {
    assert.fail('Expected Trusted Aerospace Engineering scraper module at ../../scraper/trustedaerospaceengineering/script.js')
  }
}

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Join Our Team at TASE | Career Opportunities in Precision CNC Manufacturing</title>
    <meta
      name="Description"
      content="Explore exciting career opportunities at Trusted Aerospace Engineering Pvt Ltd (TASE) in precision CNC manufacturing."
    />
  </head>
  <body>
    <section class="career">
      <div class="col-lg-6 col-12">
        <h5 class="coun">INDIA <i><image src="assets/images/tase/india-career.png"></image></i></h5>

        <div class="accordion" id="accordionExample">
          <div class="accordion-item">
            <h3 class="accordion-header" id="heading9">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse9"
                aria-expanded="false"
                aria-controls="collapse9"
              >
                MULTI-AXIS MILLING MACHINE SETTER / OPERATORS
              </button>
            </h3>
            <div id="collapse9" class="accordion-collapse collapse" aria-labelledby="heading9">
              <div class="accordion-body">
                <p><b>Job Summary:</b> Responsible for setting up, operating, and maintaining milling Multi-axis machines to produce precision parts and components.</p>
                <p><b>Qualifications:</b></p>
                <ul>
                  <li>Diploma / Engineering in Manufacturing or equivalent combination of education and experience 5+ years' work experience.</li>
                  <li>Must be able to perform own set-ups.</li>
                </ul>
                <button
                  type="button"
                  class="job-submit theme-btn"
                  data-bs-toggle="modal"
                  data-bs-target="#myModal"
                  onclick="fetch_id(9)"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="accordion" id="accordionExample">
          <div class="accordion-item">
            <h3 class="accordion-header" id="heading13">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse13"
                aria-expanded="false"
                aria-controls="collapse13"
              >
                SENIOR ENGINEER - CAM
              </button>
            </h3>
            <div id="collapse13" class="accordion-collapse collapse" aria-labelledby="heading13">
              <div class="accordion-body">
                <p><b>Job Summary:</b> As a Sr. Engineer in aerospace manufacturing, requires a strong technical background in NC Programming and excellent programming skills with MasterCAM.</p>
                <p><b>Qualifications:</b></p>
                <ul>
                  <li>Bachelor's degree in Mechanical Engineering, Manufacturing Engineering.</li>
                  <li>Minimum of 6+ years of experience in CNC machining, with a focus on new part development.</li>
                </ul>
                <button
                  type="button"
                  class="job-submit theme-btn"
                  data-bs-toggle="modal"
                  data-bs-target="#myModal"
                  onclick="fetch_id(13)"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="accordion" id="accordionExample">
          <div class="accordion-item">
            <h3 class="accordion-header" id="heading14">
              <button
                class="accordion-button collapsed"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapse14"
                aria-expanded="false"
                aria-controls="collapse14"
              >
                PRODUCTION PLANNING CONTROLLER / SHIFT SUPERVISOR
              </button>
            </h3>
            <div id="collapse14" class="accordion-collapse collapse" aria-labelledby="heading14">
              <div class="accordion-body">
                <p><b>Job Overview:</b> As a Shift Supervisor / PPC in our aerospace manufacturing facility, you will be responsible for coordinating and optimizing production schedules to meet delivery timelines and quality standards.</p>
                <p><b>Qualifications:</b></p>
                <p>Diploma / Bachelor's degree in Mechanical Engineering, or a related field or equivalent to 7+ years of experience.</p>
                <button
                  type="button"
                  class="job-submit theme-btn"
                  data-bs-toggle="modal"
                  data-bs-target="#myModal"
                  onclick="fetch_id(14)"
                >
                  Apply Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="col-lg-6 col-12">
        <h5 class="coun">USA <i><image src="assets/images/tase/america-career.png"></image></i></h5>
        <div class="accordion" id="accordionExample">
          <div class="accordion-item">
            <h3 class="accordion-header" id="heading8">
              <button class="accordion-button collapsed" type="button">MANUFACTURING ENGINEERING</button>
            </h3>
            <div class="accordion-body">
              <p>USA-only role that should not be returned for the India scraper.</p>
              <button
                type="button"
                class="job-submit theme-btn"
                data-bs-toggle="modal"
                data-bs-target="#myModal"
                onclick="fetch_id(8)"
              >
                Apply Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <div class="modal fade" id="myModal">
      <div class="modal-body">
        <input type="hidden" name="job_id" id="job_id" value="">
      </div>
    </div>

    <script>
      function fetch_id(id) {
        $('#job_id').val(id);
      }
    </script>
    <script>
      submitForm('.modal-body', 'career_mail.php')
    </script>

    <footer>
      Trusted Aerospace &amp; Engineering Pvt. Ltd.
    </footer>
  </body>
</html>
`

test('Trusted Aerospace Engineering validates the verified official careers shell and extracts only India openings', async () => {
  const trustedAerospaceEngineering = await loadTrustedAerospaceEngineeringModule()

  assert.equal(trustedAerospaceEngineering.SOURCE, 'trustedaerospaceengineering')
  assert.equal(
    trustedAerospaceEngineering.COMPANY,
    'Trusted Aerospace Engineering Private Limited',
  )
  assert.equal(
    trustedAerospaceEngineering.CAREERS_URL,
    'https://www.taseglobal.com/career.php',
  )
  assert.equal(
    trustedAerospaceEngineering.hasOfficialCareersSignal(officialCareersHtml),
    true,
  )

  const jobs = trustedAerospaceEngineering.extractIndiaJobs(officialCareersHtml)

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      location: job.location,
      city: job.city,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      experienceRequired: job.experienceRequired,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'MULTI-AXIS MILLING MACHINE SETTER / OPERATORS',
        jobId: '9',
        requisitionId: '9',
        location: 'India',
        city: null,
        country: 'India',
        sourceUrl: 'https://www.taseglobal.com/career.php',
        applyUrl: 'https://www.taseglobal.com/career.php',
        experienceRequired: "5+ years' work experience",
        remoteStatus: 'On-site',
      },
      {
        title: 'SENIOR ENGINEER - CAM',
        jobId: '13',
        requisitionId: '13',
        location: 'India',
        city: null,
        country: 'India',
        sourceUrl: 'https://www.taseglobal.com/career.php',
        applyUrl: 'https://www.taseglobal.com/career.php',
        experienceRequired: '6+ years of experience',
        remoteStatus: 'On-site',
      },
      {
        title: 'PRODUCTION PLANNING CONTROLLER / SHIFT SUPERVISOR',
        jobId: '14',
        requisitionId: '14',
        location: 'India',
        city: null,
        country: 'India',
        sourceUrl: 'https://www.taseglobal.com/career.php',
        applyUrl: 'https://www.taseglobal.com/career.php',
        experienceRequired: '7+ years of experience',
        remoteStatus: 'On-site',
      },
    ],
  )

  assert.match(jobs[0].jobDescription, /setting up, operating, and maintaining milling multi-axis machines/i)
  assert.match(jobs[1].jobDescription, /MasterCAM/i)
  assert.match(jobs[2].jobDescription, /production schedules/i)
  assert.equal(jobs.some((job) => /manufacturing engineering/i.test(job.title)), false)
})

test('Trusted Aerospace Engineering run decorates the verified India openings from the shared first-party apply form', async () => {
  const trustedAerospaceEngineering = await loadTrustedAerospaceEngineeringModule()
  const requestedUrls = []

  const jobs = await trustedAerospaceEngineering.createTrustedAerospaceEngineeringScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://www.taseglobal.com/career.php'])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      company: job.company,
      source: job.source,
      link: job.link,
      location: job.location,
    })),
    [
      {
        title: 'MULTI-AXIS MILLING MACHINE SETTER / OPERATORS',
        jobId: '9',
        company: 'Trusted Aerospace Engineering Private Limited',
        source: 'trustedaerospaceengineering',
        link: 'https://www.taseglobal.com/career.php',
        location: 'India',
      },
      {
        title: 'SENIOR ENGINEER - CAM',
        jobId: '13',
        company: 'Trusted Aerospace Engineering Private Limited',
        source: 'trustedaerospaceengineering',
        link: 'https://www.taseglobal.com/career.php',
        location: 'India',
      },
      {
        title: 'PRODUCTION PLANNING CONTROLLER / SHIFT SUPERVISOR',
        jobId: '14',
        company: 'Trusted Aerospace Engineering Private Limited',
        source: 'trustedaerospaceengineering',
        link: 'https://www.taseglobal.com/career.php',
        location: 'India',
      },
    ],
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Trusted Aerospace Engineering fails closed when the verified official careers shell changes or India jobs disappear', async () => {
  const trustedAerospaceEngineering = await loadTrustedAerospaceEngineeringModule()

  await assert.rejects(
    trustedAerospaceEngineering.createTrustedAerospaceEngineeringScraper().run({
      fetchText: async () => `
        <html>
          <head><title>Join Our Team at TASE | Career Opportunities in Precision CNC Manufacturing</title></head>
          <body>
            <h5 class="coun">INDIA</h5>
            <div class="accordion-item"><button>Placeholder</button></div>
          </body>
        </html>
      `,
    }),
    /verified official careers surface changed/i,
  )

  await assert.rejects(
    trustedAerospaceEngineering.createTrustedAerospaceEngineeringScraper().run({
      fetchText: async () => `
        <html>
          <head>
            <title>Join Our Team at TASE | Career Opportunities in Precision CNC Manufacturing</title>
          </head>
          <body>
            <h5 class="coun">INDIA</h5>
            <h5 class="coun">USA</h5>
            <div class="modal fade" id="myModal">
              <div class="modal-body">
                <input type="hidden" name="job_id" id="job_id" value="">
              </div>
            </div>
            <script>
              function fetch_id(id) {
                $('#job_id').val(id);
              }
            </script>
            <script>
              submitForm('.modal-body', 'career_mail.php')
            </script>
            <footer>Trusted Aerospace &amp; Engineering Pvt. Ltd.</footer>
          </body>
        </html>
      `,
    }),
    /verified india openings/i,
  )
})
