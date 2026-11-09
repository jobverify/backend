import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const stable=value=>Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,stable(value[key])])):value
export const svgGeometryHash=value=>createHash('sha256').update(JSON.stringify(stable(value))).digest('hex')
const same=(a,b)=>svgGeometryHash(a)===svgGeometryHash(b)
const at=(tree,path)=>path.reduce((node,index)=>node?.children?.[index],tree)
const validId=value=>typeof value==='string'&&/^[1-9]\d{0,9}$/.test(value)&&Number(value)<=2147483647

// Decode reference spellings as data, not executable CSS/JavaScript. Every
// consumer program is additionally byte-pinned before this proof is usable.
const unescapeReferences=text=>String(text).replace(/\\u\{([0-9a-f]{1,6})\}|\\u([0-9a-f]{4})|\\x([0-9a-f]{2})|\\([0-9a-f]{1,6})(?:\r\n|[\t\r\n\f ])?|\\([^\r\n])/gi,
  (_,a,b,c,d,e)=>{if(e!==undefined)return e;const code=parseInt(a||b||c||d,16);return code>0x10ffff?'\ufffd':String.fromCodePoint(code)})
const referenceText=text=>unescapeReferences(String(text).replace(/(?:%[0-9a-f]{2})+/gi,encoded=>{try{return decodeURIComponent(encoded)}catch{return encoded}}))
const consumerTextCache=new WeakMap()
const consumerText=asset=>{const prior=consumerTextCache.get(asset);if(prior?.body===asset.body)return prior.decoded;const decoded=referenceText(asset.body);consumerTextCache.set(asset,{body:asset.body,decoded});return decoded}

export function activePublisherAttributesHash(tree){
  const rows=[]
  const visit=node=>{if(typeof node==='string'||node.inert)return;if(node.tag!=='root')rows.push([node.tag,Object.entries(node.attributes).sort()]);node.children.forEach(visit)}
  visit(tree)
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex')
}

export function qualifyTenableInvalidGraphicResponse(response,resolution,expected){
  const fail=reason=>({...response,resolution,qualified:false,reason,purpose:'invalid-graphic-reference-not-native-inventory'})
  if(response.cfMitigated||response.redirectLocation)return fail('graphic-resource-challenge-or-redirect-metadata')
  if(response.url!==resolution.url||response.finalUrl!==resolution.url||response.status!==404||response.contentType!==expected.contentType)return fail('graphic-resource-not-same-target-404-html')
  try{
    const doc=readNativeDocument(response.body),root=doc.nodes(node=>node.tag==='root')[0],elements=root.children.filter(node=>typeof node!=='string')
    const title=doc.nodes(node=>node.tag==='title')[0]?.raw,headings=doc.nodes(node=>/^h[12]$/.test(node.tag)).map(node=>doc.text(node))
    const main=doc.nodes(node=>node.tag==='main'&&/(?:^|\s)page-404(?:\s|$)/.test(node.attrs.class||''))
    if(elements.length!==1||elements[0].tag!=='html'||title!==expected.title||main.length!==1||headings[0]!==expected.h1||headings[1]!==expected.h2
      ||/access denied|verify you are human|just a moment|checking your browser|enable javascript and cookies/i.test([title,...headings].join(' '))
      ||/cf-chl-|challenge-platform/i.test(response.body))return fail('graphic-response-not-genuine-tenable-nonsvg-404-page')
    return {...response,resolution,qualified:true,purpose:'invalid-graphic-reference-not-native-inventory',documentElement:'html',title,headings:headings.slice(0,2),
      semantics:'External nonfragment target is unavailable HTML, not a clipPath; no clipping. This is not native vacancy absence evidence.'}
  }catch{return fail('graphic-unavailable-document-unreviewed')}
}

export function projectTenableSvgReferences(surface,url,policy,consumers,resources=[]){
  const signatureTree=structuredClone(surface.signatureTree),rawTree=surface.rawTree,proofs=[],reasons=[]
  const requests=[]
  const fail=reason=>({signatureTree:surface.signatureTree,svgReferenceProofs:[],svgReferenceReasons:[reason],invalidGraphicRequests:[]})
  const expected=policy.pages[url]?.symbols
  if(!expected||!consumers.verified)return fail('unreviewed-svg-consumer-cohort')
  const nodes=[],definitions=[],references=[],ids=new Map()
  const visit=(node,path=[],svgPath=null)=>{
    if(typeof node==='string')return
    if(node.tag==='svg')svgPath=path
    const row={node,path,svgPath,decodedAttributes:Object.entries(node.attributes).map(([key,value])=>[key,referenceText(value)]),
      decodedRaw:node.raw===null?null:referenceText(node.raw),decodedTexts:node.children.filter(child=>typeof child==='string').map(referenceText)};nodes.push(row)
    if(node.tag==='clippath')definitions.push(row)
    if(Object.hasOwn(node.attributes,'clip-path'))references.push(row)
    if(Object.hasOwn(node.attributes,'id')){const id=node.attributes.id;if(!ids.has(id))ids.set(id,[]);ids.get(id).push(row)}
    node.children.forEach((child,index)=>visit(child,[...path,index],svgPath))
  }
  visit(rawTree)
  const page=policy.pages[url]
  if(!same(definitions.map(row=>row.path),page.allDefinitionPaths)
    ||!same(references.map(row=>row.path),page.allReferencePaths))return fail('unreviewed-svg-definition-or-reference-path-count-order')
  for(const fixed of page.fixedFields){const node=at(rawTree,fixed.path);if(node?.tag!==fixed.tag||!same(node.attributes,fixed.attributes))return fail('changed-unprojected-svg-field')}
  for(const asset of consumers.assets)if(asset.kind==='stylesheet'&&(/@import\b/i.test(consumerText(asset))
    ||/\[\s*(?:(?:[\w*-]+)\|)?(?:id|clip-path)\b/i.test(consumerText(asset))))return fail('unreviewed-css-import-or-id-value-selector')
  for(const pair of expected){
    const definition=definitions.find(row=>same(row.path,pair.definitionPath)),reference=pair.referencePath?references.find(row=>same(row.path,pair.referencePath)):null
    const svg=at(rawTree,pair.svgPath),id=definition.node.attributes.id
    const pattern=new RegExp('(^|[^a-zA-Z0-9_-])'+id+'($|[^a-zA-Z0-9_-])'),mentions=text=>pattern.test(text)
    if(svg?.tag!=='svg'||definition.node.tag!=='clippath'||!validId(id)||!same(definition.svgPath,pair.svgPath))return fail('unresolved-malformed-svg-definition')
    if(pair.kind==='closed-local-reference'&&(reference?.node.tag!=='g'||!same(reference.svgPath,pair.svgPath)||reference.node.attributes['clip-path']!=='url(#'+id+')'))return fail('unresolved-malformed-or-cross-svg-local-reference')
    if(!['closed-local-reference','unused-definition','invalid-external-graphic'].includes(pair.kind))return fail('unknown-svg-symbol-category')
    if(pair.kind==='invalid-external-graphic'){
      if(reference?.node.tag!=='g'||!same(reference.svgPath,pair.svgPath)||reference.node.attributes['clip-path']!=='url('+id+')')return fail('unreviewed-nonfragment-graphic-reference')
      const passive=node=>typeof node==='string'?!node.trim():['svg','g','path','defs','clippath','rect'].includes(node.tag)
        &&Object.keys(node.attributes).every(key=>['fill','height','viewbox','width','xmlns','clip-path','d','id'].includes(key))&&node.raw===null&&node.children.every(passive)
      if(!passive(svg))return fail('nonpassive-or-unreviewed-graphic-children-attributes')
      if(nodes.some(row=>row.node.tag==='base'||Object.hasOwn(row.node.attributes,'xml:base')))return fail('unreviewed-graphic-document-base')
      const target=new URL(id,url)
      if(target.origin!==policy.origin||target.pathname!=='/'+id||target.search||target.hash||target.username||target.password)return fail('unreviewed-graphic-resource-authority')
      requests.push({url:target.href,sourcePageUrl:url,documentBaseUri:url,htmlBaseElements:[],xmlBaseElements:[],svgPath:pair.svgPath,
        referencePath:pair.referencePath,definitionPath:pair.definitionPath,originalId:id,originalClipPath:reference.node.attributes['clip-path']})
    }
    if(ids.get(id)?.length!==1||ids.has(pair.canonicalId)||proofs.some(proof=>proof.originalId===id))return fail('duplicate-or-colliding-svg-identity')
    for(const row of nodes){
      for(const[key,value]of row.decodedAttributes){
        if(key==='id'&&same(row.path,pair.definitionPath)||pair.referencePath&&key==='clip-path'&&same(row.path,pair.referencePath))continue
        if(mentions(value))return fail('additional-dom-consumer-of-svg-identity')
      }
      if(row.decodedRaw!==null&&mentions(row.decodedRaw)||row.decodedTexts.some(mentions))return fail('additional-raw-css-script-text-consumer-of-svg-identity')
    }
    for(const asset of consumers.assets)if(mentions(consumerText(asset)))return fail('additional-external-program-consumer-of-svg-identity')
    at(signatureTree,pair.definitionPath).attributes.id=pair.canonicalId
    if(pair.kind==='closed-local-reference')at(signatureTree,pair.referencePath).attributes['clip-path']='url(#'+pair.canonicalId+')'
    if(pair.kind==='invalid-external-graphic')at(signatureTree,pair.referencePath).attributes['clip-path']='reviewed-unavailable-nonsvg-graphic-reference'
    if(svgGeometryHash(at(signatureTree,pair.svgPath))!==pair.geometrySha256)return fail('unreviewed-svg-geometry-attributes-or-children')
    proofs.push({kind:pair.kind,svgPath:pair.svgPath,definitionPath:pair.definitionPath,referencePath:pair.referencePath??null,
      originalId:id,originalReference:reference?.node.attributes['clip-path']??null,canonicalId:pair.canonicalId,
      geometrySha256:pair.geometrySha256,globalDefinitionCount:ids.get(id).length,localReferenceCount:pair.kind==='closed-local-reference'?1:0,
      method:pair.kind==='invalid-external-graphic'?'separate-fresh-unavailable-nonsvg-graphic-resource':pair.kind==='unused-definition'?'zero-consumer-unused-svg-definition-alpha-equivalence':'closed-known-same-svg-clip-definition-and-reference-alpha-equivalence'})
  }
  const qualifiedResources=[]
  for(const resolution of requests){
    const response=resources.find(resource=>resource.url===resolution.url)
    if(!response)return {signatureTree:surface.signatureTree,svgReferenceProofs:proofs,svgReferenceReasons:['fresh-invalid-graphic-resource-proof-unavailable'],invalidGraphicRequests:requests}
    const proof=qualifyTenableInvalidGraphicResponse(response,resolution,policy.unavailablePage)
    qualifiedResources.push(proof)
    if(!proof.qualified)reasons.push(proof.reason)
  }
  if(reasons.length)return {signatureTree:surface.signatureTree,svgReferenceProofs:proofs,svgReferenceReasons:reasons,invalidGraphicRequests:requests,invalidGraphicResourceProofs:qualifiedResources}
  return {signatureTree,svgReferenceProofs:proofs,svgReferenceReasons:reasons,
    invalidGraphicRequests:requests,invalidGraphicResourceProofs:qualifiedResources,
    svgConsumerProof:consumers.assets.map(({url,sha256,contentType,kind})=>({url,sha256,contentType,kind}))}
}
