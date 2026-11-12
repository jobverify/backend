import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {famPublicProfiles} from './publicScopeProfiles20261112.js'

export const famPublicURLs={home:'https://www.famapp.in/',careers:'https://www.famapp.in/careers/',jobs:'https://www.famapp.in/jobs/',hq:'https://www.famapp.in/fam-hq/',
 api:'https://api.lever.co/v0/postings/fampay?mode=json',grouped:'https://api.lever.co/v0/postings/fampay?group=team&mode=json',board:'https://jobs.lever.co/fampay',
 general:'https://jobs.lever.co/fampay/e78e59db-fc28-4643-b389-03e75e19bf39'}
export const famReviewedProgrammes=Object.keys(famPublicProfiles.programmes)
const digest=value=>createHash('sha256').update(value).digest('hex')
const need=(ok,message)=>{if(!ok)throw Error('Fam public scope: '+message)}
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const attributes=node=>Object.fromEntries(Object.entries(node.attrs).sort(([a],[b])=>a.localeCompare(b)))
const navigationDigest=doc=>digest(JSON.stringify(doc.nodes(n=>['a','area','form','object','embed','link'].includes(n.tag)).map(n=>({tag:n.tag,attributes:attributes(n),label:doc.text(n)}))))
const executionDigest=doc=>digest(JSON.stringify(doc.nodes(n=>n.tag==='script'&&n.attrs.type!=='application/ld+json').map(n=>({attributes:attributes(n),inlineSha256:digest(n.raw||'')}))))
const allDocumentNodes=doc=>{
 const walk=node=>[node,...node.children.filter(child=>typeof child!=='string').flatMap(walk)]
 return walk(doc.nodes(node=>node.tag==='root')[0])
}
// Retain the complete reviewed programme shape. Only the two request-specific
// Cloudflare nonce values and the same request's ray token vary between native
// responses; original unmodified bytes remain in every retained HTTP receipt.
const nativeProgramme=value=>String(value).replace(/(window\.__CF\$cv\$params=\{r:')[a-f\d]+(',t:')[A-Za-z\d+/=]+('\})/g,'$1<request>$2<time>$3')
 .replace(/(\/cdn-cgi\/challenge-platform\/scripts\/jsd\/main\.js\?ray=)[a-f\d]+/g,'$1<request>')
export const famNativeExecutionDigest=doc=>digest(JSON.stringify(allDocumentNodes(doc).filter(node=>node.tag==='script'&&node.attrs.type!=='application/ld+json')
 .map(node=>({attributes:attributes(node),inlineSha256:digest(nativeProgramme(node.raw||''))}))))
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value
export const sameFamNativeRecords=(left,right)=>JSON.stringify(canonical([...left].sort((a,b)=>a.id.localeCompare(b.id))))===JSON.stringify(canonical([...right].sort((a,b)=>a.id.localeCompare(b.id))))
const noAdditionalNavigation=doc=>{
 const nodes=allDocumentNodes(doc)
 need(!nodes.some(n=>n.tag==='base'||n.tag==='meta'&&/^refresh$/i.test(n.attrs['http-equiv']||'')),'unreviewed document base or refresh navigation')
 // The active parser excludes iframe raw-text nodes from nodes(). Inspect the
 // active parent's children so blank and srcdoc frames cannot escape review.
 // Hidden frames still load, and hidden scripts still execute. Conservatively
 // hold newly declared frames/embedded programmes even within inert markup.
 need(!nodes.some(node=>['iframe','object','embed'].includes(node.tag)),'unreviewed frame or embedded channel')
}

// Lever's explicit country describes the declared primary location. Only that
// exact primary label may reuse it; every distinct secondary location needs
// its own written country. A city dictionary cannot qualify a native worksite.
export function readFamWorksiteScope(row){
 const primary=clean(row.categories?.location),country=nativeCountryName(row.country),explicitPrimary=nativeLocationCountryName(primary)
 const primaryConflict=Boolean(country&&explicitPrimary&&country!==explicitPrimary)
 const values=row.categories?.allLocations,valid=Array.isArray(values)&&values.length>0&&values.length<=64&&values.every(value=>typeof value==='string'&&clean(value))
 const locations=valid?values.map(raw=>({raw,country:clean(raw)===primary?country:nativeLocationCountryName(raw),
  proof:clean(raw)===primary?'native-primary-country':'explicit-secondary-country'})):[]
 const complete=Boolean(country&&!primaryConflict&&valid&&values.some(value=>clean(value)===primary)
  &&new Set(values.map(clean)).size===values.length&&locations.every(location=>location.country===country)
  &&['onsite','hybrid','remote'].includes(row.workplaceType))
 return{primaryLocation:primary,nativePrimaryCountry:row.country??null,primaryCountry:country,primaryCountryConflict:primaryConflict,
  nativeAllLocations:values??null,locations,workplaceType:row.workplaceType??null,complete}
}

const readNativeBoard=(html,records)=>{
 const doc=readNativeDocument(html)
 noAdditionalNavigation(doc)
 need(famNativeExecutionDigest(doc)===famPublicProfiles.nativeBoard.executionSha256,'unreviewed complete native board programme declarations')
 need(!doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').length,'unreviewed native board structured inventory declaration')
 need(doc.nodes(n=>n.tag==='title').length===1&&clean(doc.nodes(n=>n.tag==='title')[0].raw)==='Fam','native board employer identity changed')
 const wrappers=doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'postings-wrapper'))
 need(wrappers.length===1,'unreviewed native board inventory container')
 const entries=doc.nodes(n=>n.tag==='div'&&doc.hasClass(n,'posting'))
 const ids=[],byId=new Map(records.map(record=>[record.id,record]))
 for(const entry of entries){
  const id=entry.attrs['data-qa-posting-id'],row=byId.get(id)
  need(row&&!ids.includes(id),'native board role omitted, duplicated or outside the full feed')
  need(doc.nodes(n=>n===entry,wrappers[0]).length===1,'native board role outside the all-postings container')
  const titles=doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'posting-title'),entry)
  const headings=doc.nodes(n=>n.tag==='h5'&&n.attrs['data-qa']==='posting-name',entry)
  const locations=doc.nodes(n=>n.tag==='span'&&doc.hasClass(n,'location'),entry)
  need(titles.length===1&&titles[0].attrs.href===row.hostedUrl&&headings.length===1&&doc.text(headings[0])===clean(row.text)
   &&locations.length===1&&doc.text(locations[0])===clean(row.categories.location),'native board role identity, title or workplace differs from the full feed')
  ids.push(id)
 }
 need(ids.length===records.length&&ids.length>0,'native board and full feed role sets disagree, or empty public board state is unreviewed')
 const titleLinks=doc.nodes(n=>n.tag==='a'&&doc.hasClass(n,'posting-title'))
 need(titleLinks.length===entries.length,'unbound native board role link')
 let allFilters=0,companyLinks=0,boardLinks=0
 for(const node of doc.nodes(n=>['a','area','form','object','embed','link','button'].includes(n.tag))){
  need(node.tag==='a','unreviewed native board navigation or continuation declaration')
  const href=node.attrs.href,label=doc.text(node)
  if(doc.hasClass(node,'posting-title')||doc.hasClass(node,'posting-btn-submit')){
   need(records.some(row=>href===row.hostedUrl),'foreign native board posting link');continue
  }
  if(doc.hasClass(node,'category-link')){
   need(node.attrs.rel==='nofollow','native category navigation profile changed')
   if(doc.hasClass(node,'selected')){need(href==='?'&&label==='All','native board is filtered');allFilters++;continue}
   const url=new URL(href,famPublicURLs.board),query=[...url.searchParams]
   need(url.origin==='https://jobs.lever.co'&&url.pathname==='/fampay'&&!url.hash&&query.length===1,'native board continuation or foreign facet')
   const[key,value]=query[0]
   need(['workplaceType','location','team','commitment'].includes(key),'unreviewed native board facet or continuation')
   need(key==='workplaceType'?['onsite','hybrid','remote'].includes(value):records.some(row=>(key==='location'?row.categories.allLocations: [row.categories[key]]).includes(value)),'native board facet absent from the full feed')
   continue
  }
  if(href===famPublicURLs.board&&doc.hasClass(node,'main-header-logo')){boardLinks++;continue}
  if(href===famPublicURLs.home&&label==='Fam Home Page'){companyLinks++;continue}
  need(href==='https://www.lever.co/job-seeker-support/'&&label==='Jobs powered by','unreviewed native board link or continuation')
 }
 need(allFilters===4&&companyLinks===1&&boardLinks===1,'native board all-categories or company binding changed')
 need(!doc.nodes(n=>Object.keys(n.attrs).some(key=>/^(?:data-)?(?:next|cursor|has-more|pagination)(?:-|$)/i.test(key))).length,'unreviewed native board continuation attributes')
 return ids.sort()
}

const readGeneralApplication=html=>{
 const doc=readNativeDocument(html)
 noAdditionalNavigation(doc)
 const scripts=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'),schemas=scripts.map(script=>JSON.parse(script.raw))
 need(schemas.length===1&&schemas[0]['@type']==='JobPosting'&&schemas[0].hiringOrganization?.name==='Fam','advertised general-application identity changed')
 const title=decodeNativeEntities(schemas[0].title)
 need(title==="Couldn't find a relevant role? Apply here!"&&doc.nodes(n=>n.tag==='h2'&&doc.text(n)===title).length===1,'advertised general-application title changed into an unreviewed channel')
 const text=doc.text(doc.nodes(n=>n.tag==='body')[0]),profile=famPublicProfiles.generalApplication
 need(digest(JSON.stringify(schemas))===profile.schemaSha256&&digest(text)===profile.visibleBodySha256&&navigationDigest(doc)===profile.navigationSha256
  &&famNativeExecutionDigest(doc)===profile.executionSha256,
  'advertised general-application criteria, workplace or navigation requires review')
 need(text.includes("Our open roles don't always keep up with the people we want to meet.")&&text.includes('nothing on this page fits, tell us what'),
  'publisher no longer identifies the advertised page as a general-application pool')
 return{url:famPublicURLs.general,id:'e78e59db-fc28-4643-b389-03e75e19bf39',title,recordKind:'general-application',inventoriedVacancy:false,
  nativeJobPosting:schemas[0],nativeVisibleText:text,originalCountryUnknown:schemas[0].jobLocation?.address?.addressCountry==null,profile}
}

// This certificate covers the currently declared public Fam vacancy channel.
// It makes no claim about unadvertised/private roles or a legal employer's
// other recruitment. The advertised application pool is retained separately.
export function readFamPublicScope({documents,programmes,boardHTML,generalHTML,records,paginatedRecords,groupedRecords}){
 for(const[url,profile]of Object.entries(famPublicProfiles.documents)){
  need(typeof documents[url]==='string','reviewed public company/careers route unavailable')
  const doc=readNativeDocument(documents[url]);noAdditionalNavigation(doc)
  need(navigationDigest(doc)===profile.navigationSha256&&executionDigest(doc)===profile.executionSha256
   &&digest(documents[url])===profile.bodySha256,'complete public document, navigation or executable declarations changed')
 }
 for(const[url,hash]of Object.entries(famPublicProfiles.programmes))need(typeof programmes[url]==='string'&&digest(programmes[url])===hash,'reviewed company/careers/jobs programme bytes changed')
 need(sameFamNativeRecords(records,paginatedRecords),'explicit native pagination and full unfiltered feed disagree')
 need(Array.isArray(groupedRecords)&&groupedRecords.every(group=>group&&typeof group.title==='string'&&Array.isArray(group.postings)
  &&group.postings.every(row=>row.categories?.team===group.title)),'advertised native grouped inventory contract changed')
 const grouped=groupedRecords.flatMap(group=>group.postings)
 need(sameFamNativeRecords(records,grouped),'advertised grouped and unfiltered public inventories disagree')
 const nativeRoleIds=readNativeBoard(boardHTML,records),generalApplicationPool=readGeneralApplication(generalHTML)
 need(!records.some(row=>row.id===generalApplicationPool.id),'general-application pool became an enumerated unreviewed posting')
 return{scope:'current-declared-public-Fam-vacancy-channel',tenant:'fampay',nativeRoleIds,nativeRoleCount:records.length,
  companyURL:famPublicURLs.home,careersURL:famPublicURLs.careers,additionalReviewedRecruitingRoutes:[famPublicURLs.jobs,famPublicURLs.hq],nativeBoardURL:famPublicURLs.board,
  reviewedDocuments:famPublicProfiles.documents,reviewedProgrammes:famPublicProfiles.programmes,
  reviewedNativeBoardProgrammes:famPublicProfiles.nativeBoard,
  publisherAllRolesDeclaration:'You\'ll apply on Lever, where all Fam roles live.',
  generalApplicationPool,excludedScope:['unadvertised-private-or-internal-postings','legal-employer-and-related-entity-recruitment'],
  remoteAnalyticsContentsReviewed:false,legalEmployer:null}
}
