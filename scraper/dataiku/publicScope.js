import { createHash } from 'node:crypto'
import { captureActiveHiringScope } from '../../scraper-support/shared/kekaCurrentSourceScope.js'
import { rawScriptNodes, rawElementNodes } from '../biofourmis/scriptExecution.js'

const HOME = 'https://www.dataiku.com/company/careers'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const sorted = value => Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
const need = (condition, reason) => { if (!condition) throw Error('Dataiku current public scope: ' + reason) }
const reviewed = Object.freeze({
  graphHash: 'fc93e83a318fbdead357512ed9a0b5e3ed193888ab40b4489f7988848e205204',
  nonFlightScriptHash: 'e341255c8320450a82d2919e69205cc053ff40a63af6de418b892c2f0ec8166a',
  nonFlightAttributeHash: '623d35d5f2dde7e355b748f742b19e144f864706cac80a1c097a4e3202b9b143',
  nonDynamicScopeHash: '40b100cbe2914a5c1857a9cb68a2a912c554af9004a8a01029b169a2ac4ba6b2',
  resourceHintHash: 'bdc0dfd5b52b641048a912145b7e85bf2b9b65339260b1ceeefdedadf40c9e81',
})

// Parse the current finite Flight wire grammar as data. Record IDs, reference
// numbers, frame sizes and delivery order are transport details; every model,
// import, resource hint, value and reference relationship remains in the proof.
function flightRecords(chunks) {
  const bytes = Buffer.from(chunks.join(''), 'utf8'), records = new Map(), hints = []
  need(bytes.length <= 2 * 1024 * 1024, 'Flight byte bound')
  const decode = value => new TextDecoder('utf8', { fatal: true }).decode(value)
  let cursor = 0
  while (cursor < bytes.length) {
    if (bytes[cursor] === 10) { cursor++; continue }
    const colon = bytes.indexOf(58, cursor)
    need(colon >= cursor && colon - cursor <= 12, 'record header')
    const id = decode(bytes.subarray(cursor, colon))
    need(id === '' || /^[0-9a-f]+$/.test(id) && !records.has(id), 'duplicate or unsupported record identity')
    cursor = colon + 1
    if (bytes[cursor] === 84) {
      const comma = bytes.indexOf(44, cursor), hex = decode(bytes.subarray(cursor + 1, comma))
      need(id && comma > cursor && /^[0-9a-f]+$/.test(hex), 'text length header')
      const length = Number.parseInt(hex, 16), end = comma + 1 + length
      need(Number.isSafeInteger(length) && length >= 0 && end <= bytes.length, 'text length bound')
      records.set(id, { kind: 'text', value: decode(bytes.subarray(comma + 1, end)) })
      cursor = end
    } else {
      const end = bytes.indexOf(10, cursor)
      need(end >= cursor, 'incomplete record')
      const raw = decode(bytes.subarray(cursor, end))
      if (!id) {
        need(raw.startsWith('HL'), 'unreviewed resource hint')
        const value = JSON.parse(raw.slice(2))
        need(Array.isArray(value), 'resource hint shape')
        hints.push(value)
      } else if (raw.startsWith('I')) records.set(id, { kind: 'import', value: JSON.parse(raw.slice(1)) })
      else records.set(id, { kind: 'model', value: JSON.parse(raw) })
      cursor = end + 1
    }
    need(records.size <= 512 && hints.length <= 512, 'record count bound')
  }
  need(records.has('0'), 'missing route root')
  const root = records.get('0')
  need(root.kind === 'model' && JSON.stringify(root.value?.c) === '["","company","careers"]', 'route root identity')
  return { records, hints }
}

function graphHash(records) {
  const active = new Set(), memo = new Map()
  let visited = 0
  const encode = (value, refs = true, depth = 0) => {
    need(depth <= 100 && ++visited <= 100000, 'graph depth or node bound')
    if (typeof value === 'string') {
      const ref = refs && value.match(/^\$(L|@|W)?([0-9a-f]+)$/)
      return ref ? ['reference', ref[1] || 'value', recordHash(ref[2], depth + 1)] : ['string', value]
    }
    if (value === null) return ['null']
    if (Array.isArray(value)) return ['array', value.map(item => encode(item, refs, depth + 1))]
    if (typeof value === 'object') return ['object', sorted(value).map(([key, child]) => [key, encode(child, refs, depth + 1)])]
    need(['number', 'boolean'].includes(typeof value), 'unsupported model scalar')
    return [typeof value, value]
  }
  const recordHash = (id, depth = 0) => {
    if (memo.has(id)) return memo.get(id)
    need(!active.has(id) && records.has(id), 'cyclic or missing reference')
    active.add(id)
    const record = records.get(id)
    const representation = record.kind === 'text' ? ['text', record.value]
      : [record.kind, encode(record.value, record.kind === 'model', depth + 1)]
    const digest = hash(representation)
    memo.set(id, digest); active.delete(id)
    return digest
  }
  const hashes = [...records.keys()].map(id => recordHash(id)).sort()
  return hash({ root: recordHash('0'), records: hashes })
}

export const captureCurrentPublicScope = html => {
  try {
    const scripts = rawScriptNodes(html), chunks = [], dataScripts = new Set()
    let dataStarted = false
    for (const script of scripts) {
      const raw = script.raw.trim()
      if (!raw.startsWith('self.__next_f.push(')) {
        need(!dataStarted, 'unreviewed script after Flight stream')
        continue
      }
      need(Object.keys(script.attrs).length === 0, 'Flight executable mode/attributes')
      const call = raw.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/)
      need(call, 'Flight statement envelope')
      const frame = JSON.parse(call[1])
      need(Array.isArray(frame) && frame.length === 2 && frame[0] === 1 && typeof frame[1] === 'string', 'Flight frame shape')
      dataStarted = true; chunks.push(frame[1]); dataScripts.add(script)
    }
    need(chunks.length > 0, 'Flight model unavailable')
    const { records, hints } = flightRecords(chunks)
    let scriptIndex = 0
    const attributes = rawElementNodes(html).filter(node => node.tag !== 'script' || !dataScripts.has(scripts[scriptIndex++]))
      .map(node => [node.tag, sorted(node.attrs)])
    const nonFlight = scripts.filter(script => !dataScripts.has(script)).map(script => [sorted(script.attrs), script.raw])
    const scope = captureActiveHiringScope(html, HOME)
    const proof = {
      graphHash: graphHash(records), nonFlightScriptHash: hash(nonFlight), nonFlightAttributeHash: hash(attributes),
      nonDynamicScopeHash: hash(Object.fromEntries(Object.entries(scope).filter(([key]) => !['scripts', 'activeElementAttributesSha256'].includes(key)))),
      resourceHintHash: hash(hints.map(value => JSON.stringify(value)).sort()),
    }
    const qualified = Object.entries(reviewed).every(([key, value]) => proof[key] === value)
    return { qualified, fingerprint: hash(proof), flightRecords: records.size, flightPackets: chunks.length,
      resourceHints: hints.length, proof, ...(qualified ? {} : { reason: 'current-public-scope-model-or-controls-changed' }) }
  } catch (error) { return { qualified: false, fingerprint: null, reason: error.message } }
}
