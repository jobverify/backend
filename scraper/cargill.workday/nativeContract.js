import {createHash} from 'node:crypto'
import {extractOfficialRecruitmentLinks} from '../../scripts/officialRecruitmentLinks.js'
import {parseRmkDetail} from '../../scraper-support/shared/successFactorsRmk.js'
import {readNativeDocument,extractActiveDescription} from './nativeHtml.js'
import {cargillGuardError,parseCargillJson,tagCargillError} from './nativeErrors.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
export const HOME='https://www.cargill.com/',CAREERS='https://careers.cargill.com/',SEARCH=CAREERS+'en/search-jobs',NATIVE='https://jobs.cargill.com',CLIENT='https://tbcdn.talentbrew.com/js/client/search.js',CORE='https://tbcdn.talentbrew.com/bundles/tb-corepack.js'
const prove=(ok,message)=>{if(!ok)throw cargillGuardError('CONTRACT',message)},norm=s=>typeof s==='string'?s.replace(/\s+/g,' ').trim():'',plain=s=>typeof s==='string'&&norm(s).length>2&&!/[<>]/.test(s),id=s=>typeof s==='string'&&/^[1-9]\d*$/.test(s),one=(a,label)=>{prove(a.length===1,'Expected one '+label);return a[0]},hash=s=>createHash('sha256').update(s).digest('hex')
const links=(html,base)=>{
 const d=readNativeDocument(html),active=new Set(d.nodes(n=>n.tag==='a'&&typeof n.attrs.href==='string').flatMap(n=>{try{return[new URL(n.attrs.href,base).href]}catch{return[]}}))
 return extractOfficialRecruitmentLinks(html,base).map(l=>l.href).filter(href=>active.has(href))
}
function number(s){prove(id(s)||s==='0','Invalid native integer');const n=Number(s);prove(Number.isSafeInteger(n)&&n<=10000,'Native count out of bounds');return n}
function failure(p){prove(p&&typeof p==='object'&&!Array.isArray(p),'Native envelope malformed');for(const[k,v]of Object.entries(p)){if(/^(error|errors|exception|fault)$/i.test(k)&&v!=null)prove(v===''||Array.isArray(v)&&v.length===0,'Native error envelope');if(/^(success|ok)$/i.test(k)&&v!=null)prove(v===true,'Native unsuccessful envelope');if(/^(status|statuscode)$/i.test(k)&&v!=null)prove(v===200,'Native failure status');if(/^(meta|metadata)$/i.test(k)&&v!=null)failure(v)}}
function day(value,now){prove(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value),'Native day unavailable');const d=new Date(value+'T00:00:00.000Z');prove(Number.isFinite(+d)&&d.toISOString().slice(0,10)===value&&+d<=Date.parse(now),'Invalid/future native day');return d.toISOString()}
function rmkDate(value,now,publication){prove(typeof value==='string','Native timestamp unavailable');const m=value.match(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/);prove(m,'Native timestamp format changed');const d=new Date(value);prove(Number.isFinite(+d)&&d.getUTCDate()===Number(m[3])&&d.getUTCFullYear()===Number(m[7])&&d.getUTCHours()===Number(m[4])&&d.getUTCMinutes()===Number(m[5])&&d.getUTCSeconds()===Number(m[6])&&(!publication||+d<=Date.parse(now)),'Invalid/future native timestamp');return d.toISOString()}
const cityKey=s=>norm(s).toLowerCase().replace(/^bengaluru$/,'bangalore')
const countryCodes={India:'IN',Malaysia:'MY',Singapore:'SG',China:'CN',Poland:'PL'}
const postalPatterns={India:/^\d{6}$/,Malaysia:/^\d{5}$/,Singapore:/^\d{6}$/,China:/^\d{6}$/,Poland:/^\d{2}-\d{3}$/}
const sameRegion=(country,city,left,right)=>norm(left)===norm(right)||country==='China'&&cityKey(city)==='shanghai'&&[left,right].every(value=>['Shanghai','Shanghai Municipality'].includes(norm(value)))
export class CargillSameCountryWorksiteDisagreement extends Error {
 constructor(validatedModel){
  super('Cargill native contract: Native role country/city/state mismatch')
  this.name='CargillSameCountryWorksiteDisagreement'
  tagCargillError(this,'CARGILL_SAME_COUNTRY_WORKSITE_DISAGREEMENT')
  this.validatedModel=validatedModel
 }
}
export class CargillNativeWithdrawnRole extends Error {
 constructor(withdrawalProof){
  super('Cargill native contract: Same-role native vacancy explicitly filled')
  this.name='CargillNativeWithdrawnRole'
  tagCargillError(this,'CARGILL_NATIVE_WITHDRAWN_ROLE')
  this.withdrawalProof=withdrawalProof
 }
}
export class CargillSameCountryPublicOfficeIncomplete extends Error {
 constructor(validatedModel){
  super('Cargill native contract: Same-country public office locality incomplete')
  this.name='CargillSameCountryPublicOfficeIncomplete'
  tagCargillError(this,'CARGILL_SAME_COUNTRY_PUBLIC_OFFICE_INCOMPLETE')
  this.validatedModel=validatedModel
 }
}
const withdrawnProfiles=[{requisitionId:'329403',publicJobId:'96958018784',title:'Process Specialist',
 sourceUrl:CAREERS+'en/job/bengaluru/process-specialist/23251/96958018784',
 applicationURL:'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=329403&company=cargill&locale=en_US',
 nativeURL:NATIVE+'/job/Bangalore-Process-Specialist-Karn-560087/1364932157/',nativeRmkPublicId:'1364932157'},
 {requisitionId:'335262',publicJobId:'101740330512',title:'Sales Executive',
 sourceUrl:CAREERS+'en/job/satara/sales-executive/23251/101740330512',
 applicationURL:'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=335262&company=cargill&locale=en_US',
 nativeURL:NATIVE+'/job/Satara-Sales-Executive-Maha-415001/1374457657/',nativeRmkPublicId:'1374457657'}]
const clickGuardStyle='<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
function readReviewedWithdrawal(html,finalURL,official,document){
 const withdrawnProfile=withdrawnProfiles.find(profile=>['requisitionId','publicJobId','title','sourceUrl','applicationURL'].every(key=>official[key]===profile[key])&&finalURL===profile.nativeURL)
 if(!withdrawnProfile)return null
 const publicModel=official.nativePublicJobPosting
 if(publicModel?.identifier?.value!==withdrawnProfile.requisitionId||publicModel.identifier.name!=='Job ID'||publicModel.title!==official.title
  ||publicModel.url!==official.sourceUrl||publicModel.hiringOrganization?.name!=='Cargill')return null
 const walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)],all=walk(document.nodes(n=>n.tag==='root')[0])
 const codes=all.filter(n=>Object.hasOwn(n.attrs,'data-company-job-code')),titles=all.filter(n=>n.tag==='meta'&&n.attrs.property==='og:title'),pageTitles=all.filter(n=>n.tag==='title')
 const companyJobCode=withdrawnProfile.requisitionId+'-en_US'
 if(codes.length!==1||codes[0].tag!=='script'||codes[0].attrs.type!=='IN/AwliWidget'||codes[0].attrs['data-company-job-code']!==companyJobCode
  ||codes[0].attrs['data-integration-context']!=='urn:li:organization:2678'||titles.length!==1||titles[0].attrs.content!==official.title
  ||pageTitles.length!==1||norm(pageTitles[0].raw)!==withdrawnProfile.title+' Job Details | cargill')return null
 // A filled tombstone has none of the active role metadata. Unexpected role,
 // employer, country, date or criteria assertions remain a real guard failure.
 const roleProperties=new Set(['title','description','datePosted','validThrough','hiringOrganization','addressCountry','jobLocation','identifier'])
 if(all.some(n=>(n.attrs.itemprop??'').split(/\s+/).some(value=>roleProperties.has(value))||n.attrs['data-careersite-propertyid']==='customfield1'
  ||/\/JobPosting$/.test(n.attrs.itemtype??'')||n.tag==='script'&&n.attrs.type==='application/ld+json'))return null
 // Exact native standalone frame protection removes only this style when
 // self===top. Bind its full original program; preserve every other CSS rule.
 const styles=all.filter(n=>n.tag==='style'&&n.attrs.id==='antiClickjack'),activators=all.filter(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript')
 const scriptMatches=[...html.matchAll(/<script\b[^>]*\bid="antiClickJackScript"[^>]*>[\s\S]*?<\/script>/g)]
 const styleIndex=html.indexOf(clickGuardStyle),headEnd=html.indexOf('</head>')
 if(styles.length!==1||styles[0].raw!=='body{display:none !important;}'||Object.keys(styles[0].attrs).sort().join(',')!=='id,type'||styles[0].attrs.type!=='text/css'
  ||activators.length!==1||Object.keys(activators[0].attrs).sort().join(',')!=='id,type'||activators[0].attrs.type!=='text/javascript'
  ||hash(activators[0].raw??'')!=='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433'
  ||styleIndex<0||scriptMatches.length!==1||scriptMatches[0].index<styleIndex+clickGuardStyle.length||scriptMatches[0].index+scriptMatches[0][0].length>headEnd)return null
 const visible=readVisibleNativeDocument(html.replace(clickGuardStyle,''),{strict:true}),visibleNodes=visible.nodes(()=>true)
 const shells=visibleNodes.filter(n=>visible.hasClass(n,'jobDisplayShell')),jobs=visibleNodes.filter(n=>visible.hasClass(n,'job'))
 const notice='Sorry, this position has been filled.',notices=visibleNodes.filter(n=>n.tag==='strong'&&visible.text(n)===notice)
 if(shells.length!==1||jobs.length!==1||notices.length!==1||!walk(shells[0]).includes(jobs[0])||!walk(jobs[0]).includes(notices[0])
  ||visible.text(jobs[0])!==notice)return null
 if(visibleNodes.some(n=>n.tag==='form'||['a','button','input'].includes(n.tag)&&(
  /(?:^|\/)talentcommunity\/apply\//i.test(n.attrs.href??'')||/jobreqcareer|\/apply(?:\/|\?)/i.test(n.attrs.href??n.attrs.formaction??'')
  ||/\bapply(?:\s+now)?\b/i.test(visible.text(n)||n.attrs.value||''))))return null
 return{requisitionId:official.requisitionId,nativeRmkPublicId:withdrawnProfile.nativeRmkPublicId,nativeURL:finalURL,title:official.title,
  nativeStatus:'filled',notice,companyJobCode,companyIntegrationContext:'urn:li:organization:2678',
  countryQualified:false,criteriaQualified:false,publicationDateQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
  activationProgramSha256:hash(activators[0].raw??'')}
}
export function parseCargillSearch(corporate,careers,search,client,core){
 prove(links(corporate,HOME).includes(CAREERS),'Current corporate careers handoff unavailable');prove(links(careers,CAREERS+'en').includes(SEARCH),'Current official search handoff unavailable')
 const d=readNativeDocument(search),scripts=d.nodes(n=>n.tag==='script'&&!Object.hasOwn(n.attrs,'nomodule')&&[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)&&n.attrs.src).map(n=>new URL(n.attrs.src,SEARCH).href)
 prove(scripts.includes(CLIENT)&&scripts.includes(CORE)&&hash(client)==='f58913158b9aa603a2a21969c4533ae9023d26ff6699d5ac505ef9d469bd85dd'&&hash(core)==='f1b4a0bc9413818f043290fe4b6944567a92888aa9e0a004673b1e90cd17c6a7','Current public native query client changed')
 const india=one(d.nodes(n=>n.tag==='input'&&n.attrs['data-facet-type']==='2'&&n.attrs['data-display']==='India'),'India country facet');prove(india.attrs['data-id']==='1269750','Native India country identity mismatch')
 const section=one(d.nodes(n=>n.attrs.id==='search-results'),'native search results');prove(section.attrs['data-ajax-url']==='/en/search-jobs/results'&&section.attrs['data-records-per-page']==='15','Native public pagination endpoint changed')
 const total=number(india.attrs['data-count']);prove(total>0&&total<=300,'Native India inventory unavailable or beyond bounded scope');return{total,globalDisplayedTotal:number(section.attrs['data-total-results'])}
}
export function buildCargillSearchURL(page,total){
 prove(Number.isSafeInteger(page)&&page>=1&&page<=20&&Number.isSafeInteger(total)&&total>0&&total<=300,'Invalid native page bound')
 const criteria={ActiveFacetID:1269750,CurrentPage:page,RecordsPerPage:15,Distance:50,RadiusUnitType:0,Keywords:'',Location:'',ShowRadius:'False',IsPagination:page===1?'False':'True',CustomFacetName:'',FacetTerm:'',FacetType:0,FacetFilters:[{ID:1269750,FacetType:2,Count:total,Display:'India',IsApplied:true,FieldName:''}],SearchResultsModuleName:'Search Results',SearchFiltersModuleName:'Search Filters',SortCriteria:0,SortDirection:0,SearchType:5,RefinedKeywords:[],PostalCode:'',ResultsType:0,fc:'',fl:'',fcf:'',afc:'',afl:'',afcf:''},parts=[]
 function add(k,v){if(Array.isArray(v))v.forEach((x,i)=>add(k+'['+i+']',x));else if(v&&typeof v==='object')for(const[n,x]of Object.entries(v))add(k+'.'+n,x);else parts.push(encodeURIComponent(k)+'='+encodeURIComponent(v))}for(const[k,v]of Object.entries(criteria))add(k,v)
 return SEARCH+'/results?'+parts.join('&').replace(/%20/g,'+')
}
export function parseCargillPage(payload,page,total){
 failure(payload);prove(payload.hasJobs===true&&payload.hasContent===false&&typeof payload.results==='string'&&typeof payload.filters==='string','Native public result fields invalid')
 const d=readNativeDocument(payload.results),section=one(d.nodes(n=>n.attrs.id==='search-results'),'native result section'),a=section.attrs
 prove(number(a['data-total-results'])===total&&number(a['data-total-job-results'])===total&&number(a['data-total-pages'])===Math.ceil(total/15)&&number(a['data-current-page'])===page&&a['data-records-per-page']==='15','Native pagination totals/range drift')
 const fd=readNativeDocument(payload.filters),selected=fd.nodes(n=>n.tag==='input'&&Object.hasOwn(n.attrs,'checked'));prove(selected.length===1&&selected[0].attrs['data-facet-type']==='2'&&selected[0].attrs['data-id']==='1269750'&&selected[0].attrs['data-display']==='India'&&number(selected[0].attrs['data-count'])===total,'Native filter country/scope drift')
 const jobs=d.nodes(n=>n.tag==='a'&&n.attrs['data-job-id']).map(n=>{const publicJobId=n.attrs['data-job-id'],url=new URL(n.attrs.href,CAREERS);prove(id(publicJobId)&&url.origin===new URL(CAREERS).origin&&!url.search&&!url.hash&&new RegExp('^/en/job/[^/]+/[^/]+/23251/'+publicJobId+'$').test(url.pathname),'Native public role identity invalid');const title=d.text(one(n.children.filter(c=>typeof c!=='string'&&c.tag==='h3'&&!c.inert),'native role title')),location=d.text(one(n.children.filter(c=>typeof c!=='string'&&d.hasClass(c,'job-location')&&!c.inert),'native listing location'));prove(plain(title)&&location,'Native listing fields unavailable');return{publicJobId,title,sourceUrl:url.href,nativeListingLocation:location}})
 prove(jobs.length===Math.min(15,total-(page-1)*15)&&new Set(jobs.map(j=>j.publicJobId)).size===jobs.length,'Native page rows/unique IDs disagree');return{jobs,page,total}
}
export function parseCargillOfficialRole(html,row,{now=new Date().toISOString(),deferIncompletePublicOffice=false}={}){
 const d=readNativeDocument(html),models=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').map(n=>parseCargillJson(n.raw,'official')),job=one(models.filter(j=>j['@type']==='JobPosting'),'native public JobPosting')
 prove(job.title===row.title&&job.url===row.sourceUrl&&job.hiringOrganization?.name==='Cargill'&&id(job.identifier?.value)&&job.identifier.name==='Job ID','Native public role identity mismatch');prove(d.nodes(n=>n.tag==='h2').some(n=>d.text(n)===row.title),'Visible public role title missing')
 const incompletePublicOffices=[]
 prove(Array.isArray(job.jobLocation)&&job.jobLocation.length>0,'Native public role location missing');const addresses=job.jobLocation.map((l,index)=>{
  const a=l.address
  prove(a&&typeof a.addressCountry==='string'&&Object.hasOwn(countryCodes,a.addressCountry)&&plain(a.addressRegion),'Unknown native public role country or office')
  if(!plain(a.addressLocality)){
   prove(deferIncompletePublicOffice===true&&a.addressLocality==='','Unknown native public role country or office')
   incompletePublicOffices.push({index,reason:'empty-public-addressLocality',address:structuredClone(a)})
  }
  return a
 });prove(addresses.some(a=>a.addressCountry==='India'),'India-filter role has no explicit native India office');prove(new Set(addresses.map(a=>JSON.stringify(a))).size===addresses.length,'Duplicate native public offices')
 if(incompletePublicOffices.length){
  // The runtime may carry this exact incomplete schema to the final native
  // guard. Nothing here supplies a locality or qualifies this role for output.
  prove(job['@context']==='http://schema.org'&&Object.keys(job).sort().join(',')==='@context,@type,baseSalary,datePosted,description,directApply,employmentType,hiringOrganization,identifier,jobLocation,title,url'
   &&job.identifier['@type']==='PropertyValue'&&Object.keys(job.identifier).sort().join(',')==='@type,name,value'
   &&job.hiringOrganization['@type']==='Organization'&&Object.keys(job.hiringOrganization).sort().join(',')==='@type,name'
   &&job.jobLocation.every(l=>l['@type']==='Place'&&Object.keys(l).sort().join(',')==='@type,address'
   &&l.address['@type']==='PostalAddress'&&Object.keys(l.address).sort().join(',')==='@type,addressCountry,addressLocality,addressRegion,postalCode,streetAddress'
   &&typeof l.address.streetAddress==='string'&&typeof l.address.postalCode==='string'),'Incomplete public office schema changed')
 }
 const req=job.identifier.value,apply=[...new Set(links(html,row.sourceUrl).filter(link=>link.startsWith('https://career2.successfactors.eu/sfcareer/jobreqcareer?')))];prove(apply.length===1,'Native SAP application missing or ambiguous');const u=new URL(apply[0]);prove(u.searchParams.get('jobId')===req&&u.searchParams.get('company')==='cargill'&&u.searchParams.get('locale')==='en_US'&&[...u.searchParams].length===3&&!u.hash,'Native SAP company/requisition mismatch')
 return{...row,requisitionId:req,applicationURL:apply[0],addresses,publicPostedAt:day(job.datePosted,now),nativePublicJobPosting:structuredClone(job),...(incompletePublicOffices.length?{incompletePublicOffices}:{})}
}
export function parseCargillRmkDetail(html,finalURL,official,{now=new Date().toISOString()}={}){
 const url=new URL(finalURL);prove(url.origin===NATIVE&&!url.search&&!url.hash&&!url.username&&!url.password&&/^\/job\/[^/]+\/[1-9]\d*\/$/.test(url.pathname),'Native SAP handoff origin/role invalid');const publicId=url.pathname.split('/').at(-2),d=readNativeDocument(html)
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'native canonical');prove(canonical.attrs.href===finalURL,'Native canonical identity mismatch')
 const requisitions=d.nodes(n=>n.attrs['data-careersite-propertyid']==='customfield1')
 if(requisitions.length!==1){
  const withdrawn=requisitions.length===0?readReviewedWithdrawal(html,finalURL,official,d):null
  if(withdrawn)throw new CargillNativeWithdrawnRole(withdrawn)
  const error=cargillGuardError('CONTRACT','Expected one native requisition')
  // Preserve the guard while exposing only the bounded, validated public ID.
  // URLs, descriptions and arbitrary upstream error text never enter this code.
  if(typeof official.requisitionId==='string'&&/^[1-9]\d{0,11}$/.test(official.requisitionId))error.code='CARGILL_REQUISITION_'+official.requisitionId+'_MISSING_OR_AMBIGUOUS'
  throw error
 }
 prove(d.text(requisitions[0])===official.requisitionId,'Native requisition mismatch')
 const title=d.text(one(d.nodes(n=>n.attrs.itemprop==='title'),'native title'));prove(title===official.title,'Native role title mismatch')
 const meta=key=>d.nodes(n=>n.tag==='meta'&&n.attrs.itemprop===key).map(n=>n.attrs.content),employers=meta('hiringOrganization');prove(employers.length===1&&employers[0]==='cargill','Native employer mismatch')
 const locations=d.nodes(n=>d.hasClass(n,'jobGeoLocation')).map(n=>d.text(n));prove(locations.length>0&&new Set(locations).size===locations.length,'Native role locations missing or duplicated')
 const offices=locations.map(location=>{const parts=location.split(',').map(norm),country=Object.keys(countryCodes).find(name=>parts[2]===countryCodes[name]+' '+name);prove(parts.length===4&&country&&postalPatterns[country].test(parts[3]),'Native role country or postal identity unavailable');const address=official.addresses.find(a=>a.addressCountry===country&&cityKey(a.addressLocality)===cityKey(parts[0])&&sameRegion(country,parts[0],a.addressRegion,parts[1]));return{address,country,code:countryCodes[country],parts}})
 const countries=meta('addressCountry');prove(countries.length>0&&countries.every(c=>typeof c==='string'&&offices.some(o=>o.code===c))&&offices.every(o=>countries.includes(o.code)),'Native country missing or conflicting')
 const normalized=offices.map(o=>[o.parts[0],o.parts[1],o.code,o.parts[3]].join(', ')),indiaLocations=official.addresses.filter(a=>a.addressCountry==='India').map(a=>{const o=offices.find(o=>o.address===a);return[a.addressLocality,a.addressRegion,'India',...(o?[o.parts[3]]:[])].join(', ')}),nativePostedAt=rmkDate(one(meta('datePosted'),'native publication'),now,true),ends=meta('validThrough');prove(ends.length<=1,'Native expiry ambiguous');const closingDate=ends.length?rmkDate(ends[0],now,false):null;prove(!closingDate||Date.parse(closingDate)>=Date.parse(nativePostedAt),'Native expiry precedes publication')
 const full=one(d.nodes(n=>n.attrs.itemprop==='description'),'native full description'),text=d.text(full)
 // A long notice or application instruction is still not role content. Ignore
 // these sentences only when evaluating content; preserve actual full native JD.
 const substantive=text.split(/(?<=[.!?])\s+/).filter(sentence=>! /^(?:the\s+)?(?:full\s+|detailed\s+)?job description\b.*\b(?:unavailable|not available|available soon|coming soon)\b/i.test(sentence)&&!/^please\s+(?:check back|click apply now)\b.*\b(?:details|learn more|application|position)\b/i.test(sentence)).join(' ')
 const meaningful=substantive.replace(/\b(?:Job Purpose and Impact|Key Accountabilities|Qualifications|Minimum Qualifications|Preferred Qualifications|Apply now|Sample|Job Description|Coming soon|Read more)\b/gi,'').replace(/[^\p{L}]/gu,'');const description=meaningful.length>=40&&extractActiveDescription(text)?text:null
 // Native addresses repeat the explicit country code and name. Normalize
 // only those already-validated geo spans for the existing RMK adapter.
 const adapterHtml=html.replace(/(<span\b[^>]*class="jobGeoLocation"[^>]*>)([\s\S]*?)(<\/span>)/g,(_m,a,b,c)=>a+b.replace(/\b(IN India|MY Malaysia|SG Singapore|CN China|PL Poland)\b/g,value=>value.slice(0,2))+c)
 const mapped=parseRmkDetail(adapterHtml,{jobId:publicId,title:official.title,sourceUrl:finalURL,locations:normalized,expectedLocationCount:normalized.length,country:offices[0].country},{source:'cargill',companyName:'Cargill',origin:NATIVE,companyToken:'cargill'})
 const postedAt=new Date(Math.min(Date.parse(official.publicPostedAt),Date.parse(nativePostedAt))).toISOString()
 const model={...mapped,jobId:official.requisitionId,requisitionId:official.requisitionId,nativeRmkPublicId:publicId,nativePublicJobId:official.publicJobId,nativePublicRoleURL:official.sourceUrl,nativeSapApplicationURL:official.applicationURL,nativePublicPostedAt:official.publicPostedAt,nativeRmkPostedAt:nativePostedAt,nativeLocations:locations,nativePublicLocations:official.addresses,nativeListingLocation:official.nativeListingLocation,sourceLocationCorroborationComplete:offices.length===official.addresses.length,locations:indiaLocations,location:indiaLocations.join(' / '),country:'India',city:indiaLocations.length===1?indiaLocations[0].split(',')[0].trim():null,nativeEmployer:'cargill',postedAt,postingDate:postedAt,closingDate,sourceClosingDateIsExact:Boolean(closingDate),jobDescription:description,sourceDescription:description,sourceDetailComplete:Boolean(description),sourceDetailStatus:description?'complete':'native-full-description-missing',sourceListingComplete:false,sourceScopeComplete:false,scrapedAt:now}
 if(offices.some(office=>!office.address)||official.incompletePublicOffices?.length){
  // Only a complete, otherwise validated same-country role can become a hold.
  // Every native primary country must be explicitly present in the own public
  // posting. Additional public offices do not resolve a native locality clash:
  // this model stays held, never returned as a qualified role or office alias.
  // Unknown countries, incomplete native offices and missing criteria fail.
  const publicCountries=new Set(official.addresses.map(address=>address.addressCountry)),nativeCountries=new Set(offices.map(office=>office.country))
  prove(offices.every(office=>plain(office.parts[0])&&plain(office.parts[1]))
   &&(!official.incompletePublicOffices?.length||publicCountries.size===nativeCountries.size)
   &&[...nativeCountries].every(country=>publicCountries.has(country)),'Native role country/city/state mismatch')
  prove(description,'Native full description missing during worksite conflict')
  const validatedModel={...model,sourceLocationCorroborationComplete:false,nativeWholeCriteriaSHA256:hash(description),
   nativeCountryMetadata:[...countries],validatedNativeOffices:offices.map(({country,code,parts})=>({country,code,parts:[...parts]}))}
  if(official.incompletePublicOffices?.length)throw new CargillSameCountryPublicOfficeIncomplete(validatedModel)
  throw new CargillSameCountryWorksiteDisagreement(validatedModel)
 }
 return model
}
