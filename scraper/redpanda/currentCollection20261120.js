import {isDeepStrictEqual as same} from 'node:util'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {need,one,all,norm,props,scalarFields,constraints,authoredLines,writtenPlaceCountries,nativeCountryName,schemas,semanticCriteria,schemaCarrier,schemaContext} from './currentFacts20261120.js'
import {HOME,BOARD,FEED} from './currentPublisher20261120.js'
const COMPANY='Redpanda',UUID=/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i
const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const applicationKeys=new Set(['applyurl','applicationurl','jobapplicationurl','applyuri','applicationuri','applylink','applicationlink','joburl','detailurl'])
const employerKeys=new Set(['employer','employername','company','companyname','hiringorganization','legalemployer'])
const countryKeys=new Set(['country','countrycode','jobcountry','workcountry','workplacecountry','worklocationcountry','addresscountry'])
const context=(at,countries)=>({employer:COMPANY,observedAt:at,countryAlternatives:countries})
function safeURL(value,base){need(typeof value==='string'&&value.trim()===value&&value.length>0,'native URL malformed');const url=new URL(value,base);need(url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&!url.hash,'native exact HTTPS URL differs');return url}
function applications(properties,allowed){for(const property of properties)if(applicationKeys.has(key(property.key))&&property.value!=null)need(allowed.includes(safeURL(property.value,BOARD).href),'native same-role application alias conflicts')}
function ancestors(root,target,path=[]){if(root===target)return[...path,root];for(const child of root.children.filter(n=>typeof n!=='string')){const found=ancestors(child,target,[...path,root]);if(found)return found}return null}
function carrier(p,node,at,{countries=[],allowed=[BOARD]}={}){
 const nodes=ancestors(p.d.root,node);need(nodes,'actual native carrier ancestry missing')
 need(nodes.every(n=>!Object.hasOwn(n.attrs,'disabled')&&!Object.hasOwn(n.attrs,'hidden')&&!Object.hasOwn(n.attrs,'inert')&&n.attrs['aria-disabled']!=='true'&&n.attrs['aria-hidden']!=='true'&&!/(?:^|\s)(?:disabled|hidden|d-none)(?:\s|$)/.test(n.attrs.class??'')&&!/(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(n.attrs.style??'')),'actual publisher/control carrier withdrawn')
 const properties=props(nodes.map(n=>({...n,inactive:false,inert:false})));applications(properties,allowed);constraints(properties,[],context(at,countries))
}
function publication(model,at,countries,allowed){
 constraints(scalarFields(model),[],context(at,countries));applications(Object.entries(model).map(([key,value])=>({key,value})),allowed)
 for(const[field,value]of Object.entries(model)){const name=key(field);if(['listed','islisted'].includes(name))need(value===true,'native role not listed');if(name==='isconfidential')need(value===false,'native employer/publication confidentiality differs')}
 if(model.publishedAt!=null){const value=model.publishedAt;need(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value),'native published date malformed');nativeDate(value.slice(0,10),{required:true});need(Number.isFinite(Date.parse(value))&&Date.parse(value)<=Date.parse(at),'native published date invalid/future')}
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
  const address=place.address?.postalAddress??place.address;let country
  typed(place,'Place')
  if(place.address===null){
   // The native optional address is null for the current Spain remote role.
   // Its whole authored label supplies the country directly; city labels and
   // present but incomplete typed addresses cannot establish that evidence.
   const label=/^(.+) - Remote$/.exec(place.location)
   need(label&&record.isRemote===true&&record.workplaceType==='Remote','native typed workplace address absent and explicit remote country unavailable')
   country=foreignCountry(label[1]);workplaceFacts(place,country,at,allowed)
  }else{
   need(address&&typeof address==='object'&&!Array.isArray(address),'native typed workplace address absent');typed(address,'PostalAddress');country=foreignCountry(address.addressCountry);workplaceFacts(place,country,at,allowed);workplaceFacts(address,country,at,allowed);if(place.address?.postalAddress){typed(place.address,'PostalAddress');workplaceFacts(place.address,country,at,allowed)}
  }
  const parts=place.location.split(/\s+-\s+/)[0].split(/\s*(?:\/|\bor\b)\s*/i),alternatives=parts.length>1?parts.map(nativeCountryName):[]
  if(parts.length>1)need(parts.length<=16&&alternatives.every(value=>value&&value!=='India')&&alternatives.includes(country),'native explicit workplace alternatives are unresolved or conflict with typed primary country')
  const countries=[...new Set([country,...alternatives])]
  need(writtenPlaceCountries(place.location).every(value=>countries.includes(value)),'native authored workplace country contradicts typed or explicit alternatives')
  for(const value of[address?.name,address?.addressLocality,address?.addressRegion,address?.streetAddress].filter(v=>v!=null)){need(typeof value==='string','native workplace text malformed');need(writtenPlaceCountries(value).every(c=>c===country||country==='United States'&&c==='Georgia'&&value===address.addressRegion&&value==='Georgia'),'native same-address authored country contradicts typed address')}
  for(const[field,value]of Object.entries(place))if(countryKeys.has(key(field))&&value!=null)need(foreignCountry(value)===country,'native same-workplace explicit countries conflict')
  return{country,countries,authoredCountryAlternatives:parts.length>1?parts:[],location:place.location,originalAddress:structuredClone(place.address),address:structuredClone(address),...(address===null?{countrySource:'native-explicit-country-label'}:{})}
 })
}
function extraFacts(model,at,workplaces,allowed){
 const countries=[...new Set(workplaces.flatMap(p=>p.countries))]
 for(const[field,value]of Object.entries(model)){
  if(value==null)continue;const name=key(field)
  if(employerKeys.has(name)){if(value&&typeof value==='object'&&!Array.isArray(value))typed(value,'Organization');const employer=typeof value==='string'?value:value&&typeof value==='object'&&!Array.isArray(value)?value.name:null;need(employer===COMPANY,'native nested employer differs')}
  if(countryKeys.has(name))need(countries.includes(foreignCountry(value)),'native explicit primary country differs')
  if(['applicantlocationrequirements','eligibleregion'].includes(name)){const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native applicant countries malformed');entries.forEach(foreignCountry)}
  if(['joblocation','joblocations','worklocation','worklocations','primarylocation','primarylocations'].includes(name)){
   const entries=Array.isArray(value)?value:[value];need(entries.length>0&&entries.length<=32,'native additional workplaces malformed')
   const written=entries.map(place=>{need(place&&typeof place==='object'&&!Array.isArray(place),'native typed additional workplace malformed');typed(place,'Place');const address=place.address?.postalAddress??place.address??place;typed(address,'PostalAddress');const country=foreignCountry(address.addressCountry??place.country??place.countryCode);workplaceFacts(place,country,at,allowed);workplaceFacts(address,country,at,allowed);for(const text of[place.name,address.name,address.addressLocality,address.addressRegion].filter(v=>v!=null))need(writtenPlaceCountries(text).every(c=>c===country),'native typed workplace country contradicts authored place');return{country,city:address.addressLocality??null}})
   need(written.some(place=>workplaces.some(known=>place.country===known.country&&(!place.city||!known.address?.addressLocality||norm(place.city).toLowerCase()===norm(known.address.addressLocality).toLowerCase()))),'native additional typed primary workplace contradicts current role')
  }
 }
 publication(model,at,countries,allowed)
}
function criteria(record,at,workplaces,allowed){
 const countries=[...new Set(workplaces.flatMap(p=>p.countries))],html=record.descriptionHtml
 need(html==null||typeof html==='string','native original criteria HTML malformed');need(record.descriptionPlain==null||typeof record.descriptionPlain==='string','native original criteria text malformed')
 const d=readNativeDocument(html??''),root=one(d.nodes(n=>n.tag==='root'),'native criteria root')
 // Hidden original role facts still constrain the scope. Strip only display
 // withdrawal flags in this separate analysis tree; retain original HTML/data.
 const visibleFacts=node=>{if(typeof node==='string')return node;const attrs={...node.attrs};for(const field of['hidden','inert','aria-hidden'])delete attrs[field];if(attrs.style)attrs.style=attrs.style.replace(/display\s*:\s*none|visibility\s*:\s*hidden/gi,'');if(attrs.class)attrs.class=attrs.class.replace(/\b(?:hidden|d-none)\b/g,'');return{...node,attrs,inert:['script','style'].includes(node.tag)?node.inert:false,inactive:['script','style'].includes(node.tag)?node.inactive:false,children:node.children.map(visibleFacts)}}
 const facts=visibleFacts(root),nodes=all(facts,()=>true),semantic=semanticCriteria(facts),properties=[...props(nodes),...semantic.properties],lines=[...authoredLines(facts),...semantic.lines,...(record.descriptionPlain??'').split(/\r?\n/).map(norm).filter(Boolean)]
 applications(properties,allowed);constraints(properties,lines,context(at,countries))
 for(const line of lines){const label=/^(?:Location|Work Location|Job Location|Workplace)\s*:\s*(.+)$/i.exec(line),scope=Boolean(label)||/^(?:Located|Based)\b/i.test(line)||/\b(?:this|the) (?:role|position) (?:is |will be )?(?:based|located|open|available|remote)\b/i.test(line)||/\b(?:applicants?|candidates?) (?:based|located|from|in|worldwide|anywhere|across)\b/i.test(line)||/\byou (?:can|may) work (?:from )?(?:anywhere|worldwide|globally)\b/i.test(line);if(scope){need(!/\b(?:worldwide|anywhere|global|globally|APAC|EMEA|Asia-Pacific)\b/i.test(label?.[1]??line),'authored native workplace is unresolved');need(writtenPlaceCountries(label?.[1]??line).every(country=>countries.includes(country)),'authored native applicant/workplace countries contradict current advertised scope')}}
 for(const schema of schemas({d},{types:['JobPosting','WebPage']})){need(typeof schemaContext(schema)==='string'&&/^https?:\/\/schema\.org\/?$/.test(schemaContext(schema)),'native criteria structured context differs');carrier({d:{...d,root}},schemaCarrier(schema),at,{countries,allowed});if(schema.title!=null)need(norm(schema.title)===norm(record.title),'native criteria structured title differs');if(schema.url!=null)need(schema.url===record.jobUrl,'native criteria structured URL differs');const types=Array.isArray(schema['@type'])?schema['@type']:[schema['@type']];if(types.some(type=>['WebPage','https://schema.org/WebPage','http://schema.org/WebPage'].includes(type)))need(schema.url===record.jobUrl||schema['@id']===record.jobUrl,'native criteria WebPage role identity missing');extraFacts(schema,at,workplaces,allowed)}
 return{originalHTML:html??null,originalPlain:record.descriptionPlain??null}
}
export function currentFeed(text,authority,at){
 need(authority?.publisher===COMPANY&&authority.home===HOME&&authority.board===BOARD&&authority.feed===FEED&&authority.consumerProof?.connected===true,'original own connected feed authority absent');
 const model=readLiteralModel(text).value;need(model&&typeof model==='object'&&!Array.isArray(model)&&same(Object.keys(model).sort(),['apiVersion','jobs'])&&model.apiVersion==='1'&&Array.isArray(model.jobs)&&model.jobs.length>0&&model.jobs.length<=2000,'native documented unfiltered public feed shape differs')
 const seen=new Set(),rows=[]
 for(const record of model.jobs){need(record&&typeof record==='object'&&!Array.isArray(record)&&UUID.test(record.id)&&!seen.has(record.id)&&typeof record.title==='string'&&norm(record.title)&&typeof record.isListed==='boolean','native identity/title/listed scope malformed');seen.add(record.id);if(!record.isListed)continue
  const url=BOARD+'/'+record.id,apply=url+'/application';need(record.jobUrl===url&&record.applyUrl===apply,'native account/publicID/application differs');const allowed=[url,apply],workplaces=places(record,at,allowed);extraFacts(record,at,workplaces,allowed);const originalCriteria=criteria(record,at,workplaces,allowed)
  rows.push({id:record.id,title:norm(record.title),url,application:apply,countries:[...new Set(workplaces.flatMap(p=>p.countries))],workplaces,originalRecord:structuredClone(record),originalCriteria})
 }
 return{model,rows}
}
