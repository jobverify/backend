import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers } from '../../scraper-support/providers/index.js'
import { CAREERS_URL, extractJobs } from './script.js'
const legacy = 'https://winman.in/jobs/resumedetail.aspx', current = 'https://winman.in/jobs/resume.aspx'
const anchor = (url, attributes = '') => `<a ${attributes} href="${url}">Apply now</a>`
const page = application => `<title>Careers for Experience Candidates - Winman Software</title><table id="experienced_table"><tr><th>Designation and Job Profile</th><th>Experience</th></tr><tr><td><h5>Senior Accountant</h5>Overseeing the finalisation of accounts.</td><td>CA Articleship completed</td></tr><tr><td><h5>Electrical Maintenance Supervisor</h5>Supervising maintenance of electrical systems.</td><td>2 years</td></tr></table>${application}`
const scraper = buildScrapers().find(item => item.name === 'winmansoftware')
const evaluate = async (application, accept, expectedURL = legacy) => {
  const html = page(application), calls = []
  let direct, registered
  try { direct = { accepted: true, jobs: extractJobs(html) } } catch { direct = { accepted: false } }
  try { registered = { accepted: true, jobs: await scraper.run({ fetchText: async url => { calls.push(url); return html } }) } } catch { registered = { accepted: false } }
  assert.deepEqual(calls, [CAREERS_URL])
  assert.deepEqual({ direct: direct.accepted, registered: registered.accepted }, { direct: accept, registered: accept })
  if (accept) {
    for (const result of [direct, registered]) { assert.equal(result.jobs.length, 2); assert.deepEqual(result.jobs.map(job => job.applyUrl), [expectedURL, expectedURL]) }
    assert.deepEqual(registered.jobs.map(job => job.link), [expectedURL, expectedURL])
  }
}
for (const url of [legacy, current]) test('Winman rejects malformed equals-href token for ' + url, () => evaluate(`<a id="candidate" =href="${url}">Apply now</a>`, false))
test('Winman rejects unsupported equals attribute before an otherwise valid href', () => evaluate(`<a =data-marker="x" href="${legacy}">Apply now</a>`, false))
test('Winman rejects repeated leading equals before href', () => evaluate(`<a ==href="${legacy}">Apply now</a>`, false))
test('Winman rejects click preventDefault on the active parent', () => evaluate(`<div onclick="event.preventDefault()">${anchor(legacy)}</div>`, false))
test('Winman rejects click handler on a higher active ancestor', () => evaluate(`<section onclick="event.preventDefault()"><div>${anchor(legacy)}</div></section>`, false))
test('Winman rejects active pointer handler without evaluating its code', () => evaluate(`<div onpointerdown="event.preventDefault()">${anchor(legacy)}</div>`, false))
test('Winman rejects active ancestor handler even when its body looks harmless', () => evaluate(`<div onclick="return true">${anchor(current)}</div>`, false, current))
test('Winman retains the existing own-handler rejection', () => evaluate(anchor(legacy, 'onclick="event.preventDefault()"'), false))
for (const url of [legacy, current]) test('Winman keeps an ordinary literal positive for ' + url, () => evaluate(anchor(url), true, url))
test('Winman supports ASCII whitespace before the genuine href token', () => evaluate(`<a id="candidate"\n\t href="${legacy}">Apply now</a>`, true))
test('Winman treats equals inside a quoted data value as data', () => evaluate(anchor(legacy, `data-note="=href='not-an-attribute'"`), true))
test('Winman treats handler words inside a quoted data value as data', () => evaluate(anchor(legacy, 'data-note="onclick=event.preventDefault()"'), true))
test('Winman keeps a boolean non-handler attribute before href', () => evaluate(anchor(legacy, 'data-marker'), true))
test('Winman ignores active handlers on a non-ancestor sibling', () => evaluate(`<div onclick="event.preventDefault()">Unrelated menu</div>${anchor(legacy)}`, true))
test('Winman keeps malformed/handler markup in scripts inert', () => evaluate(`<script>const x='<div onclick="event.preventDefault()"><a =href="${current}">Apply now</a></div>';</script>${anchor(legacy)}`, true))
test('Winman keeps template and hidden handler carriers outside the visible ancestry', () => evaluate(`<template><div onclick="event.preventDefault()"><a =href="${current}">Apply now</a></div></template><div hidden onclick="event.preventDefault()">${anchor(current)}</div>${anchor(legacy)}`, true))
for (const [label, separator] of [['space', ' '], ['tab', '\t'], ['line feed', '\n'], ['form feed', '\f'], ['carriage return', '\r']]) test('Winman preserves HTML ASCII ' + label + ' around an attribute equals', () => evaluate(`<a href${separator}=${separator}"${legacy}">Apply now</a>`, true))
for (const [label, separator] of [['NBSP', '\u00a0'], ['vertical tab', '\u000b'], ['line separator', '\u2028']]) test('Winman does not qualify ' + label + ' inside a putative href name', () => evaluate(`<a href${separator}="${legacy}">Apply now</a>`, false))
for (const [label, separator] of [['NBSP', '\u00a0'], ['vertical tab', '\u000b']]) test('Winman does not skip ' + label + ' to discover an attribute', () => evaluate(`<a data-note="x"${separator}href="${legacy}">Apply now</a>`, false))
