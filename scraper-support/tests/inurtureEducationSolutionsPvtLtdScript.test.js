import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import https from 'node:https'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>India&#039;s Leading Edtech Company Offering New-Age Programs in New-Age Domains</title>
    <meta
      name="description"
      content="iNurture is a pioneering edtech company making waves in the higher education space by offering new-age programs for tomorrow's industries."
    />
    <link rel="canonical" href="https://inurture.co.in/" />
  </head>
  <body>
    <h1>India's Leading Edtech Company Offering New-Age Programs in New-Age Domains</h1>
    <p>iNurture is a pioneering edtech company making waves in the higher education space by offering new-age programs for tomorrow's industries.</p>
    <nav>
      <a href="https://www.inurture.co.in/careers-inurture/">Careers @ iNurture</a>
    </nav>
  </body>
</html>
`

const linkedCareersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers @ iNurture - Home</title>
    <link rel="canonical" href="https://inurture.co.in/careers-inurture/" />
  </head>
  <body>
    <h1>Careers @ iNurture</h1>
    <h2>Jobs :</h2>
    <p>
      Interested persons may kindly share your resume to this Email Address
      <a href="mailto:jobs@inurture.co.in">jobs@inurture.co.in</a>
      and If you have any queries please contact on
      <a href="tel:+91-9663139827">9663139827</a>
    </p>
    <form action="/careers-inurture/#wpcf7-f28926-o1" method="post"></form>
  </body>
</html>
`

const embeddedCareersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Home</title>
    <link rel="canonical" href="https://inurture.co.in/careers/" />
  </head>
  <body>
    <h1>Careers</h1>
    <iframe
      src="https://careers.inurture.co.in/"
      scrolling="yes"
      frameborder="0"
      width="100%"
      height="1100px"
    ></iframe>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/inurtureeducationsolutionspvtltd/script.js')
  } catch {
    assert.fail('Expected iNurture Education Solutions Pvt ltd scraper module at ../../scraper/inurtureeducationsolutionspvtltd/script.js')
  }
}

test('iNurture sentinels recognize the verified homepage, email-only careers page, and first-party iframe handoff', async () => {
  const inurture = await loadModule()

  assert.equal(inurture.SOURCE, 'inurtureeducationsolutionspvtltd')
  assert.equal(inurture.COMPANY, 'iNurture Education Solutions Pvt ltd')
  assert.equal(inurture.HOMEPAGE_URL, 'https://www.inurture.co.in/')
  assert.equal(inurture.LINKED_CAREERS_URL, 'https://www.inurture.co.in/careers-inurture/')
  assert.equal(inurture.EMBEDDED_CAREERS_URL, 'https://www.inurture.co.in/careers/')
  assert.equal(inurture.EMBEDDED_CAREERS_IFRAME_URL, 'https://careers.inurture.co.in/')
  assert.equal(inurture.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(inurture.hasLinkedCareersSignal(linkedCareersHtml), true)
  assert.equal(inurture.hasEmbeddedCareersSignal(embeddedCareersHtml), true)
  assert.deepEqual(inurture.extractSuspiciousPublicJobLinks(linkedCareersHtml), [])
})

test('iNurture returns no jobs while the official first-party surfaces remain email-only plus an unresolved iframe handoff', async () => {
  const inurture = await loadModule()
  const requestedUrls = []

  const jobs = await inurture.createInurtureEducationSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === inurture.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === inurture.LINKED_CAREERS_URL) {
        return { status: 200, url, html: linkedCareersHtml }
      }

      if (url === inurture.EMBEDDED_CAREERS_URL) {
        return { status: 200, url, html: embeddedCareersHtml }
      }

      if (url === inurture.EMBEDDED_CAREERS_IFRAME_URL) {
        throw new Error('getaddrinfo ENOTFOUND careers.inurture.co.in')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    inurture.HOMEPAGE_URL,
    inurture.LINKED_CAREERS_URL,
    inurture.EMBEDDED_CAREERS_URL,
    inurture.EMBEDDED_CAREERS_IFRAME_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('iNurture default fetch verifies TLS while preserving the first-party sentinel guards', async () => {
  const inurture = await loadModule()
  const originalRequest = https.request
  const observedRequests = []

  https.request = (targetUrl, options, callback) => {
    const url = targetUrl.toString()
    observedRequests.push({ url, options })
    const request = new EventEmitter()
    request.setTimeout = () => {}
    request.end = () => {
      queueMicrotask(() => {
        if (url === inurture.EMBEDDED_CAREERS_IFRAME_URL) {
          request.emit('error', new Error('getaddrinfo ENOTFOUND careers.inurture.co.in'))
          return
        }

        const response = new EventEmitter()
        response.statusCode = 200
        response.headers = {}
        callback(response)
        if (url === inurture.HOMEPAGE_URL) {
          response.emit('data', Buffer.from(homepageHtml))
        } else if (url === inurture.LINKED_CAREERS_URL) {
          response.emit('data', Buffer.from(linkedCareersHtml))
        } else if (url === inurture.EMBEDDED_CAREERS_URL) {
          response.emit('data', Buffer.from(embeddedCareersHtml))
        }
        response.emit('end')
      })
    }
    return request
  }

  try {
    const jobs = await inurture.createInurtureEducationSolutionsScraper().run()

    assert.deepEqual(jobs, [])
    assert.ok(observedRequests.length > 0)
    assert.deepEqual(
      [...new Set(observedRequests.map((request) => request.options.rejectUnauthorized))],
      [true],
    )
  } finally {
    https.request = originalRequest
  }
})

test('iNurture fails closed when the verified shell changes or public listings appear', async () => {
  const inurture = await loadModule()

  await assert.rejects(
    inurture.createInurtureEducationSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === inurture.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected homepage</h1></body></html>' }
        }

        return { status: 200, url, html: linkedCareersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    inurture.createInurtureEducationSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === inurture.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === inurture.LINKED_CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `${linkedCareersHtml}<a href="https://jobs.ashbyhq.com/inurture">Current Openings</a>`,
          }
        }

        return { status: 200, url, html: embeddedCareersHtml }
      },
    }),
    /public job links/i,
  )

  await assert.rejects(
    inurture.createInurtureEducationSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === inurture.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === inurture.LINKED_CAREERS_URL) {
          return { status: 200, url, html: linkedCareersHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Careers</h1><a href="/jobs/academic-counsellor">Apply now</a></body></html>',
        }
      },
    }),
    /embedded careers page changed materially or now exposes public jobs/i,
  )

  await assert.rejects(
    inurture.createInurtureEducationSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === inurture.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === inurture.LINKED_CAREERS_URL) {
          return { status: 200, url, html: linkedCareersHtml }
        }

        if (url === inurture.EMBEDDED_CAREERS_URL) {
          return { status: 200, url, html: embeddedCareersHtml }
        }

        return {
          status: 200,
          url,
          html: '<html><body><h1>Open Positions</h1><a href="/apply">Apply now</a></body></html>',
        }
      },
    }),
    /iframe handoff host now resolves or changed materially/i,
  )
})

test('iNurture default preserves an untrusted-certificate error instead of certifying empty inventory', async () => {
  const inurture = await loadModule()
  const originalRequest = https.request
  const certificateError = Object.assign(new Error('unable to get local issuer certificate'), {
    code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  })
  const observedRequests = []
  https.request = (targetUrl, options) => {
    observedRequests.push({url:targetUrl.toString(), options})
    const request = new EventEmitter()
    request.setTimeout = () => {}
    request.end = () => queueMicrotask(() => request.emit('error', certificateError))
    return request
  }
  try {
    await assert.rejects(inurture.createInurtureEducationSolutionsScraper().run(), (error) => (
      error === certificateError && error.code === 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY'
    ))
    assert.equal(observedRequests.length, 1)
    assert.equal(observedRequests[0].url, inurture.HOMEPAGE_URL)
    assert.equal(observedRequests[0].options.rejectUnauthorized, true)
    assert.equal(observedRequests[0].options.agent, undefined)
  } finally {
    https.request = originalRequest
  }
})
