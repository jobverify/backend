import assert from 'node:assert/strict'
import test from 'node:test'
import {createDaloopaReplay,withDaloopaReplayClock,assertDaloopaCurrentJobs} from '../../scraper/daloopa/fixtures/replayNativeData20261115.js'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>We're here to solve tough challenges with great people.</p>
    <a href="/demo">Request a Demo</a>
    <a href="/signup">Create Free Account</a>
    <a href="/login">Log In</a>
    <p>hello@daloopa.com</p>
    <p>122 East 42nd St, 14th Floor, New York, NY 10168</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    const current = await import('../../scraper/daloopa/script.js')
    return {...current,createDaloopaScraper:current.createDaloopaLegacyScraper,VERIFIED_ON:current.LEGACY_PROVIDER_METADATA.verifiedOn}
  } catch {
    assert.fail('Expected Daloopa scraper module at ../../scraper/daloopa/script.js')
  }
}

test('historical Daloopa sentinel stays pinned to the verified careers landing page without public role cards', async () => {
  const daloopa = await loadModule()

  assert.equal(daloopa.SOURCE, 'daloopa')
  assert.equal(daloopa.COMPANY, 'Daloopa')
  assert.equal(daloopa.OFFICIAL_BRAND_NAME, 'Daloopa')
  assert.equal(daloopa.CAREERS_URL, 'https://daloopa.com/careers')
  assert.equal(daloopa.VERIFIED_ON, '2026-07-17')
  assert.equal(daloopa.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(daloopa.hasPublicJobsSignal(careersPageHtml), false)
  assert.equal(
    daloopa.hasPublicJobsSignal('<a href="https://daloopa.com/careers/software-engineer">Apply now</a>'),
    true,
  )
})

test('historical Daloopa sentinel returns [] only while the verified careers page has no public role cards', async () => {
  const daloopa = await loadModule()
  const jobs = await daloopa.createDaloopaScraper().run({
    fetchText: async (url) => {
      assert.equal(url, daloopa.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('historical Daloopa sentinel fails closed when public job cards appear on the verified first-party page', async () => {
  const daloopa = await loadModule()

  await assert.rejects(
    daloopa.createDaloopaScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Careers</h1>
            <a href="/careers/software-engineer">Software Engineer</a>
            <a href="/careers/software-engineer/apply">Apply now</a>
          </body>
        </html>
      `,
    }),
    /verified Daloopa careers page/i,
  )
})

for(const route of ['run','factory'])test('current Daloopa '+route+' preserves original full Response authority and two complete undated India data records',async()=>{
  const current=await import('../../scraper/daloopa/script.js'),io=createDaloopaReplay()
  const jobs=await withDaloopaReplayClock(()=>route==='run'?current.run({fetchImpl:io.fetchImpl}):current.createDaloopaScraper({fetchImpl:io.fetchImpl}).run())
  assertDaloopaCurrentJobs(jobs,io.fixture)
  assert.equal(io.calls.length,14)
  assert.equal(current.VERIFIED_ON,null)
  assert.equal(current.PROVIDER_METADATA.firstParty,false)
})

test('current Daloopa rejects a body-only historical callback before any I/O',async()=>{
  const current=await import('../../scraper/daloopa/script.js');let calls=0
  await assert.rejects(current.run({fetchText:async()=>{calls++;return careersPageHtml}}),error=>error.code==='DALOOPA_NATIVE_DATA_GAP'&&error.abortRetries===true)
  assert.equal(calls,0)
})
