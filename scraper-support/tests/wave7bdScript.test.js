import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const CYBER_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs and Current Openings | Career at CIS</title>
  </head>
  <body>
    <main>
      <h1>Stop Dreaming Start Living</h1>
      <p>career@cisin.com</p>
      <section data-country="India">
        <h2>Current roles at India</h2>
        <article class="job-card">
          <h3>Generative AI Developer Freshers</h3>
          <p>Exp: 0 month - 1 years India</p>
          <a href="/india-job/generative-ai-developer-freshers-jobs">View Details</a>
          <a href="https://r.cisin.com/apply/generative-ai-developer-freshers">Apply Now</a>
        </article>
        <article class="job-card">
          <h3>Junior Network Engineer</h3>
          <p>Exp: 6 month - 6 years India</p>
          <a href="/india-job/junior-network-engineer-jobs">View Details</a>
          <a href="https://r.cisin.com/apply/junior-network-engineer">Apply Now</a>
        </article>
      </section>
      <section data-country="United States">
        <h2>Current roles at United States</h2>
        <article class="job-card">
          <h3>AI Engineer</h3>
          <a href="/usa-job/ai-engineer-jobs">View Details</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const CI_INFOTECH_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Tech Openings - CI Infotech Pvt. Ltd.</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <p>Find Job</p>
      <article class="job-entry">
        <h2><a href="https://ciinfotech.net/jobs/agm-sales-it-service-amc/">AGM Sales - IT Service / AMC</a></h2>
        <p class="meta">
          <span class="posted">July 4, 2021</span>
          <span class="location">New Delhi</span>
          <span class="job-type">Sales</span>
        </p>
      </article>
      <article class="job-entry">
        <h2><a href="https://ciinfotech.net/jobs/dgm-sales-psu-government/">DGM Sales (PSU / Government)</a></h2>
        <p class="meta">
          <span class="posted">July 4, 2021</span>
          <span class="location">New Delhi</span>
          <span class="job-type">Sales</span>
        </p>
      </article>
    </main>
  </body>
</html>
`

const WEBTEL_SENTINEL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Webtel: Explore Opportunities & Join Our Dynamic Team</title>
  </head>
  <body>
    <main>
      <h1>Be a Part of The Webtel Family!</h1>
      <p>Leading Compliance Solutions Company for over 2 Decades</p>
      <section>
        <h2>We Welcome You to Webtel</h2>
        <p>We have our doors open for growth-driven creative heads.</p>
      </section>
      <section>
        <h2>Let's Share Equal Opportunities</h2>
        <p>We at Webtel believe in mutual growth.</p>
      </section>
    </main>
  </body>
</html>
`

const APPCINO_SENTINEL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Xebia</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Become a Xebian</h2>
      <p>Joining Xebia means stepping into a culture that values craftsmanship.</p>
      <h2>Open Positions</h2>
      <p>APAC</p>
      <p>North America (USA / Canada)</p>
    </main>
  </body>
</html>
`

const LOTUS_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Lotus Wireless | Build Engineering Systems</title>
  </head>
  <body>
    <h1>Work At LWT</h1>
    <p>Apply at careers@lotuswireless.com</p>
    <h2>Current Openings</h2>
    <a>
      <div data-framer-name="Senior Embedded Systems Engineer" data-framer-component-type="RichTextContainer">
        <p>Senior Embedded Systems Engineer</p>
      </div>
      <div data-framer-name="Full Time Employment" data-framer-component-type="RichTextContainer">
        <p>Full Time Employment</p>
      </div>
      <div data-framer-name="BANGALORE, INDIA" data-framer-component-type="RichTextContainer">
        <p>bangalore, INDIA</p>
      </div>
      <div data-framer-name="ENGINEERING" data-framer-component-type="RichTextContainer">
        <p>ENGINEERING</p>
      </div>
    </a>
    <a>
      <div data-framer-name="Senior Embedded Systems Engineer" data-framer-component-type="RichTextContainer">
        <p>Senior Embedded Systems Engineer</p>
      </div>
      <div data-framer-name="Full Time Employment" data-framer-component-type="RichTextContainer">
        <p>Full Time Employment</p>
      </div>
      <div data-framer-name="BANGALORE, INDIA" data-framer-component-type="RichTextContainer">
        <p>bangalore, INDIA</p>
      </div>
      <div data-framer-name="ENGINEERING" data-framer-component-type="RichTextContainer">
        <p>ENGINEERING</p>
      </div>
    </a>
    <h3>Why Join LWT</h3>
    <p>Engineering-Led Environment</p>
    <p>Work on Real-World Impact</p>
    <h3>Our Work Culture</h3>
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

test('Cyber Infrastructure reads current genuine own criteria instead of historical card-shaped controls', async () => {
  const { readFileSync } = await import('node:fs')
  const { gunzipSync } = await import('node:zlib')
  const corpus = JSON.parse(gunzipSync(readFileSync(new URL('../native-sources/cisVeeam/fixtures/actual-http-20261031.json.gz', import.meta.url))))
  const pages = new Map(corpus.pages.map(page => [page.receipt.url, page]))
  const cyber = await loadModule('../../scraper/cyberinfrastructure/script.js')
  assert.equal(cyber.VERIFIED_ON, null)
  const jobs = await cyber.run({ fetchPage: async url => {
    const page = pages.get(url);assert.ok(page)
    return { url, status: page.receipt.status, headers: page.receipt.responseHeaders, bodyBase64: page.bodyBase64 }
  } })
  assert.equal(jobs.length, 116)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription && job.sourceNativeCriteria))
})

test('Cyber Infrastructure missing native inventory stays a coverage gap with no cleanup permission', async () => {
  const cyber = await loadModule('../../scraper/cyberinfrastructure/script.js')
  let audit
  const jobs = await cyber.run({ fetchText: async () => WEBTEL_SENTINEL_HTML, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.sourceScopeComplete, false);assert.equal(audit.lifecycleCleanupAllowed, false)
  assert.ok(audit.issues.some(issue => issue.kind === 'official-primary-unqualified'))
})

test('Webtel Electrosoft stays fail-closed while the first-party careers page remains marketing-only', async () => {
  const webtel = await loadModule('../../scraper/webtelelectrosoft/script.js')

  assert.equal(webtel.SOURCE, 'webtelelectrosoft')
  assert.equal(webtel.COMPANY, 'Webtel Electrosoft')
  assert.equal(webtel.CAREERS_URL, 'https://webtel.in/careers')
  assert.equal(webtel.VERIFIED_ON, '2026-07-18')
  assert.equal(webtel.hasOfficialCareersSignal(WEBTEL_SENTINEL_HTML), true)
  assert.equal(webtel.hasPublicJobSignals(WEBTEL_SENTINEL_HTML), false)
  assert.equal(webtel.hasPublicJobSignals(PUBLIC_JOB_HTML), true)

  const jobs = await webtel.createWebtelElectrosoftScraper().run({
    fetchText: async () => WEBTEL_SENTINEL_HTML,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    webtel.createWebtelElectrosoftScraper().run({
      fetchText: async () => PUBLIC_JOB_HTML,
    }),
    /verified Webtel careers page/i,
  )
})

test('CI Infotech parses opening cards from the first-party current-openings page', async () => {
  const ciInfotech = await loadModule('../../scraper/ciinfotech/script.js')

  assert.equal(ciInfotech.SOURCE, 'ciinfotech')
  assert.equal(ciInfotech.COMPANY, 'CI Infotech')
  assert.equal(ciInfotech.CAREERS_URL, 'https://ciinfotech.net/current-openings/')
  assert.equal(ciInfotech.VERIFIED_ON, '2026-07-18')
  assert.equal(ciInfotech.hasOfficialOpeningsSignal(CI_INFOTECH_HTML), true)

  const jobs = await ciInfotech.createCiInfotechScraper().run({
    fetchText: async () => CI_INFOTECH_HTML,
  })

  assert.deepEqual(jobs, [
    {
      title: 'AGM Sales - IT Service / AMC',
      location: 'New Delhi',
      postedAt: 'July 4, 2021',
      jobType: 'Sales',
      detailUrl: 'https://ciinfotech.net/jobs/agm-sales-it-service-amc/',
    },
    {
      title: 'DGM Sales (PSU / Government)',
      location: 'New Delhi',
      postedAt: 'July 4, 2021',
      jobType: 'Sales',
      detailUrl: 'https://ciinfotech.net/jobs/dgm-sales-psu-government/',
    },
  ])
})

test('CI Infotech fails closed if the first-party openings page no longer matches the verified structure', async () => {
  const ciInfotech = await loadModule('../../scraper/ciinfotech/script.js')

  await assert.rejects(
    ciInfotech.createCiInfotechScraper().run({
      fetchText: async () => PUBLIC_JOB_HTML,
    }),
    /verified CI Infotech openings page/i,
  )
})

test('Appcino Technologies stays fail-closed while recruiting remains on the generic Xebia careers hub', async () => {
  const appcino = await loadModule('../../scraper/appcinotechnologies/script.js')

  assert.equal(appcino.SOURCE, 'appcinotechnologies')
  assert.equal(appcino.COMPANY, 'Appcino Technologies')
  assert.equal(appcino.CAREERS_URL, 'https://xebia.com/careers/')
  assert.equal(appcino.VERIFIED_ON, '2026-07-18')
  assert.equal(appcino.hasParentCareersHubSignal(APPCINO_SENTINEL_HTML), true)
  assert.equal(appcino.hasAppcinoSpecificInventory(APPCINO_SENTINEL_HTML), false)

  const jobs = await appcino.createAppcinoTechnologiesScraper().run({
    fetchText: async () => APPCINO_SENTINEL_HTML,
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    appcino.createAppcinoTechnologiesScraper().run({
      fetchText: async () => `${APPCINO_SENTINEL_HTML}\n<section>Appcino Jobs</section>`,
    }),
    /verified Appcino recruiting surface/i,
  )
})

test('Lotus Wireless Technologies extracts the verified visible opening card and email apply handoff', async () => {
  const lotus = await loadModule('../../scraper/lotuswirelesstechnologies/script.js')

  assert.equal(lotus.SOURCE, 'lotuswirelesstechnologies')
  assert.equal(lotus.COMPANY, 'Lotus Wireless Technologies')
  assert.equal(lotus.CAREERS_URL, 'https://lotuswireless.com/careers-page')
  assert.equal(lotus.VERIFIED_ON, '2026-08-15')
  assert.equal(lotus.hasOfficialCareersSignal(LOTUS_CAREERS_HTML), true)
  assert.equal(lotus.hasPublicJobSignals(LOTUS_CAREERS_HTML), true)
  assert.equal(lotus.extractOpeningCards(LOTUS_CAREERS_HTML).length, 1)

  const jobs = await lotus.createLotusWirelessTechnologiesScraper().run({
    fetchText: async () => LOTUS_CAREERS_HTML,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Embedded Systems Engineer')
  assert.equal(jobs[0].location, 'Bangalore, India')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@lotuswireless.com')
  assert.equal(jobs[0].sourceUrl, lotus.CAREERS_URL)

  await assert.rejects(
    lotus.createLotusWirelessTechnologiesScraper().run({
      fetchText: async () => PUBLIC_JOB_HTML,
    }),
    /verified Lotus Wireless careers page/i,
  )
})
