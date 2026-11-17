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

test('Logic Fruit retains the historical legacy presentation parser contract', async () => {
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

// The legacy parser above is a historical presentation contract. Current
// acquisition is covered by original HTTP replays in the source directory;
// a supplied body cannot restore obsolete country/date/application inference.
test('Logic Fruit current acquisition rejects body-only historical listing and API callbacks', async () => {
  const logicFruit = await loadLogicFruitModule()
  for (const options of [
    { fetchText: async () => careersPageHtml },
    { fetchText: async () => careersPageHtml, fetchJson: async () => ({ success: true, count: 0, data: [] }) },
  ]) {
    await assert.rejects(logicFruit.createLogicFruitTechnologiesScraper().run(options), /original HTTP metadata|body-only/i)
  }
})

test('Logic Fruit historical parser still fails closed on a changed legacy surface', async () => {
  const logicFruit = await loadLogicFruitModule()
  assert.throws(() => logicFruit.extractOpenings('<html><body><h1>Jobs</h1></body></html>'), /verified official public careers surface/i)
})
