import assert from 'node:assert/strict'
import test from 'node:test'

const loadBrainvireModule = async () => {
  try {
    return await import('../../scraper/brainvire/script.js')
  } catch {
    assert.fail('Expected Brainvire scraper module at ../../scraper/brainvire/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Brainvire</title>
    <link rel="canonical" href="https://www.brainvire.com/careers/" />
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <button type="button" aria-label="find-jobs-btn">Find Jobs</button>
      <ul class="opportunity-table-list">
        <li class="opportunity-table-item">
          <div class="title-box"><p class="h6 item-title">Technical Architect – Odoo</p></div>
          <div class="opportunity-description-buttons">
            <div class="role-content">
              <p class="role-detail">10+ years</p>
              <span class="seperator">|</span>
              <p class="role-detail">Ahmedabad</p>
              <span class="seperator">|</span>
              <p class="role-detail">Number of Openings: 1</p>
            </div>
            <div class="item-buttons"><button type="button" class="btn btn-primary" aria-label="apply-btn">Apply</button></div>
          </div>
        </li>
        <li class="opportunity-table-item">
          <div class="title-box"><p class="h6 item-title">Project Manager</p></div>
          <div class="opportunity-description-buttons">
            <div class="role-content">
              <p class="role-detail">10 - 15 Years</p>
              <span class="seperator">|</span>
              <p class="role-detail">Mumbai</p>
              <span class="seperator">|</span>
              <p class="role-detail">Number of Openings: 1</p>
            </div>
            <div class="item-buttons"><button type="button" class="btn btn-primary" aria-label="apply-btn">Apply</button></div>
          </div>
        </li>
      </ul>
      <button type="button" aria-label="upload-resume-button">Upload Resume</button>
    </main>
  </body>
</html>
`

test('Brainvire verifies the official first-party careers page and extracts inline role cards', async () => {
  const brainvire = await loadBrainvireModule()

  assert.equal(brainvire.CAREERS_URL, 'https://www.brainvire.com/careers/')
  assert.equal(brainvire.hasOfficialCareersSignal(careersHtml), true)
  const jobs = brainvire.extractPublicListings(careersHtml)
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Technical Architect - Odoo')
  assert.equal(jobs[0].city, 'Ahmedabad')
  assert.equal(jobs[1].title, 'Project Manager')
})

test('Brainvire accepts the current first-party careers shell when it exposes no inline role cards', async () => {
  const brainvire = await loadBrainvireModule()
  const currentCareersHtml = [
    '<html><head>',
    '<title>Elevate Your Career With Brainvire - Join Us</title>',
    '<meta name="description" content="Explore current openings at Brainvire" />',
    '<link rel="canonical" href="https://www.brainvire.com/careers/" />',
    '</head><body><a href="/careers/#openings">Open Roles</a></body></html>',
  ].join('')

  assert.equal(brainvire.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.deepEqual(brainvire.extractPublicListings(currentCareersHtml), [])
})

test('Brainvire runtime rejects the retired inline card surface instead of fabricating current India jobs', async () => {
  const brainvire = await loadBrainvireModule()

  await assert.rejects(brainvire.createBrainvireScraper({
    now: () => '2026-07-14T12:00:00.000Z',
  }).run({
    fetchText: async () => careersHtml,
  }), /Brainvire/)
})
