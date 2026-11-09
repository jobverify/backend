import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
export const EMPLOYER_URL='https://www.linkedin.com/company/www-holidayiq-com'
export const SEARCH_URLS=['India','Worldwide'].map(location=>'https://www.linkedin.com/jobs/search/?f_C=404342&location='+location)
const check=(ok,message)=>{if(!ok)throw Error(message)}
const hasPosting=value=>Array.isArray(value)?value.some(hasPosting):value&&typeof value==='object'&&([value['@type']].flat().some(type=>/^(?:https?:\/\/schema.org\/)?JobPosting$/i.test(type||''))||Object.values(value).some(hasPosting))
const review=doc=>{
 check(!doc.nodes(n=>n.tag==='time'||/JobPosting/i.test(n.attrs.itemtype||'')||Object.hasOwn(n.attrs,'itemprop')&&!(n.tag==='meta'&&['name','description','image'].includes(n.attrs.itemprop))||n.tag==='meta'&&/^(?:datePublished|datePosted|dateModified|validThrough|closingDate|expiryDate|expirationDate|expiresAt|addressCountry|country|jobLocation)$/i.test(n.attrs.name||n.attrs.property||'')).length,'Native role/date/country/expiry metadata requires review')
 for(const node of doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'))check(!hasPosting(JSON.parse(node.raw)),'New JobPosting requires country, earliest public date, expiry and active application review')
 check(!doc.nodes(n=>doc.hasClass(n,'job-search-card')||doc.hasClass(n,'base-search-card')||n.tag==='a'&&/\/jobs\/view\//i.test(n.attrs.href||'')).length,'New native employer vacancy requires eligibility review')
}
export async function inspectHolidayIQNative({read}){
 const employer=document(await read(EMPLOYER_URL));review(employer)
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='HolidayIQ').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:404342').length===1,'Exact HolidayIQ employer identity changed')
 const graphs=employer.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{const s=JSON.parse(n.raw);return s['@graph']||[s]})
 check(graphs.some(s=>s['@type']==='Organization'&&s.name==='HolidayIQ'&&s.url==='https://in.linkedin.com/company/www-holidayiq-com'&&s.description==='(Note: HolidayIQ acquired by Lastminute.com)'),'Native employer schema identity changed')
 const scopes=[]
 for(const [index,url] of SEARCH_URLS.entries()){
  const doc=document(await read(url));review(doc)
  check(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='f_C'&&n.attrs.value==='404342'&&Object.hasOwn(n.attrs,'checked')).length===1,'Exact native employer search scope changed')
  const location=['India','Worldwide'][index]
  check(doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='We couldn\u2019t find a match for Jobs jobs in '+location).length===1,'Native scoped search changed or blocked')
  scopes.push({location,employerId:'404342',observedRoleCards:0,noMatch:true})
 }
 return {nativeEmployerId:'404342',nativeEmployerName:'HolidayIQ',scopedSearches:scopes,sourceAssociationVerified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,reason:'Native exact HolidayIQ employer 404342 and checked India/Worldwide searches have no-match states; generic Browse Jobs are excluded. Homepage HTTP 403 blocks first-party recruiting handoff validation. These observations do not establish whole-company emptiness; all inventory counts remain unknown.'}
}

export function inspectHolidayIQHome(body){
 const doc=document(body);review(doc)
 check(!doc.nodes(n=>n.tag==='a'&&/career|vacanc|opening|join.?us|recruit|\/jobs\b/i.test((n.attrs.href||'')+' '+doc.text(n))).length,'New first-party recruiting handoff requires exact employer eligibility review')
}
