import { createHash } from 'node:crypto'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

export const CAREERS_URL = 'https://www.gadgeon.com/joinus/'
const hash = value => createHash('sha256').update(value).digest('hex')
const decode = value => String(value ?? '').replace(/&#(x[\da-f]+|\d+);/gi, (original, number) => {
  const code = number[0].toLowerCase() === 'x' ? Number.parseInt(number.slice(1), 16) : Number(number)
  return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : '\ufffd'
}).replace(/&(amp|quot|apos|nbsp|lt|gt|ndash|mdash);/gi, (_, name) => ({
  amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>', ndash: '\u2013', mdash: '\u2014',
})[name.toLowerCase()])
const norm = value => decode(value).replace(/\s+/g, ' ').trim()
const cls = (node, value) => (node.attrs.class || '').split(/\s+/).includes(value)
const walk = (node, predicate) => [ ...(predicate(node) ? [node] : []), ...node.children.filter(child => typeof child !== 'string').flatMap(child => walk(child, predicate)) ]
const literalText = node => node.blocked ? '' : norm(node.children.map(child => typeof child === 'string' ? child : literalText(child)).join(' '))

// This reads declared HTML models. Hidden Bootstrap modals remain hidden models;
// parsing them does not certify activation, visibility or complete job details.
const readLiteralTree = html => {
  const root = { tag: 'root', attrs: {}, children: [], blocked: false, hidden: false }
  const stack = [root]
  const tokens = /<!--[\s\S]*?(?:-->|$)|<![^>]*>|<\/?([a-z][a-z\d:_-]*)\b((?:[^"'<>]|"[^"]*"|'[^']*')*)>/gi
  const voids = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'])
  const rawTags = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'])
  let cursor = 0, match
  while ((match = tokens.exec(html))) {
    const parent = stack.at(-1)
    if (match.index > cursor) parent.children.push(html.slice(cursor, match.index))
    cursor = tokens.lastIndex
    if (!match[1]) continue
    const tag = match[1].toLowerCase()
    if (match[0].startsWith('</')) {
      const at = stack.findLastIndex(node => node.tag === tag)
      const boundary = stack.findLastIndex(node => node.tag === 'template')
      if (at > 0 && at >= boundary) {
        stack[at].closeStart = match.index
        stack[at].end = cursor
        stack.length = at
      }
      continue
    }
    const attrs = {}, duplicateAttributes = []
    for (const attribute of match[2].matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
      const key = attribute[1].toLowerCase()
      if (Object.hasOwn(attrs, key)) duplicateAttributes.push(key)
      else attrs[key] = decode(attribute[2] ?? attribute[3] ?? attribute[4] ?? '')
    }
    const hidden = parent.hidden || Object.hasOwn(attrs, 'hidden') || Object.hasOwn(attrs, 'inert')
      || attrs['aria-hidden']?.toLowerCase() === 'true' || /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden)\s*(?:!important\s*)?(?:;|$)/i.test(attrs.style || '')
    const node = { tag, attrs, duplicateAttributes, children: [], start: match.index, openEnd: cursor,
      blocked: parent.blocked || ['template', 'noscript', 'object'].includes(tag) || (rawTags.has(tag) && tag !== 'title'), hidden }
    parent.children.push(node)
    if (rawTags.has(tag)) {
      const ending = new RegExp(`</${tag}\\s*>`, 'ig'); ending.lastIndex = cursor
      const close = tag === 'plaintext' ? null : ending.exec(html)
      node.children.push(html.slice(cursor, close?.index ?? html.length))
      node.closeStart = close?.index ?? html.length
      node.end = close ? ending.lastIndex : html.length
      cursor = node.end; tokens.lastIndex = cursor
    } else if (voids.has(tag)) { node.closeStart = cursor; node.end = cursor }
    else stack.push(node)
  }
  if (cursor < html.length) stack.at(-1).children.push(html.slice(cursor))
  return root
}
const eligible = node => !node.blocked && !node.hidden
const raw = (html, node) => node?.end == null ? null : html.slice(node.start, node.end)
const descendants = (node, predicate) => walk(node, child => child !== node && predicate(child))

const readForm = (root, html, url) => {
  const forms = walk(root, node => eligible(node) && node.tag === 'form' && node.attrs.id === 'w0')
  if (forms.length !== 1) return null
  const node = forms[0]
  if (node.duplicateAttributes.length || node.attrs.method?.toLowerCase() !== 'get') return null
  let action
  try { action = new URL(node.attrs.action, url) } catch { return null }
  if (action.origin !== new URL(CAREERS_URL).origin || action.pathname !== '/joinus/index/'
    || action.username || action.password || action.search || action.hash) return null
  const controls = descendants(node, child => eligible(child) && ['input', 'select', 'textarea'].includes(child.tag))
  if (controls.length !== 2 || controls.some(child => child.tag !== 'select' || child.duplicateAttributes.length
    || Object.hasOwn(child.attrs, 'disabled') || Object.hasOwn(child.attrs, 'multiple'))) return null
  const selects = controls.map(select => {
    const options = descendants(select, child => eligible(child) && child.tag === 'option').map(option => ({
      value: option.attrs.value, label: literalText(option), selected: Object.hasOwn(option.attrs, 'selected'),
      ambiguous: option.duplicateAttributes.length > 0 || Object.hasOwn(option.attrs, 'disabled'),
    }))
    const selected = options.filter(option => option.selected)
    return { name: select.attrs.name, options, selected: selected.length === 0 ? options[0]?.value : selected.length === 1 ? selected[0].value : null }
  })
  if (selects.some(select => !select.name || !select.options.length || select.options.some(option => typeof option.value !== 'string' || option.ambiguous)
    || new Set(select.options.map(option => option.value)).size !== select.options.length)) return null
  const category = selects.find(select => select.name === 'JoinusSearch[career_category]')
  const region = selects.find(select => select.name === 'JoinusSearch[career_region]')
  if (!category || !region || category.selected !== '' || !category.options.some(option => option.value === '' && option.label === 'All')
    || !region.options.some(option => option.value === '' && option.label === 'All')
    || !region.options.some(option => option.value === 'India' && option.label === 'India') || region.options.length < 3) return null
  const signature = JSON.stringify({ action: action.href, controls: selects.map(select => ({ name: select.name,
    options: select.options.map(({ value, label }) => ({ value, label })) })) })
  return { action: action.href, originalHTML: raw(html, node), selects, categoryName: category.name, regionName: region.name,
    selectedRegion: region.selected, regions: region.options.map(({ value, label }) => ({ value, label })), signature }
}

export const inspectGadgeonPage = (html, url = CAREERS_URL) => {
  const root = readLiteralTree(html)
  const titles = walk(root, node => node.tag === 'title' && !node.blocked).map(literalText)
  const identity = titles.length === 1 && /gadgeon/i.test(titles[0]) && /join|career/i.test(titles[0])
    && walk(root, node => eligible(node) && /^h[1-6]$/.test(node.tag) && /^current openings$/i.test(literalText(node))).length === 1
    && walk(root, node => eligible(node) && node.attrs.id === 'countries').length === 1
  const cards = walk(root, node => eligible(node) && node.tag === 'div' && cls(node, 'v-box'))
  const modalNodes = walk(root, node => !node.blocked && node.tag === 'div' && /^jobModal-\d+$/.test(node.attrs.id || '') && cls(node, 'modal'))
  const observations = cards.map(card => {
    const issues = []
    const headings = descendants(card, node => eligible(node) && cls(node, 'caret-right'))
    const locations = descendants(card, node => eligible(node) && cls(node, 'col-md-3'))
    const buttons = descendants(card, node => eligible(node) && node.tag === 'a' && node.attrs['data-bs-toggle'] === 'modal')
    const title = headings.length === 1 ? literalText(headings[0]) : null
    const location = locations.length === 1 ? literalText(locations[0]) : null
    const target = buttons.length === 1 && buttons[0].duplicateAttributes.length === 0 ? buttons[0].attrs['data-bs-target'] : null
    const id = /^#jobModal-\d+$/.test(target || '') ? target.slice(1) : null
    const matches = modalNodes.filter(node => node.attrs.id === id)
    const modal = matches.length === 1 ? matches[0] : null
    const modalTitles = modal ? descendants(modal, node => !node.blocked && cls(node, 'modal-title')) : []
    const bodies = modal ? descendants(modal, node => !node.blocked && cls(node, 'modal-body')) : []
    const body = bodies.length === 1 ? bodies[0] : null
    const descriptionHtml = body?.closeStart == null ? null : html.slice(body.openEnd, body.closeStart)
    const descriptionText = body ? literalText(body) : null
    const mailLinks = descendants(card, node => !node.blocked && node.tag === 'a' && /^mailto:/i.test(node.attrs.href || '')).map(node => node.attrs.href)
    const applyUrls = [...new Set(mailLinks)]
    if (!title || !location || !id || !modal || modal.duplicateAttributes.length || !raw(html, modal)
      || modalTitles.length !== 1 || modalTitles[0].duplicateAttributes.length || literalText(modalTitles[0]) !== title
      || modal.attrs['aria-labelledby'] !== modalTitles[0].attrs.id || !descriptionHtml
      || !hasSourceDescription({ jobDescription: descriptionText }) || applyUrls.length !== 1
      || !/^mailto:careers@gadgeon\.com$/i.test(applyUrls[0])) issues.push('native-card-modal-or-criteria-unreconciled')
    const originalModalHTML = raw(html, modal)
    const signature = hash(JSON.stringify({ id, title, location, applyUrls, originalModalHTML }))
    return { id, title, location, country: null, originalCardHTML: raw(html, card),
      originalModalHTML, modalAttributes: modal?.attrs ?? null, descriptionHtml, descriptionText,
      applyUrls, signature, declaredCopyBound: issues.length === 0, issues }
  })
  const duplicateTargets = new Set(observations.filter((role, index) => observations.some((other, otherIndex) => index !== otherIndex && other.id === role.id)).map(role => role.id))
  for (const role of observations) if (duplicateTargets.has(role.id)) { role.declaredCopyBound = false; role.issues.push('duplicate-native-card-target') }
  return { url, title: titles[0] ?? null, originalHTML: html, bodySHA256: hash(html), identity,
    form: readForm(root, html, url), observations,
    observedModalIDs: modalNodes.map(node => node.attrs.id),
    originalModalHTML: modalNodes.map(node => raw(html, node)),
    interpretation: 'Declared native HTML only; hidden modal activation is unverified.' }
}

export const declaredRegionRequests = page => !page.identity || !page.form ? [] : page.form.regions.filter(option => option.value !== '').map(option => {
  const url = new URL(page.form.action)
  url.searchParams.append(page.form.categoryName, '')
  url.searchParams.append(page.form.regionName, option.value)
  return { url: url.href, region: option.value, label: option.label }
})

export const reconcileGadgeonPages = ({ opening, regions, indiaClosing, closing }) => {
  const form = opening.form
  const usable = (page, selected) => page?.transportQualified === true && page.identity === true
    && page.form?.signature === form?.signature && page.form?.selectedRegion === selected
  const india = regions.find(page => page.requestedRegion === 'India')
  const others = regions.filter(page => page.requestedRegion !== 'India')
  const controlsQualified = Boolean(form && opening.transportQualified && usable(opening, '') && usable(closing, '')
    && usable(india, 'India') && usable(indiaClosing, 'India') && others.length === form.regions.length - 2
    && others.every(page => usable(page, page.requestedRegion) && page.observations.every(role => role.id)))
  const unique = (page, id) => {
    const found = page?.observations?.filter(role => role.id === id) || []
    return found.length === 1 && found[0].declaredCopyBound ? found[0] : null
  }
  const observations = opening.observations.map(original => {
    const role = structuredClone(original)
    const copies = [unique(india, role.id), unique(indiaClosing, role.id), unique(closing, role.id)]
    const conflicting = others.some(page => page.observedModalIDs?.includes(role.id) || page.observations?.some(other => other.id === role.id))
    const qualified = controlsQualified && role.declaredCopyBound && !conflicting && copies.every(copy => copy?.signature === role.signature)
    role.country = qualified ? 'India' : null
    role.countryProvenance = qualified ? { method: 'declared-native-region-facet', IndiaURL: india.url,
      IndiaClosingURL: indiaClosing.url, excludedRegions: others.map(page => ({ region: page.requestedRegion, url: page.url })),
      originalNativeModalID: role.id, authority: 'Actual selected native region responses with matching original role criteria.' } : null
    if (!qualified) role.issues.push(conflicting ? 'native-region-country-conflict' : 'native-country-or-closing-unresolved')
    return role
  })
  const jobs = observations.filter(role => role.country === 'India').map(role => ({
    title: role.title, company: 'Gadgeon', department: null, location: role.location, city: null, country: 'India',
    jobId: null, requisitionId: null, sourceUrl: CAREERS_URL, applyUrl: role.applyUrls[0],
    employmentType: null, experienceRequired: null, minimumQualification: null, preferredQualification: null,
    requiredSkills: [], postingDate: null, closingDate: null, jobDescription: role.descriptionText,
    sourceDescription: role.descriptionHtml, descriptionHtml: role.descriptionHtml, sourceDescriptionType: 'declared-native-modal',
    sourceNativeModal: { id: role.id, attributes: role.modalAttributes, originalHTML: role.originalModalHTML, identityKind: 'DOM-modal-target-not-verified-posting-ID' },
    sourceCountryProvenance: role.countryProvenance, sourceDetailComplete: false, sourceListingComplete: false,
    lifecycleCleanupAllowed: false,
  }))
  return { observations, jobs, controlsQualified, modalActivationVerified: false, fullSourceVerified: false,
    authoritativeSourceTotal: null, authoritativeIndiaFacetCount: null }
}
