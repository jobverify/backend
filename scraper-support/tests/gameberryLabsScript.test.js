import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Gameberry Labs | Makers of Ludo STAR &amp; Parchisi STAR</title>
  </head>
  <body>
    <nav>
      <a href="/our-team">Our Team</a>
      <a href="/our-story">Our Story</a>
      <a href="/jobs">CAREERS</a>
      <a href="https://blog.gameberrylabs.com/">BLOG</a>
    </nav>
    <main>
      <h1>WE BUILD GAMES THAT PLAYERS LOVE TO GROW OLD WITH</h1>
      <h2>Build Your Dream Career With Us</h2>
      <p>Join our passion for gaming as we build the future of Indian mobile gaming studios - together.</p>
      <p>We are an agile team of go-getters filled with people who want to build Great Games.</p>
      <a href="/jobs">JOIN US!</a>
      <p>No.78/9, Ground Floor, Vaishnavi Signature, Outer Ring Road, Bellandur Village</p>
      <p>© 2022 Gameberry Labs</p>
    </main>
  </body>
</html>
`

const loadGameberryLabsModule = async () => {
  try {
    return await import('../../scraper/gameberrylabs/script.js')
  } catch {
    assert.fail('Expected Gameberry Labs scraper module at ../../scraper/gameberrylabs/script.js')
  }
}

test('Gameberry Labs sentinel constants stay pinned to the verified homepage and Keka handoff contract', async () => {
  const gameberryLabs = await loadGameberryLabsModule()

  assert.equal(gameberryLabs.SOURCE, 'gameberrylabs')
  assert.equal(gameberryLabs.COMPANY, 'Gameberry Labs')
  assert.equal(gameberryLabs.OFFICIAL_BRAND_NAME, 'Gameberry Labs')
  assert.equal(gameberryLabs.VERIFIED_ON, '2026-07-15')
  assert.equal(gameberryLabs.HOMEPAGE_URL, 'https://gameberrylabs.com/')
  assert.equal(gameberryLabs.CAREERS_URL, 'https://gameberrylabs.com/jobs')
  assert.equal(gameberryLabs.EXTERNAL_HANDOFF_URL, 'https://gameberry.keka.com/careers')
  assert.match(gameberryLabs.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)

  assert.equal(gameberryLabs.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(gameberryLabs.extractCareersRouteUrl(homepageHtml), 'https://gameberrylabs.com/jobs')
  assert.deepEqual(gameberryLabs.extractFirstPartyJobRecordUrls(homepageHtml), [])
  assert.equal(gameberryLabs.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(
    gameberryLabs.hasPublicJobsSignal('<a href="https://jobs.lever.co/gameberrylabs">Open positions</a>'),
    true,
  )
  assert.equal(
    gameberryLabs.isExpectedCareersRedirect({
      status: 302,
      url: 'https://gameberrylabs.com/jobs',
      location: 'https://gameberry.keka.com/careers',
    }),
    true,
  )
})

// Current public native inventory supersedes the historical redirect sentinel.
test('Gameberry traverses current native details and preserves the exact foreign-country proof and original malformed code',async()=>{
 const gameberry=await loadGameberryLabsModule()
 const {transport}=await import('../../scraper/acciojob/current.fixture.js')
 const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
 const jobs=await gameberry.createGameberryLabsScraper().run({fetchImpl:transport()})
 assert.equal(jobs.length,9)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,9)
 assert.ok(jobs[0].sourceNativeResolvedForeignPayloads.some(row=>row.id===85579))
})
test('Gameberry rejects legacy page transport without observed native HTTP metadata',async()=>{
 const gameberry=await loadGameberryLabsModule()
 await assert.rejects(gameberry.createGameberryLabsScraper().run({fetchPage:async()=>({text:homepageHtml})}),/unsupported legacy transport/)
})
