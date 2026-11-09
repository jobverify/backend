import assert from 'node:assert/strict'
import test from 'node:test'
import {nativeFixture} from '../alkemlaboratories/nativeFixture.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=nativeFixture(import.meta.url)
globalThis.fetch=async()=>{throw Error('OFFLINE Amura native source tripwire')}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const jobsBlogHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Amura - Adventure of your Lifetime</title>
    </head>
    <body>
      <main>
        <h1>Working at Amura</h1>
        <article>
          <a href="https://amura.ai/jobs/2023/10/04/growth-is-addictive/">Growth is addictive</a>
          <a href="https://amura.ai/jobs/2023/10/04/growth-is-addictive/">2023-10-04</a>
          <time>2023-10-04</time>
        </article>
        <a href="https://amura.ai/jobs">Jobs at Amura</a>
        <p>Proudly powered by WordPress</p>
      </main>
    </body>
  </html>
`

const changedJobsHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Jobs at Amura - Adventure of your Lifetime</title>
    </head>
    <body>
      <main>
        <h1>Working at Amura</h1>
        <article>
          <a href="https://amura.ai/jobs/2026/07/08/backend-engineer/">Backend Engineer</a>
        </article>
        <a href="https://amura.ai/jobs">Jobs at Amura</a>
        <p>Growth is addictive</p>
        <p>Proudly powered by WordPress</p>
      </main>
    </body>
  </html>
`

test('Amura Health preliminary blog identity and title cannot establish a non-role vacancy inventory', async () => {
  const amura = await loadModule()
  assert.ok(amura, 'Amura Health scraper module should load')

  const {
    JOBS_PAGE_URL,
    SOURCE,
    extractPublicPostTitles,
    hasKnownNonRolePostsOnly,
    hasVerifiedJobsBlogSurface,
  } = amura

  assert.equal(SOURCE, 'amurahealth')
  assert.equal(JOBS_PAGE_URL, 'https://amura.ai/jobs/')
  assert.equal(hasVerifiedJobsBlogSurface(jobsBlogHtml), true)
  assert.deepEqual(extractPublicPostTitles(jobsBlogHtml), ['Growth is addictive'])
  assert.equal(hasKnownNonRolePostsOnly(jobsBlogHtml), false)
})

test('Amura Health retains current full public editorial while returning explicitly unverified vacancy inventory', async () => {
  const amura = await loadModule()
  assert.ok(amura, 'Amura Health scraper module should load')

  const { createAmuraHealthScraper } = amura

  const requestedUrls = []
  const jobs = await createAmuraHealthScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return fixture.get(url)
    },
  })

  assert.equal(requestedUrls.filter(url=>url==='https://amura.ai/jobs/').length,2)
  assert.equal(requestedUrls.filter(url=>url==='https://amura.ai/jobs/2023/10/04/growth-is-addictive/').length,2)
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('Amura Health scraper fails loudly when the public jobs surface changes', async () => {
  const amura = await loadModule()
  assert.ok(amura, 'Amura Health scraper module should load')

  const { createAmuraHealthScraper } = amura

  await assert.rejects(
    createAmuraHealthScraper().run({
      fetchText: async () => '<html><title>Home</title></html>',
    }),
    /employer identity|official public jobs/i,
  )

  await assert.rejects(
    createAmuraHealthScraper().run({
      fetchText: async url => url==='https://amura.ai/jobs/'?fixture.get(url)+'<script type="application/ld+json">{"@type":"JobPosting","title":"Backend Engineer"}</script>':fixture.get(url),
    }),
    /public native role|collector/i,
  )
})
