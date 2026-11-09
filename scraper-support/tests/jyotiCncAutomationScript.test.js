import assert from 'node:assert/strict'
import test from 'node:test'

const loadJyotiModule = async () => {
  try {
    return await import('../../scraper/jyoticncautomation/script.js')
  } catch {
    assert.fail('Expected Jyoti CNC Automation scraper module at ../../scraper/jyoticncautomation/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <nav>
        <a href="https://jyoti.co.in/career/">Career</a>
      </nav>
      <h1>Career</h1>
      <p>Jyoti is an equal opportunity employer.</p>
      <h2>Current Openings</h2>

      <h4>Asst. VP Department Sales &amp; Marketing</h4>
      <h3>Department</h3>
      <p>Sales &amp; Marketing</p>
      <h3>No. of Vacancie</h3>
      <p>01</p>
      <h3>Qualification</h3>
      <p>B.E./B.Tech – Mechanical, Management education would be added as an extra advantage</p>
      <h3>Experience</h3>
      <p>15+ yrs; handling Business Development / Sales in a CNC machine mfg company</p>
      <h3>Job Location</h3>
      <p>Delhi</p>
      <h3>Job Description</h3>
      <p>Plan and supervise entire Sales activity.</p>
      <a href="https://jyoti.co.in/apply-now/">Apply Now</a>
      <p>OR</p>
      <p>Email Resume to : <a href="mailto:sales@jyoti.co.in">sales@jyoti.co.in</a></p>

      <h4>Sales Engineer Department Sales &amp; Marketing</h4>
      <h3>Department</h3>
      <p>Sales &amp; Marketing</p>
      <h3>No. of Vacancie</h3>
      <p>20</p>
      <h3>Qualification</h3>
      <p>B.E./B.Tech – Mechanical / Electrical</p>
      <h3>Experience</h3>
      <p>Fresher or up to 3 Years in Sales and Machine Tools Industries will be preferred first.</p>
      <h3>Job Location</h3>
      <p>( Ahmedabad, Vadodara, Pune, Kolhapur, Aurangabad, Mumbai, Bangalore ) We will be preferred only Local candidates.</p>
      <h3>Job Description</h3>
      <p>Gain complete knowledge of companies’ product range.</p>
      <a href="https://jyoti.co.in/apply-now/">Apply Now</a>
      <p>OR</p>
      <p>Email Resume to : <a href="mailto:careers@jyoti.co.in">careers@jyoti.co.in</a></p>

      <h4>Technician Department Assembly</h4>
      <h3>Department</h3>
      <p>Assembly</p>
      <h3>No. of Vacancie</h3>
      <p>10</p>
      <h3>Qualification</h3>
      <p>ITI (Fitter / Mechanic Diesel) / Diploma - Mechanical</p>
      <h3>Experience</h3>
      <p>0 to 3 Years</p>
      <h3>Job Location</h3>
      <p>Metoda, Rajkot</p>
      <h3>Job Description</h3>
      <p>Perform complex and advanced assembly of products according to established specifications and instructions.</p>
      <a href="https://jyoti.co.in/apply-now/">Apply Now</a>
      <p>OR</p>
      <p>Email Resume to : <a href="mailto:assembly@jyoti.co.in">assembly@jyoti.co.in</a></p>
    </main>
  </body>
</html>
`

const liveAccordionCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Career</h1>
      <h2>Current Openings</h2>

      <h4>CNC Turning / Turn Mill Centers</h4>
      <div class="li-column1">
        <li><a href="https://jyoti.co.in/ourproduct/dx-60-dx-100/">Product block</a></li>
      </div>

      <h4>Asst. VP Department Sales &amp; Marketing</h4>
      <div class="panel-body">
        <div class="jobdetail-main">
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-university"></i>Department</h3>
            <div class="job-desc">Sales &amp; Marketing</div>
          </div>
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-certificate"></i>Qualification</h3>
            <div class="job-desc">B.E./B.Tech – Mechanical</div>
          </div>
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-bolt"></i>Experience</h3>
            <div class="job-desc">15+ yrs</div>
          </div>
          <div class="jobdetail full">
            <h3 class="job-tit"><i class="fa fa-map-marker"></i>Job Location</h3>
            <div class="job-desc">Delhi</div>
          </div>
        </div>
        <ul class="job-action">
          <li>Apply Now</li>
          <li>Email Resume to : careers@jyoti.co.in</li>
        </ul>
      </div>

      <h4>Sales Engineer Department Sales &amp; Marketing</h4>
      <div class="panel-body">
        <div class="jobdetail-main">
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-university"></i>Department</h3>
            <div class="job-desc">Sales &amp; Marketing</div>
          </div>
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-certificate"></i>Qualification</h3>
            <div class="job-desc">B.E./B.Tech – Mechanical / Electrical</div>
          </div>
          <div class="jobdetail">
            <h3 class="job-tit"><i class="fa fa-bolt"></i>Experience</h3>
            <div class="job-desc">Fresher or up to 3 Years</div>
          </div>
          <div class="jobdetail full">
            <h3 class="job-tit"><i class="fa fa-map-marker"></i>Job Location</h3>
            <div class="job-desc">( Ahmedabad, Vadodara, Pune ) We will be preferred only Local candidates.</div>
          </div>
        </div>
        <ul class="job-action">
          <li>Apply Now</li>
          <li>Email Resume to : careers@jyoti.co.in</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`

test('Jyoti CNC Automation scraper validates the official careers page and extracts public openings', async () => {
  const jyoti = await loadJyotiModule()

  assert.equal(jyoti.SOURCE, 'jyoticncautomation')
  assert.equal(jyoti.COMPANY, 'Jyoti CNC Automation Limited')
  assert.equal(jyoti.CAREERS_URL, 'https://jyoti.co.in/career/')
  assert.equal(jyoti.APPLY_URL, 'https://jyoti.co.in/apply-now/')
  assert.equal(jyoti.hasOfficialCareersSignal(officialCareersHtml), true)

  assert.deepEqual(jyoti.extractOpenings(officialCareersHtml), [
    {
      title: 'Asst. VP',
      department: 'Sales & Marketing',
      location: 'Delhi, India',
      city: 'Delhi',
      experienceRequired: '15+ yrs; handling Business Development / Sales in a CNC machine mfg company',
      minimumQualification: 'B.E./B.Tech - Mechanical, Management education would be added as an extra advantage',
      sourceUrl: 'https://jyoti.co.in/career/',
      applyUrl: 'https://jyoti.co.in/apply-now/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Sales Engineer',
      department: 'Sales & Marketing',
      location: 'Ahmedabad, Vadodara, Pune, Kolhapur, Aurangabad, Mumbai, Bangalore, India',
      city: 'Ahmedabad',
      experienceRequired: 'Fresher or up to 3 Years in Sales and Machine Tools Industries will be preferred first.',
      minimumQualification: 'B.E./B.Tech - Mechanical / Electrical',
      sourceUrl: 'https://jyoti.co.in/career/',
      applyUrl: 'https://jyoti.co.in/apply-now/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Technician',
      department: 'Assembly',
      location: 'Metoda, Rajkot, India',
      city: 'Rajkot',
      experienceRequired: '0 to 3 Years',
      minimumQualification: 'ITI (Fitter / Mechanic Diesel) / Diploma - Mechanical',
      sourceUrl: 'https://jyoti.co.in/career/',
      applyUrl: 'https://jyoti.co.in/apply-now/',
      remoteStatus: 'On-site',
    },
  ])
})

test('Jyoti CNC Automation run decorates the official openings with shared scraper metadata', async () => {
  const jyoti = await loadJyotiModule()

  const requestedUrls = []
  const jobs = await jyoti.createJyotiCncAutomationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [jyoti.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].company, 'Jyoti CNC Automation Limited')
  assert.equal(jobs[0].source, 'jyoticncautomation')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('Jyoti CNC Automation also extracts live accordion openings while ignoring non-job h4 blocks', async () => {
  const jyoti = await loadJyotiModule()

  assert.equal(jyoti.hasOfficialCareersSignal(liveAccordionCareersHtml), true)
  assert.deepEqual(jyoti.extractOpenings(liveAccordionCareersHtml), [
    {
      title: 'Asst. VP',
      department: 'Sales & Marketing',
      location: 'Delhi, India',
      city: 'Delhi',
      experienceRequired: '15+ yrs',
      minimumQualification: 'B.E./B.Tech - Mechanical',
      sourceUrl: 'https://jyoti.co.in/career/',
      applyUrl: 'https://jyoti.co.in/apply-now/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Sales Engineer',
      department: 'Sales & Marketing',
      location: 'Ahmedabad, Vadodara, Pune, India',
      city: 'Ahmedabad',
      experienceRequired: 'Fresher or up to 3 Years',
      minimumQualification: 'B.E./B.Tech - Mechanical / Electrical',
      sourceUrl: 'https://jyoti.co.in/career/',
      applyUrl: 'https://jyoti.co.in/apply-now/',
      remoteStatus: 'On-site',
    },
  ])
})

test('Jyoti CNC Automation fails closed when the verified official public careers surface changes', async () => {
  const jyoti = await loadJyotiModule()

  await assert.rejects(
    jyoti.createJyotiCncAutomationScraper().run({
      fetchText: async () => '<html><body><h1>Career</h1></body></html>',
    }),
    /verified official public careers surface/i,
  )
})
