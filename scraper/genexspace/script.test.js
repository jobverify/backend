import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = '<title>Genex Space: Space Experience &amp; Innovation Ecosystem</title><meta name="description" content="Genex Space designs Space Experience Centers and Innovation Labs in India"><script type="module" src="/assets/index-current.js"></script><div id="root"></div>'
const appBundle = 'name:"Genex Space",tagline:"Space Experience & Innovation Ecosystem",email:"info@genex.space",label:"Reach Us",to:"/reach-us","Join Us","We hire experience designers, engineers, educators, and program managers","Send a profile to",path:"reach-us",path:"*","Page Not Found"'
const currentGsefShell = '<!doctype html><html lang="en"><head><title>Genex Space: Space Experience &amp; Innovation Ecosystem</title><script type="module" crossorigin src="/assets/index-current.js"></script></head><body><div id="root"></div></body></html>'

test('Genex Space validates the current app shell and Join Us surface', async () => {
  const genex = await import('./script.js')
  assert.equal(genex.REACH_US_URL, 'https://genex.space/reach-us')
  assert.equal(genex.extractAppBundleUrl(homepageHtml), 'https://genex.space/assets/index-current.js')
  assert.equal(genex.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(genex.hasOfficialAppBundleSignal(appBundle), true)
  assert.equal(genex.hasPublicJobsSignal(appBundle), false)
  assert.equal(genex.hasPublicJobsSignal(currentGsefShell), false)
})

test('Genex Space returns an empty discovery snapshot after validating the current profile-only hiring route', async () => {
  const genex = await import('./script.js')
  const requested = []
  const jobs = await genex.createGenexSpaceScraper().run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === genex.HOMEPAGE_URL) return homepageHtml
      if (url === 'https://genex.space/assets/index-current.js') return appBundle
      throw new Error(`Unexpected Genex Space URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    genex.HOMEPAGE_URL,
    'https://genex.space/assets/index-current.js',
  ])
  assert.deepEqual(jobs, [])
})

test('Genex Space fails closed when the hiring surface or job state changes', async () => {
  const genex = await import('./script.js')
  await assert.rejects(genex.createGenexSpaceScraper().run({
    fetchText: async (url) => url === genex.HOMEPAGE_URL ? homepageHtml : 'const changed=true;',
  }), /Join Us surface/i)
  await assert.rejects(genex.createGenexSpaceScraper().run({
    fetchText: async (url) => url === genex.HOMEPAGE_URL ? homepageHtml : `${appBundle} jobs.lever.co/genexspace Apply now`,
  }), /appears to expose public jobs/i)
})
