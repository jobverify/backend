import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'

import {
  GE_CAREERS_HUB_URL,
  GE_SUBSIDIARY_SOURCES,
  createGeneralElectricScraper,
} from '../../scraper/generalelectric/script.js'
const nativeFAQ = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/generalelectric/test-data/faq-delegation-20261031.json.gz', import.meta.url))))
const fetchPage = async url => {
  assert.equal(url, GE_CAREERS_HUB_URL)
  return structuredClone(nativeFAQ.packets[0])
}

test('General Electric wrapper preserves the three independent company identities after a native FAQ check', async () => {
  const invocationOrder = []
  const scraper = createGeneralElectricScraper({
    geAerospaceRun: async (options) => {
      invocationOrder.push(['geaerospace', options.maxJobs ?? null])
      return [{
        title: 'Aerospace role',
        company: 'GE Aerospace',
        source: 'geaerospace',
      }]
    },
    geVernovaRun: async (options) => {
      invocationOrder.push(['gevernova', options.maxJobs ?? null])
      return [{
        title: 'Vernova role',
        company: 'GE Vernova',
        source: 'gevernova',
      }]
    },
    geHealthCareRun: async (options) => {
      invocationOrder.push(['gehealthcare', options.maxJobs ?? null])
      return [{
        title: 'HealthCare role',
        company: 'GE HealthCare',
        source: 'gehealthcare',
      }]
    },
  })

  const jobs = await scraper.run({ maxJobs: 10, fetchPage })

  assert.equal(GE_CAREERS_HUB_URL, 'https://www.ge.com/faq')
  assert.deepEqual(GE_SUBSIDIARY_SOURCES, ['geaerospace', 'gevernova', 'gehealthcare'])
  assert.deepEqual(invocationOrder, [
    ['geaerospace', 10],
    ['gevernova', 10],
    ['gehealthcare', 10],
  ])
  assert.deepEqual(
    jobs.map((job) => [job.company, job.source, job.title]),
    [
      ['GE Aerospace', 'geaerospace', 'Aerospace role'],
      ['GE Vernova', 'gevernova', 'Vernova role'],
      ['GE HealthCare', 'gehealthcare', 'HealthCare role'],
    ],
  )
})

test('General Electric wrapper applies its final cap without changing independent company ownership', async () => {
  const scraper = createGeneralElectricScraper({
    geAerospaceRun: async () => [
      { title: 'A1', company: 'GE Aerospace', source: 'geaerospace' },
      { title: 'A2', company: 'GE Aerospace', source: 'geaerospace' },
    ],
    geVernovaRun: async () => [
      { title: 'V1', company: 'GE Vernova', source: 'gevernova' },
    ],
    geHealthCareRun: async () => [
      { title: 'H1', company: 'GE HealthCare', source: 'gehealthcare' },
    ],
  })

  const jobs = await scraper.run({ maxJobs: 2, fetchPage })

  assert.deepEqual(
    jobs.map((job) => [job.company, job.title]),
    [
      ['GE Aerospace', 'A1'],
      ['GE Aerospace', 'A2'],
    ],
  )
})
