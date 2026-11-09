import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures/intevaproducts',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const officialCareersHtml = readFixture('official-careers.html')
const apponeLandingHtml = readFixture('appone-landing.html')

const loadModule = async () => {
  try {
    return await import('../../scraper/intevaproducts/script.js')
  } catch {
    assert.fail('Expected Inteva Products scraper module at ../../scraper/intevaproducts/script.js')
  }
}

test('Inteva Products validates the official careers page and embedded AppOne board without India locations', async () => {
  const inteva = await loadModule()

  assert.equal(inteva.SOURCE, 'intevaproducts')
  assert.equal(inteva.COMPANY, 'Inteva Products')
  assert.equal(inteva.CAREERS_URL, 'https://www.intevaproducts.com/careers/apply-online/')
  assert.equal(inteva.hasOfficialCareersPage(officialCareersHtml), true)
  assert.equal(
    inteva.extractEmbeddedJobsUrl(officialCareersHtml),
    'https://www.appone.com/branding/reqtemplate/default.asp?servervar=IntevaProducts.appone.com',
  )
  assert.equal(inteva.hasVerifiedApponeLandingPage(apponeLandingHtml), true)
  assert.deepEqual(inteva.extractLocationOptions(apponeLandingHtml), [
    { value: '58171', label: 'Alabama, Gadsden' },
    { value: '101870', label: 'Chihuahua, Ciudad Juarez' },
    { value: '161953', label: 'Guanajuato, Silao' },
    { value: '370201', label: 'Indiana, Bluffton' },
    { value: '58159', label: 'Michigan, Troy' },
    { value: '58156', label: 'Ohio, Vandalia' },
    { value: '654222', label: 'Opolskie, Opole' },
    { value: '560287', label: 'Queretaro, Queretaro' },
    { value: '103733', label: 'Tamaulipas, Matamoros #1' },
  ])
  assert.equal(inteva.hasIndiaLocationOptions(inteva.extractLocationOptions(apponeLandingHtml)), false)
})

test('Inteva Products returns no jobs while the verified public AppOne board exposes no India locations', async () => {
  const inteva = await loadModule()
  const requestedUrls = []

  const jobs = await inteva.createIntevaProductsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === inteva.CAREERS_URL) return officialCareersHtml
      if (
        url
        === 'https://www.appone.com/branding/reqtemplate/default.asp?servervar=IntevaProducts.appone.com'
      ) {
        return apponeLandingHtml
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.intevaproducts.com/careers/apply-online/',
    'https://www.appone.com/branding/reqtemplate/default.asp?servervar=IntevaProducts.appone.com',
  ])
  assert.deepEqual(jobs, [])
})

test('Inteva Products fails closed when the official careers page or AppOne location contract changes', async () => {
  const inteva = await loadModule()

  await assert.rejects(
    inteva.createIntevaProductsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected careers page</h1></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    inteva.createIntevaProductsScraper().run({
      fetchText: async (url) => {
        if (url === inteva.CAREERS_URL) return officialCareersHtml
        return '<html><body><h1>Unexpected AppOne board</h1></body></html>'
      },
    }),
    /verified public appone board/i,
  )

  await assert.rejects(
    inteva.createIntevaProductsScraper().run({
      fetchText: async (url) => {
        if (url === inteva.CAREERS_URL) return officialCareersHtml
        return apponeLandingHtml.replace(
          '</select>',
          '<option value="900001">Maharashtra, Pune</option></select>',
        )
      },
    }),
    /now exposes india locations/i,
  )
})
