import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const redirectedHomepageSurface = {
  url: 'https://www.yalamanchili.co.in/',
  finalUrl: 'https://www.ysppayments.com/',
  status: 200,
  errorKind: null,
  html: `
    <html>
      <head>
        <title>YSP | Yalamanchili Solutions for Payments</title>
      </head>
      <body>
        <h1>One Platform, Infinite Solutions</h1>
        <p>Providing enterprise class customizable and scalable end-to-end payment solutions since 1998.</p>
      </body>
    </html>
  `,
}

const dormant404Surface = {
  url: 'https://www.yalamanchili.co.in/careers',
  finalUrl: 'https://www.yalamanchili.co.in/careers',
  status: 404,
  errorKind: null,
  html: '<html><head><title>Not Found</title></head><body>HTTP Status: 404 (not found)</body></html>',
}

const blank404Surface = {
  url: 'https://www.yalamanchili.co.in/careers.html',
  finalUrl: 'https://www.yalamanchili.co.in/careers.html',
  status: 404,
  errorKind: null,
  html: '',
}

const currentBrandHomepageSurface = {
  url: 'https://www.ysppayments.com/',
  finalUrl: 'https://www.ysppayments.com/',
  status: 200,
  errorKind: null,
  html: redirectedHomepageSurface.html,
}

const currentBrand404Surface = {
  url: 'https://www.ysppayments.com/career',
  finalUrl: 'https://www.ysppayments.com/career',
  status: 404,
  errorKind: null,
  html: '<html><head><title>404 Not Found</title></head><body>Not Found</body></html>',
}

test('Yalamanchili Software Exports accepts the redirected homepage shell and dormant routes', async () => {
  const yalamanchili = await loadModule()
  assert.ok(yalamanchili, 'Yalamanchili Software Exports scraper module should load')

  assert.equal(yalamanchili.isExpectedRedirectedHomepageSurface(redirectedHomepageSurface), true)
  assert.equal(yalamanchili.isExpectedDormantSurface(redirectedHomepageSurface), true)
  assert.equal(yalamanchili.isExpectedDormantSurface(dormant404Surface), true)
  assert.equal(yalamanchili.isExpectedDormantSurface(blank404Surface), true)
})

test('Yalamanchili Software Exports run returns [] only while the redirected homepage and no-careers routes remain dormant', async () => {
  const yalamanchili = await loadModule()
  assert.ok(yalamanchili, 'Yalamanchili Software Exports scraper module should load')

  const pages = new Map([
    ['https://www.yalamanchili.co.in/', redirectedHomepageSurface],
    ['https://www.ysppayments.com/', currentBrandHomepageSurface],
    ['https://www.yalamanchili.co.in/careers', dormant404Surface],
    ['https://www.yalamanchili.co.in/jobs', { ...dormant404Surface, url: 'https://www.yalamanchili.co.in/jobs', finalUrl: 'https://www.yalamanchili.co.in/jobs' }],
    ['https://www.yalamanchili.co.in/careers.html', blank404Surface],
    ['https://www.ysppayments.com/career', currentBrand404Surface],
    ['https://www.ysppayments.com/careers', { ...currentBrand404Surface, url: 'https://www.ysppayments.com/careers', finalUrl: 'https://www.ysppayments.com/careers' }],
    ['https://www.ysppayments.com/jobs', { ...currentBrand404Surface, url: 'https://www.ysppayments.com/jobs', finalUrl: 'https://www.ysppayments.com/jobs' }],
  ])

  const jobs = await yalamanchili.createYalamanchiliSoftwareExportsScraper().run({
    probeUrl: async (url) => {
      const surface = pages.get(url)
      if (!surface) throw new Error(`Unexpected URL: ${url}`)
      return surface
    },
  })

  assert.deepEqual(jobs, [])
})

test('Yalamanchili Software Exports fails closed when a reachable jobs surface appears', async () => {
  const yalamanchili = await loadModule()
  assert.ok(yalamanchili, 'Yalamanchili Software Exports scraper module should load')

  await assert.rejects(
    yalamanchili.createYalamanchiliSoftwareExportsScraper().run({
      probeUrl: async (url) => {
        if (url === 'https://www.yalamanchili.co.in/') return redirectedHomepageSurface
        if (url === 'https://www.ysppayments.com/') return currentBrandHomepageSurface
        if (url === 'https://www.yalamanchili.co.in/careers') {
          return {
            url,
            finalUrl: url,
            status: 200,
            errorKind: null,
            html: '<html><body><h1>Careers</h1><a href="/jobs/payments-analyst">Apply now</a></body></html>',
          }
        }

        if (url === 'https://www.ysppayments.com/career') return currentBrand404Surface
        if (url === 'https://www.ysppayments.com/careers') return { ...currentBrand404Surface, url, finalUrl: url }
        if (url === 'https://www.ysppayments.com/jobs') return { ...currentBrand404Surface, url, finalUrl: url }

        return {
          ...dormant404Surface,
          url,
          finalUrl: url,
        }
      },
    }),
    /public jobs surface/i,
  )
})
