import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import {
  CAREERS_URL,
  COMPANY,
  CONTACT_URL,
  FORM_URL,
  HOMEPAGE_URL,
  SOURCE,
  createWyreflowTechnologiesScraper,
  extractOfficialFormLinks,
  hasCareerPageSignal,
  hasContactPageSignal,
  hasHomepageSignal,
  hasPublicJobsSignal,
} from './script.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const readFixture = (name) => readFileSync(path.join(currentDir, 'fixtures', name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careerHtml = readFixture('career.html')
const contactHtml = readFixture('contact.html')

test('Wyreflow Technologies sentinel pins the verified official marketing careers surface and Google Forms handoff', () => {
  assert.equal(SOURCE, 'wyreflowtechnologies')
  assert.equal(COMPANY, 'Wyreflow Technologies')
  assert.equal(HOMEPAGE_URL, 'https://wyreflow.com/')
  assert.equal(CAREERS_URL, 'https://wyreflow.com/pages-html/career.html')
  assert.equal(CONTACT_URL, 'https://wyreflow.com/pages-html/contact.html')
  assert.equal(FORM_URL, 'https://forms.gle/7kn4tq2x9L9SaG3e9')
  assert.equal(hasHomepageSignal(homepageHtml), true)
  assert.equal(hasCareerPageSignal(careerHtml), true)
  assert.equal(hasContactPageSignal(contactHtml), true)
  assert.deepEqual(extractOfficialFormLinks(careerHtml), [FORM_URL])
  assert.deepEqual(extractOfficialFormLinks(contactHtml), [FORM_URL])
  assert.equal(hasPublicJobsSignal(homepageHtml), false)
  assert.equal(hasPublicJobsSignal(careerHtml), false)
  assert.equal(hasPublicJobsSignal(contactHtml), false)
})

test('Wyreflow Technologies sentinel returns no jobs only while the verified official marketing pages still point to the same Google Forms handoff', async () => {
  const requestedUrls = []
  const jobs = await createWyreflowTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careerHtml
      if (url === CONTACT_URL) return contactHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    HOMEPAGE_URL,
    CAREERS_URL,
    CONTACT_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Wyreflow Technologies sentinel fails closed when the verified official surface drifts into a public jobs listing or changes the handoff', async () => {
  await assert.rejects(
    createWyreflowTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return '<html><body><h1>Wyreflow</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    createWyreflowTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) {
          return careerHtml.replace(
            '</body>',
            '<section><h2>Current Openings</h2><a href="/jobs/platform-engineer">Apply now</a></section></body>',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /career page now appears to expose public jobs/i,
  )

  await assert.rejects(
    createWyreflowTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return careerHtml
        if (url === CONTACT_URL) {
          return contactHtml.replace(FORM_URL, 'https://forms.gle/replacedContract')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official Google Forms handoff/i,
  )
})
