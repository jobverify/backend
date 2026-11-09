import {createHash} from 'node:crypto'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='novonordiskgbs',CAREERS='https://careers.novonordisk.com/search/',ORIGIN='https://careers.novonordisk.com'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('Novo Nordisk GBS native: '+m),{abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex'),equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const all=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>all(c,p))]
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const rawText=n=>typeof n==='string'?decodeNativeEntities(n):['script','style'].includes(n.tag)?'':n.children.map(rawText).join(' ')
export const isRoleURL=v=>{try{const u=new URL(v);return u.origin===ORIGIN&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/job\/[^/]+\/\d+\/$/.test(u.pathname)}catch{return false}}
export const isSearchURL=v=>{try{const u=new URL(v);return u.origin===ORIGIN&&!u.username&&!u.password&&!u.port&&!u.hash&&u.pathname==='/search/'&&[...u.searchParams.keys()].every(k=>['q','locationsearch','startrow','sortColumn','sortDirection'].includes(k))&&u.searchParams.get('q')===''&&u.searchParams.get('locationsearch')==='India'&&(!u.searchParams.has('startrow')||/^\d+$/.test(u.searchParams.get('startrow')))}catch{return false}}
const document=html=>{need(typeof html==='string','original HTML required');const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document');need(!all(root,n=>n.tag==='base').length,'unreviewed base URL');need(!all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').length,'new structured role metadata requires review');return {d,root,head:activeHead(html)}}
function visibility(html,d,root){
 // Interpret only the exact reviewed top-level anti-framing render contract as
 // data. Never execute the program or remove any other publisher stylesheet.
 const script=one(d.nodes(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript'),'anti-framing program')
 need(equivalent(script.attrs,{type:'text/javascript',id:'antiClickJackScript'})&&hash(script.raw)==='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433','anti-framing program changed')
 need(all(root,n=>n.tag==='style'&&n.attrs.id==='antiClickjack').length===1,'one anti-framing stylesheet required')
 const markup=one([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)].map(m=>m[0]).filter(s=>hash(s)==='70a0797622bbbbd8e8cd97f4795bcc45216742606e0b315dd513ba99881648aa'),'reviewed anti-framing stylesheet')
 return {d:readVisibleNativeDocument(html.replace(markup,''),{strict:true}),contract:{method:'declared-top-level-anti-framing-stylesheet-removal',styleMarkupSHA256:hash(markup),scriptSHA256:hash(script.raw),publisherCodeExecuted:false,otherHidingRulesIgnored:false}}
}
function scoped(d,root,n,v){
 const searchControl=x=>n.tag==='table'&&(x.tag==='form'&&equivalent(x.attrs,{id:'searchfilter',method:'get',action:'/search/#searchresults',name:'searchfilter'})||x.tag==='script'&&equivalent(x.attrs,{type:'text/javascript'})&&hash(x.raw)==='cbfd4313c34cb616f6fcea00761f67d95411884c5ba378dddae726d440dff376')
 need(!all(n,x=>['script','template','noscript','iframe','object','embed','form','svg','img','textarea','xmp','noembed','noframes','plaintext'].includes(x.tag)&&!searchControl(x)).length,'delegated or inactive native criteria require review')
 need(clean(rawText(n))===clean(d.text(n)),'hidden native criteria require review')
 const seen=one(v.nodes(x=>x.tag===n.tag&&(n.attrs.id?x.attrs.id===n.attrs.id:cls(x,'jobDisplayShell'))),'stylesheet-visible native region')
 need(clean(d.text(n))===clean(v.text(seen)),'stylesheet-hidden native criteria require review')
}
function searchForm(d){
 const form=one(d.nodes(n=>n.tag==='form'&&n.attrs.name==='keywordsearch'),'public keyword search form')
 need(form.attrs.action==='/search/'&&form.attrs.method?.toUpperCase()==='GET','declared public GET search changed')
 for(const name of ['q','locationsearch'])one(d.nodes(n=>n.tag==='input'&&n.attrs.name===name&&n.attrs.type==='text',form),'public search field '+name)
 return {method:'GET',action:'/search/',keywordParameter:'q',locationParameter:'locationsearch'}
}
export function readPublisher(html){
 const {d,root,head}=document(html);need(equivalent(head.titles,['Novo Nordisk Jobs']),'publisher identity changed')
 const form=searchForm(d),url=new URL(form.action,ORIGIN);url.searchParams.set(form.keywordParameter,'');url.searchParams.set(form.locationParameter,'India')
 return {head,form,derivedURL:url.href,filterIsCountryProof:false}
}
export function readListing(html,url){
 need(isSearchURL(url),'unreviewed native search URL');const {d,root,head}=document(html)
 need(equivalent(head.titles,['India - Novo Nordisk Jobs','Novo Nordisk Jobs']),'search publisher identity changed');const form=searchForm(d)
 const table=one(d.nodes(n=>n.tag==='table'&&n.attrs.id==='searchresults'),'complete native search table'),visible=visibility(html,d,root);scoped(d,root,table,visible.d)
 const summary=[...new Set(d.nodes(n=>cls(n,'paginationLabel')).map(n=>d.text(n)))];need(summary.length===1,'ambiguous result summary')
 const match=/^Results (\d+) [–-] (\d+) of (\d+)$/.exec(summary[0]);need(match,'native result summary changed')
 const [start,end,total]=match.slice(1).map(Number);need(start>=1&&end>=start&&total>=end&&end-start<100,'native result count bound')
 const pageLabels=[...new Set(d.nodes(n=>cls(n,'srHelp')).map(n=>d.text(n)))],page=/^Page (\d+) of (\d+)$/.exec(one(pageLabels,'page summary'))
 need(page,'native page summary changed');const currentPage=Number(page[1]),totalPages=Number(page[2]);need(currentPage>=1&&totalPages>=currentPage&&totalPages<=4,'declared page bound')
 need(currentPage!==totalPages||end===total,'last native page count differs')
 const pageRows=all(table,n=>n.tag==='tr'&&cls(n,'data-row'));need(pageRows.length===end-start+1,'observed row count differs')
 const rows=pageRows.map(n=>{const links=all(n,x=>x.tag==='a'&&cls(x,'jobTitle-link'));need(links.length===2&&new Set(links.map(a=>a.attrs.href)).size===1&&new Set(links.map(a=>d.text(a))).size===1,'native responsive role links disagree')
  const sourceUrl=new URL(links[0].attrs.href,ORIGIN).href;need(isRoleURL(sourceUrl),'unreviewed own role URL')
  const value=c=>{const labels=[...new Set(all(n,x=>x.tag==='span'&&cls(x,c)).map(x=>d.text(x)))];return one(labels,'native '+c)}
  const title=d.text(links[0]),location=value('jobLocation'),facility=value('jobFacility'),publishedLabel=value('jobDate');need(title&&location&&facility&&publishedLabel,'blank native role card')
  return {title,sourceUrl,location,facility,publishedLabel,card:tree(n)}
 })
 need(new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'duplicate canonical native role identity')
 const pages=[...new Set(d.nodes(n=>n.tag==='a'&&n.attrs.href?.includes('startrow=')).map(n=>new URL(n.attrs.href,url).href))];need(pages.every(isSearchURL),'unreviewed declared pagination')
 return {head,form,start,end,total,currentPage,totalPages,rows,declaredPages:pages,region:tree(table),visibilityContract:visible.contract}
}
export function readRole(html,row){
 const {d,root,head}=document(html);need(equivalent(head.titles,[row.title+' Job Details | Novo Nordisk']),'own title/employer mismatch')
 need(!head.metas.some(m=>/country|location|worksite|geo[.:]/i.test([m.name,m.property,m.itemprop].filter(Boolean).join(' '))),'new geographic head metadata requires review')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical role URL').attrs.href;need(canonical===row.sourceUrl,'canonical role identity mismatch')
 const shell=one(d.nodes(n=>cls(n,'jobDisplayShell')),'complete own role shell'),visible=visibility(html,d,root);scoped(d,root,shell,visible.d)
 need(Object.hasOwn(shell.attrs,'itemscope')&&!shell.attrs.itemtype,'native role schema changed')
 const values={};for(const n of all(shell,n=>n.attrs['data-careersite-propertyid'])){const k=n.attrs['data-careersite-propertyid'];need(!Object.hasOwn(values,k),'duplicate own '+k);values[k]=d.text(n)}
 need(equivalent(Object.keys(values).sort(),['description','facility','location','title']),'own native property set changed')
 need(values.title===row.title&&values.location===row.location&&values.facility===row.facility,'listing and own metadata disagree')
 const h1=all(shell,n=>n.tag==='h1').map(n=>d.text(n));need(equivalent(h1,[row.title]),'own visible title mismatch')
 const desc=one(all(shell,n=>n.attrs['data-careersite-propertyid']==='description'),'whole native description');need(values.description.length>=750,'full role requirements missing')
 const blocks=all(desc,n=>['p','li','div'].includes(n.tag)&&!all(n,c=>c!==n&&['p','li','div'].includes(c.tag)).length).map(n=>d.text(n)).filter(Boolean)
 const publicPageID=new URL(canonical).pathname.match(/\/(\d+)\/$/)[1],links=all(shell,n=>n.tag==='a'),apply='/talentcommunity/apply/'+publicPageID+'/?locale=en_GB'
 need(links.length===2&&links.every(n=>d.text(n)==='Apply now »'&&n.attrs.href===apply),'declared application identity changed')
 const headingBlocks=blocks.slice(0,3),witnesses=headingBlocks.filter(t=>/\b(?:Company\s*[:–-]\s*Novo(?: Nordisk)?[,]?\s*Global Business Services|Novo Nordisk Global Business Services|(?:Department|Location)\s*[:–-][^.]*\bGlobal Business Services)\b/i.test(t))
 const shellBlocks=all(shell,n=>['p','li','div'].includes(n.tag)&&!all(n,c=>c!==n&&['p','li','div'].includes(c.tag)).length).map(n=>d.text(n)).filter(Boolean)
 const employerDeclarations=shellBlocks.flatMap(t=>{const labels=[...t.matchAll(/\b(?:Company|Employer|Organization|Business Area)(?:\s*:|\s+[–-]\s+)/gi)];return labels.map((m,i)=>t.slice(m.index,labels[i+1]?.index??t.length))})
 const employerScopeConflicts=employerDeclarations.filter(t=>!/(?:Company|Employer|Organization|Business Area)(?:\s*:\s*|\s+[–-]\s+)Novo(?: Nordisk)?[,]?\s*Global Business Services\b/i.test(t))
 const gbs=witnesses.length>0&&!employerScopeConflicts.length,geographicDeclarations=all(shell,n=>Object.entries(n.attrs).some(([k,v])=>/^(?:data-|job|work|address)/i.test(k)&&/country|region|location|worksite|address/i.test(k)&&k!=='data-careersite-propertyid'||k==='itemprop'&&/country|location|worksite|address/i.test(v))).map(tree)
 return {canonical,publicPageID,head,fields:values,blocks,headingBlocks,gbs,gbsWitnesses:witnesses,employerDeclarations,employerScopeConflicts,geographicDeclarations,criteriaText:d.text(shell),region:tree(shell),visibilityContract:visible.contract,applicationURL:new URL(apply,ORIGIN).href}
}
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
function dateLabel(day,month,year){const i=MONTHS.indexOf(month.slice(0,3).toLowerCase()),value=year+'-'+String(i+1).padStart(2,'0')+'-'+day.padStart(2,'0');need(i>=0&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value,'invalid deadline calendar');return value}
export function roleDeadline(role,clock){
 const dates=[...role.criteriaText.matchAll(/\b(?:Deadline\s*:?\s*|apply\b[^!?]{0,220}?\bby\s+)(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})\b/gi)].map(m=>({label:m[0],calendar:dateLabel(m[1],m[2],m[3])}))
 need(new Set(dates.map(d=>d.calendar)).size<=1,'ambiguous published deadlines');need(!/\bDeadline\b/i.test(role.criteriaText)||dates.length,'unreadable published deadline')
 return {declarations:dates,calendar:dates[0]?.calendar??null,timezone:null,expired:dates.length>0&&dates[0].calendar<clock.slice(0,10),applicationsOpenVerified:false}
}
export function countryProof(role){
 const own=role.blocks.filter(t=>/\bLocation\s*[:–-]\s*(?:Bangalore|Bengaluru),\s*(?:Novo Nordisk Global Business Services\s*\(GBS\),\s*)?India\b/i.test(t))
 const unit=role.blocks.filter(t=>/\bGBS unit (?:is )?in Bengaluru, India\b/i.test(t)&&(/\bYou will join\b/i.test(t)||/\bAbout the department\b/i.test(t)&&/\bwithin our Global Business Services \(GBS\) unit\b/i.test(role.fields.description)))
 const proofs=[...new Set([...own,...unit])]
 // HQ and partner locations remain intact in the description. They do not
 // prove this role's country; added mandatory/alternative workplaces do not
 // silently inherit the India workplace either.
 const workplaceClauses=[...role.criteriaText.matchAll(/\b(?:Location\s*[:–-]\s*|(?:based|located|stationed|deployed|assigned)\s+(?:in|at|to)\s+|relocat\w*\s+(?:to|in)\s+)([^.!?;\n]{1,180})/gi)].map(m=>m[1])
 const foreign=t=>{const words=t.match(/[A-Za-z]+/g)||[];for(let i=0;i<words.length;i++)for(let n=1;n<=6&&i+n<=words.length;n++){const label=words.slice(i,i+n).join(' ');if(label.length<4)continue;const country=nativeCountryName(label);if(country&&country!=='India')return true}return false}
 const unclear=workplaceClauses.filter(t=>!/\b(?:Bangalore|Bengaluru)\b/.test(t)||foreign(t)||/\b(?:or|alternatively|either|relocat\w*)\b/i.test(t))
 const countryDeclarations=[...role.criteriaText.matchAll(/\b(?:(?:job|work|worksite)\s+)?(?:country|region)(?:\s*:\s*|\s+[–-]\s+)([^.!?;\n]{1,100})/gi)].map(m=>m[1])
 const countryConflicts=countryDeclarations.filter(t=>!/^India(?:\s*$|[.,;])/i.test(t))
 const conflicting=/\b(?:overseas assignment|mandatory international relocation|work from anywhere|global remote)\b/i.test(role.criteriaText)||role.geographicDeclarations.length>0||unclear.length>0||countryConflicts.length>0
 return {country:role.gbs&&proofs.length&&!conflicting?'India':null,method:'own-description-explicit-workplace-or-role-owned-gbs-unit',literalCountryLabel:'India',proofParagraphs:proofs,unknownWorkplaceClauses:unclear,countryDeclarations,countryConflicts,conflicting,queryIsCountryProof:false,cityIsCountryProof:false,terminalINIsCountryProof:false}
}
export function makeJob(row,role,publisher,listings,clock){
 const proof=countryProof(role),country=proof.country,deadline=roleDeadline(role,clock),city=country?role.fields.location.split(',')[0].trim():null,state=country?role.fields.location.split(',')[1]?.trim()||null:null
 return {source:SOURCE,company:'Novo Nordisk Global Business Services',title:row.title,jobId:null,requisitionId:null,nativePublicPageID:role.publicPageID,nativeCanonicalRoleURL:role.canonical,
  sourceUrl:role.canonical,link:role.applicationURL,applyUrl:role.applicationURL,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,nativeApplicationsOpen:null,
  nativeApplicationHandoff:{kind:'unvisited-native-rmk-application',url:role.applicationURL,publicRolePageRead:true,formInteractedWith:false},
  country,city,state,location:country?[city,state,'India'].filter(Boolean).join(', '):null,nativeLocationLabel:role.fields.location,
  employmentType:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,numberOfOpenings:null,remoteStatus:null,nativeTeam:role.fields.facility,
  postingDate:null,postedAt:null,nativeListingPublishedLabel:row.publishedLabel,publicationTimezone:null,firstEverPublication:null,closingDate:null,nativeClosingCalendar:deadline.calendar,nativeDeadline:deadline,
  nativeHiringOrganization:{name:'Novo Nordisk Global Business Services',kind:'own-description-gbs-company-department-or-location',witnesses:structuredClone(role.gbsWitnesses)},legalEmployer:null,
  jobDescription:role.criteriaText,sourceDescription:role.criteriaText,nativeJobDescription:role.fields.description,
  nativeSourceRecord:{listing:structuredClone(row),role:structuredClone(role),publisher:structuredClone(publisher),indiaListings:structuredClone(listings)},
  nativeRoleClosingReconciled:false,sourceNativeCriteriaContainerRetained:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:country?'native-closing-unreconciled':'native-country-unproven',sourceCountryScopeUnresolved:!country,
  sourceWorksiteCountryProof:country?{...structuredClone(proof),roleURL:role.canonical}:null,sourceNativeCountryContext:proof,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
