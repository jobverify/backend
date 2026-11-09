import assert from 'node:assert/strict'
import test from 'node:test'

const loadLearningVertosModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const dnsAbsentErrorMessages = [
  'getaddrinfo ENOTFOUND learningvertos.com',
  'The remote name could not be resolved: "www.learningvertos.com"',
  'learningvertos.in : DNS name does not exist',
  'www.learningvertos.in : DNS name does not exist',
  'learningvertos.co.in : DNS name does not exist',
  'www.learningvertos.co.in : DNS name does not exist',
]

test('Learning Vertos sentinel stays pinned to the verified absent first-party surface', async () => {
  const learningvertos = await loadLearningVertosModule()
  assert.ok(learningvertos, 'Expected Learning Vertos scraper module at ./script.js')

  assert.equal(learningvertos.SOURCE, 'learningvertos')
  assert.equal(learningvertos.COMPANY, 'Learning Vertos')
  assert.deepEqual(learningvertos.PRIMARY_URLS, [
    'https://learningvertos.com/',
    'https://www.learningvertos.com/',
    'https://learningvertos.com/careers',
    'https://www.learningvertos.com/careers',
    'https://learningvertos.in/',
    'https://www.learningvertos.in/',
    'https://learningvertos.co.in/',
    'https://www.learningvertos.co.in/',
  ])

  for (const message of dnsAbsentErrorMessages) {
    assert.equal(
      learningvertos.isVerifiedAbsentSurfaceError(new Error(message)),
      true,
      `Expected DNS absence classifier to accept: ${message}`,
    )
  }

  assert.equal(
    learningvertos.isVerifiedAbsentSurfaceError(Object.assign(new TypeError('fetch failed'), {
      cause: {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND learningvertos.com',
      },
    })),
    true,
    'Expected DNS absence classifier to inspect fetch failed causes',
  )

  assert.equal(
    learningvertos.hasPublicJobsSignal(`
      <html>
        <body>
          <h1>Current Openings</h1>
          <a href="/apply/software-engineer">Apply now</a>
        </body>
      </html>
    `),
    true,
  )
})

test('Learning Vertos run returns no jobs only while every pinned first-party URL stays DNS-absent', async () => {
  const learningvertos = await loadLearningVertosModule()
  assert.ok(learningvertos, 'Expected Learning Vertos scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await learningvertos.createLearningVertosScraper().run({
    probeUrl: async (url) => {
      requestedUrls.push(url)
      throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
    },
  })

  assert.deepEqual(requestedUrls, learningvertos.PRIMARY_URLS)
  assert.deepEqual(jobs, [])
})

test('Learning Vertos fails closed when any pinned URL becomes reachable', async () => {
  const learningvertos = await loadLearningVertosModule()
  assert.ok(learningvertos, 'Expected Learning Vertos scraper module at ./script.js')

  await assert.rejects(
    learningvertos.createLearningVertosScraper().run({
      probeUrl: async (url) => {
        if (url === learningvertos.PRIMARY_URLS[0]) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Learning Vertos</h1></body></html>',
          }
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /first-party surface no longer matches the verified absent-site contract/i,
  )
})

test('Learning Vertos fails closed when a pinned URL starts exposing public jobs', async () => {
  const learningvertos = await loadLearningVertosModule()
  assert.ok(learningvertos, 'Expected Learning Vertos scraper module at ./script.js')

  await assert.rejects(
    learningvertos.createLearningVertosScraper().run({
      probeUrl: async (url) => {
        if (url === learningvertos.PRIMARY_URLS[2]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <body>
                  <h1>Current Openings</h1>
                  <p>Join our team.</p>
                  <a href="/apply">Apply now</a>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /pinned careers candidate now appears to expose public jobs/i,
  )
})

test('Learning Vertos fails closed on non-DNS network drift', async () => {
  const learningvertos = await loadLearningVertosModule()
  assert.ok(learningvertos, 'Expected Learning Vertos scraper module at ./script.js')

  await assert.rejects(
    learningvertos.createLearningVertosScraper().run({
      probeUrl: async (url) => {
        if (url === learningvertos.PRIMARY_URLS[0]) {
          throw new Error('ETIMEDOUT while connecting')
        }

        throw new Error(`getaddrinfo ENOTFOUND ${new URL(url).hostname}`)
      },
    }),
    /first-party surface probe failed with an unexpected network condition/i,
  )
})
