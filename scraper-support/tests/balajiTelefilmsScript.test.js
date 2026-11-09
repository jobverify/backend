import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/balajitelefilms/test-data/current-public-20261103.json.gz',import.meta.url))))
const currentCorporateHTML=()=>currentPublicFixture().responses[0].body
import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Balaji Telefilms Limited : Television, Motion Pictures</title>
  </head>
  <body>
    <nav>
      <!--<a href="http://www.careers.balajitelefilms.com/" target="_blank">Current Openings</a>-->
      <a href="career-opportunity.php">Working at Balaji</a>
    </nav>
    <main>
      <h1>Balaji Telefilms</h1>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Balaji Telefilms Limited : Television, Motion Pictures</title>
  </head>
  <body>
    <main>
      <nav>
        <a href="career-opportunity.php">Working at Balaji</a>
      </nav>
      <!--<header>CURRENT JOB OPENINGS</header>-->
      <p>Please send your resume to <a href="mailto:careers@balajitelefilms.com">careers@balajitelefilms.com</a>.</p>
      <p>For a career with Balaji Telefilms Ltd. please send your resume to careers@balajitelefilms.com.</p>
    </main>
  </body>
</html>
`

const missingRouteHtml = `
<html>
  <head>
    <script language="Javascript">var _skz_pid = "9POBEX80W";</script>
  </head>
  <body>
    <div class="loader" id="sk-loader"></div>
  </body>
</html>
`

const incapsulaBlockedShellHtml = `
<html style="height:100%">
  <head>
    <meta name="robots" content="noindex, nofollow">
    <meta name="format-detection" content="telephone=no">
    <meta name="viewport" content="initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  </head>
  <body style="margin:0px;height:100%">
    <iframe
      id="main-iframe"
      src="/_Incapsula_Resource?SWUDNSAI=31&incident_id=1652000270182916016-590217034444572368"
    ></iframe>
  </body>
</html>
`

const incapsulaScriptShellHtml = `
<html>
  <head>
    <meta name="robots" content="noindex,nofollow">
    <script src="/_Incapsula_Resource?SWJIYLWA=5074a744e2e3d891814e9a2dace20bd4,719d34d31c8e3a6e6fffd425f7e032f3"></script>
  </head>
  <body></body>
</html>
`

const loadBalajiTelefilmsModule = async () => {
  try {
    return await import('../../scraper/balajitelefilms/script.js')
  } catch {
    assert.fail('Expected Balaji Telefilms scraper module at ../../scraper/balajitelefilms/script.js')
  }
}

test('Balaji Telefilms verifies the official homepage, email-only careers page, and missing-route guardrails', async () => {
  const balaji = await loadBalajiTelefilmsModule()

  assert.equal(balaji.HOMEPAGE_URL, 'https://www.balajitelefilms.com/')
  assert.equal(balaji.CAREERS_URL, 'https://www.balajitelefilms.com/career-opportunity.php')
  assert.deepEqual(balaji.MISSING_ROUTE_URLS, [
    'https://www.balajitelefilms.com/careers',
    'https://www.balajitelefilms.com/career',
  ])
  assert.equal(balaji.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(balaji.hasVerifiedCareersLink(homepageHtml), true)
  assert.equal(balaji.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(balaji.hasEmailOnlyCareersSignal(careersHtml), true)
  assert.equal(balaji.isVerifiedMissingRoute({ status: 404, html: missingRouteHtml }), true)
  assert.equal(balaji.hasUnexpectedPublicJobsSignal(careersHtml), false)
  assert.equal(balaji.hasVerifiedIncapsulaBlockedShell(incapsulaBlockedShellHtml), true)
  assert.equal(balaji.hasVerifiedIncapsulaBlockedShell(incapsulaScriptShellHtml), true)
})

test("Balaji current email intake retains explicit unknown inventory and closing evidence", async () => {
 const balaji=await loadBalajiTelefilmsModule(),calls=[];let audit
 const jobs=await balaji.run({fetchPage:async url=>{calls.push(url);return{url,status:200,html:currentCorporateHTML()}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[balaji.CAREERS_URL,balaji.CAREERS_URL]);assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(audit.observations[0].vacancy,false);assert.equal(audit.closingMatches,true)
})

test('Balaji Telefilms fails closed if the careers surface turns into a public jobs board', async () => {
  const balaji = await loadBalajiTelefilmsModule()

  const publicListingHtml = `${careersHtml}
    <article class="job-card">
      <h2>Producer</h2>
      <a href="/jobs/producer">Apply now</a>
    </article>`

  await assert.rejects(
    balaji.createBalajiTelefilmsScraper().run({
      fetchPage: async (url) => {
        if (url === balaji.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
        if (url === balaji.CAREERS_URL) return { status: 200, url, html: publicListingHtml }
        return { status: 404, url, html: missingRouteHtml }
      },
    }),
    /vacancy.*collector/i,
  )
})

test("Balaji preserves current public transport failures without alternate browser retry", async () => {
 const balaji=await loadBalajiTelefilmsModule(),error=new TypeError('fetch failed');let browserCalls=0
 await assert.rejects(balaji.run({fetchPage:async()=>{throw error},fetchBrowserPage:async()=>{browserCalls++;return{status:200,url:balaji.CAREERS_URL,html:currentCorporateHTML()}}}),caught=>caught===error);assert.equal(browserCalls,0)
})

test('Balaji legacy TLS helper forwards its injected certificate-error collaborator outside the registered current runtime', async () => {
  const balaji = await loadBalajiTelefilmsModule()

  const requestedUrls = []
  const fetchPage = balaji.createDefaultFetchPage({
    fetchImpl: async () => {
      const error = new TypeError('fetch failed')
      error.cause = { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' }
      throw error
    },
    fetchInsecurePageImpl: async (url) => {
      requestedUrls.push(url)
      return { status: 200, url, html: incapsulaScriptShellHtml }
    },
  })

  const homepage = await fetchPage(balaji.HOMEPAGE_URL)
  const careers = await fetchPage(balaji.CAREERS_URL)

  assert.deepEqual(requestedUrls, [
    balaji.HOMEPAGE_URL,
    balaji.CAREERS_URL,
  ])
  assert.equal(balaji.hasVerifiedIncapsulaBlockedShell(homepage.html), true)
  assert.equal(balaji.hasVerifiedIncapsulaBlockedShell(careers.html), true)
})

test("Balaji current HTTP200 challenge shell is an explicit unavailable inventory, never verified empty", async () => {
 const balaji=await loadBalajiTelefilmsModule()
 await assert.rejects(balaji.run({fetchPage:async url=>({status:200,url,html:incapsulaScriptShellHtml})}),error=>error.status===200&&error.failureKind==='blocked_or_access_denied'&&error.inventoryEvidence.reportedTotal===null&&error.abortRetries===true)
})
