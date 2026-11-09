import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const GREYTRIX_SENTINEL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Greytrix</title>
  </head>
  <body>
    <main>
      <h1>Launch your PROFESSIONAL JOURNEY with us!</h1>
      <h2>Join Us</h2>
      <p>With a global presence and a reputable clientele, we guarantee our employees a collaborative and safe working space.</p>
      <h2>Job Openings</h2>
      <p>Alert: Fake Appointment Letters! Greytrix official emails only come from @greytrix.com.</p>
      <iframe src="https://jobs.example-ats.invalid/greytrix"></iframe>
      <section>
        <h2>Contact Us</h2>
      </section>
    </main>
  </body>
</html>
`

const EMTEC_SENTINEL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Engineering, Marketing, & Technology - Bridgenext</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Dream Bigger. Join our Bridgenext team!</h2>
      <a href="https://careers-bridgenext.icims.com/jobs/search?ss=1&searchRelation=keyword_all&searchCategory=8724">Check out our open jobs and apply today!</a>
      <section>
        <h2>India Openings</h2>
        <a href="https://careers-bridgenext.icims.com/jobs/search?ss=1&searchRelation=keyword_all&searchCategory=8724">View all</a>
      </section>
      <p>Copyright © 2026 Bridgenext. All rights reserved.</p>
    </main>
  </body>
</html>
`

const CONTUS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>CONTUS TECH - Career Opportunities and Job Openings</title>
    <link rel="canonical" href="https://www.contus.com/careers.php">
  </head>
  <body>
    <main>
      <h1>We build <img src="/assets/image/features.svg" alt="features"> not just Tech.</h1>
      <section class="accordion">
        <div class="acc-list">
          <div class="accordion-header open">
            <h5>Current Openings</h5>
          </div>
          <div class="accordion-content">
            <ul>
              <li class ="title">
                <h6>Role(s)</h6>
                <h6>Location</h6>
                <h6>More Info</h6>
              </li>
              <!-- <li>
                <h4>Database Developer</h4>
                <p>Chennai, India</p>
                <a href="database-developer.php">Apply Now</a>
              </li> -->
              <li>
                <h4>Business Development Manager</h4>
                <p>Chennai, India</p>
                <a href="business-development-manager.php">Apply Now</a>
              </li>
              <li>
                <h4>Sr. Angular Web Developer</h4>
                <p>Chennai, India</p>
                <a href="angular-web-developer.php">Apply Now</a>
              </li>
              <li>
                <h4>Node API Developer</h4>
                <p>Chennai, India</p>
                <a href="node-api-developer.php">Apply Now</a>
              </li>
              <li>
                <h4>Python Expert with AWS Data Engineering</h4>
                <p>Chennai, India</p>
                <a href="python-with-aws-data.php">Apply Now</a>
              </li>
              <li>
                <h4>FullStack Developer (Angular/Node)</h4>
                <p>Chennai, India</p>
                <a href="fullstack-developer.php">Apply Now</a>
              </li>
              <li>
                <h4>Business Analyst</h4>
                <p>Chennai, India</p>
                <a href="business-analyst.php">Apply Now</a>
              </li>
              <li>
                <h4>Automation Tester</h4>
                <p>Chennai, India</p>
                <a href="qa-automation.php">Apply Now</a>
              </li>
              <li>
                <h4>Graphic Designer</h4>
                <p>Chennai, India</p>
                <a href="graphic-designer.php">Apply Now</a>
              </li>
              <li>
                <h4>React.js Developer</h4>
                <p>Chennai, India</p>
                <a href="react-js-developers.php">Apply Now</a>
              </li>
              <li>
                <h4>QA Manager</h4>
                <p>Chennai, India</p>
                <a href="qa-manager.php">Apply Now</a>
              </li>
              <li>
                <h4>Roku TV Developer</h4>
                <p>Chennai, India</p>
                <a href="roku-tv-developer.php">Apply Now</a>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  </body>
</html>
`

const SMART_IMS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers & Job Opportunities | SmartIMS</title>
  </head>
  <body>
    <main>
      <h1>Building Impactful Careers</h1>
      <section>
        <h2>Openings</h2>
        <p>Select a region to view job openings.</p>
        <a href="#smart-ims-americas">Smart IMS Americas</a>
        <a href="#smart-ims-india">Smart IMS India</a>
        <a href="#smart-ims-apac">Smart IMS APAC</a>
      </section>
      <section id="smart-ims-india">
        <h2>Current Job Openings</h2>
        <article class="job-opening">
          <h3>Job Description: Data Engineer II</h3>
          <p>Experience: 3-5 Years</p>
          <p>Location: Hyderabad (or as applicable)</p>
          <p>Team: Data Platform & Engineering</p>
          <p>To apply send your profile to [email protected]</p>
        </article>
        <article class="job-opening">
          <h3>Java Backend Software Development Engineer (SDE-2)</h3>
          <p>Location: Hyderabad</p>
          <p>Experience: Minimum 4 – 6 Years</p>
          <p>No of Positions: 10</p>
          <p>To apply send your profile to [email protected]</p>
        </article>
      </section>
    </main>
  </body>
</html>
`

const SMART_IMS_SENTINEL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Job Opportunities | SmartIMS</title>
  </head>
  <body>
    <main>
      <h1>Building Impactful Careers</h1>
      <section>
        <h2>Openings</h2>
        <p>Select a region to view job openings.</p>
        <a href="https://www1.jobdiva.com/portal/?a=example-americas">Smart IMS Americas</a>
        <a href="https://www1.jobdiva.com/portal/?a=mzjdnweqc1ss8fl8ihutcdochf3fzk0aaea3jjlh6n3x65w62bqyhtma0x1l0ah3&compid=-1">Smart IMS India</a>
        <a href="https://www1.jobdiva.com/portal/?a=example-apac">Smart IMS APAC</a>
      </section>
      <section id="smart-ims-india">
        <h2>Current Job Openings</h2>
      </section>
    </main>
  </body>
</html>
`

const SMART_IMS_INACTIVE_PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Smart IMS India</title>
  </head>
  <body>
    <main>
      <p>This link is no longer active.</p>
    </main>
  </body>
</html>
`

const SMART_IMS_INLINE_LISTINGS_HTML = `
${SMART_IMS_SENTINEL_HTML}
<article class="job-opening">
  <h3>Job Description: Data Engineer II</h3>
  <p>Experience: 3-5 Years</p>
  <p>Location: Hyderabad</p>
  <p>To apply send your profile to <a href="mailto:[email protected]">[email protected]</a></p>
</article>
`

const SMART_IMS_ACTIVE_PORTAL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Smart IMS India Jobs</title>
  </head>
  <body>
    <main>
      <h1>Search Jobs</h1>
      <a href="/portal/?a=jobdetail&id=123">Apply now</a>
    </main>
  </body>
</html>
`

const SMART_IMS_CURRENT_OPENINGS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &amp; Job Opportunities | SmartIMS</title>
  </head>
  <body>
    <main>
      <h1>Building Impactful Careers</h1>
      <section>
        <h2>Openings</h2>
        <p>Select a region to view job openings.</p>
        <a href="https://www1.jobdiva.com/portal/?a=example-americas">Smart IMS Americas</a>
        <a href="https://www1.jobdiva.com/portal/?a=example-india">Smart IMS India</a>
        <a href="https://www1.jobdiva.com/portal/?a=example-apac">Smart IMS APAC</a>
      </section>
      <section id="current-openings">
        <h2>Current Job Openings</h2>
        <div class="e-n-accordion">
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Job Description: Data Engineer II </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Experience</strong>: 3-5 Years<br /><strong>Location</strong>: Hyderabad (or as applicable)<br /><strong>Team</strong>: Data Platform &amp; Engineering</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#f6bf98929f9795978493938485b6a59b978482bfbba5d895999b"><span class="__cf_email__" data-cfemail="f6bf98929f9795978493938485b6a59b978482bfbba5d895999b">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Java Backend Software Development Engineer (SDE-2) </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Location</strong>: Hyderabad<br /><strong>Experience</strong>: Minimum 4 &#8211; 6 Years<br /><strong>No of Positions</strong>: 10</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#f3ba9d979a9290928196968180b3a09e928187babea0dd909c9e"><span class="__cf_email__" data-cfemail="f3ba9d979a9290928196968180b3a09e928187babea0dd909c9e">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
          <details class="e-n-accordion-item">
            <summary>
              <span class="e-n-accordion-item-title-header">
                <div class="e-n-accordion-item-title-text"> Front End Developer </div>
              </span>
            </summary>
            <div class="elementor-element">
              <div class="elementor-widget-container">
                <p><strong>Location</strong>: Hyderabad<br /><strong>Experience</strong>: Minimum 3 – 6 Years<br /><strong>No of Positions</strong>: 10</p>
                <p>To apply send your profile to <a href="/cdn-cgi/l/email-protection#034a6d676a626062716666717043506e6271774a4e502d606c6e"><span class="__cf_email__" data-cfemail="034a6d676a626062716666717043506e6271774a4e502d606c6e">[email&#160;protected]</span></a></p>
              </div>
            </div>
          </details>
        </div>
      </section>
    </main>
  </body>
</html>
`

const DOODLEBLUE_CURRENT_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at doodleblue | Current Job Openings</title>
  </head>
  <body>
    <main>
      <h1>Join our Team</h1>
      <h2>Browse our open positions and pick the challenge that excites you the most</h2>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>Full stack Developer (Reactjs+Nodejs) 2+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=full-stack-developer"></a>
        </div>
      </div>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>Reactjs Developer 3+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=reactjs-developer"></a>
        </div>
      </div>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>React Native Developer 3+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=react-native-developer"></a>
        </div>
      </div>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>Flutter Developer 5+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=flutter-developer"></a>
        </div>
      </div>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>.NET Tech Arch 8+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=.net-tech-arch"></a>
        </div>
      </div>
      <div class="title row align-items-center">
        <div class="col-md-8">
          <div>
            <h2>Project Managers 3+ years</h2>
            <h4><span>Chennai, India</span><span>Full time</span><span>experienced</span></h4>
          </div>
        </div>
        <div class="col-md-4">
          <a href="/careers/openings/view/?position=project-managers"></a>
        </div>
      </div>
    </main>
  </body>
</html>
`

const DOODLEBLUE_LEGACY_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at doodleblue | openings at chennai | doodleblue | India</title>
  </head>
  <body>
    <main>
      <a href="/careers/apply-now/">Apply Now</a>
      <h1>Join our Team</h1>
      <h2>Browse our open positions and pick the challenge that excites you the most</h2>
      <article class="opening-card">
        <h3>Full stack Developer (Reactjs+Nodejs) 2+ years</h3>
        <p class="meta">Chennai, India Full time experienced</p>
      </article>
      <article class="opening-card">
        <h3>Flutter Developer 5+ years</h3>
        <p class="meta">Chennai, India Full time experienced</p>
      </article>
      <article class="opening-card">
        <h3>Project Managers 3+ years</h3>
        <p class="meta">Chennai, India Full time experienced</p>
      </article>
    </main>
  </body>
</html>
`

const PUBLIC_JOB_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Open Jobs</title>
  </head>
  <body>
    <main>
      <article itemscope itemtype="https://schema.org/JobPosting" data-job-id="public-001">
        <h2 itemprop="title">Senior Engineer</h2>
        <a href="/jobs/senior-engineer">Apply Now</a>
      </article>
    </main>
  </body>
</html>
`

test('Greytrix stays fail-closed while the first-party page remains an embedded jobs shell without parseable inventory', async () => {
  const greytrix = await loadModule('../../scraper/greytrix/script.js')

  assert.equal(greytrix.SOURCE, 'greytrix')
  assert.equal(greytrix.COMPANY, 'Greytrix')
  assert.equal(greytrix.CAREERS_URL, 'https://www.greytrix.com/careers/')
  assert.equal(greytrix.VERIFIED_ON, '2026-07-18')
  assert.equal(greytrix.hasOfficialCareersSignal(GREYTRIX_SENTINEL_HTML), true)
  assert.equal(greytrix.hasPublicJobSignals(GREYTRIX_SENTINEL_HTML), false)
  assert.equal(greytrix.hasPublicJobSignals(PUBLIC_JOB_HTML), true)

  const jobs = await greytrix.createGreytrixScraper().run({
    fetchText: async () => GREYTRIX_SENTINEL_HTML,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    greytrix.createGreytrixScraper().run({
      fetchText: async () => PUBLIC_JOB_HTML,
    }),
    /verified Greytrix careers page/i,
  )
})

test('Emtec stays fail-closed while the public brand routes hiring through Bridgenext external iCIMS handoff pages', async () => {
  const emtec = await loadModule('../../scraper/emtec/script.js')

  assert.equal(emtec.SOURCE, 'emtec')
  assert.equal(emtec.COMPANY, 'Emtec')
  assert.equal(emtec.CAREERS_URL, 'https://www.bridgenext.com/company/careers/')
  assert.equal(emtec.VERIFIED_ON, '2026-07-18')
  assert.equal(emtec.hasOfficialCareersSignal(EMTEC_SENTINEL_HTML), true)
  assert.equal(emtec.hasExternalIcimsHandoff(EMTEC_SENTINEL_HTML), true)
  assert.equal(emtec.hasFirstPartyInventorySignal(EMTEC_SENTINEL_HTML), false)

  const jobs = await emtec.createEmtecScraper().run({
    fetchText: async () => EMTEC_SENTINEL_HTML,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    emtec.createEmtecScraper().run({
      fetchText: async () => `${EMTEC_SENTINEL_HTML}\n<section><h3>Salesforce Technical Architect</h3><p>Pune, India</p></section>`,
    }),
    /verified Emtec\/Bridgenext recruiting surface/i,
  )
})

test('Contus parses current openings from the first-party careers page', async () => {
  const contus = await loadModule('../../scraper/contus/script.js')

  assert.equal(contus.SOURCE, 'contus')
  assert.equal(contus.COMPANY, 'Contus')
  assert.equal(contus.CAREERS_URL, 'https://www.contus.com/careers.php')
  assert.equal(contus.VERIFIED_ON, '2026-08-01')
  assert.equal(contus.hasOfficialCareersSignal(CONTUS_HTML), true)

  const jobs = await contus.createContusScraper().run({
    fetchText: async () => CONTUS_HTML,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Business Development Manager',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/business-development-manager.php',
      applyUrl: 'https://www.contus.com/business-development-manager.php',
    },
    {
      title: 'Sr. Angular Web Developer',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/angular-web-developer.php',
      applyUrl: 'https://www.contus.com/angular-web-developer.php',
    },
    {
      title: 'Node API Developer',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/node-api-developer.php',
      applyUrl: 'https://www.contus.com/node-api-developer.php',
    },
    {
      title: 'Python Expert with AWS Data Engineering',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/python-with-aws-data.php',
      applyUrl: 'https://www.contus.com/python-with-aws-data.php',
    },
    {
      title: 'FullStack Developer (Angular/Node)',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/fullstack-developer.php',
      applyUrl: 'https://www.contus.com/fullstack-developer.php',
    },
    {
      title: 'Business Analyst',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/business-analyst.php',
      applyUrl: 'https://www.contus.com/business-analyst.php',
    },
    {
      title: 'Automation Tester',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/qa-automation.php',
      applyUrl: 'https://www.contus.com/qa-automation.php',
    },
    {
      title: 'Graphic Designer',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/graphic-designer.php',
      applyUrl: 'https://www.contus.com/graphic-designer.php',
    },
    {
      title: 'React.js Developer',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/react-js-developers.php',
      applyUrl: 'https://www.contus.com/react-js-developers.php',
    },
    {
      title: 'QA Manager',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/qa-manager.php',
      applyUrl: 'https://www.contus.com/qa-manager.php',
    },
    {
      title: 'Roku TV Developer',
      location: 'Chennai, India',
      detailUrl: 'https://www.contus.com/roku-tv-developer.php',
      applyUrl: 'https://www.contus.com/roku-tv-developer.php',
    },
  ])
})

test.skip('Legacy Smart IMS inline listings fixture', async () => {
  const smartIms = await loadModule('../../scraper/smartims/script.js')

  assert.equal(smartIms.SOURCE, 'smartims')
  assert.equal(smartIms.COMPANY, 'Smart IMS')
  assert.equal(smartIms.CAREERS_URL, 'https://www.smartims.com/careers/')
  assert.equal(smartIms.VERIFIED_ON, '2026-07-18')
  assert.equal(smartIms.hasOfficialCareersSignal(SMART_IMS_HTML), true)

  const jobs = await smartIms.createSmartImsScraper().run({
    fetchText: async () => SMART_IMS_HTML,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Data Engineer II',
      location: 'Hyderabad (or as applicable)',
      applyUrl: 'mailto:[email protected]',
      experience: '3-5 Years',
      team: 'Data Platform & Engineering',
    },
    {
      title: 'Java Backend Software Development Engineer (SDE-2)',
      location: 'Hyderabad',
      applyUrl: 'mailto:[email protected]',
      experience: 'Minimum 4 - 6 Years',
      openingsCount: '10',
    },
  ])
})

test.skip('Smart IMS sentinel pins the current careers shell and inactive India handoff', async () => {
  const smartIms = await loadModule('../../scraper/smartims/script.js')

  assert.equal(smartIms.SOURCE, 'smartims')
  assert.equal(smartIms.COMPANY, 'Smart IMS')
  assert.equal(smartIms.CAREERS_URL, 'https://www.smartims.com/careers/')
  assert.equal(smartIms.VERIFIED_ON, '2026-08-04')
  assert.equal(smartIms.hasOfficialCareersSignal(SMART_IMS_SENTINEL_HTML), true)
  assert.equal(smartIms.pageExposesInlineIndiaListings(SMART_IMS_SENTINEL_HTML), false)

  const indiaPortalUrl = smartIms.extractSmartImsIndiaPortalUrl(SMART_IMS_SENTINEL_HTML)
  assert.equal(
    indiaPortalUrl,
    'https://www1.jobdiva.com/portal/?a=mzjdnweqc1ss8fl8ihutcdochf3fzk0aaea3jjlh6n3x65w62bqyhtma0x1l0ah3&compid=-1',
  )
  assert.equal(smartIms.hasInactiveIndiaPortalSignal(SMART_IMS_INACTIVE_PORTAL_HTML), true)

  const requestedUrls = []
  const jobs = await smartIms.createSmartImsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === smartIms.CAREERS_URL) {
        return SMART_IMS_SENTINEL_HTML
      }

      if (url === indiaPortalUrl) {
        return SMART_IMS_INACTIVE_PORTAL_HTML
      }

      throw new Error(`Unexpected Smart IMS URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [smartIms.CAREERS_URL, indiaPortalUrl])
  assert.deepEqual(jobs, [])
})

test.skip('Smart IMS sentinel fails closed when inline jobs or an active India portal appear', async () => {
  const smartIms = await loadModule('../../scraper/smartims/script.js')

  await assert.rejects(
    smartIms.createSmartImsScraper().run({
      fetchText: async () => SMART_IMS_INLINE_LISTINGS_HTML,
    }),
    /inline India listings/i,
  )

  await assert.rejects(
    smartIms.createSmartImsScraper().run({
      fetchText: async (url) => {
        if (url === smartIms.CAREERS_URL) {
          return SMART_IMS_SENTINEL_HTML
        }

        return SMART_IMS_ACTIVE_PORTAL_HTML
      },
    }),
    /portal changed/i,
  )
})

test('Smart IMS parses the current first-party openings accordion', async () => {
  const smartIms = await loadModule('../../scraper/smartims/script.js')

  assert.equal(smartIms.SOURCE, 'smartims')
  assert.equal(smartIms.COMPANY, 'Smart IMS')
  assert.equal(smartIms.CAREERS_URL, 'https://www.smartims.com/careers/')
  assert.equal(smartIms.VERIFIED_ON, '2026-08-04')
  assert.equal(smartIms.hasOfficialCareersSignal(SMART_IMS_CURRENT_OPENINGS_HTML), true)
  assert.equal(smartIms.extractSmartImsJobCards(SMART_IMS_CURRENT_OPENINGS_HTML).length, 3)

  const jobs = await smartIms.createSmartImsScraper().run({
    fetchText: async () => SMART_IMS_CURRENT_OPENINGS_HTML,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Data Engineer II',
      location: 'Hyderabad (or as applicable)',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: '3-5 Years',
      team: 'Data Platform & Engineering',
      openingsCount: null,
      jobDescription: 'Experience: 3-5 Years Location: Hyderabad (or as applicable) Team: Data Platform & Engineering To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
    {
      title: 'Java Backend Software Development Engineer (SDE-2)',
      location: 'Hyderabad',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: 'Minimum 4 - 6 Years',
      team: null,
      openingsCount: '10',
      jobDescription: 'Location: Hyderabad Experience: Minimum 4 - 6 Years No of Positions: 10 To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
    {
      title: 'Front End Developer',
      location: 'Hyderabad',
      applyUrl: 'mailto:Indiacareers@SmartIMS.com',
      experience: 'Minimum 3 - 6 Years',
      team: null,
      openingsCount: '10',
      jobDescription: 'Location: Hyderabad Experience: Minimum 3 - 6 Years No of Positions: 10 To apply send your profile to [email protected]',
      detailUrl: 'https://www.smartims.com/careers/',
      sourceUrl: 'https://www.smartims.com/careers/',
    },
  ])
})

test('doodleblue innovation parses first-party openings and shared metadata', async () => {
  const doodleblue = await loadModule('../../scraper/doodleblueinnovation/script.js')

  assert.equal(doodleblue.SOURCE, 'doodleblueinnovation')
  assert.equal(doodleblue.COMPANY, 'doodleblue innovation')
  assert.equal(doodleblue.CAREERS_URL, 'https://www.doodleblue.com/careers/openings/')
  assert.equal(doodleblue.VERIFIED_ON, '2026-08-02')
  assert.equal(doodleblue.hasOfficialOpeningsSignal(DOODLEBLUE_CURRENT_HTML), true)
  assert.equal(doodleblue.hasOfficialOpeningsSignal(DOODLEBLUE_LEGACY_HTML), true)

  const jobs = await doodleblue.createDoodleblueInnovationScraper().run({
    fetchText: async () => DOODLEBLUE_CURRENT_HTML,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Full stack Developer (Reactjs+Nodejs) 2+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=full-stack-developer',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=full-stack-developer',
    },
    {
      title: 'Reactjs Developer 3+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=reactjs-developer',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=reactjs-developer',
    },
    {
      title: 'React Native Developer 3+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=react-native-developer',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=react-native-developer',
    },
    {
      title: 'Flutter Developer 5+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=flutter-developer',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=flutter-developer',
    },
    {
      title: '.NET Tech Arch 8+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=.net-tech-arch',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=.net-tech-arch',
    },
    {
      title: 'Project Managers 3+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/openings/view/?position=project-managers',
      applyUrl: 'https://www.doodleblue.com/careers/openings/view/?position=project-managers',
    },
  ])

  const legacyJobs = doodleblue.parseOpenings(DOODLEBLUE_LEGACY_HTML)
  assert.deepEqual(legacyJobs, [
    {
      title: 'Full stack Developer (Reactjs+Nodejs) 2+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/apply-now/',
      applyUrl: 'https://www.doodleblue.com/careers/apply-now/',
    },
    {
      title: 'Flutter Developer 5+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/apply-now/',
      applyUrl: 'https://www.doodleblue.com/careers/apply-now/',
    },
    {
      title: 'Project Managers 3+ years',
      location: 'Chennai, India',
      employmentType: 'Full time',
      seniority: 'experienced',
      detailUrl: 'https://www.doodleblue.com/careers/apply-now/',
      applyUrl: 'https://www.doodleblue.com/careers/apply-now/',
    },
  ])
})
