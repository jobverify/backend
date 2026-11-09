import {fixture,replay,editHTML,editJSON,mutateNativePost} from '../native-sources/publicLeverChannels/fixtureReplay.js'
import {syntheticPaginatedVgs} from '../native-sources/publicLeverChannels/testSupport.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs</title>
  </head>
  <body>
    <main>
      <section id="top">
        <h1>Help us change the way the world builds amazing apps.</h1>
        <a href="/about/jobs#positions">See open positions</a>
      </section>
      <section id="positions">
        <h2>Open positions</h2>
        <p>
          Here’s what we’re looking for right now. Don’t see your specific position below?
          Just <a href="mailto: joinus@ionic.io">drop us a line</a>.
        </p>
      </section>
      <footer>
        <p>An OutSystems company.</p>
      </footer>
    </main>
  </body>
</html>
`

const driftedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Ionic</title>
  </head>
  <body>
    <h1>Join our network</h1>
  </body>
</html>
`

const brokenLeverProxyPayload = {
  ok: true,
  data: {
    ok: false,
    error: 'Document not found',
  },
}

const liveLeverProxyPayload = {
  ok: true,
  data: [
    {
      text: 'Senior Developer Relations Engineer',
      hostedUrl: 'https://jobs.lever.co/Ionic/abc123',
      categories: {
        team: 'Engineering',
        location: 'Remote',
        commitment: 'Full-time',
      },
    },
  ],
}

const notFoundBoardPage = {
  status: 404,
  finalUrl: 'https://jobs.lever.co/Ionic',
  text: '<!doctype html><html><head><title>Not found – 404 error</title></head><body>Document not found</body></html>',
}

const liveBoardPage = {
  status: 200,
  finalUrl: 'https://jobs.lever.co/Ionic',
  text: '<!doctype html><html><head><title>Ionic Jobs</title></head><body>Open positions</body></html>',
}

const loadIonicModule = async () => {
  try {
    return await import('../../scraper/ionic/script.js')
  } catch {
    assert.fail('Expected Ionic scraper module at ../../scraper/ionic/script.js')
  }
}

test('Ionic pins the verified first-party careers and broken Lever proxy contracts', async () => {
  const ionic = await loadIonicModule()

  assert.equal(ionic.SOURCE, 'ionic')
  assert.equal(ionic.COMPANY_NAME, 'Ionic')
  assert.equal(ionic.OFFICIAL_BRAND_NAME, 'Ionic')
  assert.equal(ionic.HOMEPAGE_URL, 'https://ionic.io/')
  assert.equal(ionic.CAREERS_URL, 'https://ionic.io/about/jobs')
  assert.equal(ionic.LEVER_PROXY_URL, 'https://ionic.io/api/lever')
  assert.equal(ionic.LEVER_BOARD_URL, 'https://jobs.lever.co/Ionic')
  assert.equal(ionic.VERIFIED_ON, null)
  assert.equal(ionic.hasOfficialIonicCareersSignal(officialCareersHtml), true)
  assert.equal(ionic.hasOfficialIonicCareersSignal(driftedCareersHtml), false)
  assert.equal(ionic.hasBrokenLeverProxySignal(brokenLeverProxyPayload), true)
  assert.equal(ionic.hasBrokenLeverProxySignal(liveLeverProxyPayload), false)
  assert.deepEqual(ionic.extractLeverJobs(brokenLeverProxyPayload), [])
  assert.deepEqual(ionic.extractLeverJobs(liveLeverProxyPayload), liveLeverProxyPayload.data)
  assert.equal(ionic.isMissingLeverBoardPage(notFoundBoardPage), true)
  assert.equal(ionic.isMissingLeverBoardPage(liveBoardPage), false)
})

test("Ionic retains the original proxy failure and missing roles instead of claiming a source zero",async()=>{
   const ionic=await loadIonicModule(),r=replay(),jobs=await ionic.createIonicScraper().run(r.options)
   assert.equal(jobs.length,0);assert.equal(r.audits.length,1);const a=r.audits[0]
   assert.deepEqual(a.closing.originalNativeProxy,fixture.oracle.ionic.originalProxy)
   assert.equal(a.closing.nativeFeedUnavailable,true);assert.equal(a.closing.nativeListingComplete,false)
   assert.equal(a.closing.originalCachedRoleAvailability.length,4)
   assert.ok(a.closing.originalCachedRoleAvailability.every(page=>page.status===404))
   assert.equal(a.sourceScopeComplete,false);assert.equal(a.authoritativeSourceTotal,null)
  
})

test("Ionic retains primary and board identity changes and permits a restored supported proxy array",async()=>{
   const ionic=await loadIonicModule()
   const drift=replay((url,page)=>url===ionic.CAREERS_URL?editHTML(page,html=>html.replace('<title>Jobs</title>','<title>Other</title>')):page)
   assert.equal((await ionic.run(drift.options)).length,0);assert.equal(drift.audits[0].closing.publisherQualified,false)
   const restored=replay((url,page)=>url===ionic.LEVER_PROXY_URL?editJSON(page,model=>{model.ok=true;model.data=[]}):page)
   await ionic.run(restored.options);assert.equal(restored.audits[0].closing.nativeFeedUnavailable,false)
   assert.equal(restored.audits[0].sourceScopeComplete,false)
   const board=replay((url,page)=>url===ionic.LEVER_BOARD_URL?{...editHTML(page,()=>'<title>Unrelated Company</title>'),status:200}:page)
   await ionic.run(board.options);assert.equal(board.audits[0].closing.publisherQualified,false)
  
})
