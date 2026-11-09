import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
export const SOURCE='adidas',CAREERS='https://careers.adidas-group.com/',JOBS=CAREERS+'jobs'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('Adidas native: '+m),{abortRetries:true})}
export const hash=v=>createHash('sha256').update(v).digest('hex')
export const equivalent=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const clean=v=>String(v??'').replace(/\s+/g,' ').trim(),cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c)
const all=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>all(c,p))]
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]}
const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const rawText=n=>typeof n==='string'?decodeNativeEntities(n):['script','style'].includes(n.tag)?'':n.children.map(rawText).join(' ')
const local=(v,origin,path)=>{try{const u=new URL(v);return u.origin===origin&&!u.username&&!u.password&&!u.port&&!u.hash&&path(u)}catch{return false}}
export const isRoleURL=v=>local(v,'https://jobs.adidas-group.com',u=>/^\/job\/[^/]+\/\d+\/$/.test(u.pathname)&&(!u.search||u.search==='?feedId=301201&utm_source=j2w'))
export const isClientURL=v=>local(v,'https://careers.adidas-group.com',u=>/^\/build\/js\/external-[a-f0-9]+\.js$/.test(u.pathname)&&!u.search)
export const INDIA=JOBS+'?location='+encodeURIComponent(JSON.stringify([{country:'India'}]))
const doc=html=>{need(typeof html==='string','original HTML required');const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'document');need(!all(root,n=>n.tag==='base').length,'unreviewed base URL');return {d,root,head:activeHead(html)}}
const scoped=(d,n,visible)=>{
 need(!all(n,x=>['script','style','template','noscript','iframe','object','embed','form','svg','img'].includes(x.tag)).length,'delegated or inactive role content requires review')
 need(clean(rawText(n))===clean(d.text(n)),'hidden role criteria require review')
 const candidate=one(visible.nodes(x=>x.tag===n.tag&&(n.attrs.id?x.attrs.id===n.attrs.id:cls(x,'jobDisplayShell'))),'stylesheet-visible native region')
 need(clean(d.text(n))===clean(visible.text(candidate)),'stylesheet-hidden criteria require review')
}
const noSchema=root=>need(!all(root,n=>n.tag==='script'&&(n.attrs.type||'').trim().toLowerCase()==='application/ld+json').length,'new structured native context requires review')
const literal=(node,depth=0)=>{
 need(node&&depth<30,'literal country data depth')
 if(node.type==='Literal'&&!node.regex&&['string','number','boolean'].includes(typeof node.value))return node.value
 if(node.type==='ArrayExpression'){need(node.elements.length<1000,'literal country data bound');return node.elements.map(n=>literal(n,depth+1))}
 need(node.type==='ObjectExpression','nonliteral country options');const result={}
 for(const p of node.properties){need(p.type==='Property'&&!p.computed&&!p.method&&p.kind==='init','nonliteral country property');const key=p.key.value??p.key.name;need(typeof key==='string'&&!['__proto__','constructor','prototype'].includes(key)&&!Object.hasOwn(result,key),'ambiguous country property');result[key]=literal(p.value,depth+1)}return result
}
const countryOptions=d=>{
 const declarations=[]
 for(const s of d.nodes(n=>n.tag==='script'&&!n.attrs.src&&/^(?:|(?:text|application)\/(?:java|ecma)script)$/i.test((n.attrs.type||'').trim()))){let ast;try{ast=parse(s.raw||'',{ecmaVersion:'latest'})}catch{continue}
  for(const statement of ast.body)if(statement.type==='VariableDeclaration')for(const declaration of statement.declarations)if(declaration.id.type==='Identifier'&&declaration.id.name==='locationswithregion')declarations.push(literal(declaration.init))}
 return one(declarations,'active top-level literal location declaration')
}
const roleVisibility=(html,d,root)=>{
 // This exact, reviewed anti-framing program removes only this stylesheet in
 // a top-level document. Interpret that declared render contract as data;
 // never execute the publisher's script or ignore any other hiding rules.
 const script=one(d.nodes(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript'),'declared anti-framing program')
 need(equivalent(script.attrs,{type:'text/javascript',id:'antiClickJackScript'})&&hash(script.raw)==='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433','anti-framing render program changed')
 need(all(root,n=>n.tag==='style'&&n.attrs.id==='antiClickjack').length===1,'one anti-framing stylesheet required')
 const styles=[...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi)].map(m=>m[0]).filter(s=>hash(s)==='70a0797622bbbbd8e8cd97f4795bcc45216742606e0b315dd513ba99881648aa')
 const markup=one(styles,'reviewed anti-framing stylesheet')
 return {document:readVisibleNativeDocument(html.replace(markup,''),{strict:true}),contract:{method:'declared-top-level-anti-framing-stylesheet-removal',styleMarkupSHA256:hash(markup),scriptSHA256:hash(script.raw),publisherCodeExecuted:false,otherHidingRulesIgnored:false}}
}
function form(d,id){const n=one(d.nodes(n=>n.tag==='form'&&n.attrs.id===id),'declared public search form');need(n.attrs.action==='/jobs'&&n.attrs.method?.toUpperCase()==='GET','declared GET search changed');need(d.nodes(n=>n.tag==='input'&&n.attrs.name==='location',n).length===1,'location parameter missing');return {action:n.attrs.action,method:'GET',locationParameter:'location'}}
export function readPublisher(html,{index=false}={}){
 const {d,root,head}=doc(html);need(head.titles.length===1&&/^adidas Careers .+Through sport, we have the power to change lives\./.test(head.titles[0]),'publisher brand identity changed');noSchema(root)
 const search=form(d,index?'search__form':'content__section-search__form')
 const client=one(d.nodes(n=>n.tag==='script'&&isClientURL(n.attrs.src)),'declared search client').attrs.src
 let nativeIndiaOption=null
 if(index){const locations=countryOptions(d);need(locations['Asia Pacific']?.countries?.includes('India')&&locations['Asia Pacific']?.country?.India?.country==='India','India option not declared');nativeIndiaOption=structuredClone(locations['Asia Pacific'].country.India)}
 return {title:head.titles[0],search,client,indiaOption:index?'India':null,nativeIndiaOption}
}
export function readClient(text){
 const digest=hash(text);need(digest==='dc373f5276ad3993f27a409f0e008d2f3dffb2b9fadfb273c50c91834b6157f0','declared search program changed; review required')
 need(text.includes('window.ac.jobSearchForm.find("input#location").val(JSON.stringify(t))')&&text.includes('$.getJSON("/jobs",window.getFilterOptions()'),'native GET encoding unavailable')
 return {sha256:digest,executed:false,method:'GET',action:'/jobs',locationParameter:'location',locationValue:JSON.stringify([{country:'India'}]),derivedURL:INDIA}
}
export function readListing(html){
 const {d,root,head}=doc(html);noSchema(root);need(head.titles.length===1&&head.titles[0].startsWith('adidas Careers '),'listing brand identity missing')
 form(d,'search__form');const grid=one(d.nodes(n=>n.tag==='ul'&&n.attrs.id==='jobs'),'whole native jobs grid');scoped(d,grid,readVisibleNativeDocument(html,{strict:true}))
 const items=all(grid,n=>n.tag==='li'&&cls(n,'job-list__job'));need(items.length>0&&items.length<=20,'native row/page bound')
 const countLabel=one(d.nodes(n=>n.attrs.id==='search-result__count-number'),'observed search count').attrs['data-count-to']
 need(/^\d+$/.test(countLabel)&&Number(countLabel)===items.length,'additional pages require review')
 const more=one(d.nodes(n=>n.attrs.id==='search-result__load-more'),'load more state');need(cls(more,'is-invisible'),'additional declared pages require review')
 const rows=items.map(n=>{const a=one(all(n,x=>x.tag==='a'),'native role link');need(isRoleURL(a.attrs.href)&&cls(a,'job-list__brand--adidas'),'native own Adidas role link missing')
  const title=d.text(one(all(n,x=>x.tag==='h3'&&cls(x,'job-list__title')),'listing title')),facts=d.text(one(all(n,x=>cls(x,'job-list__facts')),'listing location/team'))
  const numberDate=d.text(one(all(n,x=>cls(x,'number-and-date')),'native date/number'));need(title&&facts&&numberDate,'blank native row')
  const location=/^(.+), ([^|]+) \| (.+)$/.exec(facts);need(location,'native location/country/team labels changed')
  const u=new URL(a.attrs.href);u.search='';return {title,requestedURL:a.attrs.href,sourceUrl:u.href,facts,locationLabel:location[1],countryLabel:location[2],teamLabel:location[3],numberDate,card:tree(n)}})
 need(new Set(rows.map(r=>r.sourceUrl)).size===rows.length,'duplicate canonical native role identity')
 return {title:head.titles[0],observedCount:Number(countLabel),observedCountIsCompanyTotal:false,rows}
}
export function readRole(html,row){
 const {d,root,head}=doc(html);noSchema(root)
 need(!head.metas.some(m=>/country|location|worksite|geo[.:]/i.test([m.name,m.property,m.itemprop].filter(Boolean).join(' '))),'new geographic head metadata requires review')
 need(equivalent(head.titles,[row.title+' Job Details | adidas']),'own role title/employer mismatch')
 const canonical=one(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical'),'canonical role URL').attrs.href;need(canonical===row.sourceUrl,'canonical role identity mismatch')
 const shell=one(d.nodes(n=>cls(n,'jobDisplayShell')),'native role shell'),visibility=roleVisibility(html,d,root);scoped(d,shell,visibility.document)
 need(Object.hasOwn(shell.attrs,'itemscope')&&!shell.attrs.itemtype,'native RMK role shape changed')
 const values={};for(const n of all(shell,n=>n.attrs['data-careersite-propertyid'])){const k=n.attrs['data-careersite-propertyid'];(values[k]??=[]).push(d.text(n))}
 const expected=['title','description','facility','city','state','country','shifttype','adcode','date'];need(Object.keys(values).every(k=>expected.includes(k)),'new own role metadata requires review')
 const fields={};for(const k of expected){const v=values[k]||[];need(k==='title'?v.length===2&&new Set(v).size===1:v.length===1,'ambiguous native '+k);fields[k]=v[0]}
 const countryNode=one(all(shell,n=>n.attrs['data-careersite-propertyid']==='country'),'own country property'),countryParent=one(all(shell,n=>n.children.includes(countryNode)),'own country property parent')
 need(d.text(one(all(countryParent,n=>cls(n,'joblayouttoken-label')),'own country label'))==='Country/Region:','native country property label changed')
 need(fields.title===row.title&&fields.description.length>=750,'full own role criteria missing or mismatched')
 const headings=all(shell,n=>n.tag==='h1').map(n=>d.text(n));need(equivalent(headings,[row.title,'Job Title: '+row.title]),'visible own role title mismatch')
 const culture=one(all(shell,n=>n.tag==='section'&&cls(n,'box-footer')),'own role brand statement'),diversity=one(all(shell,n=>n.tag==='section'&&cls(n,'box-diversity')),'own role employer statement')
 need(d.text(culture).startsWith('AT ADIDAS WE HAVE A WINNING CULTURE.')&&d.text(diversity).includes('At adidas, we strongly believe')&&d.text(diversity).includes('our employees'),'explicit own role employer witness missing')
 const publicPageID=new URL(canonical).pathname.match(/\/(\d+)\/$/)[1],links=all(shell,n=>n.tag==='a');need(links.length===2&&links.every(n=>d.text(n)==='Apply now »'&&n.attrs.href==='/talentcommunity/apply/'+publicPageID+'/?locale=en_US'),'native application declaration changed')
 need(/^\d+$/.test(fields.adcode),'native Number label missing');need(row.numberDate.endsWith(' - '+fields.adcode),'publisher Number differs from own role')
 const dated=/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2}), (\d{4})$/.exec(fields.date);need(dated,'native Date label changed')
 const calendar=dated[3]+'-'+String(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(dated[1])+1).padStart(2,'0')+'-'+dated[2].padStart(2,'0');need(new Date(calendar+'T00:00:00Z').toISOString().slice(0,10)===calendar,'invalid native calendar date')
 return {canonical,publicPageID,fields,calendarDate:calendar,criteriaText:d.text(shell),region:tree(shell),head,visibilityContract:visibility.contract,nativeEmployerWitness:{name:'adidas',kind:'own-role-brand-and-first-person-employee-statements',culture:d.text(culture),employees:d.text(diversity)},
  applicationURL:new URL(links[0].attrs.href,'https://jobs.adidas-group.com').href,
  geographicDeclarations:all(shell,n=>Object.keys(n.attrs).some(k=>/^data-(?:country|location|worksite)$/i.test(k)||k==='itemprop'&&/country|location|worksite|address/i.test(n.attrs[k]))).map(tree)}
}
const foreignCountries=text=>{const tokens=text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g)||[],found=new Set();for(let i=0;i<tokens.length;i++)for(let n=1;n<=6&&i+n<=tokens.length;n++){const label=tokens.slice(i,i+n).join(' ');if(label.length<4)continue;const country=nativeCountryName(label);if(country&&country!=='India')found.add(country)}return [...found].sort()}
export function makeJob(row,role,publisher,index,client,listing,clock){
 const foreign=foreignCountries(role.criteriaText),broad=/\b(?:overseas|abroad|worldwide|work from anywhere|global remote|relocat\w*\s+(?:to|in)\s+(?!India\b))\b/i.test(role.criteriaText)
 const scopes=[...role.criteriaText.matchAll(/\b(?:(?:(?:job|work)\s+)?location\s*:|(?:based|located|stationed|deployed|assigned)\s+(?:in|at|to))\s*([^.!?\n]{1,180})/gi)].map(m=>m[1])
 const ownLocation=s=>[role.fields.city,'India'].filter(Boolean).some(label=>s===label||s.startsWith(label+' ')||s.startsWith(label+','))
 const uncertainWorkplaces=scopes.filter(s=>!ownLocation(s))
 const listingConsistent=row.countryLabel==='India'&&row.locationLabel===role.fields.city&&row.teamLabel===role.fields.facility
 const country=role.fields.country==='IN'&&listingConsistent&&!foreign.length&&!broad&&!uncertainWorkplaces.length&&!role.geographicDeclarations.length?'India':null
 const nativeCity=role.fields.city,city=country&&nativeCity&&!/^(?:India|IN)$/i.test(nativeCity)?nativeCity:null,state=country&&role.fields.state?role.fields.state:null
 const description=role.criteriaText
 return {source:SOURCE,company:'Adidas',title:row.title,jobId:null,requisitionId:null,nativePublicPageID:role.publicPageID,nativeAdvertisementNumber:role.fields.adcode,nativeCanonicalRoleURL:row.sourceUrl,
  sourceUrl:row.sourceUrl,applyUrl:role.applicationURL,link:role.applicationURL,applicationUrlIsGeneric:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,nativeApplicationsOpen:null,
  nativeApplicationHandoff:{kind:'unvisited-native-rmk-application',url:role.applicationURL,publicRolePageRead:true,formInteractedWith:false},
  country,city,state,location:country?[city,state,'India'].filter(Boolean).join(', '):null,nativeLocationLabel:nativeCity,nativeCountryLabel:role.fields.country,
  employmentType:role.fields.shifttype||null,nativeTeam:role.fields.facility||null,numberOfOpenings:null,experienceRequired:null,minimumQualification:null,preferredQualification:null,remoteStatus:null,
  postingDate:null,postedAt:null,nativeDateCalendar:role.calendarDate,nativeDateLabel:role.fields.date,nativeListingDateLabel:row.numberDate,sourceDatePrecision:'calendar-date',publicationTimezone:null,firstEverPublication:null,closingDate:null,
  nativeHiringOrganization:structuredClone(role.nativeEmployerWitness),legalEmployer:null,jobDescription:description,sourceDescription:description,nativeJobDescription:role.fields.description,
  nativeSourceRecord:{listing:structuredClone(row),role:structuredClone(role),publisher:structuredClone(publisher),index:structuredClone(index),client:structuredClone(client),indiaListing:structuredClone(listing)},
  nativeRoleClosingReconciled:false,sourceNativeCriteriaContainerRetained:true,sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:country?'native-closing-unreconciled':'native-country-unproven',sourceCountryScopeUnresolved:!country,
  sourceWorksiteCountryProof:country?{method:'own-rmk-country-region-label',literalRoleCountry:true,country:'India',nativeCountryLabel:'IN',roleURL:row.sourceUrl,exactCampusEstablished:false,locationLabel:nativeCity}:null,
  sourceNativeCountryContext:{listingConsistent,foreignCountries:foreign,broadWorkplaceScope:broad,uncertainWorkplaces,geographicDeclarations:structuredClone(role.geographicDeclarations)},sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,scrapedAt:clock}
}
