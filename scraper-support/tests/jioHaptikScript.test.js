import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Work at Haptik!</h1>
    <p>Come build conversational AI with us.</p>
    <a href="https://haptik.freshteam.com/jobs">Explore All Open Positions</a>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h4>Haptik Careers</h4>
    <h3>Open Positions</h3>
    <a href="/jobs/8RrzHwmKvc5h/software-engineer-backend">
      <span>Software Engineer - Backend</span>
      <span>Mumbai, Maharashtra</span>
      <span>Full Time</span>
    </a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/haptik/script.js')
  } catch {
    assert.fail('Expected shared Haptik scraper module at ../../scraper/haptik/script.js')
  }
}

test('Jio Haptik audit stays pinned to the shared Haptik official careers handoff and Freshteam board', async () => {
  const haptik = await loadModule()

  assert.equal(haptik.COMPANY_NAME, 'Haptik')
  assert.equal(haptik.CAREERS_URL, 'https://www.haptik.ai/careers')
  assert.equal(haptik.LISTING_URL, 'https://haptik.freshteam.com/jobs')
  assert.equal(haptik.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(haptik.extractFreshteamJobsUrl(careersHtml), haptik.LISTING_URL)
  assert.equal(haptik.hasOfficialJobsBoardSignal(boardHtml), true)
})
