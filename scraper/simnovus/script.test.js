import assert from 'node:assert/strict'
import test from 'node:test'

const loadSimnovusModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Simnovus scraper module at ./script.js')
  }
}

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Simnovus</title>
    <link rel="canonical" href="https://simnovus.com/about-us/careers/" />
    <meta property="og:site_name" content="Simnovus" />
    <meta property="og:title" content="Careers - Simnovus" />
  </head>
  <body class="career">
    <main>
      <section class="join-us">
        <h1>Ready to lead with purpose?</h1>
        <button type="submit" class="get-quote button btn-secondary contact-form-btn" id="checkBtn">
          Open Position
        </button>
      </section>

      <div class="current_box" id="open_position_section">
        <h2>Current opportunities</h2>

        <div class="current_filter dropdown">
          <h2>Area of Work</h2>
          <p>Research &amp; Development</p>
          <h2>Type</h2>
          <p>Full Time</p>
          <h2>Location</h2>
          <p>Bengaluru, INDIA</p>
        </div>

        <div class="job_list">
          <div class="col" id="5700">
            <div class="career_info">
              <div class="career_accountant">
                <h4>Full Stack Tech Lead</h4>
                <div class="career_location">
                  <div class="career_location_detail">
                    <p>Bengaluru, INDIA</p>
                  </div>
                </div>
              </div>
              <div class="qualification">
                <p>
                  Simnovus is looking for a Full Stack Tech Lead who can mentor a high-performing engineering team while
                  staying hands-on in building scalable, data-heavy products. You will set the technical direction,
                  mentor developers, ensure architectural strength, and drive on-time, high-quality delivery.
                </p>
              </div>
              <div class="career_info_btn">
                <a
                  href="javascript:void(0);"
                  class="button btn-lg load_data poptrigger"
                  data-job="5700"
                  data-onsite="0"
                >
                  Expand
                </a>
              </div>
            </div>
          </div>

          <div class="col" id="7801">
            <div class="career_info">
              <div class="career_accountant">
                <h4>Principal Systems Engineer</h4>
                <div class="career_location">
                  <div class="career_location_detail">
                    <p>Austin, USA</p>
                  </div>
                </div>
              </div>
              <div class="qualification">
                <p>Lead multi-site systems integration for customer labs.</p>
              </div>
              <div class="career_info_btn">
                <a
                  href="javascript:void(0);"
                  class="button btn-lg load_data poptrigger"
                  data-job="7801"
                  data-onsite="0"
                >
                  Expand
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="apply_now_buttons">
        <a href="javascript:void(0);" data-rel="userjob" class="button poptrigger btn-lg">
          Sign up for Job Alerts
        </a>
      </div>

      <div class="popouterbox" id="expand">
        <div class="career_popup">
          <div class="job-form job-form--default">
            <div class="wpcf7 no-js" id="wpcf7-f4606-o1" lang="en-US" dir="ltr" data-wpcf7-id="4606">
              <form action="/about-us/careers/?j=5700#wpcf7-f4606-o1" method="post" class="wpcf7-form init">
                <label>
                  Applying for
                  <select name="Applyingfor">
                    <option value="Select">Select</option>
                    <option value="Full Stack Tech Lead">Full Stack Tech Lead</option>
                  </select>
                </label>
                <label>
                  Resume/CV
                  <input type="file" name="ResumeCV" accept=".pdf" />
                </label>
              </form>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('Simnovus scraper recognizes the verified first-party careers page and extracts India role cards', async () => {
  const simnovus = await loadSimnovusModule()

  assert.equal(simnovus.SOURCE, 'simnovus')
  assert.equal(simnovus.COMPANY, 'Simnovus')
  assert.equal(simnovus.CAREERS_URL, 'https://simnovus.com/about-us/careers/')
  assert.equal(simnovus.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(
    simnovus.extractJobCards(CAREERS_HTML).map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      remoteStatus: job.remoteStatus,
    })),
    [
      {
        title: 'Full Stack Tech Lead',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '5700',
        sourceUrl: 'https://simnovus.com/about-us/careers/?j=5700',
        applyUrl: 'https://simnovus.com/about-us/careers/?j=5700',
        remoteStatus: 'On-site',
      },
    ],
  )
})

test('Simnovus scraper decorates the verified public India role for the shared runner', async () => {
  const simnovus = await loadSimnovusModule()
  const requestedUrls = []

  const jobs = await simnovus.createSimnovusScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return CAREERS_HTML
    },
  })

  assert.deepEqual(requestedUrls, [simnovus.CAREERS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Simnovus')
  assert.equal(jobs[0].source, 'simnovus')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, 'https://simnovus.com/about-us/careers/?j=5700')
  assert.equal(jobs[0].jobDescription.includes('high-performing engineering team'), true)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Simnovus scraper fails closed when the verified first-party careers surface drifts', async () => {
  const simnovus = await loadSimnovusModule()

  await assert.rejects(
    simnovus.createSimnovusScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1><p>Placeholder page.</p></body></html>',
    }),
    /verified first-party careers surface|public india role cards/i,
  )
})
