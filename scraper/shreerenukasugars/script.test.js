import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
  <html>
    <head>
      <title>Join The Team &#8211; Renuka Sugar</title>
    </head>
    <body>
      <main>
        <h1>Join Shree Renuka Sugars Ltd.</h1>
        <p>Here’s a list of the current opportunities:</p>
        <div>Position</div>
        <div>Department</div>
        <div>Location</div>
        <div>Experience</div>
        <div>Legal Executive</div>
        <div>Compliance</div>
        <div>Worli</div>
        <div>5.0 - 8.0 years</div>
        <div>Corporate Communication Head</div>
        <div>Sales &amp; Marketing</div>
        <div>Worli</div>
        <div>10.0 - 15.0 years</div>
        <p>Additionally, you can write to us on</p>
      </main>
    </body>
  </html>
`

const liveLikeCareersHtml = `
  <html>
    <head>
      <title>Join The Team &#8211; Renuka Sugar</title>
    </head>
    <body>
      <main>
        <p>At Shree Renuka Sugars Limited, we believe that our employees are our most valuable asset.</p>
        <h1>Come  Join  Shree Renuka Sugars Ltd.</h1>
        <p>Here\u2019s a list of the current opportunities:</p>
        <div>Position</div>
        <div>Department</div>
        <div>Location</div>
        <div>Experience</div>
        <div>Legal Executive</div>
        <div>Compliance</div>
        <div>Worli</div>
        <div>5.0 - 8.0 years</div>
        <p>Additionally, you can write to us on</p>
      </main>
    </body>
  </html>
`

test('Shree Renuka Sugars scraper recognizes the current live careers title and apostrophe variants', async () => {
  const renuka = await loadModule()

  assert.equal(renuka.SOURCE, 'shreerenukasugars')
  assert.equal(renuka.COMPANY, 'Shree Renuka Sugars')
  assert.equal(renuka.CAREERS_URL, 'https://renukasugars.com/join-the-team/')
  assert.equal(renuka.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(renuka.hasPublicJobSignals(careersHtml), true)

  const jobs = renuka.extractInlineOpportunities(careersHtml, {
    scrapedAt: '2026-07-27T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Legal Executive')
  assert.equal(jobs[1].title, 'Corporate Communication Head')
})

test('Shree Renuka Sugars scraper accepts the current live dash, curly apostrophe, and Come Join copy', async () => {
  const renuka = await loadModule()

  assert.equal(renuka.hasVerifiedCareersPageSignal(liveLikeCareersHtml), true)
  assert.equal(renuka.hasPublicJobSignals(liveLikeCareersHtml), true)
})
