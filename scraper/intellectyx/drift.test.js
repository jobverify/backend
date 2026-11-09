import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as scraper from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = name => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')

test('Intellectyx redesign remains a verified resume-only recruiting page', async () => {
  const home = fixture('intellectyx-home.html')
  const careers = fixture('intellectyx-careers.html')
  assert.equal(scraper.hasOfficialHomepageSignal(home), true)
  assert.equal(scraper.hasOfficialCareersSignal(careers), true)
  assert.deepEqual(await scraper.run({ fetchPage: async url => ({ ok: true, status: 200, url, text: url === scraper.HOMEPAGE_URL ? home : careers }) }), [])
})

test('Intellectyx retains ownership and active-listing guards after its redesign', async () => {
  assert.equal(scraper.hasOfficialHomepageSignal(fixture('intellectyx-home.html').replaceAll('info@intellectyx.com', 'info@example.org')), false)
  await assert.rejects(scraper.run({ fetchPage: async url => ({ ok: true, status: 200, url, text: url === scraper.HOMEPAGE_URL ? fixture('intellectyx-home.html') : fixture('intellectyx-careers.html') + '<h2>Current Openings</h2><a href="/jobs/engineer">Apply Now</a>' }) }), /public job listings/)
})


test('Intellectyx generic resume landing does not certify complete empty inventory', async () => {
  const jobs = await scraper.run({fetchPage:async url => ({ok:true,status:200,url,text:fixture(url === scraper.HOMEPAGE_URL ? 'intellectyx-home.html' : 'intellectyx-careers.html')})})
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
})
