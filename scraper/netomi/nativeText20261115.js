import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {types, isDeepStrictEqual} from 'node:util'
import {decodeHTMLStrict} from 'entities'
import {criteria} from '../../scraper-support/native-sources/declaredJobFeeds/nativeData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile = JSON.parse(readFileSync(new URL('./reviewedNativeText20261115.json', import.meta.url), 'utf8'))
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const templateBytes = gunzipSync(Buffer.from(profile.templatesGzipBase64, 'base64'))
if (sha(templateBytes) !== profile.templatesSHA256) throw Error('Netomi static template integrity conflict')
const templates = JSON.parse(templateBytes)
const clone = value => structuredClone(value)
const fail = message => Object.assign(Error('Netomi own native text coverage gap: ' + message), {
  name: 'NetomiNativeTextCoverageError', softFailure: true, failureKind: 'coverage_gap',
  sourceScopeComplete: false, lifecycleCleanupAllowed: false,
})
const need = (condition, message) => {if (!condition) throw fail(message)}
const exactKeys = (value, keys, label) => need(value && !Array.isArray(value) && typeof value === 'object'
  && isDeepStrictEqual(Object.keys(value).sort(), [...keys].sort()), 'Unreviewed ' + label + ' fields')
const wellFormed = value => typeof value === 'string' && value.isWellFormed() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
const scalar = raw => {
  need(wellFormed(raw) && !/[<>\"]/.test(raw), 'Unknown markup/control in human scalar')
  const decoded = decodeHTMLStrict(raw)
  need(wellFormed(decoded) && !/<[!/?a-z]/i.test(decoded), 'Unknown encoded scalar markup')
  return decoded
}
const plainString = value => need(wellFormed(value) && !/[<>]/.test(decodeHTMLStrict(value)), 'Unknown plain/carrier-string HTML')
const humanText = (value, join = ' ') => decodeHTMLStrict(value.replace(/<[^>]*>/g, join)).replace(/\s+/gu, ' ').trim()
const unavailable = text => /\b(?:this|the) (?:job|role|position|vacancy) (?:is|was|has been) (?:(?:now|currently|already) )?(?:closed|filled|expired|unavailable|on hold)\b|\bno longer accepting applications\b/i.test(text)
const intake = text => /\b(?:talent (?:pool|community)|general applications?|expressions? of interest|future opportunities|not (?:an? )?(?:active|specific|current) (?:job|role|vacancy))\b/i.test(text)
const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)
export const NETOMI_NATIVE_LIMITS = Object.freeze({maxRequests: 22, sourceTimeoutMs: 45000,
  requestTimeoutMs: 15000, maxEntityBytes: 1048576, maxFeedBytes: 524288,
  maxAggregateBytes: 24000000, pacingMs: 500})

// JSON.parse alone loses duplicate decoded keys and original numeric tokens.
// This bounded JSON reader keeps complete token spans and never accepts JS literals.
const strictJSON = text => {
  let at = 0
  const spans = new Map(), space = () => {while (/[ \n\r\t]/.test(text[at] ?? '') && at < text.length) at++}
  const string = () => {
    need(text[at] === '"', 'Expected JSON string')
    const start = at++
    while (at < text.length) {
      const code = text.charCodeAt(at), char = text[at++]
      need(code >= 32, 'Invalid JSON string control')
      if (char === '"') {
        let value
        try {value = JSON.parse(text.slice(start, at))} catch {throw fail('Invalid JSON string')}
        need(wellFormed(value), 'Invalid JSON Unicode/control')
        return value
      }
      if (char === '\\') {
        const escaped = text[at++]
        need(escaped && '"\\/bfnrtu'.includes(escaped), 'Invalid JSON escape')
        if (escaped === 'u') {need(/^[0-9a-f]{4}$/i.test(text.slice(at, at + 4)), 'Invalid JSON Unicode escape'); at += 4}
      }
    }
    throw fail('Unterminated JSON string')
  }
  const parse = (path = [], depth = 0) => {
    need(depth <= 32, 'JSON depth bound')
    space(); const start = at, char = text[at]
    let value
    if (char === '{') {
      value = {}; const keys = new Set(); at++; space()
      if (text[at] === '}') at++
      else for (;;) {
        space(); const key = string(); need(!keys.has(key), 'Duplicate decoded JSON key'); keys.add(key)
        space(); need(text[at++] === ':', 'Missing JSON colon')
        Object.defineProperty(value, key, {value: parse([...path, key], depth + 1), enumerable: true, configurable: true, writable: true})
        space(); const next = text[at++]; if (next === '}') break
        need(next === ',', 'Invalid JSON object separator')
      }
    } else if (char === '[') {
      value = []; at++; space()
      if (text[at] === ']') at++
      else for (;;) {
        value.push(parse([...path, value.length], depth + 1)); space()
        const next = text[at++]; if (next === ']') break
        need(next === ',', 'Invalid JSON array separator')
      }
    } else if (char === '"') value = string()
    else {
      const token = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at))?.[0]
      need(token, 'Invalid JSON token'); at += token.length
      value = token === 'null' ? null : token === 'true' ? true : token === 'false' ? false : Number(token)
      need(typeof value !== 'number' || Number.isFinite(value), 'Invalid JSON number')
    }
    spans.set(JSON.stringify(path), [start, at]); return value
  }
  const value = parse(); space(); need(at === text.length, 'Trailing JSON token')
  return {value, token: path => {const span = spans.get(JSON.stringify(path)); need(span, 'Missing JSON token owner'); return text.slice(...span)}}
}

const nativeKeys = ['additionalPlain', 'additional', 'categories', 'createdAt', 'descriptionPlain', 'description', 'id', 'lists', 'text', 'country', 'workplaceType', 'opening', 'openingPlain', 'descriptionBody', 'descriptionBodyPlain', 'hostedUrl', 'applyUrl']
const categoryKeys = ['commitment', 'department', 'location', 'team', 'allLocations']
const richKeys = ['opening', 'descriptionBody', 'description', 'additional']
const plainKeys = ['openingPlain', 'descriptionBodyPlain', 'descriptionPlain', 'additionalPlain']
const feedModel = text => {
  const parsed = strictJSON(text), records = parsed.value
  need(Array.isArray(records) && records.length < 100, 'Unknown full feed inventory/pagination')
  const rawRows = new Map(), ids = new Set()
  for (const [index, record] of records.entries()) {
    exactKeys(record, nativeKeys, '17-field native row')
    for (const key of nativeKeys.filter(key => !['categories', 'createdAt', 'lists'].includes(key))) need(wellFormed(record[key]), 'Native string required: ' + key)
    need(uuid(record.id) && !ids.has(record.id), 'Invalid or duplicate native UUIDv4'); ids.add(record.id)
    need(record.hostedUrl === profile.boardURL + '/' + record.id && record.applyUrl === record.hostedUrl + '/apply', 'Unbound current returned native URL')
    exactKeys(record.categories, categoryKeys, 'native category')
    for (const key of categoryKeys.filter(key => key !== 'allLocations')) need(wellFormed(record.categories[key]) && record.categories[key].trim(), 'Native category string required')
    need(Array.isArray(record.categories.allLocations) && record.categories.allLocations.every(wellFormed), 'Native allLocations shape')
    need(Array.isArray(record.lists), 'Native criteria list shape')
    for (const section of record.lists) {exactKeys(section, ['text', 'content'], 'native list'); need(wellFormed(section.text) && wellFormed(section.content), 'Native list string required')}
    need(Number.isSafeInteger(record.createdAt) && record.createdAt > 0 && String(record.createdAt) === parsed.token([index, 'createdAt'])
      && Number.isFinite(new Date(record.createdAt).getTime()), 'Invalid canonical native createdAt milliseconds')
    rawRows.set(record.id, parsed.token([index]))
  }
  Object.defineProperty(records, 'rawRows', {value: rawRows})
  return records
}

const variants = new Map(Object.entries(profile.presentation.tagAttributeVariants).map(([tag, attrs]) => [tag,
  new Set(attrs.map(pairs => '<' + tag + pairs.map(([key, value]) => ' ' + key + '="' + value + '"').join('') + '>'))]))
const edges = new Set(profile.presentation.allowedParentChildProductions.map(pair => pair.join('/')))
// Each original tag/text byte is consumed. Only the renderer may generate ULs.
const rich = (text, {start = 0, ownerEnd = false, rendered = false} = {}) => {
  const stack = [], nodes = []; let at = start
  while (at < text.length) {
    if (text[at] !== '<') {
      const end = text.indexOf('<', at), stop = end < 0 ? text.length : end
      const raw = text.slice(at, stop), decoded = decodeHTMLStrict(raw)
      need(wellFormed(raw) && wellFormed(decoded) && !/<[!/?a-z]/i.test(decoded), 'Unknown rich terminal markup/control')
      at = stop; continue
    }
    const close = /^<\/([a-z]+)>/.exec(text.slice(at))
    if (close) {
      if (!stack.length && ownerEnd && close[1] === 'div') break
      const node = stack.pop(); need(node?.tag === close[1], 'Unbalanced rich formatting')
      node.endStart = at; at += close[0].length; node.end = at; continue
    }
    const match = /^<([a-z]+)(?:\s[^<>]*)?>/.exec(text.slice(at)), tag = match?.[1], token = match?.[0]
    need(token && (variants.get(tag)?.has(token) || rendered && tag === 'ul' && token === '<ul>'), 'Unknown rich tag/attribute/control')
    const parent = stack.at(-1), parentTag = parent?.tag ?? 'FRAGMENT'
    const permitted = edges.has(parentTag + '/' + tag) || rendered && (parentTag === 'div' && tag === 'ul' || parentTag === 'ul' && tag === 'li'
      || parentTag === 'div' && !parent.parent && edges.has('FRAGMENT/' + tag))
    need(permitted, 'Unknown rich parent-child production')
    const node = {tag, start: at, parent, children: []}; parent?.children.push(node); nodes.push(node)
    at += token.length
    if (tag === 'br') {node.endStart = at; node.end = at} else stack.push(node)
  }
  need(stack.length === 0 && (ownerEnd || at === text.length), 'Incomplete rich fragment')
  return {end: at, nodes}
}
const renderList = value => {
  const {nodes} = rich(value), seen = new Set(), insertions = []
  for (const node of nodes) {
    if (node.tag !== 'li' || seen.has(node)) continue
    need(!node.parent || node.parent.tag === 'div', 'Unknown list owner')
    const siblings = node.parent?.children ?? nodes.filter(node => !node.parent), run = [node]
    seen.add(node)
    for (const following of siblings.slice(siblings.indexOf(node) + 1)) {
      if (following.tag !== 'li' || value.slice(run.at(-1).end, following.start).trim()) break
      run.push(following); seen.add(following)
    }
    let start = run[0].start, end = run.at(-1).end
    if (value[start - 1] === '\n') start--
    if (value[end] === '\n') end++
    insertions.push([start, '<ul>'], [end, '</ul>'])
  }
  let out = value
  for (const [at, text] of insertions.sort((a, b) => b[0] - a[0])) out = out.slice(0, at) + text + out.slice(at)
  return '<div>' + out + '</div>'
}
const divToP = value => {rich(value); return value.replace(/<(\/?)div>/g, '<$1p>')}
const cursor = text => ({text, at: 0})
const literal = (c, text) => {need(c.text.startsWith(text, c.at), 'Changed immutable document/ancestor/style/program/owner'); c.at += text.length}
const until = (c, delimiter) => {const end = c.text.indexOf(delimiter, c.at); need(end >= c.at, 'Missing complete native scalar owner'); const raw = c.text.slice(c.at, end); c.at = end; return raw}
const walk = (c, template, data) => {
  for (let index = 0; index < template.length; index++) {
    const part = template[index]
    if (typeof part === 'string') literal(c, part)
    else data(c, part.slot, template[index + 1])
  }
}
const cfData = (c, name, cf) => {
  const raw = c.text.slice(c.at, c.at + 16); c.at += 16
  if (name === 'CF.params.t') {
    const value = Buffer.from(raw, 'base64').toString('latin1')
    need(/^\d{10}$/.test(value) && Buffer.from(value).toString('base64') === raw, 'Changed canonical CF timing data')
  } else need(/^[a-f0-9]{16}$/.test(raw), 'Changed CF ASCII ray data')
  cf.push({name, raw, start: c.at - 16})
}
const closure = (text, cf) => {
  need(cf.length === 3 && cf[0].raw === cf[2].raw, 'Changed coupled CF data slots')
  for (const part of [...cf].reverse()) text = text.slice(0, part.start) + '0'.repeat(16) + text.slice(part.start + 16)
  return text
}
const readOption = c => {
  literal(c, '<li><a class="category-link" href="'); const href = scalar(until(c, '"'))
  literal(c, '" rel="nofollow">'); const label = scalar(until(c, '</a>')); literal(c, '</a></li>')
  return {href, label}
}
const rfc3986 = value => encodeURIComponent(value).replace(/[!'()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())
const query = pairs => '?' + pairs.map(([key, value]) => key + '=' + rfc3986(value)).join('&')
const optionSet = (actual, expected, label) => {
  need(new Set(actual.map(row => row.href)).size === actual.length, 'Duplicate ' + label + ' option')
  need(actual.length === expected.length && expected.every(want => actual.some(row => row.href === want.href && row.label === want.label)), 'Incomplete/conflicting ' + label + ' options')
}
const boardModel = (text, feed) => {
  const c = cursor(text), cf = [], options = {}, groups = [], ids = []
  let department = null
  walk(c, templates.board, (c, name) => {
    if (name.startsWith('CF.')) return cfData(c, name, cf)
    if (name.startsWith('options.')) {
      const key = name.slice(8), rows = []
      if (key === 'department') {
        while (c.text.startsWith('<li class="group-item" role="group" aria-label="', c.at)) {
          literal(c, '<li class="group-item" role="group" aria-label="'); const label = scalar(until(c, '"'))
          literal(c, '"><a class="group-link" href="'); const href = scalar(until(c, '"'))
          literal(c, '" rel="nofollow">'); const content = scalar(until(c, '</a>')); literal(c, '</a><ul>')
          need(label === content && href === query([['department', label]]), 'Conflicting department option owner')
          const teams = []
          while (c.text.startsWith('<li><a class="category-link"', c.at)) teams.push(readOption(c))
          need(teams.length, 'Empty department option group'); literal(c, '</ul></li>')
          rows.push({href, label, teams})
        }
      } else while (c.text.startsWith('<li><a class="category-link"', c.at)) rows.push(readOption(c))
      options[key] = rows; return
    }
    need(name === 'groups', 'Unknown board data owner')
    while (c.text.startsWith('<div class="postings-group">', c.at)) {
      literal(c, '<div class="postings-group">')
      if (c.text.startsWith('<div class="large-category-header">', c.at)) {
        literal(c, '<div class="large-category-header">'); department = scalar(until(c, '</div>')); literal(c, '</div>')
      }
      need(department, 'Continuation group without a department declaration')
      literal(c, '<div class="posting-category-title large-category-label">'); const team = scalar(until(c, '</div>'))
      literal(c, '</div><div class="horizontal-line"></div>'); const cards = []
      while (c.text.startsWith(templates.card[0], c.at)) {
        const card = {}
        walk(c, templates.card, (c, key, next) => {card[key] = scalar(until(c, next))})
        need(uuid(card['card.id']), 'Invalid card UUIDv4'); cards.push(card); ids.push(card['card.id'])
      }
      need(cards.length, 'Empty or unknown posting group'); literal(c, '</div>'); groups.push({department, team, cards})
    }
    need(groups.length, 'No complete posting groups')
  })
  need(c.at === text.length, 'Unconsumed complete board bytes')
  const whole = closure(text, cf)
  need(new Set(ids).size === ids.length, 'Duplicate board card owner')
  need(new Set(groups.map(group => JSON.stringify([group.department, group.team]))).size === groups.length, 'Duplicate department/team posting group owner')
  if (feed) {
    need(ids.length === feed.length && feed.every(row => ids.includes(row.id)), 'Native board/full feed identity conflict')
    const byId = new Map(feed.map(row => [row.id, row]))
    for (const group of groups) for (const card of group.cards) {
      const row = byId.get(card['card.id']), cat = row.categories
      need(cat.department === group.department && cat.team === group.team, 'Native group/category conflict')
      const labels = {remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'}
      need(card['card.title'] === row.text && card['card.hostedURL.0'] === row.hostedUrl && card['card.hostedURL.1'] === row.hostedUrl
        && card['card.category.0'] === labels[row.workplaceType] + '\u00a0\u2014\u00a0' && card['card.category.1'] === cat.commitment
        && card['card.category.2'] === cat.location, 'Incomplete current board card/scalar binding')
    }
    for (const key of ['location', 'commitment']) optionSet(options[key], [...new Set(feed.map(row => row.categories[key]))].map(label => ({label, href: query([[key, label]])})), key)
    const departments = [...new Set(feed.map(row => row.categories.department))]
    optionSet(options.department, departments.map(label => ({label, href: query([['department', label]])})), 'department')
    for (const entry of options.department) optionSet(entry.teams, [...new Set(feed.filter(row => row.categories.department === entry.label).map(row => row.categories.team))]
      .map(label => ({label, href: query([['department', entry.label], ['team', label]])})), 'team')
  }
  return {ids, employerLabel: profile.employerLabel, literalHomepageHref: profile.literalNativeHomepageHref, whole}
}

const rolePresentation = text => {
  const c = cursor(text), fields = {}, lists = [], cf = []
  walk(c, templates.role, (c, name, next) => {
    if (name.startsWith('CF.')) return cfData(c, name, cf)
    if (name === 'repeated-list-sections') {
      while (c.text.startsWith(templates.listSection[0], c.at)) {
        const section = {}
        walk(c, templates.listSection, (c, key, next) => {
          if (key === 'list.content') {const start = c.at; c.at = rich(c.text, {start, ownerEnd: true, rendered: true}).end; section.content = c.text.slice(start, c.at)}
          else {section.rawHeading = until(c, next); section.text = scalar(section.rawHeading)}
        })
        lists.push(section)
      }
      need(lists.length, 'Missing complete criteria list owner'); return
    }
    if (name === 'job-description' || name === 'closing-description') {
      const start = c.at; c.at = rich(c.text, {start, ownerEnd: true}).end; fields[name] = c.text.slice(start, c.at); return
    }
    if (name.startsWith('JSONLD.')) {
      // Consume one complete JSON string token, independent of embedded markup.
      need(c.text[c.at] === '"', 'Unknown JobPosting scalar token'); const start = c.at++
      for (;;) {
        need(c.at < c.text.length, 'Unterminated JobPosting scalar')
        const char = c.text[c.at++]; if (char === '\\') c.at++; else if (char === '"') break
      }
      fields[name] = strictJSON(c.text.slice(start, c.at)).value; return
    }
    const raw = until(c, next); fields[name] = scalar(raw)
    if (name === 'ai.notice') fields.rawAINotice = raw
  })
  need(c.at === text.length, 'Unconsumed complete role bytes')
  const schemaOpening = '<script type="application/ld+json">', start = text.indexOf(schemaOpening) + schemaOpening.length
  need(start >= schemaOpening.length && text.indexOf(schemaOpening, start) === -1, 'Duplicate JobPosting owner')
  const rawSchema = text.slice(start, text.indexOf('</script>', start)), schema = strictJSON(rawSchema).value
  exactKeys(schema, ['@context', '@type', 'title', 'hiringOrganization', 'jobLocation', 'employmentType', 'datePosted', 'description'], '8-field JobPosting')
  exactKeys(schema.hiringOrganization, ['@type', 'name', 'logo'], 'Organization')
  exactKeys(schema.jobLocation, ['@type', 'address'], 'Place')
  exactKeys(schema.jobLocation.address, ['@type', 'addressLocality', 'addressRegion', 'addressCountry', 'postalCode'], 'PostalAddress')
  return {fields, lists, schema, rawSchema, whole: closure(text, cf)}
}

const countryNames = (() => {
  const names = new Set(['United States of America', 'USA', 'U.S.A.', 'U.S.', 'UK', 'UAE', 'Great Britain'])
  const display = new Intl.DisplayNames(['en'], {type: 'region'})
  for (let a = 65; a <= 90; a++) for (let b = 65; b <= 90; b++) {
    const code = String.fromCharCode(a, b), name = display.of(code)
    if (name !== code && name.length > 3) names.add(name)
  }
  names.delete('India'); return [...names].sort((a, b) => b.length - a.length)
})()
const foreignCountry = new RegExp('(?:^|[^\\p{L}\\p{N}])(?:' + countryNames.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[^\\p{L}\\p{N}])', 'iu')
const detailModel = (html, record, rawRecord, observedAt) => {
  const detail = rolePresentation(html), {fields, schema, lists} = detail, cat = record.categories
  need(record.country === 'IN' && cat.allLocations.length === 1 && cat.allLocations[0] === cat.location && record.workplaceType === 'remote', 'Unsupported typed India single-worksite/workplace scope')
  need(!/(?:^|[\s,;|/(])(?:US|USA|UK|UAE)(?=$|[\s,;|/).:-])/.test(cat.location), 'Explicit foreign country code conflicts with typed IN')
  for (const key of richKeys) {rich(record[key]); need(humanText(record[key]), 'Missing substantive native rich carrier: ' + key)}
  for (const key of plainKeys) {plainString(record[key]); need(key === 'descriptionBodyPlain' || record[key].trim(), 'Missing substantive native plain carrier: ' + key)}
  for (const value of [record.text, ...Object.values(cat).flat(), ...record.lists.map(row => row.text)]) plainString(value)
  need(record.text.trim() && record.lists.length && record.lists.every(row => row.text.trim() && humanText(row.content)), 'Empty substantive criteria/list heading')
  const excerpt = record.descriptionBodyPlain.slice(0, 1000)
  need(excerpt.isWellFormed(), 'Unsupported split UTF16 excerpt boundary')
  const metadata = excerpt.replace(/[ \n\u00a0]+/g, ' ').replace(/^ +| +$/g, '')
  const expected = {'head.title': 'Netomi - ' + record.text, 'meta.twitter:title': 'Netomi - ' + record.text,
    'meta.og:title': 'Netomi - ' + record.text, 'meta.twitter:description': metadata, 'meta.og:description': metadata,
    'meta.twitter:data1': cat.location, 'meta.twitter:data2': cat.team, 'meta.og:url': record.hostedUrl,
    'role.heading': record.text, 'category.0': cat.location, 'category.1': cat.department + ' \u2013 ' + cat.team + ' /',
    'category.2': cat.commitment + ' /', 'category.3': 'Remote', 'apply.href.0': record.applyUrl, 'apply.href.1': record.applyUrl,
    'job-description': record.description, 'closing-description': record.additional}
  for (const [key, value] of Object.entries(expected)) need(fields[key] === value, 'Complete native scalar/criteria conflict: ' + key)
  need(lists.length === record.lists.length, 'Missing/extra ordered criteria list owner')
  let schemaDescription = divToP(record.description) + '\\n<p></p><p><br></p>'
  for (const [index, section] of record.lists.entries()) {
    const rendered = renderList(section.content), actual = lists[index]
    need(actual.text === section.text && actual.content === rendered, 'Incomplete current ordered list heading/content')
    schemaDescription += (index ? '<p><br></p>' : '') + '<b>' + actual.rawHeading + '</b>' + rendered.slice(5, -6)
  }
  schemaDescription += '<p><br></p><p></p>\\n' + divToP(record.additional)
  need(schema.title === record.text && schema.employmentType === cat.commitment && schema.jobLocation.address.addressLocality === cat.location
    && schema.description === schemaDescription, 'Complete current JobPosting/title/worksite/criteria conflict')
  need(/^\d{4}-\d{2}-\d{2}$/.test(schema.datePosted) && new Date(record.createdAt).toISOString().slice(0, 10) === schema.datePosted
    && record.createdAt <= Date.parse(observedAt), 'Native calendar date conflict/future publication')
  const aiNotice = fields['ai.notice']; need(aiNotice.trim(), 'Missing complete authored AI notice')
  const carriers = [...richKeys.map(key => record[key]), ...plainKeys.map(key => record[key]), ...record.lists.flatMap(row => [row.text, row.content])]
  const parts = carriers.filter(value => humanText(value))
  const authored = humanText([record.description, ...lists.flatMap(row => [row.rawHeading, row.content]), record.additional, aiNotice].join(' '))
  need(parts.every(value => authored.includes(humanText(value)) && humanText(schema.description).includes(humanText(value))), 'Incomplete independent rich/plain/schema criteria')
  for (const value of [...carriers, ...Object.values(cat).flat(), record.text, aiNotice, schema.description]) {
    const normalized = humanText(value), joined = humanText(value, '')
    need(!unavailable(normalized) && !unavailable(joined) && !intake(normalized), 'Explicit closed/filled/expired/intake role notice')
    need(!foreignCountry.test(normalized) && !foreignCountry.test(joined), 'Explicit foreign country conflicts with typed IN')
    for (const scoped of new Set([normalized, joined])) {
      for (const match of scoped.matchAll(/\bcountr(?:y|ies)\s*:\s*([^.!?]+)/gi)) {
        need(['India', 'IN'].includes(match[1].trim()), 'Explicit unknown/foreign country clause conflicts with typed IN')
      }
      need(!/\b(?:based|located)\s+(?:in|at)\s+(?:the\s+)?US\b/i.test(scoped), 'Explicit foreign country clause conflicts with typed IN')
      need(!/\b(?:secondary|additional|multiple|other|second)\s+(?:worksites?|work locations?|offices?|locations?)\b/i.test(scoped), 'Explicit additional/secondary worksite is outside one current native worksite')
      for (const match of scoped.matchAll(/\b(?:worksite|work location|primary office|location)\s*:\s*([^.!?]+)|\b(?:this|the) (?:role|job|position) (?:is )?(?:based|located) (?:in|at) ([^.!?]+)/gi)) {
        need((match[1] ?? match[2]).trim().replace(/^the /i, '') === cat.location, 'Explicit worksite clause conflicts with the one current native worksite')
      }
    }
  }
  const nativeCriteria = criteria({platform: 'lever'}, record)
  const roleCriteria = humanText([record.descriptionBody, ...record.lists.flatMap(row => [row.text, row.content])].join(' '))
  need(nativeCriteria && nativeCriteria.length > 100 && roleCriteria.length > 100 && parts.length >= 11, 'Substantive original role criteria unavailable')
  const escape = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  const authoredRaw = JSON.stringify({lists: lists.map(row => ({heading: row.rawHeading, content: row.content})), aiNotice, rawAINotice: fields.rawAINotice})
  const supplement = '<section data-source="netomi-native-originals"><p>Netomi native source data and complete public authored criteria:</p>'
    + '<pre data-carrier="native-row">' + escape(rawRecord) + '</pre><pre data-carrier="JobPosting">' + escape(detail.rawSchema)
    + '</pre><pre data-carrier="authored-list-ai">' + escape(authoredRaw) + '</pre></section>'
  return {schema: clone(schema), rawSchema: detail.rawSchema, aiNotice, completeAuthoredText: authored,
    jobDescription: record.description + supplement, richPlainCarrierCount: parts.length, originalHTML: html, whole: detail.whole}
}

export const admitNetomiEntityBytes = (url, raw) => {
  need(Buffer.isBuffer(raw), 'Original entity bytes are required')
  need(!(raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf), 'Unreviewed UTF8 BOM')
  let text
  try {text = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(raw)} catch {throw fail('Invalid original UTF8')}
  if (url === profile.feedURL) feedModel(text)
  else if (url === profile.boardURL) boardModel(text)
  else {need(url.startsWith(profile.boardURL + '/') && uuid(url.slice(profile.boardURL.length + 1)), 'Unbound native URL'); rolePresentation(text)}
  return text
}

const typedArray = Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic = name => Object.getOwnPropertyDescriptor(typedArray, name).get
const byteLength = intrinsic('byteLength'), byteOffset = intrinsic('byteOffset'), arrayBuffer = intrinsic('buffer')
const ignore = fn => {try {Promise.resolve(fn()).catch(() => {})} catch {}}

export const createNetomiNativeTextScraper = (defaults = {}) => ({name: 'netomi', async run(passed = {}) {
  const options = {...defaults, ...passed}, caller = options.signal
  caller?.throwIfAborted()
  need(!options.fetchText && !options.fetchJson && !options.fetchPage, 'Full original Response transport required')
  const limits = {}
  for (const [key, maximum] of Object.entries(NETOMI_NATIVE_LIMITS)) {
    if (key === 'pacingMs') {limits[key] = maximum; continue}
    const value = options[key] === undefined ? maximum : options[key]
    need(Number.isSafeInteger(value) && value >= 1 && value <= maximum, 'Invalid reduced ' + key)
    limits[key] = value
  }
  let maxJobs = options.maxJobs === Infinity ? null : options.maxJobs ?? null
  need(maxJobs === null || Number.isSafeInteger(maxJobs) && maxJobs >= 0, 'Invalid maxJobs')
  need(limits.maxRequests >= 4 && limits.maxAggregateBytes >= 3 * 1048576, 'Opening/closing inventory reservation cannot fit')
  const onAudit = options.onAudit ?? (() => {}), onRecords = options.onRecords ?? (() => {})
  need(typeof onAudit === 'function' && typeof onRecords === 'function', 'Invalid audit observer')
  const acquire = options.fetchImpl ?? globalThis.fetch
  need(typeof acquire === 'function', 'Original Response transport unavailable')
  const control = new AbortController(), began = performance.now()
  // Timer wakes may be early. Monotonic elapsed time alone owns each deadline.
  const deadlineTimer = (controller, start, duration, message) => {
    let timer
    const arm = () => {
      const left = duration - (performance.now() - start)
      if (left <= 0) controller.abort(fail(message))
      else timer = setTimeout(arm, Math.max(1, Math.ceil(left)))
    }
    arm(); return () => clearTimeout(timer)
  }
  const stopSourceTimer = deadlineTimer(control, began, limits.sourceTimeoutMs, 'Source deadline exceeded')
  const source = caller ? AbortSignal.any([caller, control.signal]) : control.signal
  const audit = {source: 'netomi', startedAt: new Date().toISOString(), recordKind: 'vacancy-rows',
    observedRecordCount: 0, observedVacancyCount: 0, sourceScopeComplete: false, lifecycleCleanupAllowed: false,
    corporateBindingQualified: false, formalLegalEntityQualified: false, sourceActivationComplete: false,
    sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
    qualification: 'OWN NATIVE TEXT DATA only; current corporate endorsement, formal legal entity, rendered/application and whole-company scope remain unverified.',
    ownDetailAPIVisited: false, rawPages: [], observations: [], issues: [], limits}
  const check = () => {caller?.throwIfAborted(); if (performance.now() - began >= limits.sourceTimeoutMs && !control.signal.aborted) control.abort(fail('Source deadline exceeded')); source.throwIfAborted()}
  const remaining = () => Math.max(0, limits.sourceTimeoutMs - (performance.now() - began))
  const wait = (operation, signal = source, dispose, guard = () => {}) => new Promise((resolve, reject) => {
    let settled = false, rejected
    const detach = () => signal.removeEventListener('abort', abort)
    const rejectOnce = reason => {if (!settled) {settled = true; rejected = reason; detach(); reject(reason)}}
    const abort = () => rejectOnce(caller?.aborted ? caller.reason : signal.reason)
    signal.addEventListener('abort', abort, {once: true})
    try {check(); guard(); signal.throwIfAborted()} catch (error) {rejectOnce(error); return}
    Promise.resolve().then(() => {check(); guard(); signal.throwIfAborted(); return operation()}).then(value => {
      if (settled) {if (dispose) ignore(() => dispose(value, rejected)); return}
      try {check(); guard(); signal.throwIfAborted()} catch (error) {rejectOnce(error); if (dispose) ignore(() => dispose(value, error)); return}
      settled = true; detach(); resolve(value)
    }, error => {if (!settled) {try {check(); guard(); signal.throwIfAborted()} catch (reason) {error = reason} rejectOnce(error)}})
  })
  const lastStart = new Map(), denied = new Set()
  let aggregateBytes = 0
  const returnedRoles = new Map()
  const read = async (url, kind, quota = limits.requestTimeoutMs) => {
    check(); need(url === profile.feedURL || url === profile.boardURL || returnedRoles.has(url), 'Unbound current returned native URL')
    const origin = new URL(url).origin
    need(!denied.has(origin) && audit.rawPages.length < limits.maxRequests, 'Denied origin or physical request bound')
    for (;;) {
      check()
      const pause = limits.pacingMs - (performance.now() - (lastStart.get(origin) ?? -Infinity))
      if (pause <= 0) break
      await wait(() => new Promise(resolve => {
        const abort = () => clearTimeout(timer)
        const timer = setTimeout(() => {source.removeEventListener('abort', abort); resolve()}, Math.ceil(pause))
        source.addEventListener('abort', abort, {once: true})
      }))
    }
    check(); need(quota >= 1, 'Closing time reservation exhausted')
    const deadline = new AbortController(), timeoutMs = Math.max(1, Math.min(limits.requestTimeoutMs, Math.floor(quota), Math.floor(remaining())))
    const requestBegan = performance.now()
    const stopRequestTimer = deadlineTimer(deadline, requestBegan, timeoutMs, 'Native request deadline exceeded')
    const requestSignal = AbortSignal.any([source, deadline.signal])
    const requestCheck = () => {
      check()
      if (performance.now() - requestBegan >= timeoutMs && !deadline.signal.aborted) deadline.abort(fail('Native request deadline exceeded'))
      requestSignal.throwIfAborted()
    }
    const receipt = {index: audit.rawPages.length, kind, url, method: 'GET', startedAt: new Date().toISOString(), bytes: 0, entityComplete: false}
    let response, reader, completed = false
    const cap = Math.min(limits.maxEntityBytes, kind === 'feed' ? limits.maxFeedBytes : limits.maxEntityBytes)
    const cancel = reason => {if (reader) {ignore(() => reader.cancel(reason)); ignore(() => reader.releaseLock())} else if (response?.body) ignore(() => response.body.cancel(reason))}
    try {
      response = await wait(() => {
        audit.rawPages.push(receipt); lastStart.set(origin, performance.now())
        return acquire(url, {method: 'GET', redirect: 'manual', credentials: 'omit', signal: requestSignal,
          headers: {Accept: 'text/html,application/json,*/*;q=0.5', 'User-Agent': 'Mozilla/5.0 (compatible; Jobverify scraper)'}})
      }, requestSignal, (late, reason) => late.body?.cancel(reason), requestCheck)
      receipt.status = response.status; receipt.responseURL = response.url; receipt.redirected = response.redirected
      if ([401, 403, 429, 451].includes(response.status)) denied.add(origin)
      if (response.status !== 200) {
        const error = fail('Native HTTP ' + response.status)
        Object.assign(error, {status: response.status, requestUrl: url, originDenied: denied.has(origin), failureKind: denied.has(origin) ? 'blocked_or_access_denied' : 'coverage_gap'})
        throw error
      }
      need(response.url === url && response.redirected === false, 'Changed/prefollowed original Response URL')
      const mime = response.headers.get('content-type') ?? ''
      receipt.contentType = mime
      need((kind === 'feed' ? /^application\/json(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i : /^text\/html(?:\s*;\s*charset\s*=\s*(?:utf-8|"utf-8"))?$/i).test(mime), 'Unreviewed original MIME/charset')
      need(response.body && typeof response.body.getReader === 'function', 'Original byte stream unavailable')
      reader = await wait(() => response.body.getReader(), requestSignal, (late, reason) => {ignore(() => late.cancel(reason)); ignore(() => late.releaseLock())}, requestCheck)
      const chunks = []
      for (;;) {
        const {done, value} = await wait(() => reader.read(), requestSignal, undefined, requestCheck)
        if (done) break
        need(types.isUint8Array(value), 'Native byte chunk required')
        const size = byteLength.call(value)
        receipt.bytes += size; aggregateBytes += size
        need(receipt.bytes <= cap && aggregateBytes <= limits.maxAggregateBytes, 'Original entity/aggregate streaming byte bound')
        chunks.push(Buffer.from(new Uint8Array(arrayBuffer.call(value), byteOffset.call(value), size)))
      }
      const raw = Buffer.concat(chunks)
      receipt.entityComplete = true; receipt.originalEntityReviewed = false
      receipt.rawEntitySHA256 = sha(raw); receipt.bodyBase64 = raw.toString('base64')
      const text = admitNetomiEntityBytes(url, raw)
      requestCheck()
      receipt.originalEntityReviewed = true
      completed = true
      return {text, receipt}
    } catch (error) {
      cancel(error); check()
      receipt.error = error?.message ?? String(error)
      throw error
    } finally {
      stopRequestTimer()
      if (completed && reader) ignore(() => reader.releaseLock())
      receipt.completedAt = new Date().toISOString()
    }
  }
  const finishAudit = async () => {
    check(); audit.completedAt = new Date().toISOString(); audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregateBytes
    await wait(() => onAudit(clone(audit)))
    await wait(() => onRecords(clone(audit.observations)))
    check()
  }
  try {
    let observedAt
    try {observedAt = typeof options.now === 'function' ? options.now() : options.now ?? new Date().toISOString()} finally {check()}
    need(typeof observedAt === 'string' && Number.isFinite(Date.parse(observedAt)), 'Invalid observation clock')
    const openingBoard = await read(profile.boardURL, 'board')
    const openingFeed = await read(profile.feedURL, 'feed'), records = feedModel(openingFeed.text)
    check()
    audit.opening = {board: boardModel(openingBoard.text, records), fullNativeFeed: records}
    check()
    audit.observedRecordCount = records.length; audit.observedVacancyCount = records.length
    audit.observations = records.map(record => ({id: record.id, sourceNativeRecord: clone(record), sourceNativeRawRecord: records.rawRows.get(record.id), sourceNativeDataIdentityQualified: false,
      ...(record.country !== 'IN' ? {heldReason: 'Current native country is not literal IN'}
        : record.categories.allLocations.length !== 1 || record.categories.allLocations[0] !== record.categories.location ? {heldReason: 'Current native worksite is not one consistent location'}
          : record.workplaceType !== 'remote' ? {heldReason: 'Current native workplace shape is outside reviewed selected remote roles'} : {})}))
    const candidates = records.filter(record => record.country === 'IN' && record.categories.allLocations.length === 1
      && record.categories.allLocations[0] === record.categories.location && record.workplaceType === 'remote')
    for (const record of candidates) returnedRoles.set(record.hostedUrl, record)
    const capacity = Math.max(0, Math.min(candidates.length, maxJobs ?? candidates.length, Math.floor((limits.maxRequests - 4) / 2), Math.floor((limits.maxAggregateBytes - 3 * 1048576) / (2 * 1048576))))
    const paired = []
    audit.selectedNativeIds = candidates.slice(0, capacity).map(record => record.id)
    for (const record of candidates.slice(0, capacity)) {
      check()
      const h = limits.maxEntityBytes, f = Math.min(h, limits.maxFeedBytes)
      if (audit.rawPages.length + 4 > limits.maxRequests || aggregateBytes + 3 * h + f > limits.maxAggregateBytes) {
        audit.issues.push({id: record.id, issue: 'Closing read/byte reservation requires stopping selection'}); break
      }
      const reserve = 2 * Math.min(15000, Math.floor(remaining() / 4)) + 1000
      const quota = Math.floor((remaining() - reserve - 1000) / 2)
      if (quota < 1) {audit.issues.push({id: record.id, issue: 'Closing time reservation requires stopping selection'}); break}
      const row = audit.observations.find(row => row.id === record.id)
      try {
        const first = await read(record.hostedUrl, 'role', quota), opened = detailModel(first.text, record, records.rawRows.get(record.id), observedAt)
        check()
        row.opening = {...opened, originalEntitySHA256: first.receipt.rawEntitySHA256}
        const second = await read(record.hostedUrl, 'role', Math.min(quota, remaining() - reserve)), closed = detailModel(second.text, record, records.rawRows.get(record.id), observedAt)
        check()
        row.closing = {...closed, originalEntitySHA256: second.receipt.rawEntitySHA256}
        need(isDeepStrictEqual(opened.schema, closed.schema) && opened.jobDescription === closed.jobDescription
          && opened.completeAuthoredText === closed.completeAuthoredText && opened.aiNotice === closed.aiNotice && opened.whole === closed.whole, 'Closing complete raw native qualification/criteria drift')
        row.sourceNativeDataIdentityQualified = true; paired.push({record, detail: opened, hashes: [first.receipt.rawEntitySHA256, second.receipt.rawEntitySHA256]})
      } catch (error) {check(); if (error?.originDenied) throw error; row.issue = error?.message ?? String(error); audit.issues.push({id: record.id, issue: row.issue})}
    }
    const closingBoard = await read(profile.boardURL, 'board', Math.floor((remaining() - 500) / 2))
    const closingFeed = await read(profile.feedURL, 'feed', remaining()), finalRecords = feedModel(closingFeed.text)
    audit.closing = {board: boardModel(closingBoard.text, finalRecords), fullNativeFeed: finalRecords}
    check()
    need(openingFeed.text === closingFeed.text && isDeepStrictEqual(audit.opening, audit.closing), 'Closing complete raw native inventory/qualification drift')
    audit.nativeInventoryPairComplete = true
    audit.openingHydratedNativeRecordCount = audit.observations.filter(row => row.opening).length
    audit.qualifiedNativeRecordCount = paired.length
    // Planned selection does not establish a complete, stable native role pair.
    audit.unhydratedNativeRecordCount = records.length - paired.length
    for (const row of audit.observations) if (!row.sourceNativeDataIdentityQualified && !row.heldReason && !row.issue) {
      row.heldReason = audit.selectedNativeIds.includes(row.id) ? 'Current native pair held by closing read/byte/time reservation'
        : 'Current supported native row exceeds caller/read/byte selection capacity'
    }
    const jobs = paired.map(({record, detail, hashes}) => {
      const address = detail.schema.jobLocation?.address ?? {}
      return {source: 'netomi', company: 'Netomi', companyName: 'Netomi', officialBrandName: 'Netomi', title: record.text,
        jobId: record.id, requisitionId: record.id, sourceUrl: record.hostedUrl, applyUrl: record.applyUrl, link: record.applyUrl,
        country: 'India', countryCode: record.country, location: record.categories.location,
        city: /remote/i.test(address.addressLocality ?? '') ? null : address.addressLocality ?? null, state: address.addressRegion ?? null,
        department: record.categories.team || record.categories.department, jobDescription: detail.jobDescription, sourceDescription: detail.jobDescription,
        employmentType: detail.schema.employmentType, remoteStatus: record.workplaceType === 'remote' ? 'Remote' : null,
        postingDate: new Date(record.createdAt).toISOString(), sourcePostingDate: record.createdAt, sourcePostingDatePrecision: 'native-createdAt-milliseconds',
        sourceNativeStructuredDatePosted: detail.schema.datePosted, closingDate: null, scrapedAt: observedAt,
        companyDomain: 'netomi.com', companyCareerPage: profile.corporateURL, atsPlatform: 'lever',
        sourceNativeRecord: clone(record), sourceNativeJobPosting: clone(detail.schema), sourceOriginalEntitySHA256: hashes,
        sourceAuthoredAIHiringNotice: detail.aiNotice, sourceNativeTextComplete: true, sourceDetailComplete: true,
        sourceNativeDataIdentityQualified: true, sourceEvidenceScope: 'own-native-text-data-only', sourceOwnDetailAPIVisited: false,
        sourceCorporateBindingQualified: false, sourceFormalLegalEntityQualified: false,
        sourceActivationComplete: false, sourceRenderedCriteriaComplete: false, sourceApplicationQualificationComplete: false,
        sourceListingComplete: false, sourceScopeComplete: false, lifecycleCleanupAllowed: false}
    })
    audit.returnedNativeIndiaTextRecords = jobs.length
    await finishAudit()
    need(jobs.length > 0 || maxJobs === 0, 'No paired native India text; zero inventory unverified')
    Object.defineProperty(jobs, 'sourceAudit', {value: audit})
    attachSourceObservationEvidence(jobs, audit)
    Object.defineProperty(jobs, 'nativeCollectionEvidence', {value: audit, configurable: true})
    const result = attachInventoryEvidence(jobs, {status: 'coverage-gap', surface: profile.boardURL, firstParty: true,
      listingComplete: false, lifecycleCleanupAllowed: false, reportedTotal: null, indiaFacetCount: null,
      pagesFetched: audit.rawPages.length, verifiedAt: observedAt,
      reason: 'Finite own-native text observations; corporate/legal/rendered/application/whole-company/cleanup held.'})
    check()
    return result
  } catch (error) {
    caller?.throwIfAborted()
    audit.completedAt = new Date().toISOString(); audit.physicalRequests = audit.rawPages.length; audit.originalEntityBytes = aggregateBytes
    if (error && typeof error === 'object') {
      Object.defineProperty(error, 'nativeCollectionEvidence', {value: audit, configurable: true})
      Object.defineProperty(error, 'recruitmentObservations', {value: audit, configurable: true})
    }
    throw error
  } finally {stopSourceTimer()}
}})
export const run = options => createNetomiNativeTextScraper().run(options)
