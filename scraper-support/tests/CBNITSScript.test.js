import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Agentic AI, Cybersecurity & Intelligent Enterprise Solutions | CBNITS</title>
    <script type="module" crossorigin src="/assets/index-BOK9jS_3.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const careersBundle = 'const API_BASE_URL="https://api.cbnits.com"; const endpoints={GET_CAREER_POST:"getAllCareerPost"}; function Career(){return "Join The CBNITS Team Current career opportunities at CBNITS";} const routes=[{path:"/career",element:Career}];'

const loadModule = async () => {
  try {
    return await import('../../scraper/cbnits/script.js')
  } catch {
    assert.fail('Expected CBNITS scraper module at ../../scraper/cbnits/script.js')
  }
}

test('CBNITS retains verified legacy shell helpers alongside current source metadata', async () => {
  const cbnits = await loadModule()

  assert.equal(cbnits.SOURCE, 'cbnits')
  assert.equal(cbnits.COMPANY, 'CBNITS')
  assert.equal(cbnits.CAREERS_URL, 'https://www.cbnits.com/career/')
  assert.equal(cbnits.VERIFIED_ON, '2026-10-09')
  assert.equal(cbnits.hasOfficialCareersShellSignal(careersShellHtml), true)
  assert.equal(cbnits.hasServerRenderedJobsSignal(careersShellHtml), false)
  assert.equal(cbnits.extractBundleUrl(careersShellHtml), 'https://www.cbnits.com/assets/index-BOK9jS_3.js')
  assert.equal(cbnits.hasOfficialCareersBundleSignal(careersBundle), true)
})

test('CBNITS returns [] only while the verified first-party careers page remains a raw SPA shell', async () => {
  const cbnits = await loadModule()
  const requestedUrls = []

  const jobs = await cbnits.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cbnits.CAREERS_URL) return careersShellHtml
      if (url === 'https://www.cbnits.com/assets/index-BOK9jS_3.js') return careersBundle
      throw new Error(`Unexpected CBNITS URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cbnits.CAREERS_URL,
    'https://www.cbnits.com/assets/index-BOK9jS_3.js',
  ])
  assert.deepEqual(jobs, [])
})

test('CBNITS fails closed when server-rendered public jobs appear or the shell changes materially', async () => {
  const cbnits = await loadModule()

  await assert.rejects(
    cbnits.run({
      fetchText: async () => careersShellHtml.replace('<div id="root"></div>', '<h2>Current Openings</h2><a href="/apply">Apply Now</a>'),
    }),
    /server-rendered public jobs/i,
  )

  await assert.rejects(
    cbnits.run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified first-party careers shell/i,
  )

  await assert.rejects(
    cbnits.run({
      fetchText: async (url) => url === cbnits.CAREERS_URL
        ? careersShellHtml
        : 'const routes=[]',
    }),
    /careers route bundle/i,
  )
})

const loadCurrentCbnitsFixtures = async () => ({
  html: await fs.readFile(new URL('../../scraper/cbnits/fixtures/careers-current.html', import.meta.url), 'utf8'),
  bundle: await fs.readFile(new URL('../../scraper/cbnits/fixtures/careers-current.js', import.meta.url), 'utf8'),
})

test('CBNITS verifies the current first-party Next.js careers route and its unpublished-inventory view', async () => {
  const cbnits = await loadModule()
  const current = await loadCurrentCbnitsFixtures()
  assert.equal(cbnits.hasOfficialCareersShellSignal(current.html), true)
  assert.equal(cbnits.hasOfficialCareersBundleSignal(current.bundle), true)
  assert.equal(cbnits.extractBundleUrl(current.html), 'https://www.cbnits.com/_next/static/chunks/pages/career-78af9772bc76e41b.js')
  const requested = []
  const jobs = await cbnits.run({ fetchText: async url => {
    requested.push(url)
    return url === cbnits.CAREERS_URL ? current.html : current.bundle
  } })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.deepEqual(requested, [cbnits.CAREERS_URL, cbnits.extractBundleUrl(current.html)])
})

test('CBNITS rejects a changed current route or bundle that begins publishing career records', async () => {
  const cbnits = await loadModule()
  const current = await loadCurrentCbnitsFixtures()
  assert.equal(cbnits.hasOfficialCareersShellSignal(current.html.replace('"page":"/career"', '"page":"/contact"')), false)
  const publishing = current.bundle + ';const jobs=data.map(job=>job.careerTitle);'
  assert.equal(cbnits.hasOfficialCareersBundleSignal(publishing), false)
  await assert.rejects(cbnits.run({ fetchText: async url => url === cbnits.CAREERS_URL ? current.html : publishing }), /careers route bundle/i)
})
