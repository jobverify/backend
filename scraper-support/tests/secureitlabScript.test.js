import assert from 'node:assert/strict'
import test from 'node:test'

const loadSecureItLabModule = async () => {
  try {
    return await import('../../scraper/secureitlab/script.js')
  } catch {
    assert.fail('Expected SecureITLab scraper module at ../../scraper/secureitlab/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - SecureItLab</title>
  </head>
  <body>
    <main class="main">
      <section class="section-box box-content-feature box-content-feature-3">
        <div class="container">
          <div class="row align-items-center mb-15">
            <div class="col-lg-6 col-md-6 col-xl-6 col-sm-12">
              <h1 class="mb-15">Open job position</h1>
              <p class="text-lg neutral-500 mb-25">
                As a remote first company Secureitlab embraces the flexibility and autonomy that remote work offers.
                This approach opens the door to a diverse global talent pool and supports personal and professional development.
              </p>
            </div>
          </div>

          <div class="row">
            <div class="col-lg-4 col-md-4 col-sm-6 d-flex">
              <div class="card-job d-flex flex-column h-80" style="background-color:#ffedf4;">
                <div class="card-head">
                  <div class="card-head-left">
                    <a href="#"><h5>Security Analyst / Cybersecurity Analyst</h5></a>
                  </div>
                </div>
                <div class="card-info">
                  <h6 class="text-lg neutral-800" style="display: inline;">Role:</h6>
                  <span class="text-lg neutral-1000">Monitors networks for security breaches, investigates incidents, and implements security measures.</span>
                </div>
                <div class="card-info" style="padding-top:15px">
                  <h6 class="text-lg neutral-800" style="display: inline;">Skills:</h6>
                  <span class="text-lg neutral-1000">Threat detection, incident response, SIEM (Security Information and Event Management) tools.</span>
                </div>
                <div class="flex-grow-1"></div>
                <div class="pt-25 ">
                  <a href="mailto:work@secureitlab.com" class="btn btn-color">Apply Now</a>
                </div>
              </div>
            </div>

            <div class="col-lg-4 col-md-6 d-flex">
              <div class="card-job d-flex flex-column h-80" style="background-color:#fffce6;">
                <div class="card-head">
                  <div class="card-head-left">
                    <a href="#"><h5>Penetration Tester / Ethical Hacker</h5></a>
                  </div>
                </div>
                <div class="card-info">
                  <h6 class="text-lg neutral-800" style="display: inline;">Role:</h6>
                  <span class="text-lg neutral-1000">Tests systems, applications, and networks for vulnerabilities by simulating cyberattacks.</span>
                </div>
                <div class="card-info" style="padding-top:15px">
                  <h6 class="text-lg neutral-800" style="display: inline;">Skills:</h6>
                  <span class="text-lg neutral-1000">Knowledge of penetration testing tools, programming, and understanding of hacking methodologies.</span>
                </div>
                <div class="flex-grow-1"></div>
                <div class="pt-25 ">
                  <a href="mailto:work@secureitlab.com" class="btn btn-color">Apply Now</a>
                </div>
              </div>
            </div>

            <div class="col-lg-4 col-md-6 d-flex">
              <div class="card-job d-flex flex-column h-80" style="background-color:#f0f8ff;">
                <div class="card-head">
                  <div class="card-head-left">
                    <a href="#"><h5>Cloud Security Specialist</h5></a>
                  </div>
                </div>
                <div class="card-info">
                  <h6 class="text-lg neutral-800" style="display: inline;">Role:</h6>
                  <span class="text-lg neutral-1000">Protects cloud-based infrastructure, data, and applications.</span>
                </div>
                <div class="card-info" style="padding-top:15px">
                  <h6 class="text-lg neutral-800" style="display: inline;">Skills:</h6>
                  <span class="text-lg neutral-1000">Cloud security tools (AWS, Azure, GCP), encryption, identity management.</span>
                </div>
                <div class="flex-grow-1"></div>
                <div class="pt-25 ">
                  <a href="mailto:work@secureitlab.com" class="btn btn-color">Apply Now</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
    <footer>
      <p>Email: info@secureitlab.com</p>
      <p>India: Block 23, Ambad Road, Jalna, Maharashtra, India</p>
      <p>Secureitlab is a remote first cybersecurity, data privacy consulting & solutions firm serving the industry since 2008.</p>
      <p>© 2024 SecureITLab | All Rights Reserved</p>
    </footer>
  </body>
</html>
`

test('SecureITLab validates the verified official careers page and extracts remote role cards', async () => {
  const secureItLab = await loadSecureItLabModule()

  assert.equal(secureItLab.SOURCE, 'secureitlab')
  assert.equal(secureItLab.COMPANY, 'SecureITLab')
  assert.equal(secureItLab.CAREERS_URL, 'https://secureitlab.com/careers')
  assert.equal(secureItLab.APPLICATION_EMAIL, 'work@secureitlab.com')
  assert.equal(secureItLab.APPLICATION_URL, 'mailto:work@secureitlab.com')
  assert.equal(secureItLab.hasOfficialCareersSurface(careersHtml), true)

  const jobs = secureItLab.extractOpenPositions(careersHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Security Analyst / Cybersecurity Analyst',
    company: 'SecureITLab',
    department: null,
    location: 'Remote',
    city: null,
    state: null,
    country: 'India',
    jobId: 'security-analyst-cybersecurity-analyst',
    requisitionId: 'security-analyst-cybersecurity-analyst',
    sourceUrl: 'https://secureitlab.com/careers',
    applyUrl: 'mailto:work@secureitlab.com',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Threat detection',
      'incident response',
      'SIEM (Security Information and Event Management) tools',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Monitors networks for security breaches, investigates incidents, and implements security measures.',
    publicExperienceChecked: true,
    remoteStatus: 'Remote',
  })
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Security Analyst / Cybersecurity Analyst',
      'Penetration Tester / Ethical Hacker',
      'Cloud Security Specialist',
    ],
  )
})

test('run fetches the SecureITLab careers page and decorates runner metadata', async () => {
  const secureItLab = await loadSecureItLabModule()
  const requestedUrls = []

  const jobs = await secureItLab.createSecureItLabScraper({ now: () => '2026-07-11T00:00:00.000Z' }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://secureitlab.com/careers'])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'secureitlab')
  assert.equal(jobs[0].link, 'mailto:work@secureitlab.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('run fails closed when the verified SecureITLab careers surface changes unexpectedly', async () => {
  const secureItLab = await loadSecureItLabModule()

  await assert.rejects(
    secureItLab.createSecureItLabScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified SecureITLab careers surface/i,
  )
})
