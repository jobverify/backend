import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import { extractJobDetail } from './script.js'

const fixture = id => gunzipSync(readFileSync(new URL(`./fixtures/20261113/${id}.html.gz`, import.meta.url))).toString()

test('Alstom retains current Perceived Quality Lead Engineer requirements after nested description spans', () => {
  const job = extractJobDetail(fixture('1392774833'))
  assert.match(job.jobDescription, /Managing digital mock-ups and producing related KPIs/)
  assert.match(job.jobDescription, /Degree in Mechanical Engineering, Industrial Design, or a related field/)
  assert.match(job.jobDescription, /Ability to manage multiple priorities and meet deadlines/)
  assert.match(job.jobDescription, /We’re committed to creating an inclusive workplace for everyone\./)
  assert.ok(job.requiredSkills.includes('Strong communication and problem-solving skills'))
})

test('Alstom retains every current Digital Solutions Technical Lead duty after the first styled span', () => {
  const job = extractJobDetail(fixture('1453219233'))
  assert.match(job.jobDescription, /Lead the design and implementation of scalable digital architectures supporting rail system operations and/)
  assert.ok(job.requiredSkills.includes('analytics.'))
  assert.match(job.jobDescription, /Strong understanding of cybersecurity standards and digital safety protocols in rail systems\./)
  assert.match(job.jobDescription, /Grow your career through continuous learning and professional development programs\./)
})

test('Alstom descriptions keep complete visible text while excluding hidden individual criteria and ancestors', () => {
  const html = `<html><head><style>.concealed { opacity: 0 }</style></head><body>
    <span itemprop="description"><p>Build rail systems <span>with TypeScript</span> and Python.</p>
      <p style="opacity:0">Hidden opacity requirement</p><div hidden><p>Hidden ancestor requirement</p></div>
      <ul><li>First visible qualification</li><li class="concealed">Hidden stylesheet qualification</li><li>Last visible qualification</li></ul>
    </span></body></html>`
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, 'Build rail systems with TypeScript and Python. - First visible qualification - Last visible qualification')
  assert.deepEqual(job.requiredSkills, ['First visible qualification', 'Last visible qualification'])
})

test('Alstom cannot use description text inside a hidden ancestor as source criteria', () => {
  const job = extractJobDetail('<div style="display:none"><span itemprop="description"><p>Private stale requirement</p></span></div>')
  assert.equal(job.jobDescription, null)
  assert.deepEqual(job.requiredSkills, [])
})

test('Alstom preserves decoded text in every native criteria fragment and qualification', () => {
  const job = extractJobDetail('<span itemprop="description"><p>Use A &amp; B &bull; C.</p><ul><li>Read O&#39;Reilly material</li></ul></span>')
  assert.equal(job.jobDescription, "Use A & B • C. - Read O'Reilly material")
  assert.deepEqual(job.requiredSkills, ["Read O'Reilly material"])
})

test('Alstom cannot use description text positioned outside normal page flow as source criteria', () => {
  const job = extractJobDetail('<div style="position:absolute;left:-10000px"><span itemprop="description"><p>Offscreen stale requirement</p></span></div>')
  assert.equal(job.jobDescription, null)
  assert.deepEqual(job.requiredSkills, [])
})

test('Alstom does not remove a hiding style when its top-level anti-clickjack script no longer matches', () => {
  const html = fixture('1392774833').replace('if (self === top)', 'if (false)')
  assert.equal(extractJobDetail(html).jobDescription, null)
})

for (const type of ['application/json', 'text/plain']) test(`Alstom cannot use a ${type} script as evidence that body hiding is removed`, () => {
  const html = fixture('1392774833').replace('type="text/javascript" id="antiClickJackScript"', `type="${type}" id="antiClickJackScript"`)
  assert.equal(extractJobDetail(html).jobDescription, null)
})

test('Alstom cannot use a nomodule script as evidence that body hiding is removed', () => {
  const html = fixture('1392774833').replace('id="antiClickJackScript"', 'id="antiClickJackScript" nomodule')
  assert.equal(extractJobDetail(html).jobDescription, null)
})

test('Alstom cannot use inline script text when an empty external src attribute suppresses execution', () => {
  const html = fixture('1392774833').replace('id="antiClickJackScript"', 'id="antiClickJackScript" src=""')
  assert.equal(extractJobDetail(html).jobDescription, null)
})

test('Alstom does not normalize a changed quoted element identity into the known anti-clickjack script', () => {
  const html = fixture('1392774833').replace('document.getElementById("antiClickjack")', 'document.getElementById("antiClick jack")')
  assert.equal(extractJobDetail(html).jobDescription, null)
})

test('Alstom cannot use source criteria in an ancestor positioned offscreen by a stylesheet', () => {
  const html = '<style>.offscreen{position:absolute;left:-10000px}</style><div class="offscreen"><span itemprop="description"><p>Offscreen stale requirement</p></span></div>'
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, null)
  assert.deepEqual(job.requiredSkills, [])
})

test('Alstom excludes individual criteria clipped through stylesheet selectors while retaining visible criteria', () => {
  const html = '<style>.job .clipped{position:absolute;clip:rect(0,0,0,0)}</style><div class="job"><span itemprop="description"><p>Visible duty.</p><ul><li class="clipped">Offscreen qualification</li><li>Visible qualification</li></ul></span></div>'
  const job = extractJobDetail(html)
  assert.equal(job.jobDescription, 'Visible duty. - Visible qualification')
  assert.deepEqual(job.requiredSkills, ['Visible qualification'])
})
