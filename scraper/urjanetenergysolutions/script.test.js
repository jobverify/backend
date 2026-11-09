import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const acquisitionBlogHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Arcadia acquires Urjanet | Arcadia</title>
  </head>
  <body>
    <h1>Arcadia acquires Urjanet</h1>
    <p>Urjanet, the largest utility data provider in the world, is now part of Arcadia.</p>
    <p>The Urjanet data network will significantly expand Arc.</p>
  </body>
</html>
`

const redirectPlatformHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>The Most Comprehensive Energy Data Platform | Arcadia</title>
  </head>
  <body>
    <h1>Power every decision with energy intelligence.</h1>
    <p>The Arcadia Platform provides comprehensive data and intelligent analytics.</p>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Arcadia</title>
  </head>
  <body>
    <h1>Change the future of energy with us</h1>
    <a href="/careers/openings">View job openings</a>
    <div>Arcadia careers</div>
  </body>
</html>
`

test('Urjanet Energy Solutions recognizes the updated Arcadia acquisition evidence set', async () => {
  const urjanet = await loadModule()

  assert.equal(urjanet.hasAcquisitionBlogSignal(acquisitionBlogHtml), true)
  assert.equal(urjanet.hasRedirectPlatformSignal(redirectPlatformHtml), true)
  assert.equal(urjanet.hasParentCareersSignal(careersHtml), true)
})

test('Urjanet Energy Solutions returns no jobs while it remains an Arcadia acquisition sentinel', async () => {
  const urjanet = await loadModule()

  const jobs = await urjanet.createUrjanetEnergySolutionsScraper().run({
    fetchText: async (url) => {
      if (url === urjanet.ACQUISITION_BLOG_URL) return acquisitionBlogHtml
      if (url === urjanet.URJANET_REDIRECT_URL) return redirectPlatformHtml
      if (url === urjanet.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})
