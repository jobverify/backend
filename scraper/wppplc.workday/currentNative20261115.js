import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {types} from 'node:util'
import {parse} from 'acorn'
import {boundedDeclaredPublicRead} from '../../scraper-support/native-sources/boundedDeclaredPublicRead.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {normalizeNativeAttributeBoundaries} from '../../scraper-support/utils/nativeHtmlAttributes.js'
import {parseEightfoldJson} from '../../scraper-support/utils/recruitmentEightfoldData.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const profile=JSON.parse(readFileSync(new URL('./currentProfile20261115.json',import.meta.url)))
const SOURCE='wppplc',COMPANY='WPP plc',HOME='https://www.wpp.com/',CORPORATE=HOME+'en',CAREERS=CORPORATE+'/careers/search-and-apply',BOARD='https://wpp.careersitecloud.com/'
const sha=value=>createHash('sha256').update(value).digest('hex')
const problem=message=>Object.assign(Error('WPP native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw problem(message)}
const one=(rows,label)=>{need(rows.length===1,'missing or ambiguous '+label);return rows[0]}
const cls=(node,value)=>(node.attrs.class||'').split(/\s+/).includes(value)
const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
const retainedPaths=(node,predicate,path=[])=>['script','template','noscript','object'].includes(node.tag)?[]:[...(predicate(node)?[[...path,node]]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>retainedPaths(child,predicate,[...path,node]))]
const context=value=>typeof value==='string'&&/^https?:\/\/schema\.org\/?$/.test(value)
const typed=(value,type,inherited)=>{need(value&&typeof value==='object'&&!Array.isArray(value)&&value['@type']===type,'native '+type+' missing');const current=Object.hasOwn(value,'@context')?value['@context']:inherited;need(context(current),'native '+type+' context changed');return current}
const sameCriteria=value=>value.normalize('NFKC').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[\u2012-\u2015]/g,'-').replace(/\s+/g,' ').replace(/\s+([:;)])/g,'$1').replace(/\(\s+/g,'(').trim()
const unavailable=/\b(?:(?:(?:this|the)\s+)?(?:job|role|position|vacancy|opening|opportunity)\s+(?:(?:is|was|has(?:\s+been)?)\s+)?(?:(?:already|now|currently)\s+)*(?:closed|filled|withdrawn|cancelled|canceled|unavailable|not\s+available|no\s+longer\s+(?:available|active|open))|(?:no\s+longer|not(?:\s+currently)?)\s+accepting\s+(?:(?:any|new)\s+)?applications|(?:applications|recruitment|hiring)\s+(?:for\s+(?:(?:this|the)\s+)?(?:role|position|job|vacancy)\s+)?(?:(?:are|is|were|have\s+been|has\s+been)\s+)?(?:now\s+)?(?:closed|ended|stopped|suspended))\b/i
const schemaFields=new Set(['@context','@type','url','title','description','datePosted','industry','identifier','employmentType','hiringOrganization','jobLocation','validThrough'])
const encode=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;')
const voids=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'])
function presentation(raw,css){
  const render=node=>{
    if(typeof node==='string')return node
    if(['script','template','noscript','object','textarea','xmp','noembed','noframes','plaintext'].includes(node.tag))return''
    if(node.tag==='root')return node.children.map(render).join('')
    const start='<'+node.tag+Object.entries(node.attrs).map(([name,value])=>' '+name+'="'+encode(value)+'"').join('')+'>'
    if(voids.has(node.tag))return start
    const body=node.tag==='style'?node.raw||'':node.tag==='title'?encode(node.raw||''):node.tag==='iframe'?'':node.children.map(render).join('')
    return start+(node.tag==='head'?'<style>'+css+'</style>':'')+body+'</'+node.tag+'>'
  }
  return readVisibleNativeDocument(render(one(raw.nodes(node=>node.tag==='root'),'document root')),{strict:true})
}
function navigation(page){
  need(one(page.raw.nodes(n=>n.tag==='title'),'board title').raw==='Home | WPP careers','native board publisher changed')
  const scope=one(page.visible.nodes(n=>n.tag==='div'&&cls(n,'job-listing')),'native latest opportunities'),list=one(within(scope,n=>n.tag==='ul'&&cls(n,'list-unstyled')),'native opportunities list')
  const cards=list.children.filter(n=>typeof n!=='string'),seen=new Set()
  need(cards.length>0&&cards.length<=20&&cards.every(n=>n.tag==='li'),'empty or unbounded mixed-agency navigation')
  return cards.map(card=>{
    const anchors=within(card,n=>n.tag==='a'&&n.attrs.href),link=one(anchors.filter(n=>page.visible.text(n)),'native role lead'),title=page.visible.text(link)
    const url=new URL(link.attrs.href,BOARD).href,match=url.match(/^https:\/\/wpp\.careersitecloud\.com\/job-([a-f\d]{24})-[^/?#]+$/)
    need(match&&anchors.length===2&&anchors.every(n=>new URL(n.attrs.href,BOARD).href===url)&&!seen.has(url),'unbound or duplicate native lead');seen.add(url)
    const label=page.visible.text(one(within(card,n=>n.tag==='p'),'native agency and location label')),countryCity=label.match(/^WPP - India, (.+)$/)
    return{url,title,nativeObjectId:match[1],nativeAgencyLocationLabel:label,qualifiedOwnIndiaLead:!!countryCity,nativeCity:countryCity?.[1]||null}
  })
}
const calendar=value=>{const d=new Date(value);return String(d.getUTCMonth()+1).padStart(2,'0')+'/'+String(d.getUTCDate()).padStart(2,'0')+'/'+d.getUTCFullYear()}
const timestamp=(value,now,future)=>{need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value),'native UTC date missing');const time=Date.parse(value);need(Number.isFinite(time)&&new Date(time).toISOString()===value&&(future?time>now:time<=now),'native date invalid, expired or future');return value}
function applicationDeclaration(page,uid){
  const scripts=page.raw.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&n.attrs.type!=='application/ld+json')
  need(JSON.stringify(scripts.map(n=>({attrs:n.attrs,sha256:sha(n.raw)})))===JSON.stringify(profile.rolePrograms),'current native application programs require review')
  need(JSON.stringify(page.raw.nodes(n=>n.tag==='script'&&Object.hasOwn(n.attrs,'src')).map(n=>n.attrs))===JSON.stringify(profile.roleExternalScripts),'native external program declarations require review')
  const bindings=new Map()
  for(const script of scripts){
    let ast;try{ast=parse(script.raw,{ecmaVersion:'latest',sourceType:'script'})}catch{throw problem('native application program unreadable')}
    if(ast.body.length!==1||ast.body[0].type!=='VariableDeclaration'||ast.body[0].kind!=='var'||ast.body[0].declarations.length!==1)continue
    const declaration=ast.body[0].declarations[0]
    if(declaration.id?.type==='Identifier'&&['immediateApplyRedirect','applyRedirect'].includes(declaration.id.name)){
      need(!Object.hasOwn(script.attrs,'src')&&!Object.hasOwn(script.attrs,'nomodule')&&script.attrs.type==='text/javascript'&&declaration.init?.type==='Literal'&&typeof declaration.init.value==='string','native application is not an active classic literal')
      need(!bindings.has(declaration.id.name),'ambiguous native application literal');bindings.set(declaration.id.name,declaration.init.value)
    }
  }
  const expected='https://job-boards.greenhouse.io/wpp/jobs/'+uid
  need(bindings.get('immediateApplyRedirect')===expected&&bindings.get('applyRedirect')===expected+'?__jvst=Job Board&__jvsd=CareerSiteCloud','native same-employer application UID/account changed')
  return{url:expected,nativeImmediateApplyRedirect:bindings.get('immediateApplyRedirect'),nativeApplyRedirect:bindings.get('applyRedirect'),literalAndControllerReviewed:true,applicationSubmissionPerformed:false}
}
function nativeRole(page,row,now){
  const nodes=page.raw.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'src')&&(n.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json')
  let posting;try{posting=parseEightfoldJson(one(nodes,'own JobPosting').raw)}catch{throw problem('own JobPosting unreadable or ambiguous')}
  const ctx=typed(posting,'JobPosting',null)
  need(Object.keys(posting).every(key=>schemaFields.has(key)),'unreviewed native schema criterion field')
  typed(posting.hiringOrganization,'Organization',ctx);typed(posting.identifier,'PropertyValue',ctx)
  need(posting.hiringOrganization.name==='WPP'&&posting.identifier.name==='WPP'&&posting.identifier.value===profile.nativeUID,'own WPP employer or UID changed')
  need(posting.url===row.url&&posting.title===row.title&&posting.employmentType==='FULL_TIME','own canonical role/title/employment changed')
  need(Array.isArray(posting.jobLocation)&&posting.jobLocation.length===1,'ambiguous native work-country')
  const place=posting.jobLocation[0],placeContext=typed(place,'Place',ctx),address=place.address;typed(address,'PostalAddress',placeContext)
  need(address.addressCountry==='India'&&address.addressLocality===row.nativeCity,'native own country/city missing or different')
  const scope=one(page.visible.nodes(n=>n.tag==='div'&&cls(n,'job-view')),'visible own role'),h1=page.visible.text(one(within(scope,n=>n.tag==='h1'),'own visible title'))
  need(h1===posting.title+', '+address.addressLocality,'visible title is not exact schema title plus independent native city')
  const table=one(within(scope,n=>n.tag==='table'&&cls(n,'job-view-fields')),'own labelled role fields'),fields={}
  for(const tr of table.children.filter(n=>typeof n!=='string')){
    const cells=tr.children.filter(n=>typeof n!=='string')
    if(cells.length!==2)continue
    need(tr.tag==='tr'&&cells[0].tag==='td'&&cls(cells[0],'job-field')&&cells[1].tag==='td'&&cls(cells[1],'job-field-value'),'native field structure changed')
    const key=page.visible.text(cells[0]);need(!Object.hasOwn(fields,key),'duplicate own labelled field');fields[key]=page.visible.text(cells[1])
  }
  need(JSON.stringify(Object.keys(fields))===JSON.stringify(['Agency','Created','Expires','Reference','Category','Location','City']),'native labelled field contract changed')
  need(fields.Agency==='WPP'&&fields.Reference===posting.identifier.value&&fields.Location===address.addressCountry&&fields.City===address.addressLocality&&fields.Category===posting.industry,'own visible employer/UID/country/category conflict')
  timestamp(posting.datePosted,now,false);timestamp(posting.validThrough,now,true)
  need(fields.Created===calendar(posting.datePosted)&&fields.Expires===calendar(posting.validThrough),'native schema/visible dates disagree')
  const descriptionNode=one(within(scope,n=>n.tag==='div'&&cls(n,'description-info')),'visible full native criteria')
  const original=one(page.raw.nodes(n=>n.tag==='div'&&cls(n,'description-info')),'original authored criteria'),description=page.visible.text(descriptionNode)
  const ancestors=one(retainedPaths(one(page.raw.nodes(n=>n.tag==='root'),'native root'),n=>n===original),'native criteria ancestors').map(n=>({tag:n.tag,attrs:n.attrs}))
  need(JSON.stringify(ancestors)===JSON.stringify(profile.roleAncestors),'unreviewed native criteria ancestor attributes')
  need(description.length>=1500&&description===page.raw.text(original)&&description===extractActiveDescription(posting.description),'complete own schema/visible full criteria mismatch')
  const all=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(all)]
  need(all(original).every(n=>!n.inert&&!Object.hasOwn(n,'raw')&&(n===original||Object.keys(n.attrs).length===0)&&['div','strong','b','br','ul','li','p','a','em','i','span','u'].includes(n.tag)),'unreviewed or hidden native criteria elements')
  need(!unavailable.test(page.visible.text(one(page.visible.nodes(n=>n.tag==='root'),'own root'))),'native role explicitly filled, closed or unavailable')
  return{posting,fields,description,nativeDescriptionNode:original,nativeVisibleTitle:h1,application:applicationDeclaration(page,posting.identifier.value)}
}
function nativeApplication(page,role){
  need(page.raw.nodes(n=>n.tag==='script'&&(n.attrs.type||'').split(';')[0].trim().toLowerCase()==='application/ld+json').length===0,'unreviewed native application schema criteria require review')
  const title=one(page.raw.nodes(n=>n.tag==='title'),'application publisher title').raw
  need(title==='Job Application for '+role.posting.title+' at WPP','application title/employer conflict')
  const canonical=one(page.raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native application canonical').attrs.href
  need(canonical===role.application.url.replace('https:','http:')||canonical===role.application.url,'application canonical UID/account conflict')
  need(one(page.raw.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:url'),'application URL assertion').attrs.content===role.application.url,'own application identity conflict')
  need(page.visible.text(one(page.visible.nodes(n=>n.tag==='h1'),'application visible title'))===role.posting.title,'application visible title changed')
  const descriptionNode=one(page.visible.nodes(n=>n.tag==='div'&&cls(n,'job__description')),'full application criteria'),description=page.visible.text(descriptionNode)
  const original=one(page.raw.nodes(n=>n.tag==='div'&&cls(n,'job__description')),'original full application criteria')
  const all=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(all)]
  need(all(original).every(node=>!node.inert&&!Object.hasOwn(node,'raw'))&&page.raw.text(original)===description,'application authored criteria hidden or incomplete')
  need(JSON.stringify(descriptionNode.attrs)===JSON.stringify({class:'job__description body'}),'unreviewed application criteria attributes')
  need(sameCriteria(description)===sameCriteria(role.description),'independent application full criteria mismatch')
  const form=one(page.visible.nodes(n=>n.tag==='div'&&cls(n,'application--container')),'current public application')
  need(JSON.stringify(form.attrs)===JSON.stringify({class:'application--container'})&&within(form,n=>n.tag==='h2'&&page.visible.text(n)==='Apply for this job').length===1&&within(form,n=>n.tag==='button'&&n.attrs.type==='submit'&&n.attrs.class==='btn btn--pill'&&!Object.hasOwn(n.attrs,'disabled')&&page.visible.text(n)==='Submit application'&&n.attrs['aria-disabled']==='false').length===1,'current application form unavailable')
  need(!unavailable.test(page.visible.text(one(page.visible.nodes(n=>n.tag==='root'),'application root'))),'native application filled, closed or unavailable')
  return{nativeCanonical:canonical,description,nativeDescriptionNode:descriptionNode,currentApplicationFormVerified:true}
}

export async function runCurrentWpp(options={}){
  need(!options.fetchText,'native HTTP metadata required; body-only input cannot qualify current WPP roles')
  const clock=typeof options.now==='function'?options.now():options.now??new Date().toISOString(),now=Date.parse(clock)
  need(Number.isFinite(now),'invalid observation clock')
  const duration=options.sourceDeadlineMs??85000;need(Number.isSafeInteger(duration)&&duration>0&&duration<=85000,'invalid source deadline')
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(problem('source deadline exceeded')),duration)
  const signal=options.signal?AbortSignal.any([options.signal,controller.signal]):controller.signal
  const allowed=new Set([HOME]),receipts=[],styles=new Map(),fetchImpl=options.fetchImpl||globalThis.fetch;let count=0,total=0
  const read=async(url,kind='html',redirect=false)=>{
    signal.throwIfAborted();need(allowed.has(url)&&++count<=60,'native public URL/count bound')
    const nativeFetch=async(value,init)=>{
      const response=await fetchImpl(value,{...init,cache:'no-store',credentials:'omit',headers:{...init.headers,'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'}})
      const body=response.body===null?null:{cancel:reason=>response.body.cancel(reason),getReader(){const reader=response.body.getReader();let bytes=0;return{async read(){const part=await reader.read();if(!part.done){need(types.isUint8Array(part.value),'native byte chunk type');need(part.value.byteLength<=4000000-bytes&&part.value.byteLength<=24000000-total,'native stream byte bound');bytes+=part.value.byteLength;total+=part.value.byteLength}return part},cancel:reason=>reader.cancel(reason),releaseLock:()=>reader.releaseLock()}}}
      return{status:response.status,url:response.url,headers:response.headers,body}
    }
    const packet=await boundedDeclaredPublicRead(url,{fetchImpl:nativeFetch,signal,timeoutMs:15000,overflowError:problem('native stream byte bound')})
    const bytes=Buffer.from(packet.bodyBase64,'base64'),html=new TextDecoder('utf-8',{fatal:true}).decode(bytes)
    receipts.push({requestedURL:url,...packet,body:html,bodySHA256:sha(bytes)})
    need(packet.url===url,'native final URL changed');need(packet.status===200||redirect&&packet.status===307,'native public HTTP '+packet.status)
    if(packet.status===200){const mime=(packet.headers['content-type']||'').split(';')[0].trim().toLowerCase();need(kind==='css'?mime==='text/css':['text/html','application/xhtml+xml'].includes(mime),'native response type changed')}
    return{url,html,status:packet.status,headers:packet.headers}
  }
  const page=async url=>{
    const result=await read(url),raw=readNativeDocument(normalizeNativeAttributeBoundaries(result.html))
    need(!raw.nodes(n=>n.tag==='base').length,'unreviewed native base')
    const inlineStyles=retainedPaths(one(raw.nodes(n=>n.tag==='root'),'native root'),n=>n.tag==='style'||Object.hasOwn(n.attrs,'style')).map(path=>path.at(-1)).map(n=>({tag:n.tag,attrs:n.tag==='style'?n.attrs:{style:n.attrs.style},raw:n.tag==='style'?n.raw:null}))
    need(JSON.stringify(inlineStyles)===JSON.stringify(profile.inlineStyles[url]),'native inline style inventory changed')
    const declarations=raw.nodes(n=>n.tag==='link'&&n.attrs.rel==='stylesheet').map(n=>n.attrs)
    need(JSON.stringify(declarations)===JSON.stringify(profile.styleDeclarations[url]),'native style declarations changed')
    const urls=declarations.map(attrs=>new URL(attrs.href,url).href)
    for(const url of urls){need(Object.hasOwn(profile.styles,url),'unreviewed stylesheet URL');allowed.add(url);if(!styles.has(url)){const sheet=await read(url,'css');need(sha(sheet.html)===profile.styles[url],'native stylesheet bytes changed');styles.set(url,sheet.html)}}
    return{...result,raw,visible:presentation(raw,urls.map(url=>styles.get(url)).join('\n'))}
  }
  const publication=async()=>{
    const root=await read(HOME,'html',true)
    need(root.status===307&&new URL(root.headers.location,HOME).href===CORPORATE,'configured WPP root delegation changed')
    allowed.add(CORPORATE);const home=await page(CORPORATE)
    need(one(home.raw.nodes(n=>n.tag==='title'),'corporate title').raw==='WPP | Trusted growth partner for the world’s leading brands','corporate WPP publisher changed')
    need(home.raw.nodes(n=>n.tag==='a'&&n.attrs.href==='/en/careers/search-and-apply'&&home.raw.text(n)==='Explore careers at WPP').length===1,'published corporate careers navigation changed')
    allowed.add(CAREERS);const careers=await page(CAREERS)
    need(one(careers.raw.nodes(n=>n.tag==='title'),'careers title').raw==='Find your next role | WPP','corporate careers publisher changed')
    need(careers.visible.nodes(n=>n.tag==='h1'&&careers.visible.text(n)==='Find your next role').length===1,'visible corporate careers context unavailable')
    const frame=one(careers.visible.frames(),'current visible careers delegation')
    need(frame.attrs.src===BOARD&&frame.attrs.title==='Search and apply'&&!Object.hasOwn(frame.attrs,'srcdoc'),'native corporate board delegation changed')
    allowed.add(BOARD);const board=await page(BOARD)
    return navigation(board)
  }
  try{
    const opening=await publication(),rows=opening.filter(row=>row.qualifiedOwnIndiaLead)
    need(rows.length>0&&rows.length<=8,'coverage-gap: no bounded qualified own WPP India leads; not zero inventory')
    const staged=[]
    for(const row of rows){need(row.url===profile.nativeRoleURL,'current native role profile unreviewed');allowed.add(row.url);const role=nativeRole(await page(row.url),row,now);allowed.add(role.application.url);staged.push({row,role,application:nativeApplication(await page(role.application.url),role)})}
    const closing=await publication();need(JSON.stringify(opening)===JSON.stringify(closing),'closing mixed-agency navigation changed')
    for(const item of staged){const role=nativeRole(await page(item.row.url),item.row,now),application=nativeApplication(await page(role.application.url),role);need(JSON.stringify(role)===JSON.stringify(item.role)&&JSON.stringify(application)===JSON.stringify(item.application),'closing full own role/application context changed')}
    for(const url of styles.keys()){const sheet=await read(url,'css');need(sha(sheet.html)===profile.styles[url],'closing native stylesheet changed')}
    signal.throwIfAborted()
    const jobs=staged.map(({row,role,application})=>({source:SOURCE,company:COMPANY,title:role.posting.title,nativeVisibleTitle:role.nativeVisibleTitle,jobId:role.posting.identifier.value,requisitionId:role.posting.identifier.value,
      sourceUrl:row.url,link:row.url,applyUrl:role.application.url,country:'India',city:role.fields.City,location:role.fields.City+', '+role.fields.Location,
      jobDescription:role.description,sourceDescription:role.description,sourceNativeJobPosting:role.posting,sourceNativeFullCriteria:role.nativeDescriptionNode,sourceNativeFields:role.fields,
      sourceNativeApplication:role.application,sourceNativeApplicationCriteria:application,sourceNativeSchemaCanonicalURL:role.posting.url,
      postingDate:role.posting.datePosted,sourcePostedDateRaw:role.posting.datePosted,sourcePostedDateIsExact:true,postingDatePrecision:'timestamp',firstEverPostedAt:null,closingDate:null,sourceSchemaExpiryRaw:role.posting.validThrough,
      employmentType:role.posting.employmentType,remoteStatus:null,sourceOfficialBinding:{corporate:CORPORATE,careers:CAREERS,visibleDelegatedBoard:BOARD,nativeAgency:'WPP',originalCompany:COMPANY,otherAgenciesQualified:false},
      sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date().toISOString()}))
    Object.defineProperty(jobs,'nativeCollectionEvidence',{value:{source:SOURCE,originalResponses:receipts,mixedAgencyNavigation:opening,ownRoleCount:jobs.length,corporateClosingReconciled:true,ownRolesAndApplicationsClosingReconciled:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false}})
    attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:jobs.length,observedVacancyCount:jobs.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
    return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:BOARD,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,reportedTotal:null,indiaFacetCount:null,pagesFetched:count,verifiedAt:new Date().toISOString(),reason:'current own WPP Agency role positive; exact native title/city/UID/country and full current application criteria closing reconciled; group scope and zero inventory unqualified'})
  }catch(error){
    if(options.signal?.aborted)throw options.signal.reason
    try{if(error&&typeof error==='object'&&Object.isExtensible(error))Object.defineProperty(error,'sourceAudit',{value:{source:SOURCE,originalResponses:receipts,sourceScopeComplete:false,lifecycleCleanupAllowed:false},enumerable:true,configurable:true,writable:true})}catch{}
    throw error
  }finally{clearTimeout(timer)}
}
