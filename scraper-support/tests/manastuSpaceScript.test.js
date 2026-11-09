import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../scraper/manastuspace/fixtures',
)

const readHtmlFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readHtmlFixture('homepage.html')
const verifiedCareersHtml = readHtmlFixture('careers.html')
const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Manastu Space | Green Propulsion Systems for Satellites &amp; Space Missions</title>
  </head>
  <body>
    <header>
      <a href="/">Home</a>
      <a href="/careers">Careers</a>
    </header>
    <main>
      <h1>Manastu Space</h1>
      <p>Green propulsion systems for satellites and space missions.</p>
      <p>Debris collision avoidance maneuvers keep satellites safe in orbit.</p>
      <a href="/careers">Life at Manastu</a>
    </main>
  </body>
</html>
`
const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Manastu Space | Join a Green Satellite Propulsion Startup</title>
  </head>
  <body>
    <section>
      <h2>Hiring Process</h2>
      <p>We keep it professional, clear and talent-focused.</p>
    </section>
    <section id="open-roles">
      <h2>Open Roles</h2>
      <p>Email: careers@manastuspace.com</p>
      <div class="open-roles_wrapper w-dyn-list">
        <div role="list" class="open-roles_list w-dyn-items">
          <div role="listitem" class="open-roles_item w-dyn-item">
            <div class="heading-style-h5 text-weight-semibold">Propellant Research Chemist/ Engineer</div>
            <div class="text-size-small text-weight-medium text-size">Full time</div>
            <div class="text-size-small text-weight-medium">Navi Mumbai</div>
            <a href="mailto:careers@manastuspace.com" class="open-roles-cta_wrapper w-inline-block">Apply</a>
            <div class="open-roles_details">
              <div class="w-richtext">
                <p>Role overview for propellant systems.</p>
                <p>Experience details will be shared during the technical screening.</p>
              </div>
            </div>
          </div>
          <div role="listitem" class="open-roles_item w-dyn-item">
            <div class="heading-style-h5 text-weight-semibold">Embedded Firmware Developer</div>
            <div class="text-size-small text-weight-medium text-size">Full time</div>
            <div class="text-size-small text-weight-medium">Navi Mumbai</div>
            <a href="mailto:careers@manastuspace.com" class="open-roles-cta_wrapper w-inline-block">Apply</a>
            <div class="open-roles_details">
              <div class="w-richtext">
                <p>Role overview for embedded systems.</p>
                <p>Experience: 4 - 7 Years of relevant embedded firmware experience.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </body>
</html>
`

const loadManastuSpaceModule = async () => {
  try {
    return await import('../../scraper/manastuspace/script.js')
  } catch {
    assert.fail('Expected Manastu Space scraper module at ../../scraper/manastuspace/script.js')
  }
}

test('Manastu Space scraper validates the verified homepage and current careers surface', async () => {
  const manastu = await loadManastuSpaceModule()

  assert.equal(manastu.SOURCE, 'manastuspace')
  assert.equal(manastu.COMPANY, 'Manastu Space')
  assert.equal(manastu.HOMEPAGE_URL, 'https://manastuspace.com/')
  assert.equal(manastu.CAREERS_URL, 'https://manastuspace.com/careers')
  assert.equal(manastu.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(manastu.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.ok(manastu.extractPublicJobs(verifiedCareersHtml).length > 0)
})

test('Manastu Space accepts the current homepage surface when careers links are relative', async () => {
  const manastu = await loadManastuSpaceModule()

  assert.equal(manastu.hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('Manastu Space extracts only actual open roles from the current careers layout', async () => {
  const manastu = await loadManastuSpaceModule()
  const jobs = manastu.extractPublicJobs(currentCareersHtml)

  assert.deepEqual(jobs.map((job) => job.title), [
    'Embedded Firmware Developer',
    'Propellant Research Chemist/ Engineer',
  ])
  assert.equal(jobs[0].experienceRequired, '4 - 7 Years')
  assert.equal(jobs[0].publicExperienceChecked, false)
  assert.match(jobs[0].jobDescription || '', /4 - 7 Years of relevant embedded firmware experience/i)
  assert.equal(jobs[1].experienceRequired, null)
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.match(jobs[1].jobDescription || '', /technical screening/i)
})

test('Manastu Space provider is registered in the scraper catalog', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'manastuspace')
  const scraper = buildScrapers().find((item) => item.name === 'manastuspace')

  assert.ok(provider)
  assert.equal(provider.companyName, 'Manastu Space')
  assert.equal(provider.companyCareerPage, 'https://manastuspace.com/careers')
  assert.equal(provider.companyDomain, 'manastuspace.com')
  assert.equal(provider.adapter, 'script')
  assert.ok(scraper)
  assert.equal(typeof scraper.run, 'function')
})
