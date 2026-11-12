import {createHash} from 'node:crypto'
import {DOMParser} from '@xmldom/xmldom'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const origin='https://www.botminds.ai',hub=origin+'/careers',jobsSitemapUrl=origin+'/api/jobs-sitemap'
const namespace='http://www.sitemaps.org/schemas/sitemap/0.9'
const digest=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Botminds source scope: '+message)}
const scripts=[
 '/_astro/ClientRouter.astro_astro_type_script_index_0_lang.BHP6amGi.js',
 '/js/9fe386b16906.js',
 '/_astro/page.DxxK05Nl.js',
 '/_astro/Base.astro_astro_type_script_index_0_lang.RXUwxUjY.js',
 '/_astro/index.astro_astro_type_script_index_0_lang.qeH_4dqN.js',
]
// Complete active declarations reviewed in the retained public 2026-11-12
// company/careers responses. This catches an unfamiliar recruiter URL even
// when its domain and label carry no recognizable recruitment keywords.
const navigationDigests={
 [origin+'/']:'b5a0dee304961cd74bb02a041b4624d3d53cd05dbd80ca029360bde84c2da9eb',
 [hub]:'d499d70afa36c2c646a527ec0518c5daf983c7046ad460258e0e9e7163f13109',
}
const executionDigests={
 [origin+'/']:'677fbdd69acbd794f29a568a16e14eb76f27d82cf5be502b00737642cc858fba',
 [hub]:'ed3e98353a29d7269e922c387333faf8a1b483a144eecfa4dc1d13dbd62ec804',
}
const executionDigest=doc=>digest(JSON.stringify(doc.nodes(node=>node.tag==='script'&&node.attrs.type!=='application/ld+json').map(node=>({
 attributes:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b))),inlineSha256:digest(node.raw||''),
}))))
const navigationDigest=doc=>digest(JSON.stringify(doc.nodes(node=>['a','area','form','object','embed','link'].includes(node.tag)).map(node=>({
 tag:node.tag,attributes:Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b))),label:doc.text(node),
}))))
const recruitingLabel=/^(?:careers?|jobs?|all jobs|open (?:roles|positions)|job openings|vacancies|join (?:us|our team)|we.re hiring|apply for (?:this|a) (?:job|role))\b/i
const recruitingURL=/\/(?:careers?|jobs?|recruitment|vacancies)(?:\/|\?|$)|(?:greenhouse\.io|lever\.co|ashbyhq\.com|myworkdayjobs\.com|smartrecruiters\.com|workable\.com|recruitee\.com|bamboohr\.com)/i
const documentAt=(html,canonical)=>{
 const doc=readNativeDocument(html),canonicals=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 need(canonicals.length===1&&canonicals[0].attrs.href===canonical,'canonical company/careers identity changed')
 need(doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').some(node=>{
  try{const schema=JSON.parse(node.raw);return schema['@type']==='Organization'&&schema.name==='Botminds'&&schema.url===origin}catch{return false}
 }),'official company Organization changed')
 need(!doc.nodes(node=>node.tag==='base'||node.tag==='meta'&&/^refresh$/i.test(node.attrs['http-equiv']||'')).length,'unreviewed company/careers navigation')
 // iframe is an inert raw-text element in this parser, so nodes() excludes
 // the frame itself. Its activeFrame marker remains on the active parent's
 // direct children, including blank and srcdoc frames without a source URL.
 need(!doc.nodes(node=>node.children.some(child=>typeof child!=='string'&&child.activeFrame)).length,
  'additional active company/careers frame')
 need(navigationDigest(doc)===navigationDigests[canonical],'unreviewed complete company/careers navigation declarations')
 need(executionDigest(doc)===executionDigests[canonical],'unreviewed complete company/careers program declarations or inline bytes')
 return doc
}
const recruitingBindings=(doc,{company=false}={})=>{
 const bindings=[]
 for(const node of doc.nodes(node=>['a','iframe','object','form'].includes(node.tag))){
  const value=node.attrs.href||node.attrs.src||node.attrs.data||node.attrs.action||'',label=doc.text(node).trim()
  if(!recruitingURL.test(value)&&!recruitingLabel.test(label)){
   need(company||!['iframe','object'].includes(node.tag),'additional embedded careers channel')
   continue
  }
  if(value==='mailto:jobs@botminds.ai')continue
  let url;try{url=new URL(value,origin)}catch{need(false,'invalid recruiting channel URL')}
  need(node.tag==='a'&&url.href===hub,'additional or conflicting public recruiting channel')
  bindings.push({label,url:url.href})
 }
 need(bindings.some(binding=>/^Careers$/i.test(binding.label)),'official company careers handoff missing')
 return bindings.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))
}
const readSitemap=xml=>{
 need(typeof xml==='string'&&!/<!DOCTYPE|<!ENTITY/i.test(xml),'unreviewed jobs sitemap declaration')
 const invalid=()=>{throw Error('Botminds source scope: malformed native jobs sitemap')}
 const doc=new DOMParser({errorHandler:{warning:invalid,error:invalid,fatalError:invalid}}).parseFromString(xml,'application/xml')
 const root=doc.documentElement
 need(root?.localName==='urlset'&&root.namespaceURI===namespace&&root.attributes.length===1
  &&root.getAttribute('xmlns')===namespace,'jobs sitemap is not the declared full URL inventory')
 const elements=node=>Array.from(node.childNodes).filter(child=>child.nodeType===1)
 const unhandledText=node=>Array.from(node.childNodes).some(child=>![1,8].includes(child.nodeType)&&child.textContent?.trim())
 need(!unhandledText(root),'unreviewed jobs sitemap continuation text')
 const urls=elements(root).map(entry=>{
  const children=elements(entry),locations=children.filter(child=>child.localName==='loc')
  need(entry.localName==='url'&&entry.namespaceURI===namespace&&!entry.attributes.length&&!unhandledText(entry)&&locations.length===1
   &&children.every(child=>child.namespaceURI===namespace&&['loc','lastmod'].includes(child.localName)&&!child.attributes.length&&!elements(child).length)
   &&children.filter(child=>child.localName==='lastmod').length<=1,'unreviewed jobs sitemap entry')
  const value=locations[0].textContent
  let url;try{url=new URL(value)}catch{need(false,'invalid native jobs sitemap URL')}
  need(url.origin===origin&&!url.username&&!url.password&&!url.port&&!url.search&&!url.hash
   &&/^\/careers\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(url.pathname)&&url.pathname!=='/careers/apply'
   &&url.href===value,'foreign or non-role jobs sitemap URL')
  return url.pathname.split('/').at(-1)
 })
 need(urls.length<=200&&new Set(urls).size===urls.length,'duplicate or oversized jobs sitemap')
 return urls.sort()
}

// This certificate is specific to the currently reviewed Botminds all-roles
// controller. The independent publisher-declared jobs sitemap must agree with
// the complete native feed; a stable feed alone cannot grant source cleanup.
export function readBotmindsPublicScope({companyHTML,hubHTML,robotsText,jobsSitemapXML,records}){
 const company=documentAt(companyHTML,origin+'/'),careers=documentAt(hubHTML,hub)
 const companyBindings=recruitingBindings(company,{company:true}),careersBindings=recruitingBindings(careers)
 const activeScripts=careers.nodes(node=>node.tag==='script'&&node.attrs.type!=='application/ld+json')
 need(activeScripts.length===scripts.length&&activeScripts.every((node,index)=>node.attrs.src===scripts[index]
  &&(index===1?!node.attrs.type:node.attrs.type==='module')&&!node.raw?.trim()),'unreviewed careers controller declaration')
 need(careers.nodes(node=>node.attrs.id==='jobs').length===1&&careers.nodes(node=>node.attrs.id==='jobs-state').length===1,
  'unreviewed public all-roles container')
 const sitemapDeclarations=robotsText.split(/\r?\n/).map(line=>/^Sitemap:\s*(\S+)\s*$/i.exec(line)?.[1]).filter(Boolean)
 need(sitemapDeclarations.includes(jobsSitemapUrl)&&/^Allow:\s*\/api\/jobs\s*$/im.test(robotsText),
  'native public jobs feed or sitemap declaration missing')
 need(sitemapDeclarations.every(url=>[origin+'/sitemap-index.xml',origin+'/sitemap-video.xml',jobsSitemapUrl].includes(url)),
  'additional public recruiting sitemap')
 const nativeRoleIds=readSitemap(jobsSitemapXML),feedIds=records.map(row=>row.slug).sort()
 need(JSON.stringify(nativeRoleIds)===JSON.stringify(feedIds),'native jobs sitemap and full public feed identities disagree')
 need(records.every(row=>['','onsite','hybrid','remote'].includes(row.workplace)),
  'unrecognized native role workplace scope')
 return {companyUrl:origin+'/',companyCareerUrl:hub,jobsSitemapUrl,nativeRoleIds,companyBindings,careersBindings,
  reviewedNavigationDigests:{company:navigationDigest(company),careers:navigationDigest(careers)},
  reviewedExecutionDigests:{company:executionDigest(company),careers:executionDigest(careers)},
  additionalUninspectedSitemapDeclarations:sitemapDeclarations.filter(url=>url!==jobsSitemapUrl),
  nativeDocuments:{companyHTML,hubHTML,robotsText,jobsSitemapXML},
  responseDigests:{companyHTML:digest(companyHTML),hubHTML:digest(hubHTML),robotsText:digest(robotsText),jobsSitemapXML:digest(jobsSitemapXML)}}
}
