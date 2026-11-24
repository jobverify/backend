import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readLiteralModel} from '../../scraper-support/native-sources/literalModel.js'
import {all,one,need,norm,same,nativeCountryName,writtenPlaceCountries,authoredLines,projection,retainDateModels,schemaIdentity,schemaPlaces} from './currentFacts20261120.js'
import {constraints} from './currentDates20261121.js'
import {C,UUID,NATIVE,key,properties,scope,carrier,issuerURL,applicationProperties,qualifyNamedIssuer,digest} from './currentAuthority20261121.js'

const emptyDates=()=>({posted:[],expiry:[]}),mergeDates=(...dates)=>({posted:dates.flatMap(d=>d?.posted??[]),expiry:dates.flatMap(d=>d?.expiry??[])})
function countryAddress(address,location){
 const postal=address?.postalAddress??address?.address??address,country=nativeCountryName(postal?.addressCountry)
 need(postal&&typeof postal==='object'&&country,'explicit native postal country missing')
 need([location,postal.addressLocality,postal.addressRegion,postal.streetAddress].flatMap(writtenPlaceCountries).every(c=>c===country),'same-place authored country contradicts typed postal country')
 return{country,location,originalAddress:structuredClone(address)}
}
function extraLocations(value,countries,depth=0){
 need(depth<24,'finite same-role location aliases')
 if(value==null)return
 if(Array.isArray(value)){value.forEach(v=>extraLocations(v,countries,depth+1));return}
 if(typeof value==='string'){const names=[nativeCountryName(value),...writtenPlaceCountries(value)].filter(Boolean);need(names.every(c=>countries.includes(c)),'same-role alternate work country differs');return}
 need(typeof value==='object','same-role location malformed')
 if(value.addressCountry!=null)need(countries.includes(nativeCountryName(value.addressCountry)),'same-role typed alternate country differs')
 if(value['@type']&&String(value['@type']).endsWith('Country'))need(countries.includes(nativeCountryName(value.name)),'same-role typed Country differs')
 for(const field of['name','address','postalAddress','location','country','addressCountry','workLocation','jobLocation','workLocations','jobLocations'])if(value[field]!=null)extraLocations(value[field],countries,depth+1)
}
function aliases(value,at,urls,countries,depth=0){
 need(depth<32,'finite same-role authored scope')
 if(Array.isArray(value))return mergeDates(...value.map(v=>aliases(v,at,urls,countries,depth+1)));if(!value||typeof value!=='object')return emptyDates()
 applicationProperties(value,urls)
 const dates=constraints(properties(value),[],{employer:'Verint',observedAt:at,countryAlternatives:countries})
 for(const[name,child]of Object.entries(value)){
  const k=key(name)
  if(['worklocation','joblocation','worklocations','joblocations','locationaddress','workplacecountry','worklocationcountry','joblocationcountry','addresscountry'].includes(k))extraLocations(child,countries)
  if(['employer','hiringOrganization','publisher','company'].includes(name)&&child!=null){qualifyNamedIssuer({[name]:child},at,urls);continue}
  if(['hiringOrganization','publisher','logo','identifier'].includes(name))continue
  if(child&&typeof child==='object'){const nested=aliases(child,at,urls,countries,depth+1);dates.posted.push(...nested.posted);dates.expiry.push(...nested.expiry)}
 }
 return dates
}
export function readFeed(text){const f=JSON.parse(text);need(f&&f.apiVersion==='1'&&Array.isArray(f.jobs)&&f.jobs.length<=10000,'documented native public feed contract differs');return f}
export function ambiguousRows(feed){const duplicates=new Set();for(const field of['id','jobUrl','applyUrl']){const seen=new Map();for(const row of feed.jobs){if(!row||typeof row!=='object')continue;const value=row[field];if(value!=null){if(seen.has(value)){duplicates.add(row.id);duplicates.add(seen.get(value))}else seen.set(value,row.id)}}}return duplicates}
export function maybeIndia(record){return[record?.address,...(Array.isArray(record?.secondaryLocations)?record.secondaryLocations.map(x=>x.address):[])].some(a=>nativeCountryName((a?.postalAddress??a)?.addressCountry)==='India')||[record?.location,...(Array.isArray(record?.secondaryLocations)?record.secondaryLocations.map(x=>x.location):[])].flatMap(writtenPlaceCountries).includes('India')}
export function rowFrom(record,board,at,ambiguous){
 need(record&&UUID.test(record.id)&&typeof record.title==='string'&&norm(record.title)&&typeof record.location==='string'&&Array.isArray(record.secondaryLocations),'finite native same-role row malformed')
 need(!ambiguous.has(record.id),'duplicate native public identity/application handoff')
 const url=NATIVE+'/verint/'+record.id,apply=url+'/application'
 need(record.jobUrl===url&&record.applyUrl===apply&&record.isListed===true,'native current listing/application publication differs')
 need(typeof record.publishedAt==='string'&&record.publishedAt.trim(),'original native public publication timestamp missing')
 const places=[countryAddress(record.address,record.location),...record.secondaryLocations.map(s=>countryAddress(s.address,s.location))],countries=[...new Set(places.map(p=>p.country))]
 need(countries.includes('India'),'native role does not independently qualify India')
 const briefs=board.model.jobBoard.jobPostings.filter(r=>r?.id===record.id),brief=one(briefs,'current selected native role brief')
 need(norm(brief.title)===norm(record.title)&&brief.locationName===record.location&&brief.workplaceType===record.workplaceType&&brief.employmentType===record.employmentType,'same-role native board/feed title/location/workplace differs')
 need(Array.isArray(brief.secondaryLocations)&&same(brief.secondaryLocations.map(s=>s.locationName),record.secondaryLocations.map(s=>s.location)),'same-role native secondary workplace differs')
 const briefDates=aliases(brief,at,[url,apply],countries)
 const dates=constraints([{key:'datePosted',value:record.publishedAt},...properties(record)],[],{employer:'Verint',observedAt:at,countryAlternatives:countries})
 const recordDates=aliases(record,at,[url,apply],countries)
 need(typeof record.descriptionHtml==='string'&&typeof record.descriptionPlain==='string','original published feed criteria missing')
 const criteria=scope(document(record.descriptionHtml).root,at,[url,apply],countries),plain=scope(document('<pre>'+record.descriptionPlain.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')+'</pre>').root,at,[url,apply],countries)
 return{id:record.id,title:norm(record.title),url,applyUrl:apply,locations:places.map(p=>p.location),places,countries,record:structuredClone(record),brief:structuredClone(brief),dates:mergeDates(dates,briefDates,recordDates,criteria,plain),boardOrganization:board.organizationBinding}
}
function observed(row,packet,schema){return{binding:{id:row.id,title:row.title,url:row.url,application:row.applyUrl,employer:row.boardOrganization,workplaces:row.places},originalNativePosting:packet?structuredClone(packet.model.posting):null,originalNativeModel:packet?structuredClone(packet.model):null,originalPublicRecord:structuredClone(row.record),originalBoardBrief:structuredClone(row.brief),originalSchema:schema?structuredClone(schema):null,originalCommonProse:packet?structuredClone(packet.commonProse):null}}
export function listingPartial(row,{unavailable=null}={}){
 const model=observed(row,null,null),job=projection(C,row,model,{description:norm(row.record.descriptionPlain),rawDescription:row.record.descriptionHtml,application:{url:row.applyUrl,kind:'same-role-public-unvisited-application'},countryEvidence:{basis:'typed original public feed postal countries and same-role native board identity',places:structuredClone(row.places),nativePostingAddressAcquired:false},dates:row.dates,city:row.record.address.postalAddress.addressLocality??null})
 job.sourceDetailUnavailable=unavailable!=null;job.sourceDetailUnavailableReason=unavailable?.message??null;job.sourceDetailClosingQualified=false;job.sourceOriginalFeedDescriptionHtml=row.record.descriptionHtml
 return retainDateModels(job,emptyDates())
}
export function fullRole(row,packet,at){
 const posting=packet.model.posting,urls=[row.url,row.applyUrl],countries=row.countries
 need(posting.id===row.id&&norm(posting.title)===row.title&&posting.isListed===true&&posting.isConfidential===false,'current public full native identity/status differs')
 need(posting.locationName===row.record.location&&posting.workplaceType===row.record.workplaceType&&posting.employmentType===row.record.employmentType,'full native role workplace/employment differs')
 need(Array.isArray(posting.secondaryLocationNames)&&same(posting.secondaryLocationNames,row.record.secondaryLocations.map(s=>s.location)),'full native secondary workplaces differ')
 if(posting.locationAddress!=null)extraLocations(posting.locationAddress,countries)
 const nativeAliasDates=aliases(posting,at,urls,countries)
 const scripts=all(packet.d.root,n=>n.tag==='script'&&(n.attrs.type??'').toLowerCase()==='application/ld+json'),schemas=scripts.map(n=>{carrier(packet.d,n,at,urls,countries);return readLiteralModel(n.raw??'').value}),schema=one(schemas,'original public same-role structured job')
 schemaIdentity(schema,row,'Verint');need(schema['@type']==='JobPosting'&&schema.identifier?.value===row.id&&schema.identifier?.name==='Verint','native structured public role identifier differs')
 for(const field of['url','sameAs','@id'])if(schema.hiringOrganization[field]!=null)for(const uri of Array.isArray(schema.hiringOrganization[field])?schema.hiringOrganization[field]:[schema.hiringOrganization[field]])issuerURL(uri,{social:field==='sameAs'})
 const places=schemaPlaces(schema);need(places.some(p=>p.country==='India')&&places.every(p=>countries.includes(p.country))&&places[0].country===row.places[0].country,'same-role native schema/feed work country differs')
 const schemaAliasDates=aliases(schema,at,urls,countries)
 need(typeof posting.descriptionHtml==='string'&&posting.descriptionHtml.trim()&&typeof schema.description==='string'&&schema.description.trim(),'original full role criteria missing')
 const nativeCriteria=scope(document(posting.descriptionHtml).root,at,urls,countries),schemaCriteria=scope(document(schema.description).root,at,urls,countries)
 const extra=[]
 for(const field of['compensationPhilosophyHtml','applicationLimitCalloutHtml'])if(posting[field]!=null){need(typeof posting[field]==='string','published native role additional criteria malformed');extra.push(scope(document(posting[field]).root,at,urls,countries))}
 if(posting.automatedProcessingLegalNotice?.automatedProcessingLegalNoticeHtml!=null)extra.push(scope(document(posting.automatedProcessingLegalNotice.automatedProcessingLegalNoticeHtml).root,at,urls,countries))
 const dates=mergeDates(row.dates,packet.dates,nativeAliasDates,schemaAliasDates,nativeCriteria,schemaCriteria,...extra,constraints([...properties(posting),...properties(schema)],[],{employer:'Verint',observedAt:at,countryAlternatives:countries})),model=observed(row,packet,schema)
 const job=projection(C,row,model,{description:norm(authoredLines(document(posting.descriptionHtml).root).join('\n')),rawDescription:posting.descriptionHtml,application:{url:row.applyUrl,kind:'same-role-public-unvisited-application'},countryEvidence:{basis:'original typed feed postal country plus exact same-role structured Place/PostalAddress and applicant country',places:structuredClone(row.places),schemaPlaces:places,nativePostingLocationAddress:structuredClone(posting.locationAddress),nativePostingAddressAcquired:true},dates,city:row.record.address.postalAddress.addressLocality??null})
 job.sourceOriginalFeedDescriptionHtml=row.record.descriptionHtml;job.sourceOriginalNativeDescriptionHtml=posting.descriptionHtml;job.sourceOriginalSchemaDescriptionHtml=schema.description;job.sourceNativeHTMLSHA256=digest(packet.originalHTML)
 job.sourceNativeWorkplaceType=posting.workplaceType;job.sourceNativeSchemaJobLocationType=schema.jobLocationType??null;job.sourceNativeFeedIsRemote=row.record.isRemote;job.sourceDetailUnavailable=false
 return retainDateModels(job,emptyDates())
}
