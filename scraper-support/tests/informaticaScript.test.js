import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/informatica',
)

const salesforceJobsShellHtml = readFileSync(
  path.join(fixturesDir, 'salesforce-jobs-shell.html'),
  'utf8',
)

const loadInformaticaModule = async () => {
  try {
    return await import('../../scraper/informatica/script.js')
  } catch {
    assert.fail('Expected Informatica scraper module at ../../scraper/informatica/script.js')
  }
}

test('Informatica validates the verified careers redirect into the Salesforce jobs shell', async () => {
  const informatica = await loadInformaticaModule()

  assert.equal(informatica.SOURCE, 'informatica')
  assert.equal(informatica.COMPANY, 'Informatica')
  assert.equal(informatica.CAREERS_URL, 'https://www.informatica.com/about-us/careers.html')
  assert.equal(
    informatica.REDIRECT_TARGET_URL,
    'https://careers.salesforce.com/en/jobs/?search=informatica&pagesize=20#results',
  )
  assert.equal(informatica.hasVerifiedRedirectShell(salesforceJobsShellHtml), true)
  assert.equal(
    informatica.isVerifiedRedirectLocation(
      'https://careers.salesforce.com/en/jobs/?search=informatica&pagesize=20#results',
    ),
    true,
  )
})

test('Informatica returns no jobs while the official careers page remains a redirect-only Salesforce handoff', async () => {
  const informatica = await loadInformaticaModule()
  const requests = []

  const jobs = await informatica.createInformaticaScraper().run({
    fetchPage: async (url, options = {}) => {
      requests.push({ url, manualRedirect: options.manualRedirect === true })

      if (url === informatica.CAREERS_URL) {
        return {
          status: 301,
          url,
          headers: { location: informatica.REDIRECT_TARGET_URL },
          html: '',
        }
      }

      if (url === informatica.REDIRECT_TARGET_URL) {
        return {
          status: 200,
          url,
          headers: {},
          html: salesforceJobsShellHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    { url: informatica.CAREERS_URL, manualRedirect: true },
    { url: informatica.REDIRECT_TARGET_URL, manualRedirect: false },
  ])
  assert.deepEqual(jobs, [])
})

test('Informatica fails closed when the official redirect contract or redirected shell changes', async () => {
  const informatica = await loadInformaticaModule()

  await assert.rejects(
    informatica.createInformaticaScraper().run({
      fetchPage: async (url) => {
        if (url === informatica.CAREERS_URL) {
          return {
            status: 302,
            url,
            headers: {
              location: 'https://careers.salesforce.com/en/jobs/?search=tableau&pagesize=20#results',
            },
            html: '',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers redirect no longer matches the verified first-party surface/i,
  )

  await assert.rejects(
    informatica.createInformaticaScraper().run({
      fetchPage: async (url, options = {}) => {
        if (url === informatica.CAREERS_URL) {
          return {
            status: 301,
            url,
            headers: { location: informatica.REDIRECT_TARGET_URL },
            html: '',
          }
        }

        if (url === informatica.REDIRECT_TARGET_URL && !options.manualRedirect) {
          return {
            status: 200,
            url,
            headers: {},
            html: '<html><body><h1>Unexpected landing page</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /redirected official jobs shell no longer matches the verified public surface/i,
  )
})
