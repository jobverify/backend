import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Orchids accepts the verified Admissions 2027-28 navigation and preserves five India role categories', async () => {
  const home = fixture('k12-home.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  const jobs = await scraper.run({ fetchText: async url => url === scraper.HOMEPAGE_URL ? home : fixture('k12-career.html') })
  assert.equal(jobs.length, 5)
  assert.ok(jobs.every(job => job.country === 'India' && job.applyUrl.startsWith('mailto:careers@orchids.edu.in')))
})

test('Orchids keeps identity and matched role inventory validation', () => {
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('k12-home.html').replaceAll('info@orchids.edu.in', 'info@example.org')), false)
  assert.throws(() => scraper.extractPublicListings(fixture('k12-career.html').replace('>Sports</option>', '>Football</option>')), /hiring page changed/)
})
