import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { corporateContract, CAREER_PAGE_URL, BOARD_URL } from './nativeContract.js'
import { run } from './script.js'
import { nativeOptions } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const { corporate, styles } = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/corporate-20261031.json.gz', import.meta.url))))
const currentOptions = (changeCSS = value => value) => {
  const options = nativeOptions()
  return { ...options, fetchImpl: async (url, init) => {
    const packet = url === CAREER_PAGE_URL ? corporate : styles.find(packet => packet.url === url)
    if (packet) return { status: packet.status, url, contentType: packet.contentType, body: url === CAREER_PAGE_URL ? packet.body : changeCSS(packet.body) }
    return options.fetchImpl(url, init)
  } }
}

test('October 31 Webflow popover positioning revision preserves Monocept employer handoff', () => {
  const result = corporateContract(corporate.body, styles.map(packet => packet.body).join('\n'))
  assert.deepEqual(result.reasons, [])
  assert.ok(result.hiringLinks.includes(BOARD_URL))
})

test('current Monocept corporate HTML and CSS reconcile the complete captured native inventory', async () => {
  const jobs = await run(currentOptions())
  assert.equal(jobs.length, 7)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords, 7)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.legalEmployer === 'Monocept Consulting Pvt. Ltd.'))
})

test('changed bytes under the reviewed current Monocept CSS URL cannot activate a hidden handoff', async () => {
  await assert.rejects(run(currentOptions(css => css + '\n.fda-button.careers{display:none}')), /unreviewed current corporate CSS bytes/)
})

for (const [label, change] of [
  ['CSS-hidden handoff', html => html.replace(/class="fda-button careers w-inline-block"/g, 'class="fda-button careers w-inline-block w-condition-invisible"')],
  ['CSS-hidden ancestor', html => html.replace(/<a href="https:\/\/monocept.turbohire.co/g, '<div class="w-condition-invisible"><a href="https://monocept.turbohire.co')],
  ['another employer delegation', html => html.replaceAll(BOARD_URL, 'https://another-employer.example/jobs')],
  ['unreviewed shared stylesheet revision', html => html.replace('shared.04749834d.min.css', 'shared.unreviewed.min.css')],
]) test('current Monocept ' + label + ' cannot establish official delegation', () => {
  const html = change(corporate.body)
  assert.notEqual(html, corporate.body)
  assert.throws(() => corporateContract(html, styles.map(packet => packet.body).join('\n')), /missing visible official careers delegation|unreviewed corporate stylesheet visibility/)
})
