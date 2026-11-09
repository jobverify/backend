import { createHash } from 'node:crypto'
import { readNativeDocument, activeIframeSources } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { visibleDocument, normalizeText, decodeLeaf } from './nativeVisibility.js'

export const SOURCE='acuvatesoftware', COMPANY='Acuvate Software'
export const HOMEPAGE_URL='https://acuvate.com/', CAREERS_URL=HOMEPAGE_URL+'careers/', APPLY_URL=CAREERS_URL+'#fill_the_form'
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const find=(n,p)=>typeof n==='string'||n.inert?[]:[...(p(n)?[n]:[]),...n.children.flatMap(c=>find(c,p))]
const clean=v=>normalizeText(v)||null
const absolute=(v,base=CAREERS_URL)=>{try{const u=new URL(v,base);return u.protocol==='https:'?u.href:null}catch{return null}}
const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
export class AcuvateNativeError extends Error{constructor(message){super('Acuvate native: '+message);this.name='AcuvateNativeError';this.abortRetries=true}}
const valid=(ok,message)=>{if(!ok)throw new AcuvateNativeError(message)}
const countryNames=[[/^(?:India|IN)$/i,'India','IN'],[/^(?:United Kingdom|UK|GB)$/i,'United Kingdom','GB'],[/^(?:United States(?: of America)?|USA|US)$/i,'United States','US'],[/^(?:Canada|CA)$/i,'Canada','CA'],[/^(?:Germany|DE)$/i,'Germany','DE'],[/^(?:Australia|AU)$/i,'Australia','AU']]
const locationCountry=value=>{const found=[...new Set(String(value||'').split(/[,;|()]/).map(s=>countryNames.find(([p])=>p.test(s.trim()))?.[1]).filter(Boolean))];return found.length===1?found[0]:null}
const countryCode=country=>countryNames.find(x=>x[1]===country)?.[2]||null
const label=(lines,name)=>lines.map(s=>new RegExp('^'+name+'\\s*:\\s*(.+)$','i').exec(s)?.[1]).find(Boolean)||null
const nativeDate=value=>{if(!value||!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2}))?$/.test(value)||!Number.isFinite(Date.parse(value)))return null;return value}

export const inspectHiringScope=(html,url)=>{
 const doc=readNativeDocument(html),nodes=doc.nodes(n=>n.tag==='a'),links=nodes.map(n=>({url:absolute(n.attrs.href,url),text:doc.text(n)})).filter(x=>x.url)
 const locales=doc.nodes(n=>n.tag==='link'&&n.attrs.hreflang).map(n=>absolute(n.attrs.href,url)).filter(Boolean)
 const channels=links.filter(l=>/\bcareer|\bvacanc|\bjob(?:s| openings?)?\b|hiring opportunit|recruitment|apply now/i.test(l.text)).map(l=>l.url).filter(u=>!u.startsWith(CAREERS_URL+'#')&&u!==CAREERS_URL)
 const contact=links.filter(l=>/contact us|our offices|office locations/i.test(l.text)).map(l=>l.url).filter(u=>new URL(u).origin===new URL(HOMEPAGE_URL).origin)
 const canonical=doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>absolute(n.attrs.href,url))
 const employerBound=doc.nodes(n=>n.tag==='title'&&/Acuvate/i.test(decodeLeaf(n.raw))).length===1||doc.nodes(n=>n.tag==='meta'&&n.attrs.property==='og:site_name'&&/^Acuvate(?: software)?$/i.test(n.attrs.content||'')).length===1&&canonical.length===1&&canonical[0]===url
 return {employerBound,canonical:[...new Set(canonical)],locales:[...new Set(locales.filter(u=>u!==url))].sort(),channels:[...new Set(channels)].sort(),contact:[...new Set(contact)].sort(),activeFrames:activeIframeSources(html).map(u=>absolute(u,url)).filter(Boolean)}
}
export const hasOfficialCareersSignal=html=>{const d=readNativeDocument(html);return d.nodes(n=>n.tag==='title'&&/Careers?[^<]*Acuvate/i.test(decodeLeaf(n.raw))).length===1&&d.nodes(n=>n.attrs.id==='jobs').length===1&&d.nodes(n=>['h1','h2','h3'].includes(n.tag)&&/Open Opportunities at Acuvate/i.test(d.text(n))).length>0}

export const extractOfficialWorksites=(html,url)=>{
 const doc=visibleDocument(html,n=>cls(n,'litho-heading')),root=doc.nodes(n=>n.tag==='root')[0],parents=new WeakMap()
 const walk=(n,p)=>{if(typeof n==='string')return;if(p)parents.set(n,p);n.children.forEach(c=>walk(c,n))};walk(root)
 if(!inspectHiringScope(html,url).employerBound||doc.unresolved)return {sites:[],unresolved:doc.unresolved,visibilityIssues:doc.visibilityIssues}
 const sites=[]
 for(const n of doc.nodes(n=>cls(n,'litho-primary-title'))){
  const m=/^(.+?)\s*\(([^()]+)\)$/.exec(doc.text(n)),country=m&&locationCountry(m[2]);if(!country)continue
  let p=n;while(p&&!cls(p,'elementor-column'))p=parents.get(p)
  const text=p?doc.text(p):'',city=clean(m[1]);if(!city||!text.includes(city)||!/[\d]/.test(text))continue
  const address=p?find(p,x=>cls(x,'elementor-widget-text-editor')||cls(x,'elementor-widget-litho-text-editor')).map(x=>doc.text(x)).filter(x=>x.includes(city)&&/[\d]/.test(x)):[]
  if(address.length!==1)continue
  sites.push({city,country,countryCode:countryCode(country),address:address[0],sourceUrl:url,basis:'visible-employer-office-heading-and-same-card-postal-address'})
 }
 return {sites,unresolved:false,visibilityIssues:[]}
}
const resolveLocation=(location,worksites)=>{
 const nativeCountry=locationCountry(location),city=clean(String(location||'').split(/[,;|]/)[0]),matches=worksites.filter(s=>s.city.toLowerCase()===String(location||'').trim().toLowerCase())
 const unique=matches.length===1&&!/remote|worldwide|global|anywhere/i.test(location||'')?matches[0]:null
 return {location,city:city||null,country:nativeCountry||unique?.country||null,nativeCountry,countryCode:countryCode(nativeCountry||unique?.country),evidence:{location,nativeCountry,basis:nativeCountry?'explicit-role-location-country':unique?'exact-current-employer-worksite':null,matchedWorksites:unique?[unique]:[]}}
}
export const extractNativeInventory=(html,{worksites=[],revealContract=false}={})=>{
 // Only the exact native accordion default hiding rule is relaxed after the
 // currently advertised frontend and toggle handler have proved its public UI.
 const expanded=revealContract?String(html).replace(/(\.elementor-toggle\s+\.elementor-tab-content\s*\{[^{}]*?)\bdisplay\s*:\s*none\b/gi,'$1display:block'):String(html)
 const doc=visibleDocument(expanded,n=>n.attrs.id==='jobs'),boards=doc.nodes(n=>n.attrs.id==='jobs')
 const board=boards.length===1?boards[0]:null
 const cards=board?find(board,n=>n.tag==='section'&&cls(n,'elementor-inner-section')):[]
 const rows=cards.map(card=>{
  const nodes=p=>find(card,p),titles=nodes(n=>n.tag==='h3'),title=titles.length===1?clean(doc.text(titles[0])):null
  const metadata=nodes(n=>cls(n,'panel-location')||cls(n,'panel-experience')).map(n=>doc.text(n)),lines=metadata.flatMap(s=>s.split(/\s+(?=(?:Department|Location|Experience|Job Type)\s*:)/i))
  const location=label(lines,'Location'),resolved=resolveLocation(location,worksites)
  const panels=nodes(n=>cls(n,'elementor-tab-content')),controls=nodes(n=>cls(n,'elementor-tab-title')&&n.attrs.role==='button'),panel=panels.length===1?panels[0]:null
  const target=panel?.attrs.id,control=controls.filter(n=>n.attrs['aria-controls']===target&&n.attrs.id===panel?.attrs['aria-labelledby']&&n.attrs['data-tab']===panel?.attrs['data-tab'])
  const allPanels=readNativeDocument(html).nodes(n=>cls(n,'elementor-tab-content')&&n.attrs.id===target)
  const panelIdentity=Boolean(panel&&target&&allPanels.length===1&&control.length===1&&/know more|details|description/i.test(doc.text(control[0])))
  const criteriaLines=panel?find(panel,n=>['p','li','h4','h5','h6'].includes(n.tag)).map(n=>doc.text(n)).filter(Boolean):[]
  const description=panel?clean(doc.text(panel)):null
  const sections=[];if(panel)for(const node of find(panel,n=>['h4','h5','h6','p','li'].includes(n.tag))){const text=doc.text(node);if(!text)continue;const heading=['h4','h5','h6'].includes(node.tag)||node.tag==='p'&&node.children.filter(c=>typeof c!=='string').length===1&&find(node,n=>['strong','b'].includes(n.tag)).some(n=>doc.text(n)===text);if(heading)sections.push({heading:text,lines:[]});else if(sections.length)sections.at(-1).lines.push(text)}
  const preferred=/preferred|nice.to.have|bonus|\bplus\b|not mandatory/i
  const qualificationLines=sections.filter(s=>/qualifications?|education|eligibility/i.test(s.heading)&&!preferred.test(s.heading)).flatMap(s=>s.lines).filter(s=>!preferred.test(s))
  const preferredLines=[...new Set([...sections.filter(s=>preferred.test(s.heading)).flatMap(s=>s.lines),...criteriaLines.filter(s=>preferred.test(s)&&/degree|education|graduat|certific|ph\.?d/i.test(s))])]
  let skillContext=false;const skillLines=[]
  for(const section of sections){if(/skills|technical expertise/i.test(section.heading))skillContext=true;else if(/responsibilit|overview|summary|benefit|preferred|nice.to.have|bonus|what.*doing/i.test(section.heading))skillContext=false;if(skillContext)skillLines.push(...section.lines)}
  const full=Boolean(panelIdentity&&description&&criteriaLines.length&&!doc.unresolved)
  const applyNodes=nodes(n=>n.tag==='a'&&/apply now/i.test(doc.text(n))),applies=[...new Set(applyNodes.map(n=>absolute(n.attrs.href)).filter(Boolean))],apply=applies.length===1?applies[0]:null
  const formTarget=apply?new URL(apply).hash.slice(1):null,applicationValid=Boolean(apply&&apply===APPLY_URL&&doc.nodes(n=>n.attrs.id===formTarget).length===1)
  const nativeId=clean(card.attrs['data-job-id']),key=target?CAREERS_URL+'#'+encodeURIComponent(target):null
  const allLines=[...lines,...criteriaLines],postingDate=nativeDate(label(allLines,'(?:Posted on|Date Posted|Publication Date)')),closingDate=nativeDate(label(allLines,'(?:Closing date|Valid through|Expiry date)'))
  const secondaryLines=allLines.filter(s=>/^(?:Secondary|Additional) Locations?\s*:/i.test(s)).flatMap(s=>s.replace(/^[^:]+:\s*/,'').split(';')).map(s=>resolveLocation(s.trim(),worksites))
  const identity=Boolean(title&&location&&key),withdrawn=allLines.some(s=>/^(?:Status|Availability)\s*:\s*(?:closed|withdrawn|expired|unavailable)\b/i.test(s))
  return {source:SOURCE,company:COMPANY,legalEmployer:label(allLines,'Legal employer'),title,department:label(lines,'Department'),location,...resolved,secondaryLocations:secondaryLines,
   jobId:nativeId,id:nativeId,sourceJobId:nativeId,requisitionId:label(allLines,'(?:Requisition ID|Req ID)'),sourcePostingKey:key,sourceUrl:key||CAREERS_URL,applyUrl:apply,link:apply||key||CAREERS_URL,
   applicationUrlIsGeneric:true,applicationUrlScope:'shared-first-party-application-form',applicationPostingContext:{nativePostingId:nativeId,nativeDetailAnchor:target,title,formalRequisitionId:label(allLines,'(?:Requisition ID|Req ID)')},applicationPublicContextValidated:applicationValid,applicationSubmitted:false,candidateActionsTaken:false,
   employmentType:label(lines,'Job Type'),experienceRequired:label(lines,'Experience'),remoteStatus:label(allLines,'(?:Work arrangement|Work mode|Remote status)'),minimumQualification:label(allLines,'(?:Minimum Qualification|Education|Qualification)')||(qualificationLines.length?qualificationLines.join('\n'):null),preferredQualification:label(allLines,'Preferred Qualification')||(preferredLines.length?preferredLines.join('\n'):null),requiredSkills:skillLines.length?skillLines:null,
   postingDate,postedAt:postingDate,nativePublicationDate:postingDate,sourcePublicationDateUnavailable:!postingDate,closingDate,sourceClosingDateIsExact:Boolean(closingDate?.includes('T')),sourceAvailability:withdrawn?'closed':'open',
   sourceDescription:full?description:null,jobDescription:full?description:null,sourceDetailComplete:full,sourceIdentityComplete:identity,sourceDetailFailureKind:full?null:doc.unresolved?'visible-native-criteria-unresolved':'native-panel-identity-or-reveal-unresolved',
   sourceNativeCriteria:{fullObservedText:description,lines:criteriaLines,sections,visibilityIssues:doc.visibilityIssues},sourceNativeCountryEvidence:resolved.evidence,sourceNativeIdEvidence:{nativeJobId:nativeId,layoutSectionId:card.attrs['data-id']||null,nativeDetailAnchor:target,formalRequisitionId:label(allLines,'(?:Requisition ID|Req ID)')},sourceNativeDates:{postingDate,closingDate}}
 })
 const keys=rows.map(r=>r.sourcePostingKey),duplicates=[...new Set(keys.filter((k,i)=>k&&keys.indexOf(k)!==i))]
 for(const row of rows)if(duplicates.includes(row.sourcePostingKey)){row.sourceIdentityComplete=false;row.sourceDetailComplete=false;row.sourceDescription=null;row.jobDescription=null}
 const pagination=board?find(board,n=>['a','button'].includes(n.tag)&&(/next|load more/i.test(doc.text(n))||/[?&](?:page|paged|cursor|offset)=|\/page\/\d+/i.test(n.attrs.href||'')||Object.hasOwn(n.attrs,'data-page'))).map(n=>absolute(n.attrs.href)).filter(Boolean):[]
 const explicitEmpty=Boolean(board&&/\bno (?:current |open |available )?(?:openings|vacancies|positions|opportunities|jobs)\b/i.test(doc.text(board)))
 return {rows,observedCount:rows.length,explicitEmpty,duplicateKeys:duplicates,visibilityUnresolved:doc.unresolved,visibilityIssues:doc.visibilityIssues,terminal:Boolean(board&&hasOfficialCareersSignal(html)&&!pagination.length),pagination}
}
export const extractJobs=(html,options)=>extractNativeInventory(html,options).rows
export const defaultFetchPage=async(url,{signal,fetchImpl=fetch,...init}={})=>{const r=await fetchImpl(url,{...init,redirect:'follow',signal:signal||AbortSignal.timeout(45000)});return{status:r.status,url:r.url,body:await r.text()}}
const frontendAssets=html=>{
 const script=[...String(html).matchAll(/https?:[^\s"'<>]+\.js/gi)].map(m=>m[0]).find(s=>/\/elementor\/.*\.frontend\.min\.js$/.test(s))
 let config=null;try{config=JSON.parse(String(html).match(/elementorFrontendConfig\s*=\s*(\{[^\n]+?\});/)?.[1])}catch{}
 const asset=config?.urls?.assets,chunk=asset&&new URL(asset).origin===new URL(HOMEPAGE_URL).origin&&/\/elementor\/assets\/$/.test(asset)?asset+'js/chunks/toggle.min.js?ver='+encodeURIComponent(config.version):null
 return {script,chunk}
}
export const runNative=async(options={})=>{
 const load=options.fetchPage||defaultFetchPage,maxJobs=options.maxJobs??0,now=new Date((options.now||(()=>new Date().toISOString()))()).toISOString()
 valid(Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid output cap')
 let requests=0,denied=false;const failures=[]
 const page=async url=>{valid(!denied,'public access denied; source stopped');options.signal?.throwIfAborted();const r=await load(url,{method:'GET',headers:{Accept:'text/html,application/javascript;q=0.9'},signal:options.signal});requests++;const body=r?.body??r?.html;if([401,403,429].includes(Number(r?.status))||/<(?:title|h1)\b[^>]*>\s*(?:access denied|just a moment|verify you are human|request rejected|captcha|attention required|pardon our interruption)|\bid=["'](?:challenge-form|cf-chl-)/i.test(body||'')){denied=true;throw new AcuvateNativeError('public access denied HTTP '+r?.status)}if(r?.status!==200||r.url!==url||typeof body!=='string'){failures.push('public-surface-unresolved:'+url+':'+r?.status);return null}return body}
 const phase=async()=>{
  const careers=await page(CAREERS_URL);valid(careers&&hasOfficialCareersSignal(careers),'verified Acuvate Software careers surface changed')
  const home=await page(HOMEPAGE_URL);valid(home&&inspectHiringScope(home,HOMEPAGE_URL).employerBound,'official employer homepage changed')
  const primaryScope=inspectHiringScope(careers,CAREERS_URL),homeScope=inspectHiringScope(home,HOMEPAGE_URL)
  if(primaryScope.activeFrames.length||homeScope.activeFrames.length)failures.push('embedded-public-surface-unresolved')
  valid(readNativeDocument(home).nodes(n=>n.tag==='a'&&absolute(n.attrs.href,HOMEPAGE_URL)===CAREERS_URL).length>0,'official homepage careers handoff changed')
  const scopes=[{url:CAREERS_URL,...primaryScope},{url:HOMEPAGE_URL,...homeScope}],worksites=[]
  for(const url of [...new Set([...primaryScope.contact,...homeScope.contact])]){const html=await page(url);if(html){const parsed=extractOfficialWorksites(html,url);worksites.push(...parsed.sites);if(parsed.unresolved)failures.push('employer-worksite-visibility-unresolved');scopes.push({url,...inspectHiringScope(html,url)})}}
  const assets=frontendAssets(careers);let revealContract=false
  if(assets.script&&assets.chunk){const frontend=await page(assets.script),toggle=frontend?await page(assets.chunk):null;revealContract=Boolean(frontend&&toggle&&/toggle\.default/.test(frontend)&&/__elementorLoadChunk/.test(frontend)&&/js\/chunks\//.test(frontend)&&/elementor-tab-title/.test(toggle)&&/elementor-tab-content/.test(toggle)&&/aria-expanded/.test(toggle)&&/removeAttr\(`hidden`\)/.test(toggle));if(!revealContract)failures.push('current-native-toggle-client-contract-unresolved')}
  const visited=new Set([CAREERS_URL,HOMEPAGE_URL,...scopes.map(s=>s.url)]),queue=[...new Set([...primaryScope.locales,...homeScope.locales,...scopes.flatMap(s=>s.channels)])]
  // The queue contains only current published public links. Unknown external
  // hiring services are reported, never probed as application/account routes.
  for(let i=0;i<queue.length;i++){const url=queue[i];if(visited.has(url)||url.startsWith(CAREERS_URL+'#'))continue;visited.add(url);if(new URL(url).origin!==new URL(HOMEPAGE_URL).origin){failures.push('additional-hiring-channel-unresolved:'+url);continue}const html=await page(url);if(!html)continue;const scope=inspectHiringScope(html,url);scopes.push({url,...scope});if(!scope.employerBound){failures.push('additional-scope-employer-binding-unresolved:'+url);continue}if(url!==HOMEPAGE_URL&&url!==CAREERS_URL&&readNativeDocument(html).nodes(n=>n.attrs.id==='jobs').length)failures.push('additional-native-board-unresolved:'+url);for(const next of [...scope.locales,...scope.channels])if(!visited.has(next)&&!queue.includes(next))queue.push(next);valid(queue.length<50,'advertised hiring scope exceeded safe inventory bound')}
  return {inventory:extractNativeInventory(careers,{worksites,revealContract}),scopes:scopes.sort((a,b)=>a.url.localeCompare(b.url)),worksites,revealContract,assets}
 }
 const opening=await phase(),closing=await phase(),reasons=[...new Set(failures)]
 const rowDigest=r=>digest(r),closingByKey=new Map(closing.inventory.rows.map(r=>[r.sourcePostingKey,r])),stable=opening.inventory.rows.filter(r=>r.sourcePostingKey&&closingByKey.has(r.sourcePostingKey)&&rowDigest(r)===rowDigest(closingByKey.get(r.sourcePostingKey)))
 const closingReconciled=digest(opening)===digest(closing)
 if(!closingReconciled)reasons.push('closing-scope-membership-country-or-criteria-changed')
 for(const inv of [opening.inventory,closing.inventory]){if(!inv.terminal)reasons.push('native-terminal-unresolved');if(inv.visibilityUnresolved)reasons.push('native-visibility-unresolved');if(inv.duplicateKeys.length)reasons.push('duplicate-posting-identity');if(inv.rows.some(r=>!r.sourceIdentityComplete))reasons.push('native-role-identity-unresolved');if(inv.rows.some(r=>!r.country||r.secondaryLocations.some(s=>!s.country)))reasons.push('role-owned-work-country-unresolved');if(inv.rows.some(r=>!r.sourceDetailComplete||!r.applicationPublicContextValidated))reasons.push('native-full-criteria-or-application-identity-unresolved');if(!inv.rows.length&&!inv.explicitEmpty)reasons.push('explicit-current-empty-state-unproven');if(inv.rows.length&&inv.explicitEmpty)reasons.push('conflicting-current-empty-state')}
 const scopeComplete=closingReconciled&&reasons.length===0,india=stable.filter(r=>r.sourceAvailability!=='closed'&&(r.country==='India'||r.secondaryLocations.some(s=>s.country==='India'))),outputCapped=maxJobs>0&&india.length>maxJobs,listingComplete=scopeComplete&&!outputCapped
 const jobs=(outputCapped?india.slice(0,maxJobs):india).map(r=>({...r,scrapedAt:now,sourceListingComplete:listingComplete,sourceCleanupEligible:listingComplete,sourcePrimaryScopeComplete:closingReconciled&&opening.inventory.terminal&&closing.inventory.terminal}))
 const eligible=analyzePublishableJobs(jobs.filter(j=>j.sourceDetailComplete&&j.sourceIdentityComplete&&j.applicationPublicContextValidated&&j.country&&!j.secondaryLocations.some(s=>!s.country)),{now:new Date(now)}).eligibleJobs
 const audit={source:SOURCE,observedGlobalCount:opening.inventory.observedCount,nativeGlobalReportedTotal:null,completeGlobalCount:scopeComplete?opening.inventory.observedCount:null,nativeJobs:opening.inventory.rows,closingNativeJobs:closing.inventory.rows,closingReconciled,scopeComplete,listingComplete,cleanupEligible:listingComplete,indiaJobCount:scopeComplete?india.length:null,fullHealthyIndia:india.filter(j=>j.sourceDetailComplete&&j.applicationPublicContextValidated).length,eligibleCount:eligible.length,outputCapped,requests,reasons:[...new Set(reasons)],openingScope:opening.scopes,closingScope:closing.scopes,worksites:opening.worksites,visibilityIssues:opening.inventory.visibilityIssues}
 options.onAudit?.(audit)
 return attachInventoryEvidence(jobs,{status:listingComplete?(opening.inventory.rows.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete,pagesFetched:requests,reportedTotal:listingComplete?opening.inventory.observedCount:null,indiaFacetCount:scopeComplete?india.length:null,verifiedAt:now,reason:[...new Set([...reasons,...(outputCapped?['output-capped-after-global-reconciliation']:[])])].join(';')||'complete-current-native-roles-and-closing-reconciliation'})
}
