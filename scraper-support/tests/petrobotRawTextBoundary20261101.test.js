import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as petro from '../../scraper/petrobot/script.js'
import { readVisibleNativeDocument } from '../utils/visibleNativeHtml.js'

const native = JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/petrobot/native-captures/2026-11-01-declared-api.json.gz', import.meta.url))))
const original = native.officialBody, board = petro.SMARTRECRUITERS_BOARD_URL
const activeAnchors = html => readVisibleNativeDocument(html, { strict: true }).nodes(node => node.tag === 'a').length
const injectInert = (html, separator) => {
  const literal = '</script' + separator + '><a href="' + board + '">View all positions on SmartRecruiters</a>'
  return html.replace(/<body\b[^>]*>/i, opening => opening + '<script>const controlledInertText = ' + JSON.stringify(literal) + ';</script>')
}

for (const [label, separator] of [['NBSP', '\u00a0'], ['line separator', '\u2028']]) {
  test(`PetroBot keeps the actual active handoff when inert script text contains a ${label} closing lookalike`, async () => {
    const variant = injectInert(original, separator)
    assert.notEqual(variant, original)
    assert.equal(petro.hasOfficialCareersSignal(original), true)
    assert.equal(petro.extractVerifiedJobsBoardUrl(original), board)
    assert.equal(petro.hasOfficialCareersSignal(variant), true)
    assert.equal(activeAnchors(variant), activeAnchors(original))
    assert.equal(petro.extractVerifiedJobsBoardUrl(variant), board)
    let official = 0, api = 0
    const marker = Object.assign(Error('controlled API stop after valid handoff'), { abortRetries: true })
    await assert.rejects(petro.run({
      fetchText: async url => { official++; assert.equal(url, petro.CAREERS_URL); return variant },
      fetchJson: async () => { api++; throw marker },
    }), error => error === marker)
    assert.equal(official, 1)
    assert.equal(api, 1)
  })
}

test('PetroBot never promotes an inert account link when the actual active handoff is foreign', async () => {
  const variant = injectInert(original.replaceAll(board, 'https://careers.smartrecruiters.com/ControlledOtherAccount'), '\u00a0')
  assert.equal(petro.hasOfficialCareersSignal(variant), true)
  assert.equal(petro.extractVerifiedJobsBoardUrl(variant), null)
  let api = 0
  await assert.rejects(petro.run({ fetchText: async () => variant, fetchJson: async () => { api++; throw Error('must not request API') } }), /handoff changed/)
  assert.equal(api, 0)
})
