import { createHash } from 'node:crypto'
import { requireNative } from '../../scraper-support/shared/nativeJobPosting.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'

const sha = value => createHash('sha256').update(value).digest('hex')
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value
const reviewedProfileSHAs = new Set([
  'a647e2dd2178923548eb07b39d1c78b24ee4e72db75d4c953f7d6fe6745086e3',
  // A later genuine page adds one Cloudflare RUM module. Its exact URL,
  // SHA512 integrity and complete beacon configuration remain in this profile.
  // The captured SRI-matching bytes only observe/report performance; no new
  // declaration or general Cloudflare destination is accepted by this review.
  'e60b4f8706125f159d1bf68ba3324cb46b8444568681aa2e5acff1b1901d6705',
  // The same module before the same bootstrap is separately observed/reviewed.
  // Keep declaration order exact rather than normalizing executable order.
  'e29174e325b8ee24e1b24f00b368fb3665fadcff4f5f7c795316eac105cb468d',
])

function reviewedInlineBody(raw) {
  if (!raw.startsWith('window.__CF$cv$params=')) return raw
  // This observed bootstrap has four per-response data strings and a repeated
  // ray. Qualify their exact quoted grammar and linkage; retain every code byte,
  // the fixed i:60 setting and the same-origin loader resource in the digest.
  const match = /^window\.__CF\$cv\$params=\{r:'([a-f\d]{16})',t:'([A-Za-z\d+/=]{8,64})',u:'([a-f\d]{32})',ut:'([A-Za-z\d_.-]{64,512})',i:60\};/.exec(raw)
  requireNative(match && /^\d{10}$/.test(Buffer.from(match[2], 'base64').toString())
    && Buffer.from(match[2], 'base64').toString('base64') === match[2], 'Arcadia native bootstrap data slots changed')
  const suffix = raw.slice(match[0].length), ray = '?ray=' + match[1]
  requireNative(suffix.split(ray).length === 2, 'Arcadia native bootstrap ray linkage changed')
  return "window.__CF$cv$params={r:'<ray>',t:'<time>',u:'<visitor>',ut:'<bootstrap-data>',i:60};" + suffix.replace(ray, '?ray=<ray>')
}

function reviewedAttributes(node, logoURL) {
  const attrs = { ...node.attrs }
  if (node.tag === 'link' && ['prefetch', 'preload'].includes(attrs.rel) && attrs.href === logoURL) {
    const url = new URL(attrs.href)
    requireNative(url.protocol === 'https:' && url.hostname === 'secured-assets.ripplingcdn.com' && !url.username && !url.password
      && !url.hash && url.pathname.endsWith('.png') && [...url.searchParams.keys()].sort().join(',') === 'Expires,Key-Pair-Id,Signature'
      && /^\d{10,13}$/.test(url.searchParams.get('Expires')) && /^[A-Za-z\d_~-]{64,2048}$/.test(url.searchParams.get('Signature'))
      && /^[A-Z\d]{8,32}$/.test(url.searchParams.get('Key-Pair-Id')), 'Arcadia native image resource declaration changed')
    // The path, key pair and all link attributes stay bound. Only the observed
    // expiring image signature is data; no arbitrary link is normalized.
    attrs.href = url.origin + url.pathname + '?Expires=<signed-expiry>&Signature=<signed-data>&Key-Pair-Id=' + url.searchParams.get('Key-Pair-Id')
  }
  return attrs
}

export function verifyNativeBoardDeclarations(html, items, logoURL) {
  const doc = readNativeDocument(html), roles = new Set(items.map(row => row.url)), declarations = []
  const visit = node => {
    const events = Object.fromEntries(Object.entries(node.attrs).filter(([key]) => /^on/i.test(key)))
    if (Object.keys(events).length) declarations.push({ tag: node.tag, eventHandlers: events })
    if (node.tag === 'script') declarations.push({ tag: node.tag, attributes: node.attrs,
      bodySHA256: node.attrs.id === '__NEXT_DATA__' && node.attrs.type === 'application/json' && !node.attrs.src
        ? null : sha(reviewedInlineBody(node.raw || '')) })
    // These exact native role destinations are separately reconciled to every
    // visible publisher card and typed row. Their IDs and cardinality are data.
    else if (node.tag === 'a' && roles.has(new URL(node.attrs.href || '', 'https://ats.rippling.com/arcadiacareers/jobs?pageSize=1000').href)) {
      requireNative(Object.keys(node.attrs).sort().join(',') === 'class,font-size,href'
        && node.attrs.class === 'css-1f4uuoy epvls061' && node.attrs['font-size'] === '20',
      'Arcadia native role-link navigation attributes changed')
    }
    else if (['a', 'area', 'form', 'base', 'iframe', 'frame', 'object', 'embed', 'portal', 'link'].includes(node.tag)
      || node.tag === 'meta' && node.attrs['http-equiv'] || ['input', 'button'].includes(node.tag) && (node.attrs.formaction || node.attrs.form)) {
      declarations.push({ tag: node.tag, attributes: reviewedAttributes(node, logoURL) })
    }
    // Walk the retained tree directly. CSS/hidden/template exclusions from a
    // visible-content query cannot erase executable, form or embed declarations.
    node.children.filter(child => typeof child !== 'string').forEach(visit)
  }
  doc.nodes(node => node.tag === 'root').forEach(visit)
  const bodySHA256 = sha(JSON.stringify(canonical(declarations)))
  requireNative(reviewedProfileSHAs.has(bodySHA256), 'Arcadia native board executable or navigation/form/embed declarations changed')
  return { complete: true, profileSHA256: bodySHA256, declarationCount: declarations.length,
    nativeRoleLinkAttributesQualified: true, nextInventoryDataExcludedFromExecutableHash: true,
    reviewedDynamicDataSlots: ['signed-native-logo-query', 'qualified-Cloudflare-bootstrap-data'] }
}
