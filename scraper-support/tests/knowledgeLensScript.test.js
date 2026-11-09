import assert from 'node:assert/strict'
import test from 'node:test'

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

const loadKnowledgeLensModule = async () => {
  try {
    return await import('../../scraper/knowledgelens/script.js')
  } catch {
    assert.fail('Expected Knowledge Lens scraper module at ../../scraper/knowledgelens/script.js')
  }
}

test('Knowledge Lens validates the retired-brand announcement and parent careers page signals', async () => {
  const knowledgelens = await loadKnowledgeLensModule()

  assert.equal(knowledgelens.SOURCE, 'knowledgelens')
  assert.equal(knowledgelens.COMPANY, 'Knowledge Lens')
  assert.equal(
    knowledgelens.isRetiredHomepageTimeoutError({
      message: 'fetch failed',
      cause: {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
      },
    }),
    true,
  )
  assert.equal(knowledgelens.hasRetiredHomepageSignal(retiredAnnouncementHtml), true)
  assert.equal(knowledgelens.hasRetiredHomepageSignal(retiredAnnouncementHtmlWithCurlyApostrophes), true)
  assert.equal(knowledgelens.hasParentCareersSignal(parentCareersHtml), true)
  assert.equal(knowledgelens.hasBrandSpecificOpeningsSignal(parentCareersHtml), false)
})

test('Knowledge Lens returns no jobs when the retired brand homepage times out but the canonical announcement and parent careers page remain verified', async () => {
  const knowledgelens = await loadKnowledgeLensModule()
  const requestedUrls = []

  const jobs = await knowledgelens.createKnowledgeLensScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === knowledgelens.HOMEPAGE_URL) {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: {
            code: 'UND_ERR_CONNECT_TIMEOUT',
            message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
          },
        })
      }

      if (url === knowledgelens.RETIRED_ANNOUNCEMENT_URL) {
        return {
          status: 200,
          url,
          html: retiredAnnouncementHtml,
        }
      }

      if (url === knowledgelens.PARENT_CAREERS_URL) {
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
    knowledgelens.HOMEPAGE_URL,
    knowledgelens.RETIRED_ANNOUNCEMENT_URL,
    knowledgelens.PARENT_CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Knowledge Lens fails closed when the retired announcement or parent careers page drifts', async () => {
  const knowledgelens = await loadKnowledgeLensModule()

  await assert.rejects(
    knowledgelens.createKnowledgeLensScraper().run({
      fetchPage: async (url) => {
        if (url === knowledgelens.HOMEPAGE_URL) {
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
    knowledgelens.createKnowledgeLensScraper().run({
      fetchPage: async (url) => {
        if (url === knowledgelens.HOMEPAGE_URL) {
          throw Object.assign(new TypeError('fetch failed'), {
            cause: {
              code: 'UND_ERR_CONNECT_TIMEOUT',
              message: 'Connect Timeout Error (attempted address: www.knowledgelens.com:443, timeout: 10000ms)',
            },
          })
        }

        if (url === knowledgelens.RETIRED_ANNOUNCEMENT_URL) {
          return {
            status: 200,
            url,
            html: retiredAnnouncementHtml,
          }
        }

        if (url === knowledgelens.PARENT_CAREERS_URL) {
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
