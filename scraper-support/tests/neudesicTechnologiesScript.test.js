import assert from 'node:assert/strict'
import test from 'node:test'
import { createNeudesicTechnologiesScraper } from '../../scraper/neudesictechnologies/script.js'

test('Neudesic rejects its retired LinkedIn handoff shell instead of reporting no jobs', async () => {
  await assert.rejects(createNeudesicTechnologiesScraper().run({ fetchText: async () =>
    '<title>Careers - Neudesic</title><h2>Search India Openings by Region</h2>'
    + '<a href="https://www.linkedin.com/jobs/search/">India openings</a><p>Neudesic is an IBM subsidiary</p>',
  }), /no longer matches/i)
})
