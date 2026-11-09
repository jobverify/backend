import assert from 'node:assert/strict'
import test from 'node:test'

const loadKnowledgeLensModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Knowledge Lens scraper module at ./script.js')
  }
}

const retiredAnnouncementHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rockwell Acquires Knowledge Lens | Kalypso</title>
  </head>
  <body>
    <main>
      <h1>Knowledge Lens Integration with Rockwell Automation Complete</h1>
      <p>March 1, 2025</p>
      <p>We're proud to share that Knowledge Lens is now fully integrated into Rockwell Automation.</p>
      <p>With the integration complete, the Knowledge Lens website has been retired.</p>
      <p>Explore Kalypso.com.</p>
    </main>
  </body>
</html>
`

const retiredAnnouncementHtmlWithCurlyApostrophes = `
<!doctype html>
<html lang="en">
  <head>
    <title>Rockwell Acquires Knowledge Lens | Kalypso</title>
  </head>
  <body>
    <main>
      <h1>Knowledge Lens Integration with Rockwell Automation Complete</h1>
      <p>March 1, 2025</p>
      <p>We’re proud to share that Knowledge Lens is now fully integrated into Rockwell Automation.</p>
      <p>As part of this transition, Knowledge Lens’ data science capabilities and the UnifyTwin platform are now part of Kalypso, Rockwell’s digital services business.</p>
      <p>With the integration complete, the Knowledge Lens website has been retired.</p>
      <p>To learn more about these capabilities, explore Kalypso.com.</p>
    </main>
  </body>
</html>
`

const parentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Kalypso</title>
  </head>
  <body>
    <main>
      <p>We've never wanted to be a typical firm.</p>
      <p>Kalypsonians are innovators and intrapreneurs.</p>
      <p>What it means to be a Kalypsonian.</p>
      <p>View all openings.</p>
      <a href="https://rockwellautomation.wd1.myworkdayjobs.com/en-US/Search/jobs">Workday</a>
    </main>
  </body>
</html>
`

test('Knowledge Lens scraper validates the verified retired-brand homepage and parent careers zero-job surfaces', async () => {
  const knowledgeLens = await loadKnowledgeLensModule()

  assert.equal(knowledgeLens.SOURCE, 'knowledgelens')
  assert.equal(knowledgeLens.COMPANY, 'Knowledge Lens')
  assert.equal(knowledgeLens.HOMEPAGE_URL, 'https://www.knowledgelens.com/')
  assert.equal(
    knowledgeLens.RETIRED_ANNOUNCEMENT_URL,
    'https://kalypso.com/about/press/releases/rockwell-automation-announces-acquisition-of-knowledge-lens',
  )
  assert.equal(knowledgeLens.PARENT_CAREERS_URL, 'https://kalypso.com/careers')
  assert.equal(
    knowledgeLens.isRetiredHomepageTimeoutError({
      message: 'fetch failed',
      cause: {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
      },
    }),
    true,
  )
  assert.equal(knowledgeLens.hasRetiredHomepageSignal(retiredAnnouncementHtml), true)
  assert.equal(knowledgeLens.hasRetiredHomepageSignal(retiredAnnouncementHtmlWithCurlyApostrophes), true)
  assert.equal(knowledgeLens.hasParentCareersSignal(parentCareersHtml), true)
  assert.equal(knowledgeLens.hasBrandSpecificOpeningsSignal(parentCareersHtml), false)
})

test('Knowledge Lens scraper returns no jobs while the retired-brand homepage and parent careers page remain stable', async () => {
  const knowledgeLens = await loadKnowledgeLensModule()
  const requestedUrls = []

  const jobs = await knowledgeLens.createKnowledgeLensScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === knowledgeLens.HOMEPAGE_URL) {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: {
            code: 'UND_ERR_CONNECT_TIMEOUT',
            message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
          },
        })
      }

      if (url === knowledgeLens.RETIRED_ANNOUNCEMENT_URL) {
        return {
          status: 200,
          url,
          html: retiredAnnouncementHtml,
        }
      }

      if (url === knowledgeLens.PARENT_CAREERS_URL) {
        return {
          status: 200,
          url,
          html: parentCareersHtml,
        }
      }

      throw new Error(`Unexpected Knowledge Lens URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    knowledgeLens.HOMEPAGE_URL,
    knowledgeLens.RETIRED_ANNOUNCEMENT_URL,
    knowledgeLens.PARENT_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Knowledge Lens default fetch is bounded by a timeout signal', async () => {
  const knowledgeLens = await loadKnowledgeLensModule()
  let capturedInit = null

  const page = await knowledgeLens.defaultFetchPage(knowledgeLens.HOMEPAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url: knowledgeLens.RETIRED_ANNOUNCEMENT_URL,
        text: async () => retiredAnnouncementHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, knowledgeLens.RETIRED_ANNOUNCEMENT_URL)
  assert.equal(page.html, retiredAnnouncementHtml)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Knowledge Lens scraper fails closed when the retired-brand or parent-careers contract drifts', async () => {
  const knowledgeLens = await loadKnowledgeLensModule()

  await assert.rejects(
    knowledgeLens.createKnowledgeLensScraper().run({
      fetchPage: async (url) => {
        if (url === knowledgeLens.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /retired brand homepage/i,
  )

  await assert.rejects(
    knowledgeLens.createKnowledgeLensScraper().run({
      fetchPage: async (url) => {
        if (url === knowledgeLens.HOMEPAGE_URL) {
          throw Object.assign(new TypeError('fetch failed'), {
            cause: {
              code: 'UND_ERR_CONNECT_TIMEOUT',
              message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
            },
          })
        }

        if (url === knowledgeLens.RETIRED_ANNOUNCEMENT_URL) {
          return {
            status: 200,
            url,
            html: retiredAnnouncementHtml,
          }
        }

        if (url === knowledgeLens.PARENT_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: parentCareersHtml.replace(
              '</main>',
              '<p>Knowledge Lens openings are now listed here.</p></main>',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /brand-specific openings/i,
  )
})
