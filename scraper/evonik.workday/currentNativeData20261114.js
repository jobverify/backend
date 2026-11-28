import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const PROFILE=JSON.parse(readFileSync(new URL('./reviewedNativeData20261114.json',import.meta.url),'utf8'))
const CORPORATE_PROFILES=[PROFILE,JSON.parse(readFileSync(new URL('./reviewedCorporateCarrier20261127.json',import.meta.url),'utf8'))]
const CURRENT_BOOTSTRAP=JSON.parse(readFileSync(new URL('./reviewedNativeBootstrap20261127.json',import.meta.url),'utf8'))
export const CAREERS=PROFILE.corporate.requestedUrl
const SOURCE='evonik',ORIGIN='https://evonik.wd3.myworkdayjobs.com',SITE='/External_Careers',API=ORIGIN+'/wday/cxs/evonik'+SITE
const USER_AGENT='Mozilla/5.0 (compatible; Jobverify careers inventory check)'
const sha=value=>createHash('sha256').update(value).digest('hex'),same=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
const keys=(value,expected)=>object(value)&&same(Object.keys(value).sort(),[...expected].sort())
const fail=(message,fields={})=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true,sourceScopeComplete:false,...fields})
const need=(condition,message)=>{if(!condition)throw fail(message)}
const ignore=operation=>{try{Promise.resolve(operation()).catch(()=>{})}catch{}}
const typedArray=Object.getPrototypeOf(Uint8Array.prototype)
const intrinsic=name=>Object.getOwnPropertyDescriptor(typedArray,name).get
const byteLength=intrinsic('byteLength'),byteOffset=intrinsic('byteOffset'),arrayBuffer=intrinsic('buffer')
const DEFAULTS={sourceTimeoutMs:90000,requestTimeoutMs:15000,maxRequests:48,maxEntityBytes:4000000,maxTotalBytes:24000000}
const HTML_BYTES=524288,JSON_BYTES=262144,CLOSING_READS=24,CLOSING_BYTES=2*HTML_BYTES+2*JSON_BYTES+10*(HTML_BYTES+JSON_BYTES)
const post=india=>JSON.stringify({appliedFacets:india?{Country:[PROFILE.IndiaUUID]}:{},limit:20,offset:0,searchText:''})
const unsafe=new Set(['__proto__','constructor','prototype'])

// JSON.parse alone silently loses duplicate fields. Parse the original text
// first, then inspect its complete literal tree without executing any code.
export function readEvonikJSON(text){
 let value,ast
 try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'}).body[0].expression}catch{throw fail('Invalid original JSON representation')}
 const walk=node=>{
  if(node.type==='ObjectExpression'){
   const names=new Set()
   for(const property of node.properties){
    need(property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init','Unreviewed JSON property')
    const name=property.key.value
    need(typeof name==='string'&&!unsafe.has(name)&&!names.has(name),'Duplicate or unsafe original JSON field');names.add(name);walk(property.value)
   }
  }else if(node.type==='ArrayExpression')for(const item of node.elements)walk(item)
 }
 walk(ast);return value
}

const display=(key,value)=>typeof value==='string'&&value.length<=100&&(new RegExp(PROFILE.relativeDisplayGrammar[key]).test(value)||key==='timeLeftToApply'&&value==='1 day left to apply')
function reviewedData(actual,expected,path='native'){
 if(Array.isArray(expected)){need(Array.isArray(actual)&&actual.length===expected.length,'Changed reviewed array '+path);expected.forEach((value,index)=>reviewedData(actual[index],value,path+'['+index+']'));return}
 if(object(expected)){
  need(keys(actual,Object.keys(expected)),'Unknown or missing original field '+path)
  for(const [key,value]of Object.entries(expected)){
   if(Object.hasOwn(PROFILE.relativeDisplayGrammar,key))need(display(key,actual[key]),'Unreviewed relative display '+path+'.'+key)
   else reviewedData(actual[key],value,path+'.'+key)
  }
  return
 }
 need(actual===expected,'Changed reviewed data '+path)
}
const calendar=(value,label)=>{
 need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,'Invalid '+label+' calendar')
 return value
}
function facetValues(values){
 need(Array.isArray(values)&&values.length<=256,'Unreviewed facet values')
 for(const value of values)need(keys(value,['descriptor','id','count'])&&typeof value.descriptor==='string'&&value.descriptor.length>0&&value.descriptor.length<=200&&/^[a-f0-9]{32}$/.test(value.id??'')&&Number.isSafeInteger(value.count)&&value.count>=0,'Unreviewed original facet value')
 need(new Set(values.map(value=>value.id)).size===values.length,'Duplicate original facet value')
}
export function readEvonikListing(text,india=false){
 const data=readEvonikJSON(text)
 need(keys(data,['total','jobPostings','facets','userAuthenticated'])&&Number.isSafeInteger(data.total)&&data.total>=0&&Array.isArray(data.jobPostings)&&data.jobPostings.length<=20&&Array.isArray(data.facets)&&data.userAuthenticated===false,'Original listing envelope changed')
 const params=['jobFamilyGroup','Country','workerSubType','timeType','locationMainGroup'],descriptors=['Job Category','Country','Job Type','Time Type']
 need(data.facets.length===5&&same(data.facets.map(value=>value.facetParameter),params),'Original facet inventory changed')
 for(const [index,facet]of data.facets.entries()){
  if(index===4){need(keys(facet,['facetParameter','values'])&&Array.isArray(facet.values)&&facet.values.length===1,'Original location facet group changed');const child=facet.values[0];need(keys(child,['facetParameter','descriptor','values'])&&child.facetParameter==='locations'&&child.descriptor==='Locations','Original nested location facet changed');facetValues(child.values)}
  else{need(keys(facet,['facetParameter','descriptor','values'])&&facet.descriptor===descriptors[index],'Original facet descriptor changed');facetValues(facet.values)}
 }
 for(const row of data.jobPostings){
  need(keys(row,['title','externalPath','locationsText','postedOn','bulletFields'])&&typeof row.title==='string'&&row.title.length>0&&typeof row.locationsText==='string'&&display('postedOn',row.postedOn)&&/^\/job\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+_R\d+(?:-\d+)?$/.test(row.externalPath??'')&&Array.isArray(row.bulletFields)&&row.bulletFields.length===1&&/^R\d+$/.test(row.bulletFields[0])&&new RegExp('_'+row.bulletFields[0]+'(?:-\\d+)?$').test(row.externalPath),'Original listing row identity or fields changed')
 }
 need(new Set(data.jobPostings.map(row=>row.bulletFields[0])).size===data.jobPostings.length,'Duplicate native listing ID')
 need(new Set(data.jobPostings.map(row=>row.externalPath)).size===data.jobPostings.length,'Duplicate native listing path')
 const selected=data.facets[1].values.filter(value=>value.descriptor==='India')
 need(selected.length===1&&selected[0].id===PROFILE.IndiaUUID&&selected[0].count===PROFILE.IndiaTotal,'Typed India facet changed')
 if(india){need(data.total===PROFILE.IndiaTotal&&data.jobPostings.length===data.total,'Incomplete native India inventory');reviewedData(data.jobPostings,PROFILE.IndiaRows,'IndiaRows')}
 else need(data.total>=PROFILE.IndiaTotal&&data.jobPostings.length===Math.min(20,data.total),'Incomplete native global first page')
 return data
}
const indiaFacet=data=>data.facets[1].values.find(value=>value.id===PROFILE.IndiaUUID)
const allNodes=root=>[root,...root.children.filter(child=>typeof child!=='string').flatMap(allNodes)]
function document(html){
 const doc=readNativeDocument(html),root=doc.nodes(node=>node.tag==='root')[0],nodes=allNodes(root)
 need(!nodes.some(node=>node.tag==='base'||node.tag==='meta'&&(node.attrs['http-equiv']??'').toLowerCase()==='refresh'),'Original document base or refresh changed')
 return{doc,root,nodes}
}
function corporateCards(bytes,profile){
 if(profile.mutableCardPresentation)return mutableCorporateCards(bytes,profile)
 const envelope=profile.corporateCardEnvelope,ordered=[],seen=new Set()
 need(bytes.length===envelope.bytes,'Original corporate careers carrier length changed')
 let cursor=0
 for(let index=0;index<8;index++){
  const outside=envelope.outerRuns[index],part=bytes.subarray(cursor,cursor+outside.bytes)
  need(part.length===outside.bytes&&sha(part)===outside.sha256,'Original corporate bytes outside immutable cards changed');cursor+=outside.bytes
  const matches=envelope.cards.filter(card=>{const raw=bytes.subarray(cursor,cursor+card.bytes);return raw.length===card.bytes&&sha(raw)===card.sha256})
  need(matches.length===1&&!seen.has(matches[0].id),'Unknown, changed or duplicate complete corporate card')
  const card=matches[0];ordered.push(card);seen.add(card.id);cursor+=card.bytes
 }
 const outside=envelope.outerRuns[8],part=bytes.subarray(cursor)
 need(seen.size===8&&part.length===outside.bytes&&sha(part)===outside.sha256,'Original corporate final bytes or complete card inventory changed')
 return ordered
}
function mutableCorporateCard(raw,profile){
 const values={},slots=[
  ['HREF',/(\bhref=")([^"]*)(")/g],
  ['TITLE_ATTRIBUTE',/(\btitle=")([^"]*)(")/g],
  ['TITLE_TEXT',/(<h3 class="tile-job__title text-16 font-medium line-clamp-3 hyphens-auto">)([^<]*)(<\/h3>)/g],
  ['LOCATION_TEXT',/(<span class="block break-words line-clamp-2">)([^<]*)(<\/span>)/g],
  ['DATE_TEXT',/(<span class="block break-words line-clamp-1">)([^<]*)(<\/span>)/g],
 ]
 let normalized=raw
 for(const[key,expression]of slots){
  let count=0
  normalized=normalized.replace(expression,(_all,before,value,after)=>{count++;values[key]=value;return before+'{{EVONIK_'+key+'}}'+after})
  need(count===1,'Current featured card literal data ownership changed '+key)
 }
 const presentation=profile.mutableCardPresentation
 need(Buffer.byteLength(normalized)===presentation.bytes&&sha(normalized)===presentation.sha256,'Current complete featured card presentation changed')
 need(/^\/en\/careers\/jobs\/job\.html\?jobId=R[1-9]\d{0,11}$/.test(values.HREF),'Current featured card literal role authority changed')
 const {doc}=document(raw),anchors=doc.nodes(node=>node.tag==='a'),headings=doc.nodes(node=>node.tag==='h3'),locations=doc.nodes(node=>node.tag==='span'&&node.attrs.class==='block break-words line-clamp-2')
 need(anchors.length===1&&headings.length===1&&locations.length===1,'Current featured card active data owners changed')
 const attrs=anchors[0].attrs,expected=profile.corporateCardEnvelope.cards[0].attrs
 need(keys(attrs,Object.keys(expected))&&Object.entries(expected).every(([key,value])=>['href','title'].includes(key)||attrs[key]===value)&&attrs.href===values.HREF,'Current featured card full attributes changed')
 const literal=(value,ceiling)=>typeof value==='string'&&value.length>0&&value.length<=ceiling&&!/[\u0000-\u001f\u007f]/.test(value)
 const title=doc.text(headings[0]),locationText=doc.text(locations[0])
 need(literal(title,500)&&literal(locationText,500)&&attrs.title===title,'Current featured title or location data is ambiguous')
 need(/^\d{2}\/\d{2}\/\d{4}$/.test(values.DATE_TEXT),'Current featured calendar display changed')
 const [month,day,year]=values.DATE_TEXT.split('/'),postedDate=calendar(year+'-'+month+'-'+day,'featured posting')
 const bytes=Buffer.from(raw),url=new URL(values.HREF,CAREERS).href,id=new URL(url).searchParams.get('jobId')
 return{id,url,attrs,title,locationText,dateText:values.DATE_TEXT,postedDate,text:doc.text(anchors[0]),bytes:bytes.length,sha256:sha(bytes),bodyBase64:bytes.toString('base64')}
}
function mutableCorporateCards(bytes,profile){
 const text=bytes.toString('utf8'),matches=[...text.matchAll(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g)],ordered=[],envelope=profile.corporateCardEnvelope
 need(matches.length===8,'Current complete featured card inventory changed')
 let cursor=0
 for(const[index,match]of matches.entries()){
  const outside=Buffer.from(text.slice(cursor,match.index)),expected=envelope.outerRuns[index]
  need(outside.length===expected.bytes&&sha(outside)===expected.sha256,'Current full corporate bytes outside featured data changed')
  ordered.push(mutableCorporateCard(match[0],profile));cursor=match.index+match[0].length
 }
 const outside=Buffer.from(text.slice(cursor)),expected=envelope.outerRuns[8]
 need(outside.length===expected.bytes&&sha(outside)===expected.sha256,'Current final corporate programme or authority changed')
 need(new Set(ordered.map(card=>card.id)).size===8,'Duplicate current featured requisition')
 const seed=ordered.find(card=>card.url===profile.seed.requestedUrl),model=profile.seed.model,address=model.jobLocation[0].address
 need(seed&&seed.title===model.title&&seed.locationText===address.addressCountry+' | '+address.addressLocality&&seed.postedDate===model.datePosted,'Current declared seed data contradicts its exact employer/identity profile')
 return ordered
}
export function readEvonikCorporate(page,seed=false,seedURL=PROFILE.seed.requestedUrl){
 need(Buffer.isBuffer(page.bytes)&&typeof page.text==='string'&&Buffer.from(page.text).equals(page.bytes),'Original corporate text/byte representation changed')
 // The current full prefix selects a programme revision, not job data. Every
 // outside byte and full card presentation remains pinned independently.
 const mutable=CORPORATE_PROFILES.find(profile=>profile.mutableCardPresentation),prefix=mutable?.corporateCardEnvelope.outerRuns[0]
 const current=!seed&&prefix&&page.bytes.length>=prefix.bytes&&sha(page.bytes.subarray(0,prefix.bytes))===prefix.sha256
 const revisions=current?[mutable]:CORPORATE_PROFILES.filter(profile=>seed?profile.seed.requestedUrl===seedURL:!profile.mutableCardPresentation&&profile.corporateCardEnvelope.bytes===page.bytes.length)
 need(revisions.length===1,seed?'Unreviewed corporate seed URL':'Original corporate careers carrier length changed')
 const profile=revisions[0],expected=seed?profile.seed:profile.corporate
 const ordered=seed?null:corporateCards(page.bytes,profile)
 if(seed)need(page.bytes.length===expected.bytes&&sha(page.bytes)===expected.sha256,'Original corporate seed carrier changed')
 const {doc,root}=document(page.text)
 if(!seed){
  const owners=[],describe=node=>({tag:node.tag,attrs:node.attrs,activeFrame:node.activeFrame??null,inert:node.inert??null})
  const isCard=node=>node.tag==='a'&&(node.attrs.class??'').split(/\s+/).includes('tile-job')
  const walk=(node,ancestors=[])=>{if(isCard(node))owners.push({node,ancestors:ancestors.map(describe)});for(const child of node.children)if(typeof child!=='string')walk(child,[...ancestors,node])}
  walk(root)
  const active=doc.nodes(isCard)
  need(owners.length===8&&active.length===8,'Original active corporate card owner inventory changed')
  owners.forEach((owner,index)=>need(owner.node===active[index]&&owner.node.inert===false&&owner.node.activeFrame===false&&same(owner.node.attrs,ordered[index].attrs)&&same(owner.ancestors,profile.corporateCardEnvelope.ownerSlots[index]),'Original complete corporate card owner or ancestry changed'))
  const links=doc.nodes(node=>node.tag==='a'&&typeof node.attrs.href==='string').map(node=>({url:new URL(node.attrs.href,CAREERS).href,text:doc.text(node),attrs:node.attrs}))
  need(links.some(link=>link.url==='https://www.evonik.com/en/careers/jobs.html'),'Current corporate careers handoff absent')
  const roles=links.filter(link=>/^https:\/\/www\.evonik\.com\/en\/careers\/jobs\/job\.html\?jobId=R\d+$/.test(link.url))
  need(roles.length===8&&roles.every((role,index)=>role.url===new URL(ordered[index].attrs.href,CAREERS).href&&(profile.mutableCardPresentation?same(role.attrs,ordered[index].attrs)&&role.text===ordered[index].text:same(role,profile.corporateRoleDeclarations.find(original=>original.url===role.url))))&&roles.some(link=>link.url===profile.seed.requestedUrl),'Current literal corporate role declarations changed')
  if(profile.mutableCardPresentation){
   const binding=ordered.find(card=>card.url===profile.seed.requestedUrl)
   // Featured tiles are partial native records. Membership/data may change
   // while the exact programme and currently declared seed binding stay fixed.
   // Retain every original card; these labels never establish India/company
   // scope or substitute for the exact CXS/public criteria and closing reads.
   return{handshake:{careersURL:'https://www.evonik.com/en/careers/jobs.html',seedURL:profile.seed.requestedUrl,outsideRunsSHA256:profile.mutableCardPresentation.outsideRunsSHA256,cardPresentationSHA256:profile.mutableCardPresentation.sha256,seedDeclaration:{url:binding.url,attrs:binding.attrs,title:binding.title,locationText:binding.locationText,postedDate:binding.postedDate}},observation:{bytes:page.bytes.length,sha256:sha(page.bytes),orderedCardIds:ordered.map(card=>card.id),roleDeclarations:roles,rawCardRecords:ordered,companyScopeComplete:false,indiaScopeComplete:false}}
  }
  // Only this exact eight-card corporate tile multiset is unordered. Preserve
  // the actual raw order/hash; native listings and role closures stay exact.
  return{handshake:{careersURL:'https://www.evonik.com/en/careers/jobs.html',seedURL:profile.seed.requestedUrl,cards:profile.corporateCardEnvelope.cards.map(({id,bytes,sha256})=>({id,bytes,sha256})),roleDeclarations:profile.corporateRoleDeclarations},observation:{bytes:page.bytes.length,sha256:sha(page.bytes),orderedCardIds:ordered.map(card=>card.id),roleDeclarations:roles}}
 }
 const models=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').map(node=>readEvonikJSON(node.raw)),canonical=doc.nodes(node=>node.tag==='link'&&node.attrs.rel==='canonical')
 need(models.length===1&&same(models[0],profile.seed.model)&&canonical.length===1&&canonical[0].attrs.href===profile.seed.requestedUrl,'Corporate seed original employer/identity data changed')
 const model=models[0],id=new URL(profile.seed.requestedUrl).searchParams.get('jobId')
 need(/^R\d+$/.test(id??'')&&model.identifier.value===id&&model.hiringOrganization.name==='Evonik'&&model.hiringOrganization.sameAs==='https://www.evonik.com'&&model.sameAs.startsWith(ORIGIN+SITE+'/job/')&&new RegExp('_'+id+'(?:-\\d+)?/apply$').test(model.sameAs),'Corporate own-account binding changed')
 need(doc.nodes(node=>node.tag==='a'&&node.attrs.href===model.sameAs).length>0&&doc.nodes(node=>node.tag==='a'&&node.attrs.href===ORIGIN+'/en-US'+SITE).length>0,'Literal own native account declarations absent')
 return model
}

export function readEvonikRole(text,row,now){
 const data=readEvonikJSON(text),id=row.bulletFields[0],profile=PROFILE.roles.find(role=>role.id===id)
 need(profile,'Unreviewed native role identity')
 reviewedData(data,profile.APIRecord)
 const info=data.jobPostingInfo
 need(info.title===row.title&&info.externalUrl===ORIGIN+SITE+row.externalPath&&info.jobPostingId===row.externalPath.split('/').at(-1),'Native row/detail identity contradiction')
 calendar(info.startDate,'native posting');calendar(info.endDate,'native expiry')
 need(info.startDate<=now.slice(0,10)&&info.endDate>=now.slice(0,10)&&info.posted===true&&info.canApply===true,'Native role future/expired/closed')
 need(info.country.descriptor==='India'&&info.country.id===PROFILE.IndiaUUID&&info.jobRequisitionLocation.country.descriptor==='India'&&info.jobRequisitionLocation.country.id===PROFILE.IndiaUUID&&info.jobRequisitionLocation.country.alpha2Code==='IN','Explicit native India country changed')
 need(Buffer.byteLength(info.jobDescription)===profile.APIHTML.bytes&&sha(info.jobDescription)===profile.APIHTML.sha256,'Complete native criteria changed')
 return{data,profile}
}

function bootShape(node){
 need(node&&typeof node.type==='string','Unsupported original boot data node')
 if(node.type==='Literal')return{kind:node.regex?'regex':node.value===null?'null':typeof node.value}
 if(node.type==='ArrayExpression'){need(node.elements.every(Boolean),'Sparse original boot data');return{kind:'array',items:node.elements.map(bootShape)}}
 if(node.type==='ObjectExpression'){
  need(node.properties.every(property=>property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init'),'Unsupported nested boot data property')
  const names=node.properties.map(property=>property.key?.name??property.key?.value)
  need(names.every(name=>typeof name==='string'&&!unsafe.has(name))&&new Set(names).size===names.length,'Duplicate or unsafe nested boot data property')
  return{kind:'object',properties:node.properties.map(property=>({key:property.key?.name??property.key?.value,computed:property.computed,kind:property.kind,value:bootShape(property.value)}))}
 }
 return{kind:'UNQUALIFIED:'+node.type}
}
function staticBoot(raw,profile){
 let ast
 try{ast=parse(raw,{ecmaVersion:'latest'})}catch{throw fail('Unparseable original bootstrap evidence')}
 const first=ast.body[0]?.expression
 const member=node=>node?.type==='MemberExpression'&&!node.computed&&node.object?.type==='Identifier'&&node.object.name==='window'&&node.property?.name==='workday'
 need(first?.type==='AssignmentExpression'&&first.operator==='='&&member(first.left)&&first.right?.type==='LogicalExpression'&&first.right.operator==='||'&&member(first.right.left)&&first.right.right?.type==='ObjectExpression','Initial literal own-account declaration changed')
 const object=first.right.right,properties=object.properties,names=properties.map(property=>property.key?.name??property.key?.value)
 need(properties.every(property=>property.type==='Property'&&!property.computed&&!property.method&&property.kind==='init')&&same(names,profile.staticBootPropertyNames)&&new Set(names).size===names.length,'Unknown or duplicate original boot data property')
 const shape=bootShape(object)
 if(!same(shape,profile.staticBootDataShape)){
  need(same(shape,CURRENT_BOOTSTRAP.staticBootDataShape),'Original boot data shape changed')
  const token=properties.find(property=>(property.key.name??property.key.value)==='token')?.value
  need(token?.type==='Literal'&&typeof token.value==='string','Current public token is not one literal')
  // This finite revision added three opaque feature IDs. Pin the complete
  // programme on both sides of the public token; do not admit arbitrary
  // feature lists by their length or pretend their UI meaning is qualified.
  const before=Buffer.from(raw.slice(0,token.start)),after=Buffer.from(raw.slice(token.end))
  need(before.length===CURRENT_BOOTSTRAP.rawBeforeToken.bytes&&sha(before)===CURRENT_BOOTSTRAP.rawBeforeToken.sha256&&after.length===CURRENT_BOOTSTRAP.rawAfterToken.bytes&&sha(after)===CURRENT_BOOTSTRAP.rawAfterToken.sha256,'Unreviewed current bootstrap programme outside public token')
 }
 const scalar=name=>{const value=properties.find(property=>(property.key.name??property.key.value)===name)?.value;need(value?.type==='Literal','Nonliteral static authority '+name);return value.value}
 need(scalar('tenant')==='evonik'&&scalar('siteId')==='External_Careers'&&scalar('isExternal')===true&&scalar('postingAvailable')===true,'Static native account/availability contradiction')
 // This is a static data contradiction check, never whole-program authority.
 return{propertyNames:names,tenant:'evonik',siteId:'External_Careers',isExternal:true,postingAvailable:true,wholeProgramQualified:false,tokenValueShapeOrLengthQualified:false,bytes:Buffer.byteLength(raw),sha256:sha(raw)}
}
const nodeShape=node=>({tag:node.tag,attrs:node.attrs,inert:node.inert??false,children:node.children.filter(child=>typeof child!=='string').map(nodeShape),...(node.tag==='script'?{}:{nonScriptText:node.children.filter(child=>typeof child==='string').join('')})})
export function readEvonikLanding(page,profile){
 const {root,nodes}=document(page.text),scripts=nodes.filter(node=>node.tag==='script')
 need(nodes.length===17&&scripts.length===2&&same(nodeShape(root),profile.DOMShape),'Original full16node document/attributes/ancestry changed')
 const schemas=scripts.filter(node=>node.attrs.type==='application/ld+json'),boots=scripts.filter(node=>node.attrs.type==='text/javascript')
 need(schemas.length===1&&boots.length===1&&!schemas[0].inert&&!boots[0].inert,'Unique active original static data owners changed')
 const schema=schemas[0].raw,boot=boots[0].raw
 need(Buffer.byteLength(schema)===profile.rawJSONLD.bytes&&sha(schema)===profile.rawJSONLD.sha256,'Complete original JobPosting carrier changed')
 const model=readEvonikJSON(schema)
 need(same(model,profile.publicSchema)&&Buffer.byteLength(model.description)===profile.publicDescription.bytes&&sha(model.description)===profile.publicDescription.sha256,'Complete original public criteria or model changed')
 const [before,middle,after]=profile.rawCarrierSegments.map(segment=>{const bytes=Buffer.from(segment.base64,'base64');need(bytes.length===segment.bytes&&sha(bytes)===segment.sha256,'Invalid reviewed carrier profile');return bytes})
 const reconstructed=Buffer.concat([before,Buffer.from(schema),middle,Buffer.from(boot),after])
 need(reconstructed.equals(page.bytes),'Original raw carrier tags/attributes/declarations changed')
 const account=staticBoot(boot,profile)
 return{model,canonical:profile.canonical,account,originalEntitySHA256:sha(page.bytes),originalEntityBytes:page.bytes.length,rawJSONLDSHA256:sha(schema),wholeExecutableOrCSSOrUIOrApplicationQualified:false}
}

export function createEvonikOriginalReader(options={}){
 const caller=options.signal;caller?.throwIfAborted()
 need(options.maxJobs==null,'Native truncation is forbidden')
 need(!options.fetchText&&!options.fetchJson&&!options.fetchPage,'Original Response metadata is required; body-only callbacks are unsupported')
 need(options.fetchImpl===undefined||typeof options.fetchImpl==='function','Invalid native transport callback')
 const aliases=['timeoutMs','sourceTimeoutMs'].map(name=>options[name]).filter(value=>value!==undefined&&value!==null)
 need(aliases.every(value=>Number.isSafeInteger(value)&&value>0&&value<=DEFAULTS.sourceTimeoutMs),'Invalid source deadline ceiling')
 const limits=Object.fromEntries(Object.entries(DEFAULTS).map(([name,maximum])=>{const value=name==='sourceTimeoutMs'?Math.min(maximum,...aliases):options[name]??maximum;need(Number.isSafeInteger(value)&&value>0&&value<=maximum,'Invalid '+name+' ceiling');return[name,value]}))
 const controller=new AbortController(),signal=caller?AbortSignal.any([caller,controller.signal]):controller.signal,started=performance.now(),receipts=[],lastStarts=new Map()
 const allowed=new Set([CAREERS,...CORPORATE_PROFILES.map(profile=>profile.seed.requestedUrl),API+'/jobs',...PROFILE.roles.map(role=>API+role.APIRecord.jobPostingInfo.externalUrl.slice((ORIGIN+SITE).length))])
 let decodedBytes=0,currentPhase='opening',reservedReads=CLOSING_READS,reservedBytes=CLOSING_BYTES,inFlight=false,closed=false
 const expire=()=>controller.abort(new DOMException('Evonik native90s source deadline exceeded','TimeoutError'))
 const timer=setTimeout(expire,limits.sourceTimeoutMs)
 const check=()=>{caller?.throwIfAborted();if(performance.now()-started>=limits.sourceTimeoutMs&&!controller.signal.aborted)expire();signal.throwIfAborted();need(!closed,'Original reader closed');need(currentPhase!=='opening'||performance.now()-started<limits.sourceTimeoutMs/2,'Opening phase exhausted reserved closing time')}
 const spacing=async url=>{
  const origin=new URL(url).origin
  while(lastStarts.has(origin)&&performance.now()-lastStarts.get(origin)<500){
   const delay=Math.ceil(500-(performance.now()-lastStarts.get(origin)))
   await new Promise((resolve,reject)=>{const abort=()=>{clearTimeout(wait);reject(signal.reason)};const wait=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve()},delay);signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()})
   check()
  }
  check();lastStarts.set(origin,performance.now())
 }
 return{check,limits,
  admitPublic(url){need(PROFILE.roles.some(role=>role.APIRecord.jobPostingInfo.externalUrl===url),'Unbound public role URL');allowed.add(url)},
  beginClosing(){check();need(receipts.length===24,'Opening observations incomplete');currentPhase='closing'},
  async read(url,body=null){
   check();need(!inFlight&&allowed.has(url),'Unbound or concurrent native request')
   need(body===null?url!==API+'/jobs':url===API+'/jobs'&&[post(false),post(true)].includes(body),'Unknown public request method/body')
   need(receipts.length<limits.maxRequests,'Original48 request ceiling exceeded')
   const isJSON=body!==null||url.startsWith(API),ceiling=Math.min(limits.maxEntityBytes,isJSON?JSON_BYTES:HTML_BYTES)
   if(currentPhase==='opening')need(receipts.length+1+reservedReads<=limits.maxRequests&&decodedBytes+reservedBytes<limits.maxTotalBytes,'Closing read/byte reserve unavailable')
   else{need(reservedReads>0&&reservedBytes>=ceiling,'Closing reserve exhausted');reservedReads--;reservedBytes-=isJSON?JSON_BYTES:HTML_BYTES}
   // Reserve the single reader before pacing yields; a second caller cannot
   // pass read/closing checks while the first request is waiting to start.
   inFlight=true
   let receipt
   try{
    await spacing(url)
    const remaining=(currentPhase==='opening'?limits.sourceTimeoutMs/2:limits.sourceTimeoutMs)-(performance.now()-started)
    need(remaining>=1,'No original phase time remains')
    const timeoutMs=Math.max(1,Math.min(limits.requestTimeoutMs,Math.floor(remaining)))
    receipt={requestedUrl:url,method:body===null?'GET':'POST',requestBody:body,requestBodySHA256:body===null?null:sha(body),phase:currentPhase,startedAt:new Date().toISOString(),bodyComplete:false,requestTimeoutMs:timeoutMs,entityCeiling:ceiling,closingReadReserve:reservedReads,closingByteReserve:reservedBytes}
    receipts.push(receipt)
    const page=await boundedDeclaredPublicRead(url,{signal,timeoutMs,request:body===null?{method:'GET'}:{method:'POST',body},overflowError:fail('Original entity byte ceiling exceeded'),fetchImpl:async(requested,init)=>{
     const verify=()=>{check();init.signal.throwIfAborted()};verify();let original
     try{
      original=await(options.fetchImpl??globalThis.fetch)(requested,{...init,method:receipt.method,redirect:'manual',credentials:'omit',headers:{'User-Agent':USER_AGENT,Accept:isJSON?'application/json':'text/html',...(body===null?{}:{'Content-Type':'application/json'})}})
      verify();need(original&&Number.isInteger(original.status)&&typeof original.url==='string'&&typeof original.headers?.get==='function','Original Response HTTP metadata unavailable')
      Object.assign(receipt,{status:original.status,finalUrl:original.url,redirected:original.redirected,contentType:original.headers.get('content-type')??''})
      const stream=original.body;let received=0
      return{status:original.status,url:original.url,headers:original.headers,body:stream===null?null:{cancel:reason=>stream.cancel(reason),getReader(){
       verify();const reader=stream.getReader()
       return{async read(){verify();const chunk=await reader.read();verify();if(!chunk.done){need(types.isUint8Array(chunk.value),'Original stream chunk is not Uint8Array');const size=byteLength.call(chunk.value);received+=size;decodedBytes+=size;receipt.bytesReceived=received;need(received<=ceiling,'Original per-kind/entity byte ceiling exceeded');need(decodedBytes+reservedBytes<=limits.maxTotalBytes,'Aggregate bytes or closing reserve exceeded');return{done:false,value:new Uint8Array(arrayBuffer.call(chunk.value),byteOffset.call(chunk.value),size)}}return chunk},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}
      }}}
     }catch(error){ignore(()=>original?.body?.cancel(error));throw error}
    }})
    const bytes=Buffer.from(page.bodyBase64,'base64');Object.assign(receipt,{bytes:bytes.length,sha256:sha(bytes),bodyBase64:page.bodyBase64,bodyComplete:true})
    if(page.status!==200)throw fail('Original native HTTP '+page.status,{status:page.status,requestUrl:url})
    need(receipt.redirected===false&&page.url===url,'Original redirect/final URL authority changed')
    need((isJSON?/^application\/json(?:;\s*charset=(?:utf-8|"utf-8"))?$/i:/^text\/html(?:;\s*charset=(?:utf-8|"utf-8"))?$/i).test(receipt.contentType),'Original MIME/charset changed')
    need(!(bytes[0]===239&&bytes[1]===187&&bytes[2]===191),'Original BOM requires review')
    let text;try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes)}catch{throw fail('Invalid original UTF8 representation')}
    need(Buffer.from(text).equals(bytes),'Original UTF8 is not lossless');check();return{bytes,text}
   }catch(error){
    caller?.throwIfAborted();signal.throwIfAborted()
    if(receipt?.status!==undefined&&receipt.status!==200&&error?.status!==receipt.status)throw fail('Original native HTTP '+receipt.status,{status:receipt.status,requestUrl:url,responseBodyError:error})
    throw error
   }finally{if(receipt)receipt.completedAt=new Date().toISOString();inFlight=false}
  },
  stats:()=>({limits,requests:receipts.length,decodedBytes,phase:currentPhase,reservedClosingReads:reservedReads,reservedClosingBytes:reservedBytes,receipts:structuredClone(receipts)}),
  close(){closed=true;clearTimeout(timer);controller.abort()},
 }
}

export async function runCurrentEvonikData(options={}){
 const reader=createEvonikOriginalReader(options),observations=[]
 try{
  const now=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
  need(typeof now==='string'&&Number.isFinite(Date.parse(now)),'Invalid native source clock')
  const home=readEvonikCorporate(await reader.read(CAREERS)),seedURL=home.handshake.seedURL,seed=readEvonikCorporate(await reader.read(seedURL),true,seedURL)
  const global=readEvonikListing((await reader.read(API+'/jobs',post(false))).text),india=readEvonikListing((await reader.read(API+'/jobs',post(true))).text,true)
  need(same(indiaFacet(global),indiaFacet(india)),'Global/India selected facet contradiction')
  for(const row of india.jobPostings.slice(0,10)){
   const native=readEvonikRole((await reader.read(API+row.externalPath)).text,row,now),url=native.data.jobPostingInfo.externalUrl;reader.admitPublic(url)
   const landing=readEvonikLanding(await reader.read(url),native.profile)
   observations.push({id:row.bulletFields[0],row,nativeURL:API+row.externalPath,url,nativeOpening:native.data,landingOpening:landing})
  }
  reader.beginClosing()
  const lastIndia=readEvonikListing((await reader.read(API+'/jobs',post(true))).text,true),lastGlobal=readEvonikListing((await reader.read(API+'/jobs',post(false))).text)
  need(same(india.jobPostings,lastIndia.jobPostings)&&india.total===lastIndia.total&&same(indiaFacet(india),indiaFacet(lastIndia))&&same(indiaFacet(global),indiaFacet(lastGlobal))&&global.total===lastGlobal.total&&same(global.jobPostings,lastGlobal.jobPostings),'Required complete ordered listing/selected facet closing changed')
  for(const observed of observations){
   const native=readEvonikRole((await reader.read(observed.nativeURL)).text,observed.row,now),landing=readEvonikLanding(await reader.read(observed.url),native.profile)
   need(same(observed.nativeOpening,native.data)&&same(observed.landingOpening.model,landing.model),'Complete original native/public role closing changed '+observed.id)
   Object.assign(observed,{nativeClosing:native.data,landingClosing:landing})
  }
  const lastSeed=readEvonikCorporate(await reader.read(seedURL),true,seedURL),lastHome=readEvonikCorporate(await reader.read(CAREERS))
  need(same(seed,lastSeed)&&same(home.handshake,lastHome.handshake),'Current corporate/seed handoff closing changed')
  const stats=reader.stats();need(stats.requests===48&&stats.reservedClosingReads===0&&stats.reservedClosingBytes===0,'Required original closing observations incomplete')
  const jobs=observations.map(observed=>{
   const info=observed.nativeOpening.jobPostingInfo,model=observed.landingOpening.model,profile=PROFILE.roles.find(role=>role.id===observed.id)
   return{jobId:observed.id,sourceJobId:observed.id,title:info.title,sourcePublicTitle:model.title,sourceTitleVector:structuredClone(profile.titleVector),companyName:'Evonik',company:'Evonik',source:SOURCE,country:'India',location:info.location,jobUrl:observed.url,url:observed.url,sourceUrl:observed.url,nativeJobLandingURL:observed.url,applyUrl:null,link:null,nativeApplicationURL:null,nativeApplicationActionVerified:false,applicationVisited:false,
    postedDate:info.startDate,datePosted:info.startDate,postingDate:info.startDate,validThrough:info.endDate,employmentType:model.employmentType,sourcePublicationProvenance:'native-startDate-and-own-JobPosting.datePosted;first-ever-publication-unverified',firstPublicationVerified:false,
    sourceDescription:model.description,jobDescription:model.description,description:model.description,sourceNativeDescriptionHTML:info.jobDescription,nativeSourceRecord:structuredClone(model),nativeClosingSourceRecord:structuredClone(observed.landingClosing.model),nativeWorkdayRecord:structuredClone(observed.nativeOpening),nativeClosingWorkdayRecord:structuredClone(observed.nativeClosing),nativeHiringOrganization:structuredClone(model.hiringOrganization),nativeLegalHiringOrganization:structuredClone(observed.nativeOpening.hiringOrganization),nativeAdditionalLocations:structuredClone(info.additionalLocations??[]),additionalLocationCountryScopeUnresolved:Boolean(info.additionalLocations?.length),
    sourceDetailComplete:true,nativeCriteriaTextComplete:true,sourceCriteriaPresentation:'Complete original API-rich and own JobPosting criteria as data; executable/CSS/UI/application unqualified',currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceRenderedCriteriaComplete:false,sourceApplicationQualificationComplete:false,applicationQuestionsCoverage:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,nativeRoleClosingReconciled:true,
    nativeEvonikEvidence:{primaryCountryCode:'IN',primaryWorksite:info.location,APIHTMLSHA256:sha(info.jobDescription),publicDescriptionSHA256:sha(model.description),openingClosingReconciled:true,fullCriteriaVisibleExact:false,ownNativeApplyParity:false,titleVectorDisagreementDisclosed:info.title!==model.title,bootstrapOpening:observed.landingOpening.account,bootstrapClosing:observed.landingClosing.account,wholeExecutableOrUIQualified:false,companyGlobalTotal:null,companyIndiaTotal:null}}
  })
  attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS,firstParty:true,listingComplete:false,pagesFetched:48,reportedTotal:null,indiaFacetCount:null,verifiedAt:now,reason:'ten-reviewed-native-data-criteria-pairs;one-India-row-unhydrated;company-and-executable-scope-unproven'})
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',surface:CAREERS,firstParty:true,observedRecordCount:11,observedVacancyCount:11,companyGlobalTotal:null,companyIndiaTotal:null,lifecycleCleanupAllowed:false,sourceScopeComplete:false,observedAt:now})
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:11,observedVacancyCount:11,observations,originalResponses:stats.receipts,nativeOpeningCorporate:home,nativeClosingCorporate:lastHome,nativeOpeningSeed:seed,nativeClosingSeed:lastSeed,nativeOpeningIndiaListing:india,nativeClosingIndiaListing:lastIndia,nativeOpeningGlobalListing:global,nativeClosingGlobalListing:lastGlobal,observedIndiaRows:11,hydratedIndiaRows:10,unhydratedIndiaRows:structuredClone(india.jobPostings.slice(10)),observedNativeBoardReportedTotal:global.total,observedNativeIndiaFacet:indiaFacet(india),wholeObservedIndiaFacetClosingReconciled:true,companyGlobalTotal:null,companyIndiaTotal:null,companyScopeComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,currentCSSCoverage:false,clientDependencyCoverage:false,activationVerified:false,sourceApplicationQualificationComplete:false,applicationInteractions:0,limits:stats.limits,originalDecodedBytes:stats.decodedBytes},configurable:true})
  return jobs
 }catch(error){
  options.signal?.throwIfAborted()
  if(error&&typeof error==='object')Object.defineProperty(error,'recruitmentObservations',{value:{source:SOURCE,receipts:reader.stats().receipts,observations,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null},enumerable:true,configurable:true})
  throw error
 }finally{reader.close()}
}

export const createEvonikNativeDataScraper=(options={})=>({source:SOURCE,run:extra=>runCurrentEvonikData({...options,...extra})})
