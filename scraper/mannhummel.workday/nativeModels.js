import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='mannhummel',CAREERS='https://www.mann-hummel.com/en/career.html',ORIGIN='https://careers.mann-hummel.com',BOARD=ORIGIN+'/search/?locale=en_US'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('Mann+Hummel native: '+m),{abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex'),equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c),clean=v=>String(v??'').replace(/\s+/g,' ').trim()
const all=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>all(c,p))]
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
export const isRoleURL=v=>{try{const u=new URL(v);return u.origin===ORIGIN&&!u.username&&!u.password&&!u.port&&!u.search&&!u.hash&&/^\/job\/[^/]+\/\d+\/$/.test(u.pathname)}catch{return false}}
export const SEARCH=ORIGIN+'/search/?createNewAlert=false&q=India'
const document=(html,{corporate=false}={})=>{need(typeof html==='string','original HTML required');const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document');need(!all(root,n=>n.tag==='base').length,'unreviewed base URL');const schemas=all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json');need(corporate||!schemas.length,'new structured metadata requires review');return {d,root,head:activeHead(html),schemas}}
function visibility(html,d,root){
 const script=one(d.nodes(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript'),'anti-framing program');need(equivalent(script.attrs,{type:'text/javascript',id:'antiClickJackScript'})&&hash(script.raw)==='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433','anti-framing program changed')
 need(all(root,n=>n.tag==='style'&&n.attrs.id==='antiClickjack').length===1,'one anti-framing stylesheet required')
 const markup=one([...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)].map(m=>m[0]).filter(s=>hash(s)==='70a0797622bbbbd8e8cd97f4795bcc45216742606e0b315dd513ba99881648aa'),'reviewed anti-framing stylesheet')
 return {d:readVisibleNativeDocument(html.replace(markup,''),{strict:true}),contract:{method:'declared-top-level-anti-framing-stylesheet-removal',styleMarkupSHA256:hash(markup),scriptSHA256:hash(script.raw),publisherCodeExecuted:false,otherHidingRulesIgnored:false}}
}
const textWithoutLinks=(n,{active=true,omitLinks=false}={})=>typeof n==='string'?decodeNativeEntities(n):active&&n.inert||['script','style'].includes(n.tag)||omitLinks&&n.tag==='a'?'':n.children.map(c=>textWithoutLinks(c,{active,omitLinks})).join(' ')
function scoped(d,n,v,{role=false}={}){
 const mapFallback=x=>role&&x.tag==='noscript'&&equivalent(x.attrs,{})&&x.raw==='\n            <p>Please enable JavaScript</p>\n        '
 need(!all(n,x=>['template','noscript','iframe','object','embed','form','svg','img','textarea','xmp','noembed','noframes','plaintext'].includes(x.tag)&&!mapFallback(x)).length,'delegated or inactive native criteria require review')
 need(clean(textWithoutLinks(n,{active:false}))===clean(textWithoutLinks(n)),'hidden native criteria require review')
 const settings={omitLinks:role}
 const other=one(v.nodes(x=>x.tag===n.tag&&(n.attrs.id?x.attrs.id===n.attrs.id:cls(x,'jobDisplayShell'))),'stylesheet-visible native region')
 need(clean(textWithoutLinks(n,settings))===clean(textWithoutLinks(other,settings)),'stylesheet-hidden native criteria require review')
}
export function readCorporate(html){
 const {d,head,schemas}=document(html,{corporate:true});need(equivalent(head.titles,['Careers at MANN+HUMMEL: Open positions']),'corporate identity changed')
 const navigationSchemas=schemas.map(n=>{let data;try{data=JSON.parse(n.raw)}catch{need(false,'unreadable corporate navigation schema')}
  need(data['@context']==='https://schema.org'&&data['@type']==='ItemList'&&equivalent(Object.keys(data).sort(),['@context','@type','itemListElement'])&&Array.isArray(data.itemListElement)&&data.itemListElement.length<=20,'unreviewed corporate schema')
  for(const item of data.itemListElement)need(item['@type']==='ListItem'&&equivalent(Object.keys(item).sort(),['@type','image','name','position','url'])&&typeof item.url==='string'&&item.url.startsWith('https://www.mann-hummel.com/en/career/'),'unreviewed corporate navigation item')
  return data})
 const links=d.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith(ORIGIN+'/search/'));need(links.length===3&&links.every(n=>n.attrs.href===BOARD),'corporate public board handoff changed')
 for(const n of links){let layer;try{layer=JSON.parse(n.attrs['data-cmp-data-layer'])}catch{need(false,'corporate link analytics contract changed')}const keys=Object.keys(layer);need(keys.length===1&&/^link-[a-f0-9]{10}$/.test(keys[0])&&layer[keys[0]]['xdm:linkURL']===BOARD&&(!n.attrs.id||n.attrs.id===keys[0]),'corporate link analytics identity changed')}
 need(links.some(n=>d.text(n)==='SEE OPEN POSITIONS'),'native open positions declaration missing')
 return {title:head.titles[0],board:BOARD,declaredLinks:links.map(tree),navigationSchemas,companyBrand:'MANN+HUMMEL'}
}
function searchForm(d){
 const n=one(d.nodes(n=>n.tag==='form'&&n.attrs.name==='keywordsearch'),'public keyword search form');need(n.attrs.method==='get'&&n.attrs.action==='/search/','public GET form changed')
 const alert=one(d.nodes(x=>x.tag==='input'&&x.attrs.name==='createNewAlert',n),'disabled alert field');need(alert.attrs.type==='hidden'&&alert.attrs.value==='false','non-creating search declaration changed')
 one(d.nodes(x=>x.tag==='input'&&x.attrs.type==='text'&&x.attrs.name==='q',n),'keyword field')
 const u=new URL(n.attrs.action,ORIGIN);u.searchParams.set('createNewAlert','false');u.searchParams.set('q','India');return {method:'GET',action:n.attrs.action,keywordParameter:'q',createNewAlert:false,derivedURL:u.href,queryIsCountryProof:false}
}
export function readBoard(html){const {d,head}=document(html);need(equivalent(head.titles,['Mann+Hummel GmbH Jobs']),'public board identity changed');return {title:head.titles[0],form:searchForm(d)}}
export function readListing(html){
 const {d,root,head}=document(html);need(equivalent(head.titles,['India - Mann+Hummel GmbH Jobs']),'search publisher identity changed');const form=searchForm(d),list=one(d.nodes(n=>n.attrs.id==='job-tile-list'),'whole native tile list'),visible=visibility(html,d,root);scoped(d,list,visible.d)
 const label=d.text(one(d.nodes(n=>n.attrs.id==='tile-search-results-label'),'native count label')),m=/^Showing 1 to (\d+) of (\d+) Jobs$/.exec(label);need(m&&Number(m[1])===Number(m[2]),'additional pages require review')
 const cards=all(list,n=>n.tag==='li'&&cls(n,'job-tile')),total=Number(m[2]);need(total>0&&total<=25&&cards.length===total&&list.attrs['data-record-returned']===String(total)&&list.attrs['data-per-page']==='25','native tile count bound/reconciliation failed')
 need(!d.nodes(n=>n.tag==='a'&&n.attrs.href?.includes('startrow')).length,'new native pagination requires review')
 const rows=cards.map((card,index)=>{need(card.attrs['data-row-index']===String(index+1)&&(card.attrs.class.match(/\bjob-row-index-\d+\b/g)||[]).join('')==='job-row-index-'+(index+1),'native result rank declaration changed');const links=all(card,n=>n.tag==='a'&&cls(n,'jobTitle-link'));need(links.length===3&&new Set(links.map(n=>n.attrs.href)).size===1&&new Set(links.map(n=>d.text(n))).size===1,'responsive role declarations disagree')
  const sourceUrl=new URL(links[0].attrs.href,ORIGIN).href;need(isRoleURL(sourceUrl)&&card.attrs['data-url']===links[0].attrs.href,'canonical native tile identity changed')
  const title=d.text(links[0]),id=new URL(sourceUrl).pathname.match(/\/(\d+)\/$/)[1],fields={}
  for(const [field,label]of [['city','City'],['country','Country/Region'],['customfield1','Job Area'],['customfield2','Job Level']]){
   const cells=all(card,n=>cls(n,'section-field')&&cls(n,field));need(field==='city'?cells.length===0||cells.length===3:cells.length===3,'responsive '+field+' field count changed')
   const values=cells.map(cell=>{need(cell.attrs.id?.startsWith('job-'+id+'-'),'native field ownership changed');const caption=one(all(cell,n=>n.attrs.id===cell.attrs.id+'-label'),'native field label'),value=one(all(cell,n=>n.attrs.id===cell.attrs.id+'-value'),'native field value');need(d.text(caption)===label&&caption.attrs['aria-describedby']===value.attrs.id,'native '+field+' semantics changed');return d.text(value)})
   need(new Set(values).size<=1,'responsive '+field+' values disagree');fields[field]=values[0]??''
  }
  return {title,sourceUrl,publicPageID:id,fields,card:tree(card)}
 })
 need(new Set(rows.map(r=>r.sourceUrl)).size===rows.length&&new Set(rows.map(r=>r.publicPageID)).size===rows.length,'duplicate canonical native role identity')
 return {title:head.titles[0],form,observedCount:total,observedCountIsCompanyTotal:false,countLabel:label,rows,region:tree(list),visibilityContract:visible.contract}
}
// Preserve both complete models. Only validated display ranks and the outer
// analytics link key vary without changing role or handoff semantics.
const comparisonCard=card=>{const copy=structuredClone(card);delete copy.attrs['data-row-index'];copy.attrs.class=copy.attrs.class.replace(/\bjob-row-index-\d+\b/g,'job-row-index-<DISPLAY-RANK>');return copy}
export const comparisonRow=row=>({...row,card:comparisonCard(row.card)})
export function comparisonContext({corporate,board,listing}){
 const links=corporate.declaredLinks.map(link=>{const copy=structuredClone(link),layer=JSON.parse(copy.attrs['data-cmp-data-layer']);if(copy.attrs.id)copy.attrs.id='<NATIVE-ANALYTICS-LINK-ID>';copy.attrs['data-cmp-data-layer']=JSON.stringify({'<NATIVE-ANALYTICS-LINK-ID>':Object.values(layer)[0]});return copy})
 const cards=listing.region.children.filter(n=>typeof n!=='string'&&n.tag==='li'&&cls(n,'job-tile')).map(comparisonCard).sort((a,b)=>a.attrs['data-url'].localeCompare(b.attrs['data-url']))
 const layout=listing.region.children.filter(n=>typeof n==='string'||n.tag!=='li'||!cls(n,'job-tile'))
 return {corporate:{...corporate,declaredLinks:links},board,listing:{...listing,rows:listing.rows.map(comparisonRow).sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl)),region:{...listing.region,children:{cards,layout}}}}
}
function programs(d,shell,row){
 const scripts=all(shell,n=>n.tag==='script');need(scripts.length===3,'unreviewed own render program count')
 const result=scripts.map(n=>{need(!n.attrs.src,'delegated own role program requires review');const direct=hash(n.raw)
  if(direct==='4e7638dca6908a3c812b035c90e173e80c1d916f1b3bb01994ec416480b7548c'){need(equivalent(n.attrs,{}),'metadata renderer attributes changed');return {kind:'declared-metadata-row-and-sticky-header',sha256:direct,executed:false}}
  if(direct==='b12ad01f77fb237acb6c2ba616633064d8409e95e78260351a6156baee8c74ba'){need(equivalent(n.attrs,{type:'text/javascript'}),'map program attributes changed');return {kind:'unvisited-worldwide-jobs-map-url',sha256:direct,executed:false}}
  let ast;try{ast=parse(n.raw,{ecmaVersion:'latest'})}catch{need(false,'unreadable own renderer')}
  const declaration=ast.body[0]?.declarations?.[0],literal=declaration?.init;need(declaration?.id?.name==='href'&&literal?.type==='Literal'&&typeof literal.value==='string','unreviewed own renderer')
  const digest=hash(n.raw.slice(0,literal.start)+'<OWN_ROLE_URL>'+n.raw.slice(literal.end));need(digest==='f7f0b5c4911a9b5e2ac57d281419b0b0251a2bde8b3a5e3b57111796452612d6'&&equivalent(n.attrs,{type:'text/javascript'}),'map bootstrap changed')
  const ref=new URL(literal.value);need(ref.protocol==='http:'&&ref.host==='careers.mann-hummel.com'&&!ref.search&&!ref.hash,'native map parent reference changed');const canonical=new URL(row.sourceUrl);need(equivalent(ref.pathname.split('/').map(decodeURIComponent),canonical.pathname.split('/').map(decodeURIComponent)),'map reference belongs to another role')
  return {kind:'unvisited-worldwide-jobs-map-render',normalizedProgramSHA256:digest,parentRoleLiteral:literal.value,executed:false,mapVisited:false}
 });need(new Set(result.map(r=>r.kind)).size===3,'ambiguous own render programs');return result
}
export function readRole(html,row){
 const {d,root,head}=document(html);need(equivalent(head.titles,[row.title+' Job Details | Mann+Hummel GmbH']),'own title/brand mismatch')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'own canonical').attrs.href;need(canonical===row.sourceUrl,'canonical role identity mismatch')
 const shell=one(d.nodes(n=>cls(n,'jobDisplayShell')),'whole own role shell');need(shell.attrs.itemscope==='itemscope'&&shell.attrs.itemtype==='http://schema.org/JobPosting'&&all(root,n=>/JobPosting/i.test(n.attrs.itemtype||'')).length===1,'one own typed JobPosting required')
 const nativePrograms=programs(d,shell,row),links=all(shell,n=>n.tag==='a'),apply='/talentcommunity/apply/'+row.publicPageID+'/?locale=en_US'
 need(links.length===4&&links.filter(n=>n.attrs.href===apply&&d.text(n)==='APPLY').length===2&&links.filter(n=>n.attrs.href==='/search/'&&d.text(n)==='Follow this link to reach our Job Search page to search for available jobs in a more accessible format.').length===1&&links.filter(n=>n.attrs.href==='https://mann-hummel-careers.com/search/?locale=en_US'&&d.text(n)==='VIEW ALL JOBS').length===1,'native application/navigation declarations changed')
 const visible=visibility(html,d,root);scoped(d,shell,visible.d,{role:true})
 const values={};for(const n of all(shell,n=>n.attrs['data-careersite-propertyid'])){const k=n.attrs['data-careersite-propertyid'];(values[k]??=[]).push(d.text(n))}
 need(equivalent(Object.keys(values).sort(),['city','country','customfield1','customfield2','description','shifttype','title']),'native property set changed')
 const fields={};for(const [k,v]of Object.entries(values)){need(k==='title'?v.length===2&&new Set(v).size===1:v.length===1,'ambiguous own '+k);fields[k]=v[0]}
 need(fields.title===row.title&&fields.city===row.fields.city&&fields.customfield1===row.fields.customfield1&&fields.customfield2===row.fields.customfield2,'listing and own native metadata disagree');need(fields.description.length>=750,'complete criteria missing')
 const metas=all(shell,n=>n.tag==='meta'&&n.attrs.itemprop),metadata={};need(metas.length===4,'new typed native metadata requires review')
 for(const n of metas){const k=n.attrs.itemprop;need(['streetAddress','datePosted','validThrough','hiringOrganization'].includes(k)&&!Object.hasOwn(metadata,k)&&typeof n.attrs.content==='string','unreviewed own typed metadata');metadata[k]=n.attrs.content}
 need(metadata.hiringOrganization==='Mann+Hummel GmbH','native employer mismatch')
 const metaOutside=all(root,n=>n.tag==='meta'&&!metas.includes(n)&&(n.attrs.itemprop||['name','property'].some(k=>/country|region|location|worksite|geo[.:]/i.test(n.attrs[k]||''))));need(!metaOutside.length,'unreviewed outside typed/geographic metadata')
 const location=one(all(shell,n=>n.attrs.itemprop==='jobLocation'&&n.attrs.itemtype==='http://schema.org/Place'),'own native location'),address=one(all(location,n=>n.attrs.itemprop==='address'&&n.attrs.itemtype==='http://schema.org/PostalAddress'),'own native address')
 need(all(address,n=>n.tag==='meta'&&n.attrs.itemprop==='streetAddress').length===1,'native address ownership changed')
 const knownGeography=new Set([location,address,...metas])
 const extraGeography=all(shell,n=>Object.entries(n.attrs).some(([k,v])=>/country|region|location|worksite|address/i.test(k)&&k!=='data-careersite-propertyid'||k==='itemprop'&&/country|region|location|worksite|address/i.test(v)&&!knownGeography.has(n))).map(tree)
 const description=one(all(shell,n=>n.attrs['data-careersite-propertyid']==='description'),'native description'),criteriaText=d.text(shell)
 return {canonical,publicPageID:row.publicPageID,head,fields,metadata,criteriaText,descriptionRegion:tree(description),region:tree(shell),programs:nativePrograms,extraGeography,applicationURL:new URL(apply,ORIGIN).href,navigationLinks:links.filter(n=>n.attrs.href!==apply).map(tree),visibilityContract:visible.contract}
}
export function utcInstant(label){
 const m=/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{2}) (\d{2}):(\d{2}):(\d{2}) UTC (\d{4})$/.exec(label);need(m,'native UTC timestamp changed')
 const value=Date.UTC(Number(m[7]),['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(m[2]),Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6])),date=new Date(value)
 need(date.getUTCFullYear()===Number(m[7])&&date.getUTCDate()===Number(m[3])&&date.getUTCHours()===Number(m[4])&&date.getUTCMinutes()===Number(m[5])&&date.getUTCSeconds()===Number(m[6])&&['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][date.getUTCDay()]===m[1],'invalid native UTC timestamp');return date.toISOString()
}
export function makeJob(row,role,corporate,board,listing,clock){
 const declaredCountries=[...role.criteriaText.matchAll(/\b(?:(?:job|work|worksite)\s+)?(?:country|region)(?:\s*:\s*|\s+[–-]\s+)([^.!?;\n]{1,100})/gi)].map(m=>m[1])
 const placementContext=role.criteriaText.split(row.title).join(' ')
 const placementClauses=[...placementContext.matchAll(/\b(?:Location\s*[:–-]\s*|(?:based|located|stationed|deployed|assigned)\s+(?:in|at|to)\s+|relocat\w*\s+(?:to|in)\s+)([^.!?;\n]{1,200})/gi)].map(m=>m[1])
 const sameWorkplace=s=>s.includes('MANN+HUMMEL India (MHIN) location in Bangalore')||role.fields.city&&[role.fields.city,role.fields.city+',',role.fields.city+' '].some((v,i)=>i===0?s===v:s.startsWith(v))
 const foreign=s=>{const words=s.match(/[A-Za-z]+/g)||[];for(let i=0;i<words.length;i++)for(let n=1;n<=6&&i+n<=words.length;n++){const label=words.slice(i,i+n).join(' ');if(label.length<4&&!/^[A-Z]{2,3}$/.test(label))continue;const country=nativeCountryName(label)||({USA:'United States',UAE:'United Arab Emirates'})[label];if(country&&country!=='India')return true}return false}
 const unknownPlacements=placementClauses.filter(s=>!sameWorkplace(s)||foreign(s)||/\b(?:or|alternatively|either|relocat\w*)\b/i.test(s)),countryConflict=declaredCountries.some(s=>!/^India\s*$/.test(s))
 const employerClauses=[...role.criteriaText.matchAll(/\b(?:Company|Employer|Organization)(?:\s*:\s*|\s+[–-]\s+)/gi)]
 need(!employerClauses.length,'additional own employer declaration requires review')
 const street=role.metadata.streetAddress,expectedStreet=role.fields.city?new RegExp('^'+role.fields.city.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+', '+role.fields.country+', \\d{6}$').test(street):street===role.fields.country
 const titlePlacements=[...row.title.matchAll(/\b(?:Location\s*[-–:]\s*|(?:based|located|stationed|deployed|assigned)\s+(?:in|at|to)\s+|relocat\w*\s+(?:to|in)\s+)([^)]*)/gi)].map(m=>m[1]),titlePlacement=titlePlacements[0]??null,titleCountryConflict=titlePlacements.some(foreign)
 const country=role.fields.country==='IN'&&row.fields.country==='IN'&&nativeCountryName(role.fields.country)==='India'&&expectedStreet&&!role.extraGeography.length&&!unknownPlacements.length&&!countryConflict&&!titleCountryConflict?'India':null
 const nativeCity=role.fields.city,city=country&&nativeCity&&!titlePlacement&&!/^(?:Haryana|India|IN)$/i.test(nativeCity)?nativeCity:null
 const posted=utcInstant(role.metadata.datePosted),validThrough=utcInstant(role.metadata.validThrough);need(posted<=validThrough,'native date interval reversed')
 const deadlineClauses=[...role.criteriaText.matchAll(/\b(?:application\s+deadline\b|closing date\b|apply\s+by\b|deadline\s*:|deadline\s+(?=\d))\s*:?\s*([^.!?;\n]{1,80})/gi)].map(m=>m[1]);need(!deadlineClauses.length,'additional own deadline requires review')
 return {source:SOURCE,company:'Mann+Hummel',title:row.title,jobId:null,requisitionId:null,nativePublicPageID:role.publicPageID,nativeCanonicalRoleURL:role.canonical,sourceUrl:role.canonical,applyUrl:role.applicationURL,link:role.applicationURL,
  country,city,state:null,location:country?(city?city+', India':nativeCity&&!titlePlacement?nativeCity+', India':'India'):null,nativeLocationLabel:nativeCity,nativeCountryLabel:role.fields.country,nativeTitlePlacement:titlePlacement,
  employmentType:null,nativeContractDurationLabel:role.fields.shifttype,nativeJobArea:role.fields.customfield1,nativeJobLevel:role.fields.customfield2,experienceRequired:null,numberOfOpenings:null,remoteStatus:null,
  postingDate:posted,postedAt:posted,closingDate:validThrough,nativeDatePosted:role.metadata.datePosted,nativeValidThrough:role.metadata.validThrough,sourceDatePrecision:'second',publicationTimezone:'UTC',firstEverPublication:null,nativeExpired:validThrough<=clock,
  nativeHiringOrganization:{name:role.metadata.hiringOrganization,kind:'own-typed-JobPosting-hiringOrganization'},legalEmployer:null,jobDescription:role.criteriaText,sourceDescription:role.criteriaText,nativeJobDescription:role.fields.description,
  nativeSourceRecord:{listing:structuredClone(row),role:structuredClone(role),corporate:structuredClone(corporate),board:structuredClone(board),indiaListing:structuredClone(listing)},
  nativeRoleClosingReconciled:false,sourceNativeCriteriaContainerRetained:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:country?'native-closing-unreconciled':'native-country-unproven',sourceCountryScopeUnresolved:!country,
  sourceWorksiteCountryProof:country?{method:'own-rmk-country-property-and-labelled-native-tile',country:'India',nativeCountryCode:'IN',nativeCountryProperty:'country',nativeListingCountryLabel:'Country/Region',typedJobPosting:true,freeStreetAddressIsCountryProof:false,queryIsCountryProof:false,cityIsCountryProof:false,literalEnglishCountryName:false,exactCampusEstablished:false,roleURL:role.canonical}:null,
  sourceNativeCountryContext:{declaredCountries,unknownPlacements,countryConflict,titleCountryConflict,extraGeography:structuredClone(role.extraGeography),nativeStreetAddress:street,streetConsistent:expectedStreet},
  applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,nativeApplicationsOpen:null,nativeApplicationHandoff:{kind:'unvisited-native-rmk-application',url:role.applicationURL,publicRolePageRead:true,formInteractedWith:false},
  sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
