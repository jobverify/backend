// Normal production imports. The private genuine current document is optional and never packaged.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { hasCurrentWidget } from './nativeJobs.js'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
const sha = value => createHash('sha256').update(value).digest('hex')
const privateBody = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../artifacts/scraper-all-repair-2026-11-06/apexon-auzmor-ausweg-public-profile-preparation-20261108/output/local-only/002-response.body')
const current = fs.existsSync(privateBody) ? fs.readFileSync(privateBody, 'utf8') : null
if (current !== null) assert.equal(sha(current), '51784bf8bca56bb112d864d31b3ec082eb59607770c529ea8559392523c421fa')
const rows = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-inputs/surface-20261102.json.gz', import.meta.url))))
test('preserves the dated ordinary external widget declaration', () => {
  assert.equal(hasCurrentWidget(rows.findLast(row => row.requestedUrl === 'https://auzmor.com/careers/').html), true)
})
test('private original complete current declaration and finite carrier negatives', { skip: current === null ? 'Private current HTML intentionally excluded from portable delivery' : false }, () => {
  assert.equal(hasCurrentWidget(current), true)
  const doc = document(current)
  const loader = doc.nodes(node => node.tag === 'script' && sha(node.raw || '') === '518eadc7049fed854902042465a561f5ac425cab4f5889e3452bd52f787c5f1d')[0]
  const outer = doc.outer(loader), program = loader.raw
  const widgetOuter = doc.outer(doc.nodes(node => node.tag === 'div' && node.attrs.id === 'widget:careers')[0])
  const mutations = [
    current.replace(/(data_org=)(["'])auzmor\2/, (_m, h, q) => h + q + 'foreign' + q),
    current.replace('https://hire.api.auzmor.com/api/v1/', 'https://unrelated.invalid/api/v1/'),
    current.replace(program, program + ';'),
    current.replace(outer, outer.replace('<script ', '<script async ')),
    current.replace(widgetOuter, widgetOuter.replace(/(data_org=)(["'])auzmor\2/, (_m, h, q) => h + q + 'auzmor' + q + ' data_org=' + q + 'foreign' + q)),
    current.replace('<body ', '<body onclick="return false" '),
    current.replace('</body>', '<div hidden>' + widgetOuter + '</div></body>'),
    current.replace('</body>', '<div hidden>' + outer + '</div></body>'),
    current.replace(outer, '').replace('</body>', outer + '</body>'),
    current.replace('</body>', '<link hidden rel="canonical" href="https://unrelated.invalid/"></body>'),
  ]
  for (const mutation of mutations) {
    assert.notEqual(mutation, current)
    assert.equal(hasCurrentWidget(mutation), false)
  }
})

// New-inline admission binds the complete selected canonical, unlike the untouched old branch.
test('private current selected canonical raw carrier and head context stay strict', { skip: current === null ? 'Private current HTML intentionally excluded from portable delivery' : false }, () => {
  const doc = document(current)
  const canonical = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')[0]
  const outer = doc.outer(canonical)
  const replacements = [
    outer.replace(/\s*\/?>$/, ' href="https://unrelated.invalid/">'),
    outer.replace(/\s*\/?>$/, ' rel="alternate">'),
    outer.replace('<link ', '<link onload="return false" '),
  ]
  for (const replacement of replacements) {
    const mutation = current.replace(outer, replacement)
    assert.notEqual(mutation, current)
    assert.equal(hasCurrentWidget(mutation), false)
    // Historical external-script admission is deliberately unchanged.
    assert.equal(hasCurrentWidget(mutation.replace('</body>', '<script src="https://hire.auzmor.com/widget.js"></script></body>')), true)
  }
})
