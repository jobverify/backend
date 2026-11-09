import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Goldi password gate reports unavailable public inventory instead of empty success', async () => {
  await assert.rejects(scraper.createGoldiSolarScraper().run({ fetchText: async () => fixture('goldi-career.html') }), /password.protected|password gate/i)
})
