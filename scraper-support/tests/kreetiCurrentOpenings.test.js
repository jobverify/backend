import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createKreetiTechnologiesScraper, extractListings, hasOfficialHomepageSignal, HOMEPAGE_URL, CAREERS_HOME_URL, CANDIDATES_URL } from '../../scraper/kreetitechnologies/script.js'

const fixture = name => readFileSync(new URL(`./fixtures/kreetitechnologies/${name}.html`, import.meta.url), 'utf8')
const homepage = fixture('current-homepage')
const candidates = fixture('current-candidates')

test('Kreeti recognizes its redesigned branded homepage and pinned careers handoff', () => {
  assert.equal(hasOfficialHomepageSignal(homepage), true)
  assert.equal(hasOfficialHomepageSignal(homepage.replaceAll('https://careers.kreeti.com/candidates', 'https://unrelated.example/candidates')), false)
})

test('Kreeti explicit active-section empty state takes precedence over an old general-interest option', async () => {
  assert.deepEqual(extractListings(candidates), [])
  const requests = []
  const jobs = await createKreetiTechnologiesScraper().run({ fetchText: async url => {
    requests.push(url)
    if (url === HOMEPAGE_URL) return homepage
    if (url === CAREERS_HOME_URL) return fixture('careers-home')
    if (url === CANDIDATES_URL) return candidates
    assert.fail('General-interest roles must not be fetched as active vacancies')
  } })
  assert.deepEqual(jobs, [])
  assert.equal(requests.length, 3)
})

test('Kreeti fails closed for ambiguous or contradictory active job sections', () => {
  assert.throws(() => extractListings(candidates.replace('No Open Positions', 'Open Positions')), /candidate jobs|active|openings/i)
  assert.throws(() => extractListings(candidates.replace('No Open Positions', 'No Open Positions <a href="/jobs/48">Agile Project Manager</a>')), /contradict|active|openings/i)
  assert.throws(() => extractListings(candidates.replace('class="jobs"', 'class="old-jobs"')), /candidate jobs|active|openings/i)
})
