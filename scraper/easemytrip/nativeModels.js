import {createHash} from 'node:crypto'
import {isDeepStrictEqual} from 'node:util'
import {parse} from 'acorn'
import {activeHead,readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const SOURCE='easemytrip',COMPANY='EaseMyTrip',HOME='https://www.easemytrip.com/',CAREERS=HOME+'career.html',CONTACT=HOME+'contact-us.html',ABOUT=HOME+'about-us.html'
export const APPLICATION='https://docs.google.com/forms/d/e/1FAIpQLScn5D94mZ3r3hq7hpv9OQfxmPFWuM6wzq5eWpTx8citbCqWLQ/viewform'
export const need=(v,m)=>{if(!v)throw Object.assign(Error('EaseMyTrip native: '+m),{abortRetries:true})},hash=v=>createHash('sha256').update(v).digest('hex'),equal=isDeepStrictEqual
const one=(rows,label)=>{need(rows.length===1,'one '+label+' required');return rows[0]},cls=(n,c)=>(n.attrs.class||'').split(/\s+/).includes(c),clean=s=>s.replace(/\s+/g,' ').trim()
export const tree=n=>typeof n==='string'?n:{tag:n.tag,attrs:{...n.attrs},children:n.children.map(tree),...(n.raw===undefined?{}:{raw:n.raw})}
const walk=(n,p)=>[...(p(n)?[n]:[]),...n.children.filter(c=>typeof c!=='string').flatMap(c=>walk(c,p))],unhidden=n=>typeof n==='string'?decodeNativeEntities(n):['script','style'].includes(n.tag)?'':n.children.map(unhidden).join(' ')
const semantic=n=>Object.keys(n.attrs).some(k=>/^on|country|region|worksite|location|address/i.test(k)||['itemprop','itemtype','itemscope','property'].includes(k))
function foreign(text){const words=text.match(/[A-Za-z]+/g)||[];for(let i=0;i<words.length;i++)for(let n=1;n<=6&&i+n<=words.length;n++){const value=words.slice(i,i+n).join(' ');if(value.length<4&&!/^(?:US|USA|UK|UAE)$/.test(value))continue;const country=nativeCountryName(value)||({USA:'United States',UAE:'United Arab Emirates'})[value];if(country&&country!=='India')return true}return false}
export function readHome(html){
 const d=readNativeDocument(html),head=activeHead(html),bases=d.nodes(n=>n.tag==='base').map(n=>({...n.attrs}));need(equal(head.titles,['EaseMyTrip.com - Book Flights, Hotels, Holidays, Bus & Train Tickets'])&&bases.length<=1&&bases.every(b=>equal(b,{href:'/'})),'official homepage identity/base changed')
 const links=d.nodes(n=>n.tag==='a'&&n.attrs.href===CAREERS&&/^CURRENT OPENINGS\b/i.test(d.text(n)))
 return {title:head.titles[0],bases,careersURL:CAREERS,currentHandoff:links.length>0,links:links.map(tree)}
}
function literal(node,state={nodes:0}){
 need(++state.nodes<=10000,'native literal node bound')
 if(node.type==='Literal'){need(node.value===null||['string','number','boolean'].includes(typeof node.value),'unsupported literal value');if(typeof node.value==='string')need(node.value.length<=32000,'native string bound');return node.value}
 if(node.type==='ArrayExpression'){need(node.elements.length<=200&&!node.elements.includes(null),'native array shape/bound');return node.elements.map(n=>literal(n,state))}
 need(node.type==='ObjectExpression'&&node.properties.length<=30,'native object shape/bound');const entries=[],keys=new Set()
 for(const p of node.properties){need(p.type==='Property'&&!p.computed&&!p.method&&!p.shorthand&&p.kind==='init','executable or indirect native data');const k=p.key.type==='Identifier'?p.key.name:p.key.value;need(typeof k==='string'&&!['__proto__','prototype','constructor'].includes(k)&&!keys.has(k),'duplicate or unsafe native property');keys.add(k);entries.push([k,literal(p.value,state)])}
 return Object.fromEntries(entries)
}
export const observationKey=r=>JSON.stringify([r.title,r.dept,r.loc])
export function readCareers(html){
 const d=readNativeDocument(html),v=readVisibleNativeDocument(html,{strict:true}),head=activeHead(html),title='Careers at EaseMyTrip — Boost Your Professional Journey with India’s Leading Travel Platform';need(equal(head.titles,[title])&&!d.nodes(n=>n.tag==='base').length,'current careers identity changed')
 need(equal(head.metas,[{charset:'UTF-8'},{name:'viewport',content:'width=device-width, initial-scale=1.0'}])&&!d.nodes(n=>n.tag==='script'&&/ld\+json/i.test(n.attrs.type||'')||['itemprop','itemtype','itemscope','property'].some(k=>Object.hasOwn(n.attrs,k))).length,'unreviewed own structured job metadata')
 const root=one(d.nodes(n=>n.tag==='root'),'careers document root'),inlineStyles=walk(root,n=>n.tag==='style').map(n=>({attrs:{...n.attrs},bodySHA256:hash(n.raw||'')})),externalStyles=d.nodes(n=>n.tag==='link'&&(n.attrs.rel||'').toLowerCase().split(/\s+/).includes('stylesheet')).map(n=>({...n.attrs}))
 // The reviewed native drawer CSS reveals every criterion when openDrawer
 // adds .open. Any new authored rules or stylesheet declarations require a
 // new review; an unchanged renderer alone cannot establish publication.
 need(equal(inlineStyles,[{attrs:{},bodySHA256:'7f5222213e0c0bf182df2cf68c67793b067a856ee94017a7f91fcd03e6905a61'}]),'reviewed authored careers visibility changed')
 need(hash(JSON.stringify(externalStyles))==='9ebd95ddf73a70ffcaccadf9cac1bdf7341abc25ef229543d3be0b780629be79','reviewed external careers stylesheet declarations changed')
 const hero=one(d.nodes(n=>cls(n,'hero-copy')),'whole own careers hiring region');need(/^Come & Join EaseMyTrip\b/.test(d.text(hero))&&d.nodes(n=>n.tag==='h1'&&/Boost Your Professional Journey/.test(d.text(n))).length===1,'own hiring-employer statement missing')
 const visibleHero=one(v.nodes(n=>cls(n,'hero-copy')),'visible own hiring region');need(d.text(hero)===v.text(visibleHero),'hidden own hiring-employer context')
 const parents=new Map(),index=n=>{for(const child of n.children.filter(c=>typeof c!=='string')){parents.set(child,n);index(child)}};index(root);const containingAncestors=[];for(let n=parents.get(hero);n;n=parents.get(n)){need(!semantic(n),'unreviewed containing hiring metadata');containingAncestors.push({tag:n.tag,attrs:{...n.attrs}})}
 const script=one(d.nodes(n=>n.tag==='script'&&!n.attrs.src&&/\bconst\s+ROLES\s*=/.test(n.raw||'')),'active native role program');need(Object.keys(script.attrs).length===0&&script.raw.length<=200000,'unreviewed native program attributes/bound')
 let ast;try{ast=parse(script.raw,{ecmaVersion:'latest'})}catch{need(false,'unreadable native program')}
 const declarations=ast.body.filter(n=>n.type==='VariableDeclaration').flatMap(n=>n.declarations),data={}
 for(const name of ['DEPARTMENTS','ROLES']){const row=one(declarations.filter(n=>n.id.type==='Identifier'&&n.id.name===name),'native '+name+' declaration');need(row.init?.type==='ArrayExpression','native array must be a direct literal');data[name]={node:row.init,value:literal(row.init)}}
 let skeleton=script.raw;for(const [name,row]of Object.entries(data).sort((a,b)=>b[1].node.start-a[1].node.start))skeleton=skeleton.slice(0,row.node.start)+'<NATIVE-'+name+'>'+skeleton.slice(row.node.end)
 const rendererSHA256=hash(skeleton);need(rendererSHA256==='2d336edb90fce4c688af02c2b0dcc32054fcf1ac754b8bab772a6acdc49823d7','reviewed role renderer changed')
 const departments=data.DEPARTMENTS.value,roles=data.ROLES.value;need(departments.length>0&&roles.length>0,'empty native data is unqualified')
 const keys=new Set();for(const r of departments){need(equal(Object.keys(r).sort(),['icon','key','label'])&&Object.values(r).every(v=>typeof v==='string'&&v.trim()&&!/[<>]/.test(v))&&!keys.has(r.key),'native department identity changed');keys.add(r.key)}
 const identities=new Set();for(const r of roles){need(r&&['title','dept','loc'].every(k=>typeof r[k]==='string'&&r[k].trim()&&!/[<>]/.test(r[k])),'native role identity missing');const k=observationKey(r);need(!identities.has(k)&&keys.has(r.dept),'duplicate role identity or unknown department');identities.add(k)}
 return {context:{title,headMetadata:structuredClone(head.metas),publicationStyles:{inlineStyles,externalStyles},containingAncestors,hiringRegion:tree(hero),hiringStatement:'Come & Join EaseMyTrip',departments:structuredClone(departments),rendererSHA256,publisherProgramsExecuted:false,applicationURL:APPLICATION,applicationIsGeneric:true},roles:structuredClone(roles),nativeProgram:script.raw,nativeProgramSHA256:hash(script.raw),nativeScript:tree(script)}
}
export function readOffices(html){
 const d=readNativeDocument(html),v=readVisibleNativeDocument(html,{strict:true});need(equal(activeHead(html).titles,['EaseMyTrip Contact details'])&&!d.nodes(n=>n.tag==='base').length,'current owned office publisher identity changed')
 need(equal(d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical').map(n=>n.attrs.href),[CONTACT]),'owned office canonical identity changed')
 const universe=one(d.nodes(n=>cls(n,'bgbx')),'whole office universe'),projected=one(v.nodes(n=>cls(n,'bgbx')),'visible whole office universe');need(clean(unhidden(universe))===d.text(universe)&&d.text(universe)===v.text(projected),'hidden native office-country context')
 need(!walk(universe,n=>semantic(n)||['script','style','iframe','form','template','noscript','textarea','object','embed','svg'].includes(n.tag)).length,'unreviewed office metadata/delegation')
 const parents=new Map(),index=n=>{for(const c of n.children.filter(c=>typeof c!=='string')){parents.set(c,n);index(c)}};index(one(d.nodes(n=>n.tag==='root'),'owned office document root'))
 const ancestors=[];for(let n=parents.get(universe);n;n=parents.get(n)){need(!semantic(n),'additional containing office geography');ancestors.push({tag:n.tag,attrs:{...n.attrs}})}
 const regions=d.nodes(n=>cls(n,'ofcbx')),india=one(regions.filter(r=>d.nodes(n=>cls(n,'mn-title')&&d.text(n)==='Our Offices Within India').some(n=>walk(r,c=>c===n).length)),'explicit own India office region')
 need(!foreign(d.text(india))&&!walk(india,n=>['alt','title','aria-label'].some(k=>foreign(n.attrs[k]||''))).length,'competing India office-country context')
 const allOffices=regions.flatMap(region=>walk(region,n=>cls(n,'addbx')).map(card=>({regionHeading:one(walk(region,n=>cls(n,'mn-title')),'office region heading').children.map(unhidden).join(' ').replace(/\s+/g,' ').trim(),label:d.text(one(walk(card,n=>cls(n,'adttl')),'own office label')),address:d.text(one(walk(card,n=>n.tag==='address'),'whole own office address')),card:tree(card),inIndia:region===india})))
 need(allOffices.length>0&&allOffices.length<=40&&allOffices.every(o=>o.label&&o.address),'incomplete native office universe')
 return {title:'EaseMyTrip Contact details',canonical:CONTACT,indiaCountryHeading:'Our Offices Within India',universe:tree(universe),containingAncestors:ancestors,offices:allOffices,cityDictionaryUsed:false,exactCampusEstablished:false}
}
function fragment(html){
 need(typeof html==='string','native criterion missing');const d=readNativeDocument(html),root=one(d.nodes(n=>n.tag==='root'),'criterion root');need(!walk(root,n=>!['root','b','strong','em','i','u','br'].includes(n.tag)||Object.keys(n.attrs).length>0).length,'hidden, delegated or unreviewed native criterion markup');need(clean(unhidden(root))===d.text(root),'hidden native criterion');return d.text(root)
}
export function classifyRole(row,context){
 need(equal(Object.keys(row).sort(),['about','dept','exp','loc','process','profile','resp','title','type']),'unreviewed native role fields')
 for(const k of ['title','dept','loc','type','exp'])need(typeof row[k]==='string'&&row[k].trim()&&!/[<>]/.test(row[k]),'native '+k+' missing or hidden')
 for(const k of ['process','resp','profile'])need(Array.isArray(row[k])&&row[k].length>0&&row[k].length<=50,'complete native '+k+' missing')
 const about=fragment(row.about),process=row.process.map(fragment),responsibilities=row.resp.map(fragment),profile=row.profile.map(fragment),experience=fragment(row.exp)
 need(about.length>=100&&responsibilities.join(' ').length>=150&&profile.join(' ').length>=100&&process.every(Boolean),'complete actual role criteria missing')
 const html='<div class="jd-block"><h4>About the role</h4><p>'+row.about+'</p></div><div class="jd-block"><h4>Interview process</h4><ul>'+row.process.map(p=>'<li>'+p+'</li>').join('')+'</ul></div><div class="jd-block"><h4>Minimum experience</h4><span class="jd-exp">'+row.exp+'</span></div><div class="jd-block"><h4>Roles &amp; responsibilities</h4><ul>'+row.resp.map(p=>'<li>'+p+'</li>').join('')+'</ul></div><div class="jd-block"><h4>Preferred candidate profile</h4><ul>'+row.profile.map(p=>'<li>'+p+'</li>').join('')+'</ul></div>',d=readNativeDocument(html),description=d.text(one(d.nodes(n=>n.tag==='root'),'whole rendered criteria root'))
 const department=one(context.careers.context.departments.filter(d=>d.key===row.dept),'published native department'),publishedText=[row.title,department.label,row.loc,row.type,row.exp,description].join('\n')
 need(!/\b(?:Employer|Hiring Organization|Company)\s*[:\-–—]|\b(?:Country|Worksite Country|application deadline|closing date|deadline)\s*[:\-–—]|\bapply\s+by\s+/i.test(publishedText),'additional employer/country/deadline declaration')
 const matching=context.offices.offices.filter(o=>o.label===row.loc);if(matching.length===0)return {kind:'excluded',reason:'outside-current-verified-office-country-binding',countryNotClassified:true,record:structuredClone(row),description,criteriaHTML:html}
 need(matching.length===1&&matching[0].inIndia,'own worksite has ambiguous or foreign office-country binding')
 const placements=[...publishedText.matchAll(/\b(?:Location\s*:\s*|(?:based|located|stationed|deployed|assigned|working|operat(?:e|es|ing))\s+(?:in|from|at|to)\s+|relocat\w*\s+(?:to|in)\s+)([^.!?;\n]{1,200})/gi)].map(m=>m[1])
 need(!foreign(row.title)&&!placements.some(s=>!(s.startsWith(row.loc)||/^India\b/.test(s))||foreign(s)||/\b(?:or|either|alternatively|relocat\w*)\b/i.test(s)),'conflicting own workplace criteria')
 return {kind:'qualified',row,office:matching[0],description,criteriaHTML:html,about,process,responsibilities,profile,experience}
}
export function makeJob(fact,context,index,clock){const row=fact.row,key=observationKey(row);return {source:SOURCE,company:COMPANY,title:row.title,jobId:null,requisitionId:null,nativePostingID:null,nativeObservationKey:key,nativeObservationKeyKind:'literal-title-department-worksite-tuple-not-a-posting-id',nativeRoleDisplayIndex:index,
 sourceUrl:CAREERS,link:CAREERS,applyUrl:APPLICATION,nativePublishedRoleURL:null,nativeCanonicalRoleURL:null,sourceURLIsSharedCareersPage:true,applicationUrlIsGeneric:true,nativeLocationLabel:row.loc,location:row.loc+', India',city:row.loc,state:null,country:'India',remoteStatus:null,employmentType:row.type,sourceEmploymentType:row.type,sourceExperienceRequired:row.exp,experienceRequired:row.exp,
 nativeHiringOrganization:{name:COMPANY,kind:'current-owned-careers-hiring-statement',statement:context.careers.context.hiringStatement,legalEmployer:null},legalEmployer:null,nativeDepartmentKey:row.dept,department:context.careers.context.departments.find(d=>d.key===row.dept).label,numberOfOpenings:null,postingDate:null,postedAt:null,closingDate:null,firstEverPublication:null,
 sourceDescription:fact.description,jobDescription:fact.description,nativeRenderedCriteriaHTML:fact.criteriaHTML,nativeInterviewProcess:structuredClone(row.process),nativeRoleCriteriaContainerRetained:true,
 nativeSourceRecord:{role:structuredClone(row),nativeDisplayIndex:index,home:structuredClone(context.home),careers:structuredClone(context.careers.context),offices:structuredClone(context.offices)},
 sourceWorksiteCountryProof:{method:'own-native-worksite-to-current-explicit-office-country-region',nativeWorksiteLabel:row.loc,nativeOfficeLabel:fact.office.label,nativeOfficeAddress:fact.office.address,country:'India',contextURL:CONTACT,countryHeading:context.offices.indiaCountryHeading,contextualBinding:true,literalRoleCountry:false,cityDictionaryUsed:false,headquartersIsCountryProof:false,companyNameIsCountryProof:false,exactCampusEstablished:false},
 sourceDetailComplete:false,sourceDetailStatus:'partial',sourceDetailFailureKind:'native-closing-unreconciled',nativeRoleClosingReconciled:false,sourceCountryScopeUnresolved:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false,nativeApplicationsOpen:null,scrapedAt:clock}}
