import {replay as currentReplay} from '../native-sources/publicNativeGetSources/fixtureReplay.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const careersBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at ikya</title>
  </head>
  <body>
    <h1>ikya</h1>
    <nav>
      <a href="https://www.ikya.com/">Home Page</a>
    </nav>
    <section>
      <h2>Jobs at ikya</h2>
      <p>No job postings are currently available.</p>
    </section>
  </body>
</html>
`

const activeBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at ikya</title>
  </head>
  <body>
    <h1>ikya</h1>
    <nav>
      <a href="https://www.ikya.com/">Home Page</a>
    </nav>
    <section>
      <h2>Jobs at ikya</h2>
      <a href="https://careers.smartrecruiters.com/Ikya1/operations-manager">Operations Manager</a>
    </section>
  </body>
</html>
`

const placeholderHomepageBody = 'OK'

const comingSoonHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>www.ikya.com - Coming Soon</title>
  </head>
  <body>
    <p>This domain is coming soon.</p>
  </body>
</html>
`

const browserChallengeHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Checking your browser...</title>
  </head>
  <body>
    <h1>Checking your browser</h1>
    <p>Verification</p>
    <p>Security check</p>
    <p>Before you can access this site, we need to verify you're human.</p>
    <p>Verification failed. Please refresh and try again.</p>
  </body>
</html>
`

const realHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IKYA HCS</title>
  </head>
  <body>
    <h1>Leading HR Solutions</h1>
  </body>
</html>
`

const loadIkyaModule = async () => {
  try {
    return await import('../../scraper/ikya/script.js')
  } catch {
    assert.fail('Expected Ikya scraper module at ../../scraper/ikya/script.js')
  }
}

test('Ikya pins the verified empty SmartRecruiters board and homepage blocker signals', async () => {
  const ikya = await loadIkyaModule()

  assert.equal(ikya.SOURCE, 'ikya')
  assert.equal(ikya.COMPANY_NAME, 'Ikya')
  assert.equal(ikya.CAREERS_URL, 'https://careers.smartrecruiters.com/Ikya1')
  assert.equal(ikya.HOMEPAGE_URL, 'http://www.ikya.com/')
  assert.equal(ikya.VERIFIED_ON, null)
  assert.equal(ikya.hasVerifiedEmptyBoardSignal(careersBoardHtml), true)
  assert.deepEqual(
    ikya.extractPublicJobLinksFromBoard(careersBoardHtml),
    [],
  )
  assert.deepEqual(
    ikya.extractPublicJobLinksFromBoard(activeBoardHtml),
    ['https://careers.smartrecruiters.com/Ikya1/operations-manager'],
  )
  assert.equal(ikya.hasHomepagePlaceholderSignal(placeholderHomepageBody), true)
  assert.equal(ikya.hasHomepagePlaceholderSignal(comingSoonHomepageHtml), true)
  assert.equal(ikya.hasHomepagePlaceholderSignal(browserChallengeHomepageHtml), true)
  assert.equal(ikya.hasHomepagePlaceholderSignal(realHomepageHtml), false)
})





test('ikya current GET run reports retained native observations and leaves unresolved scope held',async()=>{const m=await import('../../scraper/ikya/script.js'),r=currentReplay(),jobs=await m.run(r.options);assert.equal(jobs.length,0);assert.equal(r.audits.length,1);assert.equal(r.audits[0].sourceScopeComplete,false);assert.equal(r.audits[0].lifecycleCleanupAllowed,false);assert.equal(r.audits[0].phases.length,2);assert.ok(!r.requests.some(u=>u.startsWith('http:')))})
