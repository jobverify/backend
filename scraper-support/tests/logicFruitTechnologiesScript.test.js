import assert from 'node:assert/strict'
import test from 'node:test'

const loadLogicFruitModule = async () => {
  try {
    return await import('../../scraper/logicfruittechnologies/script.js')
  } catch {
    assert.fail(
      'Expected Logic Fruit Technologies scraper module at ../../scraper/logicfruittechnologies/script.js',
    )
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Jobs Opening - Logic Fruit Technologies</title>
  </head>
  <body>
    <main>
      <h1>Create Your Future With Us!</h1>
      <p>Navigate your career with the best possibilities.</p>
      <nav>
        <a href="https://www.logic-fruit.com/career/">Career</a>
        <a href="https://www.logic-fruit.com/career/jobs-current-opening/">Current Openings</a>
      </nav>
      <p>Open Positions In Logic Fruit</p>

      <div class="elementor-widget-tp-tabs-tours">
        <div class="theplus-tabs-content-wrapper">
          <div class="elementor-tab-title elementor-tab-mobile-title text-center" tabindex="2001" data-tab="1" role="tab"><span>All Positions</span></div>
          <div id="elementor-tab-content-2007" class="elementor-tab-content elementor-clearfix plus-tab-content" data-tab="1" role="tabpanel">
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/executive-assistant-to-ceo/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/executive-assistant-to-ceo/">Executive Assistant to CEO</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/rf-architect/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/rf-architect/">RF Architect</a></h2>
              <span class="elementor-icon-list-text">Gurugram/Bengaluru</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/verification-lead/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/verification-lead/">Verification Lead</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/project-lead-fpga/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/project-lead-fpga/">Project Lead - FPGA</a></h2>
              <span class="elementor-icon-list-text">Gurugram/Bengaluru</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/it-expert/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/it-expert/">IT Expert</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/">FPGA RTL Engineer</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/director-sr-director-fpga-hw-engineering/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/director-sr-director-fpga-hw-engineering/">Director / Sr Director - FPGA &amp; HW Engineering</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
          </div>
          <div class="elementor-tab-title elementor-tab-mobile-title text-center" tabindex="2002" data-tab="2" role="tab"><span>R&D Management</span></div>
          <div id="elementor-tab-content-2008" class="elementor-tab-content elementor-clearfix plus-tab-content" data-tab="2" role="tabpanel">
            <div data-tp-sc-link="/career/jobs-current-opening/technical-writer/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="/career/jobs-current-opening/technical-writer/">Technical Writer</a></h2>
              <span class="elementor-icon-list-text">Gurugram</span>
            </div>
            <div data-tp-sc-link="https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/" class="elementor-column">
              <h2 class="elementor-heading-title elementor-size-default"><a href="https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/">FPGA RTL Engineer</a></h2>
              <span class="elementor-icon-list-text">Gurugram/Bengaluru</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('Logic Fruit Technologies scraper validates the official careers surface and extracts unique public openings', async () => {
  const logicFruit = await loadLogicFruitModule()

  assert.equal(logicFruit.SOURCE, 'logicfruittechnologies')
  assert.equal(logicFruit.COMPANY, 'Logic Fruit Technologies')
  assert.equal(logicFruit.CAREERS_URL, 'https://www.logic-fruit.com/career/jobs-current-opening/')
  assert.equal(logicFruit.APPLY_URL, 'https://www.logic-fruit.com/career/application-form/')
  assert.equal(logicFruit.hasOfficialCareersSignal(careersPageHtml), true)

  assert.deepEqual(logicFruit.extractOpenings(careersPageHtml), [
    {
      title: 'Executive Assistant to CEO',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/executive-assistant-to-ceo/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/executive-assistant-to-ceo/',
      remoteStatus: 'On-site',
    },
    {
      title: 'RF Architect',
      location: 'Gurugram / Bengaluru, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/rf-architect/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/rf-architect/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Verification Lead',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/verification-lead/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/verification-lead/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Project Lead - FPGA',
      location: 'Gurugram / Bengaluru, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/project-lead-fpga/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/project-lead-fpga/',
      remoteStatus: 'On-site',
    },
    {
      title: 'IT Expert',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/it-expert/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/it-expert/',
      remoteStatus: 'On-site',
    },
    {
      title: 'FPGA RTL Engineer',
      location: 'Gurugram / Bengaluru, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/fpga-rtl-engineer/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Director / Sr Director - FPGA & HW Engineering',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/director-sr-director-fpga-hw-engineering/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/director-sr-director-fpga-hw-engineering/',
      remoteStatus: 'On-site',
    },
    {
      title: 'Technical Writer',
      location: 'Gurugram, India',
      city: 'Gurgaon',
      sourceUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/technical-writer/',
      applyUrl: 'https://www.logic-fruit.com/career/jobs-current-opening/technical-writer/',
      remoteStatus: 'On-site',
    },
  ])
})

test('Logic Fruit Technologies run decorates the official openings with shared scraper metadata', async () => {
  const logicFruit = await loadLogicFruitModule()

  const requestedUrls = []
  const jobs = await logicFruit.createLogicFruitTechnologiesScraper({
    now: () => '2026-08-03T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [logicFruit.CAREERS_URL])
  assert.equal(jobs.length, 8)
  assert.equal(jobs[0].company, 'Logic Fruit Technologies')
  assert.equal(jobs[0].source, 'logicfruittechnologies')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].scrapedAt, '2026-08-03T00:00:00.000Z')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('Logic Fruit Technologies accepts the current first-party careers app only while its opening CTA remains non-listing', async () => {
  const logicFruit = await loadLogicFruitModule()
  const homepage = `
    <html><head>
      <title>Logic Fruit Technologies | Semiconductor Systems Solutions Company</title>
      <script type="module" crossorigin src="/assets/index-current.js"></script>
    </head><body><div id="root"></div></body></html>
  `
  const bundle = 'label:`Career`,page:`career`,href:`/careers`; Build your Career with Opportunities to Learn, Grow, and Make an Impact; drop in your resume. We’ll get back to you in a flash!; href:`#`,onClick:e=>e.preventDefault(),children:`CURRENT OPENING`'
  const requestedUrls = []
  const jobs = await logicFruit.createLogicFruitTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === logicFruit.CAREERS_URL) throw new Error(`HTTP 404 for ${url}`)
      if (url === logicFruit.HOMEPAGE_URL) return homepage
      if (url === 'https://www.logic-fruit.com/assets/index-current.js') return bundle
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requestedUrls, [
    logicFruit.CAREERS_URL,
    logicFruit.HOMEPAGE_URL,
    'https://www.logic-fruit.com/assets/index-current.js',
  ])
  await assert.rejects(
    logicFruit.createLogicFruitTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === logicFruit.CAREERS_URL) throw new Error(`HTTP 404 for ${url}`)
        if (url === logicFruit.HOMEPAGE_URL) return homepage
        return bundle.replace('href:`#`', 'href:`/jobs`')
      },
    }),
    /careers app changed materially/i,
  )
})

test('Logic Fruit Technologies fails closed when the verified public openings surface changes', async () => {
  const logicFruit = await loadLogicFruitModule()

  await assert.rejects(
    logicFruit.createLogicFruitTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Jobs</h1></body></html>',
    }),
    /verified official public careers surface/i,
  )
})

const currentJobsHomepage = '<html><head><title>Logic Fruit Technologies | Hardware, Software, AI &amp; Robotics for Mission-Critical Systems</title></head><body><div id="root"></div><script type="module" src="/assets/index-current.js"></script><script type="application/ld+json">{"@type":"Organization","name":"Logic Fruit Technologies","url":"https://www.logic-fruit.com"}</script></body></html>'
const currentJobsBundle = 'const Y="https://api.logic-fruit.com/api"; async getJobs(e={}){return fetch(Y+"/jobs")} label:`Career`,page:`career`,href:`/careers`; href:`/career/jobs-current-opening/`,children:`CURRENT OPENINGS`'
const migrateFetchText = async (url) => {
  if (url.includes('/career/jobs-current-opening/')) throw new Error('HTTP 404 for ' + url)
  return url.endsWith('.js') ? currentJobsBundle : currentJobsHomepage
}

test('Logic Fruit follows the current verified jobs API after the obsolete WordPress route closes', async () => {
  const logicfruit = await loadLogicFruitModule()
  const jobs = await logicfruit.createLogicFruitTechnologiesScraper({ now: () => '2026-10-03T00:00:00Z' }).run({
    fetchText: migrateFetchText,
    fetchJson: async (url) => {
      assert.equal(url, 'https://api.logic-fruit.com/api/jobs')
      return { success: true, count: 3, data: [
        { id: 'active', entityType: 'job', slug: 'rf-architect', title: 'RF Architect', location: 'Gurugram/Bengaluru', status: 'published', type: 'Full-Time', department: 'Engineering', experience: '8-12 Years', description: 'Design radios.', responsibilities: 'Review systems.', qualifications: 'Engineering degree', skills: ['RF'], workMode: 'On-site', createdAt: '2026-09-18T00:00:00Z' },
        { id: 'draft', entityType: 'job', slug: 'draft', title: 'Draft opening', location: 'Gurugram', status: 'draft' },
        { id: 'foreign', entityType: 'job', slug: 'foreign', title: 'US opening', location: 'Boston', status: 'published' },
      ] }
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'RF Architect')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://www.logic-fruit.com/jobs-current-opening/rf-architect/')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].experienceRequired, '8-12 Years')
  assert.deepEqual(jobs[0].requiredSkills, ['RF'])
  assert.match(jobs[0].jobDescription, /Review systems/)
})

test('Logic Fruit refuses incomplete public API results instead of returning partial or empty jobs', async () => {
  const logicfruit = await loadLogicFruitModule()
  await assert.rejects(logicfruit.createLogicFruitTechnologiesScraper().run({
    fetchText: migrateFetchText,
    fetchJson: async () => ({ success: true, count: 7, data: [] }),
  }), /jobs feed changed|incomplete/i)
})
