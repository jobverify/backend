import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { publicPostingDescription } from '../rewriting/publicPostingDescription.js'
import { inferExperienceFromPublicPageHtml } from '../scraper-support/utils/publicExperienceEnrichment.js'
import { hasSourceDescription } from '../src/utils/jobSourceContent.js'

const fixture = () => JSON.parse(readFileSync(new URL('../scraper-support/tests/fixtures/rippling/native-role.json', import.meta.url), 'utf8'))
const job = {
  source: 'rippling', company: 'Rippling', title: 'Director of Product, Global Tax Platform',
  jobId: 'd8797dce-0abf-406a-bf5f-0f288b9800ad', country: 'India', location: 'Bangalore, India',
  sourceUrl: 'https://ats.rippling.com/rippling/jobs/d8797dce-0abf-406a-bf5f-0f288b9800ad',
  sourceDescription: null,
}
const html = value => `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(value)}</script>`
const post = value => value.props.pageProps.apiData.jobPost

test('recovers original Rippling employer HTML from the bound native role page without JobPosting schema', () => {
  const value = fixture()
  const recovered = publicPostingDescription(job, html(value), job.sourceUrl)
  assert.equal(recovered?.description, `${post(value).description.company}\n${post(value).description.role}`)
  assert.equal(recovered?.evidence.jobId, 'd8797dce-0abf-406a-bf5f-0f288b9800ad')
})

test('existing public enrichment promotes Rippling native content into the canonical source description', () => {
  const value = fixture()
  const result = inferExperienceFromPublicPageHtml(job, { status: 200, url: job.sourceUrl, html: html(value) })
  assert.equal(hasSourceDescription(result), true)
  assert.ok(result.sourceDescription.includes(post(value).description.role))
  assert.equal(result.title, job.title)
  assert.equal(result.country, 'India')
  assert.equal(job.sourceDescription, null)
})

test('Rippling rejects conflicting role, board, employer, title, location and native URL identities', () => {
  const changes = [
    value => { post(value).uuid = 'another-role' },
    value => { post(value).name = 'Another position' },
    value => { post(value).companyName = 'Another employer' },
    value => { post(value).url = 'https://ats.rippling.com/rippling/jobs/another-role' },
    value => { post(value).board.slug = 'another-board' },
    value => { value.props.pageProps.apiData.jobBoard.companyName = 'Another employer' },
    value => { value.props.pageProps.apiData.jobBoard.slug = 'another-board' },
    value => { value.query.jobId = 'another-role' },
    value => { value.query.jobBoardSlug = 'another-board' },
    value => { post(value).workLocations = ['London, United Kingdom'] },
    value => { value.props.pageProps.apiData.workLocations = ['London, United Kingdom'] },
  ]
  for (const change of changes) {
    const value = fixture()
    change(value)
    assert.equal(publicPostingDescription(job, html(value), job.sourceUrl), null)
  }
  assert.equal(publicPostingDescription({ ...job, jobId: 'another-role' }, html(fixture()), job.sourceUrl), null)
})

test('Rippling only trusts its exact native HTTPS role host and successful matching responses', () => {
  const content = html(fixture())
  for (const sourceUrl of [job.sourceUrl.replace('ats.rippling.com', 'unrelated.example'), job.sourceUrl.replace('https:', 'http:')]) {
    assert.equal(publicPostingDescription({ ...job, sourceUrl }, content, sourceUrl), null)
  }
  assert.equal(publicPostingDescription(job, content, 'https://ats.rippling.com/rippling/jobs'), null)
  for (const response of [{ status: 403, url: job.sourceUrl }, { status: 200, url: 'https://unrelated.example/' }]) {
    assert.equal(hasSourceDescription(inferExperienceFromPublicPageHtml(job, { ...response, html: content })), false)
  }
})

test('Rippling rejects ambiguous, inactive, malformed and role-free payloads', () => {
  const content = html(fixture())
  const noRole = fixture()
  post(noRole).description.role = ''
  const placeholder = fixture()
  post(placeholder).description.role = 'Description coming soon'
  for (const page of [content + content, `<template>${content}</template>`, `<div hidden>${content}</div>`,
    '<script id="__NEXT_DATA__" type="application/json">{broken</script>', html(noRole), html(placeholder)]) {
    assert.equal(publicPostingDescription(job, page, job.sourceUrl), null)
  }
})

test('Rippling recovery preserves an existing canonical employer description', () => {
  const sourceDescription = '<p>Existing verified original employer content.</p>'
  const result = inferExperienceFromPublicPageHtml({ ...job, sourceDescription }, { status: 200, url: job.sourceUrl, html: html(fixture()) })
  assert.equal(result.sourceDescription, sourceDescription)
})
