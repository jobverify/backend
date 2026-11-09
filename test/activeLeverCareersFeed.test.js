import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { activeLeverCareersFeeds } from '../scraper-support/utils/activeLeverCareersFeed.js'
import { readNativeDocument } from '../scraper-support/utils/activeNativeHtml.js'
import { createCatalogScraper, getScraperCatalog } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'

const fixtureDir = new URL('../scraper/cloudinary/fixtures/current-20261029/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('manifest.json', fixtureDir), 'utf8'))
const records = new Map(manifest.requests.map(receipt => {
  const body = gunzipSync(readFileSync(new URL(receipt.filename, fixtureDir)))
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.bodySHA256)
  return [receipt.requestedURL, { ...receipt, body: body.toString('utf8') }]
}))
const page = records.get('https://cloudinary.com/careers/jobs').body
const feedURL = 'https://api.lever.co/v0/postings/cloudinary?mode=json'
const inline = readNativeDocument(page).nodes(node => node.tag === 'script' && node.raw?.includes('ACCOUNT_NAME'))[0].raw
const minimal = `<div id="job-listings"></div><script>${inline}</script>`

test('captured active Cloudinary renderer binds the exact Lever account through its current fetch data flow', () => {
  assert.deepEqual(activeLeverCareersFeeds(readNativeDocument(page)), [feedURL])
  assert.deepEqual(activeLeverCareersFeeds(readNativeDocument(minimal)), [feedURL])
})

test('quoted endpoints, inactive scripts and an uncalled or broken renderer cannot bind a tenant', () => {
  const mutations = [
    `<!--${minimal}-->`, `<template>${minimal}</template>`,
    minimal.replace('<script>', '<script type="application/json">'),
    minimal.replace('<script>', '<script nomodule>'),
    minimal.replace("const ACCOUNT_NAME =", 'let ACCOUNT_NAME ='),
    minimal.replace("'cloudinary'", "'../other'"),
    minimal.replace('fetch(API_URL)', 'fetch(OLD_URL)'),
    minimal.replace('const jobs = await fetchJobs();', 'const jobs = [];'),
    minimal.replace('renderJobs(jobs);', 'renderJobs([]);'),
    minimal.replace('\ninitJobBoard();', '\n// initJobBoard();'),
    minimal.replace('id="job-listings"', 'id="unrelated"'),
    `<div id="job-listings"></div><script>const example = ${JSON.stringify(feedURL)}</script>`,
  ]
  for (const html of mutations) {
    assert.notEqual(html, minimal)
    assert.deepEqual(activeLeverCareersFeeds(readNativeDocument(html)), [])
  }
})

test('registered Cloudinary scraper consumes the captured current native feed without declaring company-wide emptiness', async () => {
  const provider = getScraperCatalog().find(row => row.source === 'cloudinary')
  const jobs = await createCatalogScraper(provider).run({
    fetchPage: async url => {
      const response = records.get(url)
      if (response) return { status: response.status, url: response.finalURL, html: response.body }
      if (url === provider.companyCareerPage) return { status: 200, url, html: '<a href="/careers/jobs">Open roles</a>' }
      return { status: 404, url, html: '' }
    },
    fetchJson: async url => { assert.equal(url, feedURL); return JSON.parse(records.get(url).body) },
  })
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).firstParty, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
})
