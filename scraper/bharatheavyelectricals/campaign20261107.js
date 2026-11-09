import {createHash} from 'node:crypto'
import {failure} from './runtime20261107.js'
import {CAREERS_URL} from './native20261107.js'
const sha=v=>createHash('sha256').update(v).digest('hex'),need=(ok,message)=>{if(!ok)throw failure('BHEL native campaign '+message,'BHEL_NATIVE_PROOF')}
const months=['January','February','March','April','May','June','July','August','September','October','November','December']
function dateOf(day,month,year){const m=months.findIndex(v=>v.toLowerCase()===month.toLowerCase()),n=new Date(Date.UTC(Number(year),m,Number(day)));need(m>=0&&n.getUTCFullYear()===Number(year)&&n.getUTCMonth()===m&&n.getUTCDate()===Number(day),'calendar date unverified');return n.toISOString().slice(0,10)}
export function readNativeMatrix(text,advertisementNumber){
 const at=text.indexOf('Requirement of Artisans Grade IV');need(at>=0,'native requirement table scope unavailable')
 const definitions=[...text.slice(0,at).matchAll(/^\(([A-I])\)\s+([^\n]+)$/gm)].map(m=>({nativeLetter:m[1],nativeDefinition:m[2],unitCode:m[2].match(/\(([A-Z]{2,5})\)/)?.[1]??null}))
 need(definitions.length===9&&definitions.every((u,i)=>u.nativeLetter==='ABCDEFGHI'[i]&&u.unitCode)&&new Set(definitions.map(u=>u.unitCode)).size===9,'unit-definition coordinates changed')
 const table=text.slice(at)
 need(new RegExp(definitions.map(u=>u.unitCode).join('\\s+')).test(table)&&new RegExp(definitions.map(u=>'\\('+u.nativeLetter+'\\)').join('\\s+')).test(table),'unit table columns unavailable or changed')
 const expected=['Fitter','Welder','Turner','Machinist','Electrician','Electronics Mechanic','Foundryman'],matches=[...table.matchAll(/^(\d+)\s+(Fitter|Welder|Turner|Machinist|Electrician|Electronics\s+Mechanic|Foundryman)\s+((?:\d+\s+){9}\d+)\s*$/gm)],rows=[],cells=[]
 need(matches.length===7,'native trade rows changed')
 for(let i=0;i<matches.length;i++){
  const m=matches[i],trade=m[2].replace(/\s+/g,' '),values=m[3].trim().split(/\s+/).map(Number)
  need(Number(m[1])===i+1&&trade===expected[i]&&values.length===10&&values.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)&&values.slice(0,9).reduce((a,b)=>a+b,0)===values[9],'trade row coordinates or totals contradictory')
  rows.push({nativeRowNumber:Number(m[1]),trade,nativeCounts:values.slice(0,9),nativeTotal:values[9],nativeText:m[0].trim()})
  for(let column=0;column<9;column++)cells.push({advertisementNumber,nativeRowNumber:Number(m[1]),nativeColumnNumber:column+1,trade,unitCode:definitions[column].unitCode,nativeUnitLetter:definitions[column].nativeLetter,nativeUnitDefinition:definitions[column].nativeDefinition,nativeCount:values[column]})
 }
 const totalMatches=[...table.matchAll(/^Total\s+((?:\d+\s+){9}\d+)\s*$/gm)]
 need(totalMatches.length===1,'total row unavailable or ambiguous duplicate')
 const totalMatch=totalMatches[0],totals=totalMatch[1].trim().split(/\s+/).map(Number)
 need(totals?.length===10&&totals.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000)&&definitions.every((_,column)=>rows.reduce((n,r)=>n+r.nativeCounts[column],0)===totals[column])&&totals.slice(0,9).reduce((a,b)=>a+b,0)===totals[9],'campaign totals contradictory')
 need(/manpower requirement indicated above is tentative/.test(table),'native headcount tentative qualification changed')
 return{definitions,rows,cells,nativeColumnTotals:totals.slice(0,9),tentativeTotal:totals[9],tentative:true,isCompanyOrCountryTotal:false,nativeTotalText:totalMatch[0].trim()}
}
function scheduleOf(text){
 const opening=text.match(/Opening of On-line submission of application\s+(\d{1,2})\s*(?:st|nd|rd|th)\s+([A-Za-z]+),\s*(\d{4})\s+(?:at\s+)?(\d{1,2}:\d{2}\s*[AP]M)/),closing=text.match(/Closing of On-line submission of application\s+(\d{1,2})\s*(?:st|nd|rd|th)\s+([A-Za-z]+),\s*(\d{4})\s+(\d{1,2}:\d{2}\s*[AP]M)/)
 need(opening&&closing&&/dates are tentative and may undergo change/i.test(text),'application diary dates or tentative qualifier unavailable')
 return{openingDate:dateOf(opening[1],opening[2],opening[3]),closingDate:dateOf(closing[1],closing[2],closing[3]),openingNativeTime:opening[4],closingNativeTime:closing[4],openingNativeText:opening[0],closingNativeText:closing[0],tentative:true,timezone:null,isPostingDate:false}
}
function publicationDate(text){const m=text.match(/Dated:\s*(\d{1,2})\s*(?:st|nd|rd|th)\s+([A-Za-z]+),\s*(\d{4})/);return m?dateOf(m[1],m[2],m[3]):null}
function declaredPDF(link,year){
 need(link&&typeof link.url==='string'&&!link.requiresAccount,'document declaration unavailable or account-bound')
 const u=new URL(link.url);need(u.origin==='https://careers.bhel.in'&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&new RegExp('^/ar_'+year+'/[^/]+\\.pdf$','i').test(u.pathname)&&!/%(?:2f|5c)/i.test(u.pathname),'coupled document publisher or campaign path changed');return u.href
}
const reference=doc=>({kind:doc.kind,url:doc.url,bodySHA256:doc.bodySHA256,bodyBytes:doc.bodyBytes})
function refresh(state){
 const docs=state.nativeDocuments.filter(d=>d.qualifiedForCampaign),text=docs.map(d=>d.pdf.text).join('\n\n'),refs=docs.map(reference)
 state.nativeCampaign.fullAvailableNativeText=text
 state.nativeCampaign.nativeDocumentReferences=refs
 for(const role of state.nativeRoleCandidates){role.fullAvailableNativeText=text;role.nativeDocumentReferences=refs}
}
export async function readPublishedCampaign(io,analysis,state){
 const first=analysis.observedAnnouncements[0],year=first?.title?.match(/^Artisan Recruitment\s*[-\u2013]\s*(\d{4})$/)?.[1]
 const declaration=(phase,link,kind)=>io.declare({phase,requestUrl:link?.url??null,nativeDeclaration:{sourceUrl:CAREERS_URL,nativeHref:link?.nativeHref??null,kind,observationOrdinal:first?.observationOrdinal??null}})
 declaration('native-advertisement-declaration',first?.nativeDetailCandidates?.find(l=>l.url===first.nativeDetailURL),'primary-advertisement')
 need(year&&first.nativeDetailURL,'first original campaign advertisement identity unavailable')
 state.nativeCampaignComplete=false
 async function document(link,kind,phase){
  declaration(phase+'-declaration',link,kind)
  const url=declaredPDF(link,year);state.handoffs.push({kind,from:CAREERS_URL,to:url,observationOrdinal:first.observationOrdinal,applicationLoginFollowed:false})
  const packet=await io.read(url,'pdf',phase),bytes=Buffer.from(packet.rawBodyBase64,'base64')
  need(bytes.subarray(0,5).toString()==='%PDF-','declared campaign document is not PDF')
  const pdf=await io.decode(bytes,url,phase+'-decode'),model={kind,url,nativeHref:link.nativeHref,bodySHA256:sha(bytes),bodyBytes:bytes.length,pdf,qualifiedForCampaign:false,publisherProgramsExecuted:false};state.nativeDocuments.push(model)
  need(pdf.visibilityQualified===true&&pdf.pageModels.every(p=>p.isPureXfa!==true),'PDF content visibility unqualified')
  need(pdf.text.includes('BHARAT HEAVY ELECTRICALS LIMITED')&&pdf.text.includes('ARTISAN RECRUITMENT - '+year),'PDF publisher or campaign title mismatch')
  return model
 }
 const primary=first.nativeDetailCandidates.find(l=>l.url===first.nativeDetailURL),ad=await document(primary,'primary-advertisement','native-advertisement'),ids=[...ad.pdf.text.matchAll(/^Advt\.\s+(\d{2}\/\d{4})\s*$/gm)]
 need(ids.length===1,'original advertisement identifier unavailable or ambiguous')
 const advertisementNumber=ids[0][1],matrix=readNativeMatrix(ad.pdf.pageModels[0].text,advertisementNumber),nativeApplicationSchedule=scheduleOf(ad.pdf.text)
 ad.qualifiedForCampaign=true
 state.nativeCampaign={nativeRecordKind:'recruitment-campaign',nativeAdvertisementNumber:advertisementNumber,nativeCampaignTitle:'ARTISAN RECRUITMENT - '+year,nativePublisher:'BHARAT HEAVY ELECTRICALS LIMITED',nativeVacancyMatrix:matrix,nativeApplicationSchedule,postingDate:null,corrections:[],fullAvailableNativeText:ad.pdf.text,sourceScopeComplete:false,wholeCompanyScope:false,country:null,nativeCountryProofAvailable:false,activePublicationQualified:false,nativeScopeComplete:false}
 state.nativeRoleCandidates=matrix.cells.filter(c=>c.nativeCount>0).map(c=>({nativeRecordKind:'vacancy-candidate',nativeVacancyCandidate:true,nativeRoleIdentity:{advertisementNumber,unitCode:c.unitCode,trade:c.trade,nativeRowNumber:c.nativeRowNumber,nativeColumnNumber:c.nativeColumnNumber},nativePositionCount:c.nativeCount,nativeUnitDefinition:c.nativeUnitDefinition,nativeVacancyId:null,requisitionId:null,country:null,city:null,postingDate:null,closingDate:null,sourceUrl:ad.url,sourceDetailComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,nativeCountryProofAvailable:false,activePublicationQualified:false,fullAvailableNativeText:ad.pdf.text,nativeDocumentReferences:[]}))
 refresh(state)
 const corrections=first.links.filter(l=>l.purpose==='correction')
 declaration('native-corrections-declaration',null,'coupled-corrections')
 need(corrections.length===2&&new Set(corrections.map(l=>l.url)).size===2,'coupled correction declaration scope changed')
 for(let index=0;index<corrections.length;index++){
  const correction=await document(corrections[index],'corrigendum-'+(index+1),'native-corrigendum-'+(index+1)),refs=[...correction.pdf.text.matchAll(/(?:Advt\.?|Advertisement\s+No\.?)\s+(\d+\/\d{4})/g)].map(m=>m[1]),number=correction.pdf.text.match(/^CORRIGENDUM\s+(\d+)\s*\/\s*(\d{4})/m),date=publicationDate(correction.pdf.text)
  need(refs.length>0&&refs.every(v=>v===advertisementNumber)&&number&&Number(number[1])===index+1&&date,'correction reference, sequence or issue date changed')
  correction.qualifiedForCampaign=true
  state.nativeCampaign.corrections.push({nativeCorrectionNumber:number[1]+'/'+number[2],nativeAdvertisementNumber:advertisementNumber,nativePublicationDate:date,fullNativeText:correction.pdf.text,sourceUrl:correction.url,bodySHA256:correction.bodySHA256})
  refresh(state)
 }
 const tables=first.links.filter(l=>l.purpose==='vacancy-table')
 declaration('native-vacancy-table-declaration',null,'coupled-vacancy-table')
 need(tables.length===1,'coupled unit vacancy table scope changed')
 const table=await document(tables[0],'native-vacancy-table','native-vacancy-table')
 // A future successful table response requires its own semantic reconciliation.
 // Current originals stop on the HTML challenge before this unimplemented gate.
 state.nativeUnreconciledVacancyTable=reference(table)
 throw failure('BHEL native unit vacancy table reconciliation and own-country proof remain unverified','BHEL_NATIVE_PROOF')
}
