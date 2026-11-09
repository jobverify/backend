import {document,norm,decode} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {nativeDate,nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'

export const CAREERS_URL='https://www.supergaming.com/careers'
export const BOARD_URL='https://jobs.gohire.io/supergaming-zikxnf8m/'
export const EMPLOYER_URL='https://in.linkedin.com/company/supg/'
const check=(ok,why)=>{if(!ok)throw Error(why)}
const one=(nodes,why)=>{check(nodes.length===1,'Missing or ambiguous '+why);return nodes[0]}
const parse=html=>{
 const doc=document(html)
 const prune=(n,hidden=false)=>{n.inactive ||= hidden||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test((n.attrs?.style||'').replace(/\/\*[\s\S]*?\*\//g,''));for(const c of n.children.filter(v=>typeof v!=='string'))prune(c,n.inactive)}
 prune(doc.root);return doc
}
const companyUrl=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&['www.supergaming.com','supergaming.com'].includes(u.hostname)&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password}catch{return false}}
const prose=n=>n.inactive||/^(?:script|style|h[1-6]|strong|b)$/.test(n.tag)?'':n.children.map(c=>typeof c==='string'?decode(c):prose(c)).join(' ')
const description=html=>{if(typeof html!=='string'||!extractActiveDescription(html))return null;const d=parse(html);return /[\p{L}\p{N}]/u.test(prose(d.root))?d.text(d.root):null}
const day=value=>nativeDate(value,{required:true}).raw
const months=['January','February','March','April','May','June','July','August','September','October','November','December']
const displayDay=value=>{
 const m=/^(?:Posted )?(?:(\d{1,2}) (\w+), (\d{4})|(\w+) (\d{1,2})(?:st|nd|rd|th), (\d{4}))$/.exec(value)
 check(m,'Unreviewed native public date');const month=months.indexOf(m[2]||m[4])+1
 check(month>0,'Invalid native public month');return day(`${m[3]||m[6]}-${String(month).padStart(2,'0')}-${(m[1]||m[5]).padStart(2,'0')}`)
}
const keys=(value,allowed,label)=>{check(value&&typeof value==='object'&&!Array.isArray(value),'Invalid '+label);check(Object.keys(value).every(k=>allowed.includes(k)),'Unreviewed '+label+' fields')}
const schemaOf=doc=>{
 const all=[],nodes=[];const walk=n=>{nodes.push(n);if(n.tag==='script'&&n.attrs.type==='application/ld+json')all.push(n);for(const c of n.children.filter(v=>typeof v!=='string'))walk(c)};walk(doc.root)
 const node=one(all,'native JSON-LD carrier');check(!node.inactive,'Inert native schema')
 check(!nodes.some(n=>Object.hasOwn(n.attrs??{},'itemprop')||/JobPosting/i.test(n.attrs?.itemtype||'')||n.tag==='time'||n.tag==='meta'&&/datePosted|datePublished|validThrough|jobLocation|addressCountry|expiry/i.test(n.attrs.name||n.attrs.property||'')),'New native country or date carrier requires review')
 const s=JSON.parse(node.raw)
 keys(s,['@context','@type','title','description','identifier','datePosted','directApply','hiringOrganization','jobLocation','url','validThrough','employmentType','image','baseSalary'],'JobPosting')
 check(s['@type']==='JobPosting'&&s['@context']==='https://schema.org','Native JobPosting type changed')
 keys(s.identifier,['@type','name','value'],'identifier')
 keys(s.hiringOrganization,['@type','name','sameAs','logo'],'employer')
 keys(s.jobLocation,['@type','address'],'job location')
 keys(s.jobLocation.address,['@type','addressLocality','addressRegion','addressCountry','streetAddress','postalCode'],'job address')
 if(s.baseSalary){keys(s.baseSalary,['@type','currency','value'],'salary');keys(s.baseSalary.value,['@type','unitText','minValue','maxValue','value'],'salary value')}
 return s
}
export async function collectSuperGamingNative({read,now}){
 const clock=new Date(now);check(Number.isFinite(clock.getTime()),'Invalid verification clock')
 const homeHTML=await read(CAREERS_URL),home=parse(homeHTML)
 check(activeHead(homeHTML).titles.length===1&&activeHead(homeHTML).titles[0]==='Careers — SuperGaming'&&home.nodes(n=>n.tag==='a'&&n.attrs.href?.split('?')[0]==='mailto:careers@supergaming.com').length>0,'Unreviewed official careers identity or contact')
 check(home.nodes(n=>n.tag==='a'&&n.attrs.href==='https://in.linkedin.com/company/supg').length===1,'Official exact employer association changed')
 const employer=parse(await read(EMPLOYER_URL))
 check(employer.nodes(n=>n.tag==='h1'&&employer.text(n)==='SuperGaming').length===1&&employer.nodes(n=>n.attrs['data-semaphore-content-urn']==='urn:li:organization:14740244').length===1,'Native exact employer changed')
 check(employer.nodes(n=>n.tag==='a'&&n.attrs['data-tracking-control-name']==='about_website').some(n=>{try{const u=new URL(n.attrs.href);return u.origin==='https://www.linkedin.com'&&u.pathname==='/redir/redirect'&&companyUrl(u.searchParams.get('url'))}catch{return false}}),'Native reciprocal company domain changed')
 const board=parse(await read(BOARD_URL))
 check(board.nodes(n=>n.tag==='h1'&&board.text(n)==='Jobs at SuperGaming').length===1&&board.nodes(n=>n.tag==='a'&&companyUrl(n.attrs.href)).length>0,'Native board company changed')
 const count=board.text(one(board.nodes(n=>board.hasClass(n,'job-list-count')),'board count')).match(/^(\d+) Job openings?$/)
 check(count&&Number(count[1])>0&&Number(count[1])<=100,'Unknown empty or changed native board count')
 const cards=board.nodes(n=>n.tag==='a'&&board.hasClass(n,'gohire-job'))
 check(cards.length===Number(count[1]),'Partial or duplicate native board cards')
 const jobs=[],nativeCandidates=[],seen=new Set()
 for(const card of cards){
  const url=new URL(card.attrs.href,BOARD_URL);check(url.origin==='https://jobs.gohire.io'&&url.pathname.startsWith('/supergaming-zikxnf8m/')&&!url.search&&!url.hash,'Foreign native role URL')
  const id=/-(\d+)\/$/.exec(url.pathname)?.[1];check(id&&!seen.has(id),'Invalid or duplicate native ID');seen.add(id)
  const title=board.text(one(board.nodes(n=>board.hasClass(n,'job-title'),card),'native card title'))
  const location=board.text(one(board.nodes(n=>board.hasClass(n,'careers-location'),card),'native card location'))
  const listingDate=displayDay(board.text(one(board.nodes(n=>board.hasClass(n,'date-posted'),card),'native card date')))
  const detail=parse(await read(url.href)),schema=schemaOf(detail)
  check(schema.url===url.href&&String(schema.identifier.value)===id&&schema.identifier.name==='SuperGaming'&&schema.title===title&&schema.hiringOrganization.name==='SuperGaming'&&companyUrl(schema.hiringOrganization.sameAs)&&schema.hiringOrganization.logo==='https://gohire-avatars.s3.amazonaws.com/company/11610_full.png','Native detail identity changed')
  check(detail.text(one(detail.nodes(n=>n.tag==='h1'),'native role title'))===title+' at SuperGaming','Rendered native role identity conflict')
  const fields=detail.nodes(n=>detail.hasClass(n,'jp-sidebar-item')).map(n=>({label:detail.text(one(detail.nodes(c=>detail.hasClass(c,'jp-sidebar-item-title'),n),'native role field')),value:detail.text(one(detail.nodes(c=>detail.hasClass(c,'jp-sidebar-item-data'),n),'native role value'))}))
  check(fields.every(field=>['Location','Salary','Job Type','Date Posted'].includes(field.label)),'New native role geography or timeline field requires review')
  const displayedLocations=fields.filter(field=>field.label==='Location')
  check(displayedLocations.length>0&&displayedLocations.every(field=>norm(field.value)===norm(location)),'Rendered native country or location conflict')
  const renderedDates=detail.nodes(n=>detail.hasClass(n,'jp-sidebar-item')).filter(n=>detail.nodes(c=>detail.hasClass(c,'jp-sidebar-item-title')&&detail.text(c)==='Date Posted',n).length).map(n=>displayDay(detail.text(one(detail.nodes(c=>detail.hasClass(c,'jp-sidebar-item-data'),n),'primary rendered date'))))
  check(renderedDates.length>0,'Missing native primary public date')
  const publicDates=[day(schema.datePosted),listingDate,...renderedDates].sort(),posted=publicDates[0]
  const closing=schema.validThrough==null?null:day(schema.validThrough)
  check(publicDates.every(date=>Date.parse(date)<=clock.getTime())&&(!closing||closing>=publicDates.at(-1)),'Future or impossible native dates')
  const api=JSON.parse(await read(`https://api.gohire.io/widget-job?clientHash=ZIkXNF8M&jobId=${id}`))
  keys(api,['id','client','title','type','city','county','postcode','country','description','salary','questions','isGeneralPool','iswhite'],'application record')
  keys(api.client,['id','name','noBranding','showGdprConsent','customColour','uploadExtensions','uploadExtensionsForm','uploadMaxSize','privacyPolicyUrl','country'],'application employer')
  keys(api.country,['id','code','name'],'application country')
  check(String(api.id)===id&&api.client.id===11610&&api.client.name==='SuperGaming'&&norm(api.title)===title&&api.isGeneralPool===0&&Array.isArray(api.questions),'Native application identity or pool mismatch')
  const country=nativeCountryName(schema.jobLocation.address.addressCountry)
  check(country&&country===nativeCountryName(api.country.name)&&country===nativeCountryName(api.country.code)&&norm(location)===norm(api.city+', '+api.country.name)&&schema.jobLocation.address.addressLocality===api.city&&schema.jobLocation.address.addressRegion===api.county,'Native primary country or location conflict')
  const descriptionNodes=detail.nodes(n=>detail.hasClass(n,'jp-text'))
  check(descriptionNodes.length<=1,'Ambiguous rendered native description')
  const visible=descriptionNodes.length?detail.outer(descriptionNodes[0]):null
  const texts=[description(visible),description(schema.description),description(api.description)].filter(Boolean)
  check(texts.every(text=>norm(text)===norm(texts[0])),'Native descriptions conflict')
  const jobDescription=texts[0]??null
  const activeApplyVerified=schema.directApply===true&&detail.nodes(n=>n.tag==='script'&&n.attrs.src==='https://widget.gohire.io/widget/ZIkXNF8M').length===1&&detail.nodes(n=>n.tag==='script'&&!n.attrs.src&&new RegExp('function\\s+apply\\s*\\(\\)\\s*\\{\\s*gohire\\("open",\\s*'+id+',').test(n.raw)).length===1&&detail.nodes(n=>n.attrs.onclick==='apply(); return false;'&&!Object.hasOwn(n.attrs,'disabled')&&n.attrs['aria-disabled']!=='true').length>0
  const exclusionReason=closing&&closing<clock.toISOString().slice(0,10)?'native-expired':country!=='India'?'non-India':!activeApplyVerified?'active-application-unproven':null
  nativeCandidates.push({id,title,country,postingDate:posted,nativeSchemaPostedDate:schema.datePosted,nativeListingPostedDate:listingDate,nativeRenderedPostedDates:renderedDates,closingDate:closing,activeApplyVerified,exclusionReason})
  if(!exclusionReason)jobs.push({source:'supergaming',company:'SuperGaming',title,jobId:id,location,country,postingDate:posted,closingDate:closing,sourceUrl:url.href,applyUrl:url.href,link:url.href,activeApplyVerified,jobDescription,sourceDescription:jobDescription,sourceDetailComplete:Boolean(jobDescription),sourceDetailStatus:jobDescription?'complete':'partial',sourceDetailFailureKind:jobDescription?null:'missing-content',sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,firstParty:false})
 }
 return {jobs,facts:{nativeCandidates,nativeObservedRecordCount:cards.length,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false},firstParty:false,inventoryStatus:'discovery-only',reason:'Exact SuperGaming native employer and GoHire tenant11610 corroborated. Native board, public details and same-role application data reconciled; original public dates and explicit expiry retained. Public board includes an expired record with an available application form. General application is not a vacancy. Company inventory and outbound ATS delegation remain incomplete; totals unknown and cleanup disabled.'}
}
