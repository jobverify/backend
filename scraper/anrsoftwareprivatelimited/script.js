import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG } from './catalog.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {runCurrentAnr} from './currentNative.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = ANR_SOFTWARE_PRIVATE_LIMITED_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const CAREERS_URL = PROVIDER_METADATA.companyCareerPage

// These are declared source observations, never a rendering or vacancy proof.
// Traverse inert nodes too: hidden/disabled criteria and duplicate controls must
// survive audit. The full original HTML preserves comments and exact raw bytes.
const walk = (node, predicate) => [
  ...(predicate(node) ? [node] : []),
  ...(node.children || []).filter(child => typeof child !== 'string').flatMap(child => walk(child, predicate)),
]
const hasClass = (node, name) => String(node.attrs.class || '').split(/\s+/).includes(name)
const declaredText = node => {
  if (['script','style'].includes(node.tag)) return ''
  const value = node.raw ?? (node.children || []).map(child => typeof child === 'string' ? child : declaredText(child)).join(' ')
  return decodeNativeEntities(value).replace(/\s+/g, ' ').trim()
}

// Legacy export retained for a page identity signal only; a no-vacancy token
// anywhere in a raw response cannot establish an empty inventory.
export const hasVerifiedCareersPageSignal = (html = '') => {
  const document = readNativeDocument(String(html ?? ''))
  return document.nodes(node => node.tag === 'title').some(node => /^Career - ANR Software Pvt Ltd\.$/i.test((node.raw || '').trim()))
    && document.nodes(node => /^h[1-6]$/.test(node.tag)).some(node => /^Current Job Openings$/i.test(document.text(node)))
}

export const inspectAnrCareersPage = (html = '') => {
  const originalCareersHTML = String(html ?? '')
  const document = readNativeDocument(originalCareersHTML)
  const root = document.nodes(node => node.tag === 'root')[0]
  const cards = walk(root, node => hasClass(node, 'current-opening'))
  const observations = cards.map((card, observationIndex) => {
    // A nested card is its own observation; do not borrow its title or criteria.
    const owned = (node, predicate) => [
      ...(predicate(node) ? [node] : []),
      ...(node.children || []).filter(child => typeof child !== 'string' && !hasClass(child, 'current-opening')).flatMap(child => owned(child, predicate)),
    ]
    const titles = owned(card, node => node.tag === 'h2').map(node => ({attrs:node.attrs,text:declaredText(node)}))
    const applyControls = owned(card, node => ['button','a','input'].includes(node.tag) && hasClass(node,'apply')).map(node => ({attrs:node.attrs,text:declaredText(node),disabled:Object.hasOwn(node.attrs,'disabled'),rawNode:node}))
    return {
      observationIndex, // Local audit position only, not a native job identity.
      title: titles.length === 1 ? titles[0].text : null,
      nativeTitleCandidates: titles,
      jobId:null, applyUrl:null, sourceUrl:CAREERS_URL,
      country:null, location:null, city:null, legalHiringEmployer:null,
      sourcePublisher:COMPANY, postingDate:null, closingDate:null,
      openingCountText:owned(card,node => hasClass(node,'total-opening')).map(declaredText).join(' ') || null,
      categoryText:owned(card,node => hasClass(node,'job-category')).map(declaredText).join(' ') || null,
      applyControls,
      descriptionBranches:owned(card,node => hasClass(node,'description-text')).map(node => ({attrs:node.attrs,text:declaredText(node),rawNode:node})),
      rawCardNode:card, declaredCardText:declaredText(card),
      status:'unresolved', sourceIdentityVerified:false,
      sourceVisibilityVerified:false, sourceDetailComplete:false,
      sourceListingComplete:false, sourceScopeComplete:false, lifecycleCleanupAllowed:false,
    }
  })
  const ids = new Map()
  for (const node of walk(root,node => Boolean(node.attrs.id))) ids.set(node.attrs.id,(ids.get(node.attrs.id)||0)+1)
  return {
    source:SOURCE, originalCareersHTML, observations,
    observationUnit:'raw card block; not a unique vacancy or hiring count',
    nativeIdCollisions:[...ids].filter(([,occurrences]) => occurrences > 1).map(([id,occurrences]) => ({id,occurrences})),
    applicationForms:walk(root,node => node.tag === 'form').map(node => ({attrs:node.attrs,declaredText:declaredText(node),rawNode:node})),
    declaredResources:walk(root,node => ['link','script','iframe'].includes(node.tag)).map(node => ({tag:node.tag,attrs:node.attrs,rawBody:node.raw ?? null})),
    sourceScopeComplete:false, sourceListingComplete:false, lifecycleCleanupAllowed:false,
    authoritativeSourceTotal:null, authoritativeIndiaFacetCount:null,
    currentLiveQualification:false, noClosingProof:true,
    reasons:['role countries and native vacancy identities unresolved','external stylesheet and accordion/form activation unverified','all-channel inventory and closing cohort unverified'],
  }
}

export const createAnrsoftwareprivatelimitedScraper = () => ({run:(options={})=>runCurrentAnr(options,inspectAnrCareersPage)})

export const run = async (options = {}) => createAnrsoftwareprivatelimitedScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()

  if (process.argv.includes('--dry-run')) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
