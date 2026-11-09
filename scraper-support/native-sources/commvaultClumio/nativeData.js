import { parse } from 'acorn'
import { readNativeDocument } from '../../utils/activeNativeHtml.js'
import { readLiteralModel } from '../literalModel.js'
import { countryName } from '../jobPostingData.js'
import { children, content, hasClass, text } from '../cisVeeam/publishedData.js'
import { geography, literalFields, requireNative } from '../declaredGreenhouse/nativeData.js'

export const PROFILE = Object.freeze({ source: 'clumio', companyName: 'Clumio', publisherName: 'Commvault', countryFilter: 'Global',
  primaryURL: 'https://www.commvault.com/careers/jobs', publicAPIBase: 'https://boards-api.greenhouse.io/v1/boards/commvault', boardToken: 'commvault' })
export const firstPartyRoleURI = value => {
  try { const u = new URL(value, PROFILE.primaryURL)
    return u.origin === 'https://www.commvault.com' && !u.username && !u.password && !u.search && !u.hash
      && /^\/careers\/jobs\/[1-9]\d*$/.test(u.pathname) ? u.href : null
  } catch { return null }
}
export const primaryModel = html => {
  const doc = readNativeDocument(html), models = []
  requireNative(doc.nodes(n => n.tag === 'title').some(n => /Find a Career with Commvault/i.test(n.raw || ''))
    && doc.nodes(n => n.tag === 'h1').some(n => /^Find a career with Commvault$/i.test(content(n))), 'current corporate careers identity changed')
  for (const script of doc.nodes(n => n.tag === 'script' && !n.attrs.src && !Object.hasOwn(n.attrs, 'nomodule')
    && ['', 'text/javascript', 'application/javascript', 'module'].includes((n.attrs.type || '').toLowerCase()))) {
    if (!/\bgreenhouse_list\b/.test(script.raw || '')) continue
    const ast = parse(script.raw, { ecmaVersion: 'latest' })
    // An initializer is current data only under this supported whole-script
    // contract. Later mutation/aliasing cannot be interpreted without running
    // the website program, so unknown statements hold the declaration.
    const statements = ast.body.filter(node => node.type !== 'EmptyStatement')
    requireNative(statements.length === 1 && statements[0].type === 'VariableDeclaration'
      && statements[0].kind === 'const' && statements[0].declarations.length === 1, 'unsupported corporate literal ownership statement')
    const declaration = statements[0].declarations[0]
    requireNative(declaration.id.type === 'Identifier' && declaration.id.name === 'greenhouse_list'
      && declaration.init?.type === 'ArrayExpression', 'corporate job model is not an unconditional literal array')
    const value = readLiteralModel(script.raw.slice(declaration.init.start, declaration.init.end)).value
    requireNative(Array.isArray(value), 'corporate job model is not an array');models.push(value)
  }
  requireNative(models.length === 1, 'unique current literal corporate job model unavailable')
  const links = new Map()
  for (const node of doc.nodes(n => n.tag === 'a' && n.attrs.href)) {
    const url = firstPartyRoleURI(node.attrs.href)
    if (url) links.set(url.split('/').at(-1), url)
  }
  return { records: models[0], links }
}
export const ownRole = (html, id, title) => {
  const doc = readNativeDocument(html), headings = doc.nodes(n => hasClass(n, 'job__heading')), bodies = doc.nodes(n => hasClass(n, 'job__body'))
  requireNative(headings.length === 1 && bodies.length === 1, 'unique corporate own-role body/heading unavailable')
  const titles = children(headings[0], n => n.tag === 'h1')
  requireNative(titles.length === 1 && content(titles[0]) === title, 'corporate own-role title conflict')
  const target = 'https://job-boards.greenhouse.io/commvault/jobs/' + id
  const handoffs = doc.nodes(n => n.tag === 'a' && n.attrs.href).map(n => n.attrs.href).filter(value => {
    try { return new URL(value).hostname === 'job-boards.greenhouse.io' } catch { return false }
  })
  requireNative(handoffs.length > 0 && handoffs.every(value => value === target || value === target + '#application-form'), 'corporate own-role native posting handoff changed')
  const body = content(bodies[0]), role = bodies[0].children.filter(n => typeof n !== 'string'
    && !['content-intro', 'content-conclusion', 'content-pay-transparency'].some(c => hasClass(n, c)))
  // The current job body is retained in full. Generic company overview, fraud,
  // pay and equal-opportunity sections cannot supply a product-brand match.
  let genericOverview = false
  const owned = []
  for (const node of role) {
    if (/^h[1-6]$/.test(node.tag)) genericOverview = /^About Commvault$/i.test(content(node))
    if (!genericOverview) owned.push(content(node))
  }
  const roleOwned = text(owned.join(' '))
  requireNative(body && roleOwned, 'corporate own-role criteria unavailable')
  return { title, body, roleOwned, originalNativeHandoffs: handoffs, brandQualified: /\bClumio\b/i.test(roleOwned) }
}
const typedCountry = value => countryName(value) || (/^Korea,\s*Republic Of$/i.test(text(value)) ? 'South Korea' : null)
export const combinedGeography = (native, index, corporate) => {
  const original = { country: corporate.country ?? null, state: corporate.state ?? null, location: corporate.location ?? null }
  const typed = typedCountry(corporate.country), first = geography({ location: { name: corporate.location }, offices: [],
    metadata: typed ? [{ name: 'Country', value: typed }] : [] }, { nodes: new Map(), posts: new Map() })
  const current = geography(native, index), countries = [...new Set([...current.sourceNativeCountries, ...first.sourceNativeCountries])]
  const disagreement = Boolean(typed && current.sourceNativeCountries.some(country => country !== typed))
  const conflict = current.sourceNativeCountryConflict || first.sourceNativeCountryConflict || disagreement
  const country = conflict ? null : countries.includes('India') ? 'India' : countries.length === 1 ? countries[0] : null
  const labels = country ? [...new Set([...current.locations, ...first.locations])] : []
  return { ...current, country, city: null, state: null, location: country ? labels.join('; ') || country : null, locations: labels,
    sourceNativeCountries: countries, sourceNativeCountryConflict: conflict,
    sourceCountryScopeUnresolved: conflict || !country || current.sourceCountryScopeUnresolved || first.sourceCountryScopeUnresolved,
    sourceFirstPartyGeography: original, sourceNativeCountryEvidence: { native: current.sourceNativeCountryEvidence,
      firstParty: { original, typedCountry: typed, projected: first }, conflicts: disagreement ? [{ reason: 'corporate-native-country-scope-conflict' }] : [] } }
}
export const combinedFields = (native, corporate, role) => {
  const get = name => [...new Set((native.metadata || []).filter(m => m.name === name).map(m => m.value).filter(v => typeof v === 'string'))]
  const hours = [...new Set([corporate.hiring_type, ...get('Time Type')].filter(v => typeof v === 'string').map(text))]
  const employmentType = hours.length === 1 ? /^full[ -]time$/i.test(hours[0]) ? 'Full-time' : /^part[ -]time$/i.test(hours[0]) ? 'Part-time'
    : /^(?:contract|temporary|fixed term)$/i.test(hours[0]) ? 'Contract' : /^intern(?:ship)?$/i.test(hours[0]) ? 'Internship' : null : null
  const flags = [...new Set([corporate.remote_position, ...get('Remote Position')].filter(v => typeof v === 'string').map(v => text(v).toLowerCase()))]
  const explicit = [...new Set([...role.roleOwned.matchAll(/#LI-(Hybrid|Remote|Onsite)\b/gi)].map(m => m[1].toLowerCase()))]
  const flagRemote = flags.length === 1 && flags[0] === 'yes', contradictory = flags.length > 1 || explicit.length > 1
    || flagRemote && explicit.length === 1 && explicit[0] !== 'remote' || flags.includes('no') && explicit[0] === 'remote'
  const arrangement = !contradictory && (explicit[0] || (flagRemote ? 'remote' : null))
  const remoteStatus = arrangement === 'remote' ? 'Remote' : arrangement === 'hybrid' ? 'Hybrid' : arrangement === 'onsite' ? 'On-site' : null
  return { ...literalFields(native), sourceEmploymentType: hours.length === 1 ? hours[0] : null, employmentType,
    sourceEmploymentTypeUnresolved: !employmentType || employmentType === 'Part-time', sourceFirstPartyEmploymentType: corporate.hiring_type ?? null,
    sourceNativeTimeTypeValues: get('Time Type'), sourceFirstPartyRemotePosition: corporate.remote_position ?? null,
    sourceNativeRemotePositionValues: get('Remote Position'), sourceNativeRoleArrangementTags: explicit,
    remoteStatus, sourceNativeWorkplaceType: remoteStatus, sourceRemoteStatusUnresolved: !remoteStatus,
    sourceNativeWorkplaceTypeProvenance: explicit.length === 1 ? 'corporate-role-owned-LI-tag' : flagRemote ? 'paired-positive-remote-position-fields' : null }
}
