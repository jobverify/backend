import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Ellenbarrie missing application form reports unavailable inventory rather than zero', async () => {
  await assert.rejects(scraper.run({ fetchPage: async url => ({ status: 200, url, html: url === scraper.HOMEPAGE_URL ? fixture('ellen-home.html') : fixture('ellen-career.html') }) }), /contact form.*(?:missing|unavailable|not found)/i)
})
