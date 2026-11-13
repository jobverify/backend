import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readLiteralModel } from '../../scraper-support/native-sources/literalModel.js'

export const currentEpamProgram = JSON.parse(readFileSync(new URL('./reviewedProgram20261113.json', import.meta.url)))
const sha = value => createHash('sha256').update(value).digest('hex')
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
const requireProgram = (condition, code) => {
  if (!condition) throw Object.assign(new Error(code), { code })
}
const walk = node => [node, ...node.children.filter(child => typeof child !== 'string').flatMap(walk)]
const normalizedAttrs = node => {
  const attrs = { ...node.attrs }
  if (attrs['data-event-result']) attrs['data-event-result'] = 'NATIVE_ROLE_TITLE / NATIVE_ROLE_UID'
  return attrs
}
const potentialStyle = node => node.tag === 'style' || node.tag === 'link'
  && (/stylesheet/i.test(node.attrs.rel || '') || node.attrs.as?.toLowerCase() === 'style'
    || /(?:text\/css|\.css(?:[?#]|$))/i.test((node.attrs.type || '') + ' ' + (node.attrs.href || ''))
    || Object.hasOwn(node.attrs, 'onload'))

// This is the public, anonymous, own-role context. It establishes the currently
// declared renderer/control prototype; individual native models still need
// their own complete country, criteria, application-mode and closing proof.
export async function verifyCurrentEpamProgram({ html, sourceUrl, nativeRecord, read }) {
  const doc = readNativeDocument(html)
  const root = doc.nodes(node => node.tag === 'root')[0]
  const raw = walk(root), parents = new Map()
  for (const node of raw) for (const child of node.children) if (typeof child !== 'string') parents.set(child, node)
  const path = node => {
    const nodes = []
    while (node) { nodes.unshift({ tag: node.tag, attrs: normalizedAttrs(node) }); node = parents.get(node) }
    return nodes
  }
  const models = doc.nodes(node => node.tag === 'script' && node.attrs.id === '__NEXT_DATA__'
    && node.attrs.type === 'application/json')
  requireProgram(models.length === 1, 'native-role-context-model-ambiguous')
  const next = readLiteralModel(models[0].raw).value
  const props = next.props?.pageProps
  requireProgram(next.page === '/vacancy/[jobId]' && props?.pageType === 'vacancy_detail'
    && props.contentType === 'anywhere_pages_job_details_page' && props.locale === 'en-us'
    && props.canonicalPath === sourceUrl
    && next.query?.jobId === new URL(sourceUrl).pathname.split('/').at(-1), 'native-role-context-identity-changed')
  const role = props.job
  requireProgram(role && role.uid === nativeRecord.uid && role.unique_id === nativeRecord.unique_id
    && canonical(Object.fromEntries(Object.entries(role).filter(([key]) => key !== 'localizations'))) === canonical(nativeRecord)
    && canonical(role.localizations) === canonical([{ locale: 'en-us' }]), 'native-role-context-original-model-disagrees')
  requireProgram(props.staticData?.uid === currentEpamProgram.contextCmsUid,
    'native-role-context-cms-producer-changed')
  const otherPageProps = Object.fromEntries(Object.entries(props)
    .filter(([key]) => !['job', 'staticData', 'commonCmsProps'].includes(key))
    .map(([key, value]) => [key, key === 'canonicalPath' ? 'NATIVE_ROLE_CANONICAL_URL' : value]))
  requireProgram(sha(canonical(props.staticData)) === currentEpamProgram.staticDataSha256
    && sha(canonical(props.commonCmsProps)) === currentEpamProgram.commonCmsPropsSha256
    && sha(canonical(otherPageProps)) === currentEpamProgram.otherPagePropsSha256,
  'native-role-original-cms-or-application-rules-changed')

  const scripts = raw.filter(node => node.tag === 'script' && node.attrs.src).map(node => node.attrs)
  requireProgram(canonical(scripts) === canonical(currentEpamProgram.scriptDeclarations), 'native-role-script-declarations-changed')
  const inlinePrograms = raw.filter(node => node.tag === 'script' && !node.attrs.src
    && !/^application\/(?:ld\+)?json$/i.test(node.attrs.type || ''))
    .map(node => ({ attrs: node.attrs, sha256: sha(node.raw || '') }))
  requireProgram(canonical(inlinePrograms) === canonical(currentEpamProgram.inlinePrograms), 'native-role-inline-program-changed')
  const styleDeclarations = raw.filter(potentialStyle)
    .map(node => ({ tag: node.tag, attrs: node.attrs, rawSha256: node.raw ? sha(node.raw) : null }))
  requireProgram(canonical(styleDeclarations) === canonical(currentEpamProgram.styleDeclarations),
    'native-role-raw-style-declarations-changed')

  const controls = raw.filter(node => node.attrs.id === 'cta_job_apply_unauthorized')
  requireProgram(controls.length === 1, 'native-role-public-apply-control-ambiguous')
  const control = controls[0]
  requireProgram(!control.inert && !Object.hasOwn(control.attrs, 'disabled') && !Object.hasOwn(control.attrs, 'readonly')
    && control.attrs['aria-disabled'] !== 'true' && control.attrs['aria-readonly'] !== 'true'
    && control.attrs['data-event-result'] === nativeRecord.name + ' / ' + nativeRecord.uid
    && doc.text(control) === currentEpamProgram.applyText
    && canonical(path(control)) === canonical(currentEpamProgram.applyPath), 'native-role-public-apply-control-unqualified')
  const criteria = raw.filter(node => node.attrs['data-testid'] === 'description-container')
  requireProgram(criteria.length === 1 && canonical(path(criteria[0])) === canonical(currentEpamProgram.criterionPath),
    'native-role-original-criteria-context-changed')
  for (const node of walk(criteria[0])) {
    requireProgram(!node.inert && currentEpamProgram.criterionNodePatterns[node.tag]
      ?.some(pattern => canonical(pattern) === canonical(normalizedAttrs(node))), 'native-role-original-criteria-markup-changed')
  }
  requireProgram(doc.text(criteria[0]) === nativeRecord.text.replace(/\s+/g, ' ').trim(),
    'native-role-rendered-original-criteria-disagree')

  // A declaration URL does not bind the executable at that URL. Bootstrap
  // programs can load other producers; unread programs cannot be presumed
  // harmless. The main app is independently read and pinned by the collector.
  const qualifiedFiles = new Set(currentEpamProgram.programAndStyleFiles.map(file => file.url))
  const unresolvedScripts = scripts.map(attrs => new URL(attrs.src, sourceUrl).toString())
    .filter(url => !/\/_next\/static\/chunks\/pages\/_app-[a-f0-9]+\.js$/.test(new URL(url).pathname)
      && !qualifiedFiles.has(url))
  requireProgram(unresolvedScripts.length === 0, 'native-unreviewed-declared-bootstrap')

  const files = []
  for (const file of currentEpamProgram.programAndStyleFiles) {
    const text = await read(file.url, file.mime, 'public-role-program-and-style')
    requireProgram(sha(Buffer.from(text)) === file.sha256, 'native-role-program-or-styling-changed')
    files.push({ ...file })
  }
  // Complete original models remain available for an independent join. This
  // does not claim an authenticated user's eligibility or a submitted form.
  const evidence = {
    sourceUrl, nativeRoleId: nativeRecord.uid, nativeRecord: role,
    nativeCmsModel: props.staticData, nativeCommonCmsProps: props.commonCmsProps,
    nativeOtherPageProps: otherPageProps, publicAnonymousApplyEnabled: true,
    formSubmitted: false, userAuthenticated: false, declaredProgramsAndStyles: files,
    rawStyleDeclarations: styleDeclarations, inlinePrograms, criteriaMarkupQualified: true,
  }
  return { ...evidence, fingerprint: sha(canonical(evidence)) }
}
