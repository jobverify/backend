import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
export const literalApiText=value=>typeof value==='string'&&!/[<>]/.test(decodeNativeEntities(value))?clean(value)||null:null
export const literalApiRecordID=value=>typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):literalApiText(value)
const display=new Intl.DisplayNames(['en'],{type:'region'}),written=[]
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(name!==code&&!['ZZ','EU','EZ','UN','QO','XA','XB'].includes(code))written.push(name)}
const writtenNames=new Set(written.map(name=>name.toLowerCase())),escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
const countryNames=new RegExp('(?:^|[^\\p{L}])('+written.sort((a,b)=>b.length-a.length).map(escape).join('|')+')(?=$|[^\\p{L}])','giu')
function ownLocationCountry(raw,record){
 if(!raw||/[<>]/.test(raw)||/\b(?:not|outside|excluding|except)\s+India\b/i.test(raw))return null
 const countries=new Set()
 for(const m of raw.matchAll(/\bcountry(?:\s+code)?\s*:\s*([^,()/;|]*)/gi)){
  const country=nativeCountryName(clean(m[1].split(/\s+[-–—]\s+/)[0]));if(!country)return null;countries.add(country)
 }
 for(const group of raw.split(/[/;|]/)){
  const parts=group.split(/[(),]|\s+[-–—]\s+/).map(clean).filter(Boolean),last=parts.at(-1)||'',typed=last.match(/^country(?:\s+code)?\s*:\s*(.+)$/i)
  const country=typed?nativeCountryName(typed[1]):writtenNames.has(last.toLowerCase())?nativeCountryName(last):null
  if(!country)return null
  countries.add(country)
 }
 for(const m of raw.matchAll(countryNames))countries.add(nativeCountryName(m[1]))
 // Unreviewed separate typed fields are contradiction checks only; they
 // cannot turn a countryless city/remote label into a qualified worksite.
 for(const field of ['country','country_code'])if(Object.hasOwn(record,field)){
  const country=nativeCountryName(record[field]);if(!country)return null;countries.add(country)
 }
 return countries.size===1?[...countries][0]:null
}
export function normalizeNativeLocation(value,record={}){
 const location=clean(value)||null,country=ownLocationCountry(location,record)
 return {location,city:null,state:null,country,sourceCountryScopeUnresolved:country===null}
}
const months=['january','february','march','april','may','june','july','august','september','october','november','december']
export function strictCreatedCalendarDate(value){
 const match=clean(value).match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);if(!match)return null
 const day=+match[1],month=months.indexOf(match[2].toLowerCase()),year=+match[3]
 if(month<0||year<1000||year>9999)return null
 const date=new Date(Date.UTC(year,month,day))
 return date.getUTCFullYear()===year&&date.getUTCMonth()===month&&date.getUTCDate()===day?date.toISOString().slice(0,10):null
}
export function attachUnqualifiedApiObservations(jobs,records,{source,surface,scrapedAt}){
 attachInventoryEvidence(jobs,{status:'coverage-gap',surface,firstParty:false,listingComplete:false,lifecycleCleanupAllowed:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:scrapedAt,reason:'Current native API/program/employer/individual full-criteria contract unqualified. Parsed fields are scoped observations, not complete inventory or verified zero.'})
 attachSourceObservationEvidence(jobs,{source,recordKind:'mixed',observedRecordCount:records.length,observedVacancyCount:jobs.length,sourceScopeComplete:false,companyIndiaTotal:null,companyGlobalTotal:null})
 const collection={source,observedListingCount:records.length,observedRecordType:'api-role-observations-current-native-contract-unqualified',candidateListingRecords:structuredClone(records),returnedCandidateCount:jobs.length,extractedDetailJobs:0,jobs:[],failures:records.filter(record=>record.job_status).map(record=>({stage:'native-api-contract',nativeAPIRecordID:literalApiRecordID(record.id),name:'UnqualifiedNativeApiContract',message:'Current API program/employer/individual full criteria remain unqualified; malformed identity facts remain raw observations.'})),listingPaginationComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyIndiaTotal:null,companyGlobalTotal:null}
 Object.defineProperty(jobs,'nativeCollectionEvidence',{value:collection,configurable:true})
 if(jobs[0])jobs[0].nativeCollectionEvidence=collection
 return jobs
}
