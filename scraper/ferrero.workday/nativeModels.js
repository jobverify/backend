import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {document as rawDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const HOME='https://www.ferrero.com/',HOME_FINAL=HOME+'int/en/',CAREERS='https://www.ferrerocareers.com/int/en/',JOBS=CAREERS+'jobs'
export const PROFILE=JSON.parse(fs.readFileSync(new URL('./nativeProfile20261107.json',import.meta.url)))
export const sha=b=>createHash('sha256').update(b).digest('hex')
export const failure=(message,extra={})=>Object.assign(Error('[ferrero] '+message),{softFailure:true,abortRetries:true,upstreamOutage:false,failureKind:'coverage_gap',lifecycleCleanupAllowed:false,...extra})
export const need=(value,message)=>{if(!value)throw failure(message)}
export const one=(values,name)=>{need(values.length===1,'Missing or duplicate '+name);return values[0]}
export const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const children=n=>n.children.filter(c=>typeof c!=='string')
const walk=n=>typeof n==='string'?[]:[n,...n.children.flatMap(walk)]
const text=n=>typeof n==='string'?decodeNativeEntities(n.replaceAll('&nbsp;','\u00a0')):(n.raw??n.children.map(text).join(''))
const norm=s=>String(s).replace(/\s+/g,' ').trim()
const panelText=n=>text(n).replace(/[\r\n]/g,'').replace(/^[ \t]+|[ \t]+$/g,'')
const fields=(value,names,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&same(Object.keys(value).sort(),[...names].sort()),'Unreviewed '+label+' fields')
function literal(n,raw){
 if(n.type==='Literal'){need(!n.regex&&(n.value===null||['string','number','boolean'].includes(typeof n.value)),'Non-JSON authority literal');return}
 if(n.type==='UnaryExpression'&&n.operator==='-'&&n.argument.type==='Literal'&&typeof n.argument.value==='number')return
 if(n.type==='ArrayExpression'){need(n.elements.every(Boolean),'JSON array holes');n.elements.forEach(v=>literal(v,raw));return}
 need(n.type==='ObjectExpression','Nonliteral JSON authority');const keys=new Set
 for(const p of n.properties){need(p.type==='Property'&&p.kind==='init'&&!p.method&&!p.shorthand&&!p.computed&&p.key.type==='Literal'&&typeof p.key.value==='string','Nonliteral JSON authority property');const key=p.key.value;need(!keys.has(key)&&!['__proto__','prototype','constructor'].includes(key)&&raw.slice(p.key.start,p.key.end)===JSON.stringify(key),'Duplicate/escaped JSON authority key');keys.add(key);literal(p.value,raw)}
}
export function strictJSON(raw){try{const wrapped='('+raw+')',program=parse(wrapped,{ecmaVersion:'latest'});need(program.body.length===1,'Additional JSON program');literal(program.body[0].expression,wrapped);return JSON.parse(raw)}catch(e){throw failure('Invalid/duplicate/escaped native JSON authority',{cause:e})}}
function page(page,expected){
 need(page?.status===200&&page.url===expected&&/^text\/html(?:;|$)/i.test(page.contentType||'')&&typeof page.html==='string','Native HTTP URL/MIME identity')
 const d=readNativeDocument(page.html);need(!d.nodes(n=>n.tag==='base').length,'Unreviewed native base URL');return d
}
export function readCorporate(p){
 const d=page(p,HOME_FINAL),links=d.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS&&d.text(n)==='CAREERS')
 need(links.length>0,'Current corporate careers handoff unavailable')
 return{requestedURL:HOME,url:HOME_FINAL,nativeCareers:CAREERS,links:links.map(n=>({attributes:n.attrs,text:d.text(n)})),rawHTML:p.html,bodySHA256:sha(p.html)}
}
export function readCareers(p){
 const d=page(p,CAREERS);need(d.nodes(n=>n.tag==='a'&&new URL(n.attrs.href||'#',CAREERS).href===JOBS).length>0,'Current native jobs handoff unavailable')
 return{url:CAREERS,jobsURL:JOBS,rawHTML:p.html,bodySHA256:sha(p.html)}
}
export function readCountryForm(p){
 const d=page(p,JOBS),form=one(d.nodes(n=>n.tag==='form'&&n.attrs.id==='views-exposed-form-jobs-jobs'),'GET country form')
 need(same(form.attrs,PROFILE.countryFormAttributes),'Changed country GET form attributes')
 need(!walk(form).some(n=>['select','textarea','button','form'].includes(n.tag)&&n!==form),'Unreviewed successful country GET control kind')
 const inputs=walk(form).filter(n=>n.tag==='input'),allowed=['class','data-bef-auto-submit-click','data-drupal-selector','type','id','value','placeholder','data-bef-auto-submit-exclude','name','size']
 for(const n of inputs)need(Object.keys(n.attrs).every(k=>allowed.includes(k))&&!n.inert,'Unreviewed country GET control authority/visibility')
 need(same(inputs.map(n=>({type:n.attrs.type||'text',name:n.attrs.name??null,value:n.attrs.value??null})),PROFILE.countryFormInputs),'Changed country GET controls')
 const india=one(inputs.filter(n=>n.attrs.name==='country[India]'&&n.attrs.value==='India'),'India country checkbox')
 const url=new URL(form.attrs.action,JOBS)
 for(const n of inputs){if(!n.attrs.name||['submit','button','reset','file','image'].includes(n.attrs.type))continue;if(['checkbox','radio'].includes(n.attrs.type)&&n!==india)continue;url.searchParams.append(n.attrs.name,n.attrs.value||'')}
 need(url.origin===new URL(JOBS).origin&&url.pathname===new URL(JOBS).pathname&&same([...url.searchParams],[['search_country',''],['country[India]','India']]),'Unreviewed successful India GET controls')
 const label=one(d.nodes(n=>n.tag==='label'&&n.attrs.for===india.attrs.id),'India checkbox label'),match=d.text(label).match(/^India \((\d+)\)$/)
 need(match&&Number(match[1])>0&&Number(match[1])<=20,'Unreviewed India country facet total/budget')
 return{url:JOBS,indiaURL:url.href,publishedIndiaCandidateCount:Number(match[1]),formAttributes:form.attrs,successfulControls:[...url.searchParams],rawHTML:p.html,bodySHA256:sha(p.html)}
}
const classOne=(d,root,name)=>one(d.nodes(n=>d.hasClass(n,name),root),name)
function scalar(d,node,label){need(!node.inert,'Hidden '+label);const value=d.text(node);need(value,'Missing '+label);return value}
export function readIndiaListing(p,form){
 const d=page(p,form.indiaURL),articles=d.nodes(n=>n.tag==='article'&&d.hasClass(n,'node--view-mode-teaser')),rows=[]
 for(const a of articles){
  const id=scalar(d,classOne(d,a,'field--name-field-id'),'listing own Job ID'),title=scalar(d,one(d.nodes(n=>n.tag==='h3',a),'listing title'),'listing title')
  need(/^[1-9]\d{3,9}$/.test(id),'Invalid native listing Job ID')
  const category=scalar(d,classOne(d,a,'field--name-field-job-function'),'listing category'),location=scalar(d,classOne(d,a,'location'),'listing location'),employment=scalar(d,classOne(d,a,'field--name-field-type-of-contract'),'listing contract')
  const link=one(d.nodes(n=>n.tag==='a'&&d.text(n)==='Details',a),'own Details link'),url=new URL(link.attrs.href,JOBS)
  need(url.origin===new URL(JOBS).origin&&/^\/int\/en\/jobs\/[a-z0-9-]+$/.test(url.pathname)&&!url.search&&!url.hash&&!url.username&&!url.password,'Unbound native India role URL')
  need(norm(text(a))===title+' '+category+' Job ID: '+id+' '+location+' '+employment+' Details','Unreviewed complete listing row text/hidden criteria')
  for(const n of walk(a))need(!n.inert&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&!Object.keys(n.attrs).some(k=>/country|employer|company|organization|itemprop|itemtype|style/i.test(k)),'Unreviewed native listing authority/visibility carrier')
  need(PROFILE.listingOwnerStructures.some(v=>same(v,listingOwnerSignature(d,a))),'Unreviewed complete native listing owner structure/order')
  rows.push({id,title,category,location,employment,url:url.href,originalRowText:d.text(a)})
 }
 need(rows.length===form.publishedIndiaCandidateCount&&new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.map(r=>r.url)).size===rows.length,'Current India listing count/identity disagreement')
 return{url:p.url,rows,publishedIndiaCandidateCount:form.publishedIndiaCandidateCount,rawHTML:p.html,bodySHA256:sha(p.html)}
}
function date(value){
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+(?:0100|0200)$/.test(value)&&Number.isFinite(Date.parse(value)),'Unreviewed native lifecycle timestamp')
 const [y,m,d]=value.slice(0,10).split('-').map(Number);need(new Date(Date.UTC(y,m-1,d)).toISOString().slice(0,10)===value.slice(0,10),'Invalid native lifecycle calendar')
 return value
}
export function ownerSignature(article,criteria,scalars,hrefs){
 const scalarMap=new Map(scalars.map(([n,v])=>[n,v]))
 const build=(n,bound=null)=>{
  if(typeof n==='string'){const raw=norm(decodeNativeEntities(n));if(!raw)return null;if(bound!==null){need(raw===bound,'Additional text in bound native scalar');return'BOUND_SCALAR'}return raw}
  const attrs={...n.attrs};if(hrefs.has(n)){need(attrs.href===hrefs.get(n),'Changed native owner share/apply URL');attrs.href='BOUND_NATIVE_LINK'}
  return{tag:n.tag,attributes:attrs,children:n===criteria?['BOUND_FULL_CRITERIA']:n.children.map(c=>build(c,scalarMap.get(n)??bound)).filter(c=>c!==null)}
 }
 return build(article)
}
export function listingOwnerSignature(d,a){
 const link=one(d.nodes(n=>n.tag==='a'&&d.text(n)==='Details',a),'own Details link')
 const scalars=[one(d.nodes(n=>n.tag==='h3',a),'listing title'),...['field--name-field-id','field--name-field-job-function','location','field--name-field-type-of-contract'].map(c=>classOne(d,a,c))].map(n=>[n,d.text(n)])
 return ownerSignature(a,null,scalars,new Map([[link,link.attrs.href]]))
}
// Bind only carriers which the role parser independently validates in full.
// Every other authored node, attribute, hidden subtree and script stays exact.
export function roleEnvelopeSignature(d,article,schemaNode,settingsNode,metas,canonical){
 const metadata=new Set(metas),root=one(d.nodes(n=>n.tag==='root'),'whole raw native tree')
 const build=n=>{
  if(typeof n==='string')return n
  if(n===article)return{checkedOwnRole:'BOUND_COMPLETE_OWN_ROLE'}
  const attrs={...n.attrs};if(metadata.has(n)&&Object.hasOwn(attrs,'content'))attrs.content='BOUND_CHECKED_METADATA'
  if(n===canonical)attrs.href='BOUND_CHECKED_CANONICAL'
  return{tag:n.tag,attributes:attrs,inert:n.inert,unqualified:n.nativeTagUnqualified===true,
   raw:n===schemaNode?'BOUND_CHECKED_WHOLE_SCHEMA':n===settingsNode?'BOUND_CHECKED_RENDERER_CONTEXT':n.raw??null,children:n.children.map(build)}
 }
 return build(root)
}
export function readFerreroRole(p,row,now){
 const d=page(p,row.url),article=one(d.nodes(n=>n.tag==='article'&&d.hasClass(n,'node--view-mode-full')),'full own role'),header=one(d.nodes(n=>n.tag==='header',article),'own role header'),body=classOne(d,article,'job-posting__body')
 const allRaw=walk(one(d.nodes(n=>n.tag==='root'),'whole raw native tree')),canonical=one(allRaw.filter(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own canonical')
 need(canonical.attrs.href===row.url&&!canonical.inert,'Native role canonical identity')
 const scripts=d.nodes(n=>n.tag==='script'),inline=scripts.filter(n=>!n.attrs.src),schemaNode=one(inline.filter(n=>n.attrs.type==='application/ld+json'),'own full schema'),settingsNode=one(inline.filter(n=>n.attrs['data-drupal-selector']==='drupal-settings-json'),'native renderer context')
 need(inline.length===2,'Unreviewed inline authority program')
 need(PROFILE.externalRoleProgramDeclarations.some(v=>same(v,scripts.filter(n=>n.attrs.src).map(n=>n.attrs))),'Unreviewed external program declaration')
 need(d.nodes(n=>n.tag==='style').every(n=>PROFILE.inlineStyleHashes.includes(sha(n.raw||''))),'Unreviewed native inline CSS authority')
 const context=strictJSON(settingsNode.raw);need(/^node\/[1-9]\d*$/.test(context.path?.currentPath)&&PROFILE.settingsLibraries.includes(context.ajaxPageState?.libraries),'Unreviewed native renderer path/library')
 const dialog='share-job-'+context.path.currentPath.slice(5)
 need(one(d.nodes(n=>n.tag==='button'&&d.hasClass(n,'page-share-button'),header),'share button').attrs['data-dialog-id']===dialog&&one(d.nodes(n=>n.attrs.role==='dialog',header),'share dialog').attrs.id===dialog,'Native renderer/own share-dialog identity conflict')
 const comparison=structuredClone(context);delete comparison.path.currentPath;delete comparison.ajaxPageState.libraries;need(PROFILE.settingsTemplates.some(v=>same(v,comparison)),'Unreviewed native renderer authority fields')
 const graph=strictJSON(schemaNode.raw);fields(graph,['@context','@graph'],'schema envelope');need(graph['@context']==='https://schema.org'&&Array.isArray(graph['@graph'])&&graph['@graph'].length===2,'Unreviewed full schema envelope')
 const schema=one(graph['@graph'].filter(x=>x['@type']==='JobPosting'),'JobPosting'),web=one(graph['@graph'].filter(x=>x['@type']==='WebPage'),'WebPage')
 fields(schema,['@type','title','datePosted','employmentType','identifier','validThrough','hiringOrganization','jobLocation','description','industry'],'native JobPosting')
 need(same(schema.hiringOrganization,PROFILE.nativeOrganization),'Unreviewed native employer authority')
 fields(schema.jobLocation,['@type','address'],'native Place');need(schema.jobLocation['@type']==='Place','Native Place type')
 const address=schema.jobLocation.address;fields(address,['@type','addressLocality','addressCountry'],'native PostalAddress');need(address['@type']==='PostalAddress'&&address.addressCountry==='IN'&&typeof address.addressLocality==='string'&&address.addressLocality.trim(),'Unreviewed/contradictory native country/address')
 const h1=one(d.nodes(n=>n.tag==='h1',header),'own title'),idNode=classOne(d,header,'field--name-field-id'),catNode=classOne(d,header,'field--name-field-job-function'),locationNode=classOne(d,header,'location'),contractNode=classOne(d,header,'field--name-field-type-of-contract')
 need(scalar(d,h1,'title')===row.title&&schema.title===row.title&&scalar(d,idNode,'own Job ID')===row.id,'Native role title/own Job ID identity')
 need(schema.identifier===row.category&&schema.industry===row.category&&scalar(d,catNode,'category')===row.category,'Native category copy conflict')
 need(scalar(d,locationNode,'location')===row.location&&scalar(d,contractNode,'contract')===row.employment&&schema.employmentType===row.employment,'Native listing/detail location/employment disagreement')
 const place=row.location.match(/^(.*), ([A-Z]{2}), IN \((On-Site|Hybrid|Field based)\)$/);need(place&&place[1]===address.addressLocality,'Native explicit country/city/worksite disagreement')
 const scalars=[[h1,row.title],[idNode,row.id],[catNode,row.category],[locationNode,row.location],[contractNode,row.employment]]
 const encode=value=>encodeURIComponent(value).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())
 const encoded=encode(row.url),shares=new Map([['page-share--email','mailto:?subject=Check out this Job opportunity in Ferrero&body='+encoded],['page-share--fb','https://www.facebook.com/sharer/sharer.php?u='+encoded],['page-share--wa','https://wa.me/?text='+encoded],['page-share--linkedin','//www.linkedin.com/shareArticle?mini=true&url='+encoded+'&title='+encode(row.title)]])
 const hrefs=new Map;for(const[k,v]of shares){const node=one(d.nodes(n=>n.tag==='a'&&d.hasClass(n,k),header),k);need(node.attrs.href===v,'Native share link identity');hrefs.set(node,v)}
 const apply=new URL(row.url).pathname+'/apply',applyNodes=d.nodes(n=>n.tag==='a'&&d.text(n)==='Apply now',article);need(applyNodes.length===2&&applyNodes.every(n=>n.attrs.href===apply),'Unbound native application URL');applyNodes.forEach(n=>hrefs.set(n,apply))
 for(const n of walk(article)){
  need(!n.inert&&!['script','style','template','noscript','iframe','meta','input'].includes(n.tag),'Hidden/extra native criteria authority node')
  for(const[k,v]of Object.entries(n.attrs)){if(k==='href'){need(hrefs.has(n)||PROFILE.criteriaHrefValues.includes(v),'Unreviewed native criteria link');continue}need(PROFILE.articleAttributeValues[n.tag+'.'+k]?.includes(v),'Unreviewed native owner/criteria attribute '+k)}
 }
 const panels=children(body);need(PROFILE.panelSequences.some(v=>same(v,panels.map(n=>scalar(d,classOne(d,n,'ac-trigger'),'criterion heading')))),'Unreviewed complete criteria sections')
 let projected='';for(const n of panels){need(n.tag==='div'&&n.attrs.class==='ac'&&children(n).length===2,'Unreviewed authored criterion owner');const h=classOne(d,n,'ac-trigger'),b=classOne(d,n,'ac-panel');projected+=panelText(h)+panelText(b)}
 need(typeof schema.description==='string'&&schema.description.length>=150&&projected===schema.description,'Full authored criteria/schema byte projection conflict')
 fields(web,['@type','@id','breadcrumb','description'],'native WebPage');need(web['@id']===row.url&&typeof web.description==='string'&&schema.description.startsWith(web.description)&&PROFILE.webPageSummarySHA256s.includes(sha(web.description)),'Native WebPage criteria/identity conflict')
 need(same(web.breadcrumb,{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:CAREERS.slice(0,-1)},{'@type':'ListItem',position:2,name:'Jobs',item:JOBS},{'@type':'ListItem',position:3,name:row.title,item:row.url}]}),'Native breadcrumb authority conflict')
 const expectedMeta=[{charset:'utf-8'},{name:'description',content:'Apply today for the '+row.title+' position at Ferrero! Craft your career in a unique global company to make Ferrero brands even more extraordinary.'},{property:'og:site_name',content:'Global Ferrero Careers'},{property:'og:type',content:'article'},{property:'og:title',content:row.title+' | Ferrero Careers'},{property:'og:description',content:'Apply today for the '+row.title+' position at Ferrero! Craft your career in a unique global company to make Ferrero brands even more extraordinary.'},{name:'Generator',content:'Drupal 11 (https://www.drupal.org)'},{name:'MobileOptimized',content:'width'},{name:'HandheldFriendly',content:'true'},{name:'viewport',content:'width=device-width, initial-scale=1.0'}]
 const metas=allRaw.filter(n=>n.tag==='meta');need(same(metas.map(n=>n.attrs),expectedMeta)&&metas.every(n=>!n.inert),'Unreviewed head employer/country/criteria metadata')
 const owner=ownerSignature(article,body,scalars,hrefs);need(PROFILE.ownerStructures?.some(v=>same(v,owner)),'Unreviewed complete own-role structure/order')
 const globalEnvelopeSHA256=sha(JSON.stringify(roleEnvelopeSignature(d,article,schemaNode,settingsNode,metas,canonical)))
 need(PROFILE.roleEnvelopeSHA256s?.includes(globalEnvelopeSHA256),'Unreviewed complete raw head/global native owner envelope')
 date(schema.datePosted);date(schema.validThrough);const issues=[]
 if(Date.parse(schema.validThrough)<Date.parse(now))issues.push('native-validThrough-is-past')
 if(Date.parse(schema.validThrough)<Date.parse(schema.datePosted))issues.push('native-validThrough-precedes-posting')
 if(Date.parse(schema.datePosted)>Date.parse(now))issues.push('native-posting-is-future')
 const raw=rawDocument(p.html),slice=one(raw.nodes(n=>n.tag==='article'&&raw.hasClass(n,'node--view-mode-full')),'raw own role'),criteria=one(raw.nodes(n=>raw.hasClass(n,'job-posting__body'),slice),'raw full criteria')
 return{id:row.id,title:row.title,url:row.url,country:'India',nativeCountry:'IN',city:address.addressLocality,nativeRegion:place[2],workplaceType:place[3],employmentType:row.employment,category:row.category,schemaIdentifierIsCategory:true,schema,rawSchema:schemaNode.raw,webPageSchema:web,rendererContext:context,ownerStructure:owner,globalEnvelopeSHA256,criteriaText:projected,fullCriteriaHTML:raw.outer(criteria),wholeOwnArticleHTML:raw.outer(slice),applyUrl:new URL(apply,CAREERS).href,applicationVisited:false,activeApplyVerified:false,legalEmployer:null,modelComplete:true,issues,originalRawHTML:p.html,originalBodySHA256:sha(p.html)}
}
