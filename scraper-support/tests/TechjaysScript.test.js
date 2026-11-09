import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/techjays/script.js')
  } catch {
    assert.fail('Expected Techjays scraper module at ../../scraper/techjays/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Techjays | The AI Reimagination Company</title>
  </head>
  <body>
    <nav>
      <a href="/about">About</a>
      <a href="/services">Services</a>
      <a href="/contact">Contact</a>
      <a href="/insights">Insights</a>
    </nav>
    <h1>The AI Reimagination Company</h1>
  </body>
</html>
`

test('Techjays retains helpers for identifying its legacy homepage and careers redirect', async () => {
  const techjays = await loadModule()

  assert.equal(techjays.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(techjays.hasPublicCareersLink(homepageHtml), false)
  assert.equal(
    techjays.isExpectedCareersRedirect({
      status: 308,
      url: 'https://www.techjays.com/careers',
      headers: { location: '/about' },
    }),
    true,
  )
})

test('Techjays does not treat its legacy careers redirect as evidence of an empty listing', async () => {
  const techjays = await loadModule()
  const requestedUrls = []

  await assert.rejects(techjays.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === techjays.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml, headers: {} }
      }
      if (url === techjays.CAREERS_URL) {
        return { status: 308, url, html: '', headers: { location: '/about' } }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  }), /redirect is not an empty listing/i)

  assert.deepEqual(requestedUrls, [
    techjays.HOMEPAGE_URL,
    techjays.CAREERS_URL,
  ])
})

test('Techjays default fetch handles careers redirects with a timeout signal', async () => {
  const techjays = await loadModule()
  let capturedInit = null

  const page = await techjays.defaultFetchPage(techjays.CAREERS_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init

      return {
        status: 308,
        url,
        headers: {
          get: (name) => name.toLowerCase() === 'location' ? '/about' : '',
        },
        text: async () => '',
      }
    },
  })

  assert.equal(page.status, 308)
  assert.deepEqual(page.headers, { location: '/about' })
  assert.equal(capturedInit.redirect, 'manual')
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('Techjays rejects the legacy careers redirect and an unverified replacement page', async () => {
  const techjays = await loadModule()

  await assert.rejects(
    techjays.run({
      fetchPage: async (url) => {
        if (url === techjays.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            headers: {},
            html: homepageHtml.replace('</nav>', '<a href="/careers">Careers</a></nav>'),
          }
        }
        return { status: 308, url, headers: { location: '/about' }, html: '' }
      },
    }),
    /current careers public surface/i,
  )

  await assert.rejects(
    techjays.run({
      fetchPage: async (url) => {
        if (url === techjays.HOMEPAGE_URL) {
          return { status: 200, url, headers: {}, html: homepageHtml }
        }
        return { status: 200, url, headers: {}, html: '<html><body><h1>Jobs</h1></body></html>' }
      },
    }),
    /current careers page/i,
  )
})
