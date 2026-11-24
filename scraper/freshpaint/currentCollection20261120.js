import {isDeepStrictEqual as same} from 'node:util'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {need,one,all,norm,props,scalarFields,constraints,authoredLines,writtenPlaceCountries,nativeCountryName,schemas,semanticCriteria,schemaCarrier} from './currentFacts20261120.js'
import {currentNativeModel} from './currentModel20261120.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {schemaContext} from './currentFacts20261120.js'
import {scriptKind as currentScriptKind} from './currentScriptKind20261120.js'

export const HOME='https://www.freshpaint.io/careers',BOARD='https://jobs.ashbyhq.com/freshpaint',CLIENT=BOARD+'/embed',EMBED=BOARD+'?embed=js',FEED='https://api.ashbyhq.com/posting-api/job-board/freshpaint'
const COMPANY='Freshpaint',UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applicationKeys=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','applylink','applicationlink','joburl','detailurl'])
const employerKeys=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer'])
const countryKeys=new Set(['country','countrycode','jobcountry','workcountry','workplacecountry','addresscountry'])
const context=(at,countries)=>({employer:COMPANY,observedAt:at,countryAlternatives:countries})
export function pure(fn){try{return fn()}catch(error){if(error?.nativeContradiction)throw error;throw Object.assign(Error('Freshpaint complete native parser/contract: '+error.message),{cause:error,abortRetries:true,nativeContradiction:true,softFailure:true,failureKind:'parser_or_contract_error'})}}
function safeURL(value,base){need(typeof value==='string'&&value.trim()===value&&value.length>0,'native URL malformed');const url=new URL(value,base);need(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash,'native exact HTTPS URL differs');return url}
export function publisherRootDomain(value){need(typeof value==='string'&&/^https:\/\/(?:www\.)?freshpaint\.io\/?$/i.test(value),'current native owned root publisher metadata differs');return'freshpaint.io'}
function applications(properties,allowed){for(const property of properties)if(applicationKeys.has(key(property.key))&&property.value!=null)need(allowed.includes(safeURL(property.value,BOARD).href),'native same-role application alias conflicts')}
function ancestors(root,target,path=[]){if(root===target)return[...path,root];for(const child of root.children.filter(n=>typeof n!=='string')){const found=ancestors(child,target,[...path,root]);if(found)return found}return null}
function carrier(p,node,at,{countries=[],allowed=[BOARD]}={}){
 const nodes=ancestors(p.d.root,node);need(nodes,'actual native carrier ancestry missing')
 need(nodes.every(n=>!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-disabled']!=='true'&&n.attrs['aria-hidden']!=='true'&&!/(?:^|\s)(?:disabled|hidden|d-none)(?:\s|$)/.test(n.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style??'')),'actual publisher/control carrier withdrawn')
 const properties=props(nodes.map(n=>({...n,inactive:false,inert:false})));applications(properties,allowed);constraints(properties,[],context(at,countries))
}
function publisher(html,url,at,{own=false}={}){
 const d=document(html),nodes=all(d.root,()=>true),head=activeHead(html),title=one(head.titles,'current native publisher title'),brand=/\bFreshpaint\b/i
 need(brand.test(title),'current publisher title brand differs');need(!nodes.some(n=>n.tag==='base'||n.tag==='meta'&&/refresh/i.test(n.attrs['http-equiv']??'')),'native base/refresh differs')
 const p={d,nodes,title,originalPublisherModels:[],originalUnscopedPublisherModels:[]},canonicals=nodes.filter(n=>n.tag==='link'&&(n.attrs.rel??'').toLowerCase()==='canonical')
 const samePage=value=>{const href=safeURL(value,url).href;return own?href===HOME:[BOARD,url].includes(href)}
 if(own||canonicals.length){const canonical=one(canonicals,'current publisher canonical');need(samePage(canonical.attrs.href),'native publisher canonical differs');carrier(p,canonical,at,{allowed:[BOARD,EMBED]})}
 carrier(p,one(nodes.filter(n=>n.tag==='title'),'actual publisher title'),at,{allowed:[BOARD,EMBED]})
 for(const meta of nodes.filter(n=>n.tag==='meta'&&['og:site_name','og:url','og:title'].includes(n.attrs.property))){if(meta.attrs.property==='og:site_name')need(meta.attrs.content===COMPANY,'native OG publisher differs');if(meta.attrs.property==='og:url')need(samePage(meta.attrs.content),'native OG publisher URL differs');if(meta.attrs.property==='og:title')need(brand.test(meta.attrs.content??''),'native OG title publisher differs');carrier(p,meta,at,{allowed:[BOARD,EMBED]})}
 if(own){const headings=d.nodes(n=>n.tag==='h1');need(headings.length>0&&headings.length<=8,'current own publisher headings missing/excessive');for(const heading of headings)carrier(p,heading,at,{allowed:[BOARD,EMBED]})}
 let visited=0
 function structured(value,inherited,depth=0){
  need(depth<=32&&++visited<=20000,'finite current publisher structured scope exceeded');if(Array.isArray(value)){value.forEach(v=>structured(v,inherited,depth+1));return}if(!value||typeof value!=='object')return
  const current=Object.hasOwn(value,'@context')?value['@context']:inherited,types=(Array.isArray(value['@type'])?value['@type']:[value['@type']]).map(t=>String(t??'').replace(/^https?:\/\/schema\.org\//,''))
  need(!types.includes('JobPosting'),'additional native JobPosting requires role qualification rather than configured empty proof')
  if(types.some(t=>['AboutPage','WebPage','WebSite','Organization'].includes(t))){
   // The actual own document also retains a separate freshpaint.com/about
   // AboutPage. Its explicit different document URI supplies no current
   // career/domain alias, publication, employer or country authority.
   if(own&&types.includes('AboutPage')&&!types.some(t=>['WebPage','Organization','WebSite'].includes(t))&&value.url!=null&&!samePage(value.url)){
    if(value['@id']!=null){need(typeof value['@id']==='string'&&value['@id'].trim()===value['@id']&&value['@id'].length>0,'native AboutPage identifier malformed');const identifier=new URL(value['@id'],url);identifier.hash='';need(identifier.href!==HOME,'native AboutPage document URI aliases conflict')}
    p.originalUnscopedPublisherModels.push(structuredClone(value));return
   }
   need(typeof current==='string'&&/^https?:\/\/schema\.org\/?$/.test(current),'native publisher structured context differs');publisherFacts(value,at,[BOARD,EMBED]);p.originalPublisherModels.push(structuredClone(value))
   if(types.some(t=>['Organization','WebSite'].includes(t))){need(value.name===COMPANY,'native structured publisher differs');if(value.url!=null)publisherRootDomain(value.url)}
   else{if(value.name!=null)need(typeof value.name==='string'&&brand.test(value.name),'native structured own publisher name differs');if(value.url!=null)need(samePage(value.url),'native structured publisher page URL differs')}
   if(value['@id']!=null){const u=new URL(value['@id'],url);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&(['freshpaint.io','www.freshpaint.io'].includes(u.hostname)||!own&&u.origin===new URL(BOARD).origin&&u.pathname===new URL(BOARD).pathname),'native structured publisher identifier differs')}
  }
  for(const[field,child]of Object.entries(value))if(field!=='@context'&&child&&typeof child==='object')structured(child,current,depth+1)
 }
 for(const script of nodes.filter(n=>n.tag==='script'&&!n.attrs.src&&(n.attrs.type??'').toLowerCase()==='application/ld+json')){const before=p.originalPublisherModels.length;structured(readLiteralModel(script.raw??'').value);if(p.originalPublisherModels.length>before)carrier(p,script,at,{allowed:[BOARD,EMBED]})}
 return p
}
export function currentAuthority(html,at){
 const p=publisher(html,HOME,at,{own:true}),scripts=p.nodes.filter(n=>n.tag==='script'&&n.attrs.src).filter(n=>{try{return new URL(n.attrs.src,HOME).origin===new URL(BOARD).origin}catch{return false}}),declared=one(scripts,'actual own declared native client'),container=one(p.nodes.filter(n=>n.attrs.id==='ashby_embed'),'actual own native embed container')
 need(safeURL(declared.attrs.src,HOME).href===CLIENT,'current own declared native account/client differs');need(currentScriptKind(declared),'declared native client is not executable programme data');need(!container.attrs['data-jid'],'actual current own container is scoped to a native role');carrier(p,declared,at,{allowed:[BOARD,EMBED]});carrier(p,container,at,{allowed:[BOARD,EMBED]})
 return{publisher:COMPANY,home:HOME,board:BOARD,client:CLIENT,originalDeclarations:[{attributes:structuredClone(declared.attrs)}],originalContainer:{tag:container.tag,attributes:structuredClone(container.attrs)},originalPublisherModels:p.originalPublisherModels,originalUnscopedPublisherModels:p.originalUnscopedPublisherModels,legalEmployer:null}
}
function noAdditionalJobs(model){
 const collections=new Set(['jobs','joblist','joblistings','jobopenings','openpositions','positions','vacancies','jobpostings','jobcount','jobscount','openjobcount']);let visited=0
 function visit(value,path=[],depth=0){need(depth<=32&&++visited<=20000,'finite native original model scope exceeded');if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((child,i)=>visit(child,[...path,String(i)],depth+1));return}for(const[name,child]of Object.entries(value)){need(!collections.has(key(name))||path.length===1&&path[0]==='jobBoard'&&name==='jobPostings','additional unqualified native job model prevents configured zero');if(child&&typeof child==='object')visit(child,[...path,name],depth+1)}}
 visit(model)
}
function publication(model,at,countries,allowed){
 constraints(scalarFields(model),[],context(at,countries));applications(Object.entries(model).map(([key,value])=>({key,value})),allowed)
 for(const[field,value]of Object.entries(model)){const name=key(field);if(['listed','islisted'].includes(name))need(value===true,'native role not listed');if(name==='isconfidential')need(value===false,'native employer/publication confidentiality differs')}
 if(model.publishedAt!=null){const value=model.publishedAt;need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'native published date malformed');nativeDate(value.slice(0,10),{required:true});need(Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(at),'native published date invalid/future')}
}
function publisherFacts(model,at,allowed){
 const retained=Object.fromEntries(Object.entries(model).filter(([name])=>!countryKeys.has(key(name))))
 for(const[field,value]of Object.entries(retained))if(employerKeys.has(key(field))&&value!=null){if(typeof value==='object'&&!Array.isArray(value))typed(value,'Organization');need((typeof value==='string'?value:value.name)===COMPANY,'native nested publisher employer differs')}
 publication(retained,at,[],allowed)
}
function typed(value,type){if(value['@context']!=null)need(typeof value['@context']==='string'&&/^https?:\/\/schema\.org\/?$/.test(value['@context']),'native typed context differs');if(value['@type']!=null){const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];need(types.length>0&&types.every(t=>[type,'https://schema.org/'+type,'http://schema.org/'+type].includes(t)),'native semantic type differs')}}
function foreignCountry(value){
 const object=value&&typeof value==='object'&&!Array.isArray(value);if(object)typed(value,'Country')
 const raw=object?value.name:value,country=nativeCountryName(raw);need(country&&country!=='India','native explicit workplace is India or unresolved')
 if(object)for(const[field,alias]of Object.entries(value))if(['country','countrycode','addresscountry','code','identifier','alternatename'].includes(key(field))&&alias!=null)need(typeof alias==='string'&&nativeCountryName(alias)===country,'native Country name/code contradicts current foreign workplace')
 return country
}
function workplaceFacts(value,country,at,allowed){
 for(const[field,entry]of Object.entries(value)){if(entry==null)continue;const name=key(field);if(countryKeys.has(name))need(foreignCountry(entry)===country,'native same-workplace explicit countries conflict');if(employerKeys.has(name)){if(typeof entry==='object'&&!Array.isArray(entry))typed(entry,'Organization');need((typeof entry==='string'?entry:entry.name)===COMPANY,'native workplace publisher differs')}}
 publication(value,at,[country],allowed)
}
function places(record,at,allowed){
 need(Array.isArray(record.secondaryLocations)&&record.secondaryLocations.length<=64,'native secondary workplaces malformed')
 return[{location:record.location,address:record.address},...record.secondaryLocations].map(place=>{
  need(place&&typeof place==='object'&&!Array.isArray(place)&&typeof place.location==='string'&&norm(place.location)&&!/\b(?:worldwide|anywhere|global|APAC|EMEA)\b/i.test(place.location),'native whole workplace is unresolved')
  const address=place.address?.postalAddress??place.address;need(address&&typeof address==='object'&&!Array.isArray(address),'native typed workplace address absent');typed(place,'Place');typed(address,'PostalAddress');const country=foreignCountry(address.addressCountry);workplaceFacts(place,country,at,allowed);workplaceFacts(address,country,at,allowed);if(place.address?.postalAddress){typed(place.address,'PostalAddress');workplaceFacts(place.address,country,at,allowed)}
  for(const value of[place.location,address.name,address.addressLocality,address.addressRegion,address.streetAddress].filter(v=>v!=null)){need(typeof value==='string','native workplace text malformed');need(writtenPlaceCountries(value).every(c=>c===country||country==='United States'&&c==='Georgia'&&value===address.addressRegion&&value==='Georgia'),'native same-place authored country contradicts typed address')}
  for(const[field,value]of Object.entries(place))if(countryKeys.has(key(field))&&value!=null)need(foreignCountry(value)===country,'native same-workplace explicit countries conflict')
  return{country,location:place.location,originalAddress:structuredClone(place.address),address:structuredClone(address)}
 })
}
function extraFacts(model,at,workplaces,allowed){
 const countries=[...new Set(workplaces.map(p=>p.country))]
 for(const[field,value]of Object.entries(model)){
  if(value==null)continue;const name=key(field)
  if(employerKeys.has(name)){if(value&&typeof value==='object'&&!Array.isArray(value))typed(value,'Organization');const employer=typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.name:null;need(employer===COMPANY,'native nested employer differs')}
  if(countryKeys.has(name))need(countries.includes(foreignCountry(value)),'native explicit primary country differs')
  if(['applicantlocationrequirements','eligibleregion'].includes(name)){const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native applicant countries malformed');entries.forEach(foreignCountry)}
  if(['joblocation','joblocations','worklocation','worklocations','primarylocation','primarylocations'].includes(name)){
   const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native additional workplaces malformed')
   const written=entries.map(place=>{need(place&&typeof place==='object'&&!Array.isArray(place),'native typed additional workplace malformed');typed(place,'Place');const address=place.address?.postalAddress??place.address??place;typed(address,'PostalAddress');const country=foreignCountry(address.addressCountry??place.country??place.countryCode);workplaceFacts(place,country,at,allowed);workplaceFacts(address,country,at,allowed);for(const text of[place.name,address.name,address.addressLocality,address.addressRegion].filter(v=>v!=null))need(writtenPlaceCountries(text).every(c=>c===country),'native typed workplace country contradicts authored place');return{country,city:address.addressLocality??null}})
   need(written.some(place=>workplaces.some(known=>place.country===known.country&&(!place.city||!known.address.addressLocality||norm(place.city).toLowerCase()===norm(known.address.addressLocality).toLowerCase()))),'native additional typed primary workplace contradicts current role')
  }
 }
 publication(model,at,countries,allowed)
}
function criteria(record,at,workplaces,allowed){
 const countries=[...new Set(workplaces.map(p=>p.country))],html=record.descriptionHtml
 need(html==null||typeof html==='string','native original criteria HTML malformed');need(record.descriptionPlain==null||typeof record.descriptionPlain==='string','native original criteria text malformed')
 const d=readNativeDocument(html??''),root=one(d.nodes(n=>n.tag==='root'),'native criteria root'),nodes=all(root,()=>true),semantic=semanticCriteria(root),properties=[...props(nodes),...semantic.properties],lines=[...authoredLines(root),...semantic.lines,...(record.descriptionPlain??'').split(/\r?\n/).map(norm).filter(Boolean)]
 applications(properties,allowed);constraints(properties,lines,context(at,countries))
 for(const line of lines){const label=/^(?:Location|Work Location|Job Location|Workplace)\s*:\s*(.+)$/i.exec(line);if(label)need(!/\b(?:worldwide|anywhere|global|APAC|EMEA)\b/i.test(label[1]),'authored native workplace is unresolved')}
 for(const schema of schemas({d},{types:['JobPosting','WebPage']})){need(typeof schemaContext(schema)==='string'&&/^https?:\/\/schema\.org\/?$/.test(schemaContext(schema)),'native criteria structured context differs');carrier({d:{...d,root}},schemaCarrier(schema),at,{countries,allowed});if(schema.title!=null)need(norm(schema.title)===norm(record.title),'native criteria structured title differs');if(schema.url!=null)need(schema.url===record.jobUrl,'native criteria structured URL differs');const types=Array.isArray(schema['@type'])?schema['@type']:[schema['@type']];if(types.some(type=>['WebPage','https://schema.org/WebPage','http://schema.org/WebPage'].includes(type)))need(schema.url===record.jobUrl||schema['@id']===record.jobUrl,'native criteria WebPage role identity missing');extraFacts(schema,at,workplaces,allowed)}
 return{originalHTML:html??null,originalPlain:record.descriptionPlain??null}
}
export function currentBoard(html,url,at){
 const p=publisher(html,url,at),state=currentNativeModel(p.d),model=state.originalModel,organization=model.organization,collection=model.jobBoard
 noAdditionalJobs(model)
 need(model.environment==='production'&&model.maintenanceMode===false&&model.schedulingMaintenanceMode===false&&model.posting===null&&model.routerPrefix==='/','native current board environment/router differs')
 need(organization.__typename==='Organization'&&organization.name===COMPANY&&organization.hostedJobsPageSlug==='freshpaint'&&organization.isDemoOrg===false&&UUID.test(organization.organizationId)&&publisherRootDomain(organization.publicWebsite)==='freshpaint.io','native exact publisher/account/backlink differs')
 need(organization.customJobsPageUrl==null||safeURL(organization.customJobsPageUrl).href===HOME,'native custom publisher differs')
 need(collection?.__typename==='JobBoard'&&collection.stealthAccess===false&&Array.isArray(collection.jobPostings)&&collection.jobPostings.length>0&&collection.jobPostings.length<=2000,'native complete current listed collection unavailable')
 publisherFacts(model,at,[BOARD]);publisherFacts(organization,at,[BOARD]);publisherFacts(collection,at,[BOARD])
 const selected=one(p.nodes.filter(n=>n.tag==='script'&&n.attrs===state.originalScriptAttributes),'actual original appData carrier');carrier(p,selected,at)
 return{model,rows:collection.jobPostings,organizationBinding:{id:organization.organizationId,name:organization.name,slug:organization.hostedJobsPageSlug,website:organization.publicWebsite},originalAssignment:state.originalAssignment}
}
export function currentFeed(text,currentBoard,at){
 const model=readLiteralModel(text).value;need(model&&typeof model==='object'&&!Array.isArray(model)&&same(Object.keys(model).sort(),['apiVersion','jobs'])&&model.apiVersion==='1'&&Array.isArray(model.jobs)&&model.jobs.length<=2000,'native documented unfiltered public feed shape differs')
 const seen=new Set(),rows=[]
 for(const record of model.jobs){need(record&&typeof record==='object'&&!Array.isArray(record)&&UUID.test(record.id)&&!seen.has(record.id)&&typeof record.title==='string'&&norm(record.title)&&typeof record.isListed==='boolean','native identity/title/listed scope malformed');seen.add(record.id);if(!record.isListed)continue
  const url=BOARD+'/'+record.id,apply=url+'/application';need(record.jobUrl===url&&record.applyUrl===apply,'native account/publicID/application differs');const allowed=[url,apply],workplaces=places(record,at,allowed);extraFacts(record,at,workplaces,allowed);const originalCriteria=criteria(record,at,workplaces,allowed)
  rows.push({id:record.id,title:norm(record.title),url,application:apply,countries:[...new Set(workplaces.map(p=>p.country))],workplaces,originalRecord:structuredClone(record),originalCriteria})
 }
 need(rows.length===currentBoard.rows.length&&new Set(currentBoard.rows.map(r=>r.id)).size===currentBoard.rows.length,'native board/feed membership count differs')
 for(const brief of currentBoard.rows){const row=one(rows.filter(r=>r.id===brief.id),'native exact board/feed identity');need(brief.__typename==='JobPostingBriefsWithIdsAndTeamId'&&norm(brief.title)===row.title&&brief.locationName===row.originalRecord.location&&Array.isArray(brief.secondaryLocations)&&same(brief.secondaryLocations.map(p=>p.locationName),row.originalRecord.secondaryLocations.map(p=>p.location)),'native board/feed title or workplace alternatives differ');for(const field of['workplaceType','employmentType'])if(brief[field]!=null&&row.originalRecord[field]!=null)need(brief[field]===row.originalRecord[field],'native board/feed employment/workplace kind differs');extraFacts(brief,at,row.workplaces,[row.url,row.application])}
 return{model,rows}
}
