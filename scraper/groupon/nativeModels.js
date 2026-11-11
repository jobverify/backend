import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {readNativeDocument,activeHead,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'

export const ENTRY='https://www.grouponcareers.com/',PRIMARY='https://careers.groupon.com/',API='https://api-core.livingsocial.com/careers/jobs'
export const MODULES={main:{path:'index-Ax6y42Wp.js',sha:'a1ed719fbfef73ef23b6e8b3cd99540aa6430d743289d24c26158fa034ca27d1'},origins:{path:'src-D1ipTgb0.js',sha:'d2fe89a21723b6af3dca2e6f8f672575d45a19b43ed9dbb28ccbc524f6f61005'},roles:{path:'page-D1ud1n30.js',sha:'31d3a164851b495cc2654ae7531d95f2ba29b697300475629334741ef8bd0d43'},detail:{path:'useJob-CUjdKsOP.js',sha:'ea5dcaeb284a5a4ab5f6a267c9ef665181f1bcf9e6acb403518958f75d505dd7'},locations:{path:'locations-C3ZnT-yL.js',sha:'f8cc099c0deb019e88e81611f1e496878de18723dcb971e5206b9d9ece35b971'}}
// These exact published clients share the reviewed production GET and full
// criteria contracts. The declared entry selects its entire matching graph.
export const CURRENT_MODULES={main:{path:'index-kQ8lO2tS.js',sha:'fcbbfbc2e5eed21787ebbc1a187cbfbfd0d2d9aa3a64238085e6b517afe07204'},origins:{path:'src-w5C0Sia3.js',sha:'a493598602e7499fd8b5e8fef89711d999d8c9ef8f4844be9881f1e9a0a4caf0'},roles:{path:'page-Dp0bProt.js',sha:'ae52e5cef72868d9a9894999ef6f4411687b1890b7c98361baa07e512df0bab0'},detail:{path:'useJob-vB8fc8As.js',sha:'e4301da6b22e1454910bd37a3d4203182a26052f4a9775946cd11d8895de2565'},locations:MODULES.locations}
export const CURRENT_20261110_MODULES={main:{path:'index-Doyq3TRB.js',sha:'3937e4ee67292fed831755b6c5a25f47ba592d342f96193b0d5069502afc254b'},origins:{path:'src-dGgtAKLy.js',sha:'580f573465192b3a79cdcd6c62d92f12ef94865ef3d29a993abd2298dad41b03'},roles:{path:'page-DkBDFwow.js',sha:'e7ff4016b3caaff126d848cccd58a6f89d65da3d562e9078040123b2a6771439'},detail:{path:'useJob-Dd5siOF_.js',sha:'4466fbe2e23e0ee22b0a00df9a69b075e0fa356bab8a850ed1e11821be579086'},locations:MODULES.locations}
export const CURRENT_20261111_MODULES={main:{path:'index-ddzPHZYi.js',sha:'05697a5c15dec6db7363f7473a82cc27e7f29e7d6036d9a45b75e6040f93f78f'},origins:{path:'src-BvLlLOJG.js',sha:'f8eeeffc5de4365fecc8cd2eb3974ab217f4bbc522deb19bba705283d82baaf9'},roles:{path:'page-B0S3JwUh.js',sha:'517f6b0c9d6ff0f8db48178a8737ac74046459fbe0a39af00e5f0db1b85d4850'},detail:{path:'useJob-BKEJaqyG.js',sha:'b36df55429f73161276d71480a18f89421100f8b1d4de5652b398f3fa1ab41a8'},locations:MODULES.locations}
export const MODULE_PROFILES=[MODULES,CURRENT_MODULES,CURRENT_20261110_MODULES,CURRENT_20261111_MODULES]
export const profileModuleURL=(key,modules)=>new URL('assets/'+modules[key].path,PRIMARY).href
export const moduleURL=key=>profileModuleURL(key,MODULES)
export function profileForPublisher(value){
 const href=new URL(value.module.attrs.src,PRIMARY).href
 const profile=MODULE_PROFILES.find(modules=>profileModuleURL('main',modules)===href)
 need(profile,'current declared main module changed')
 return profile
}
export const sha=value=>createHash('sha256').update(value).digest('hex')
export const need=(value,message)=>{if(!value)throw Object.assign(Error('Groupon native: '+message),{abortRetries:true})}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b)
const countryLabel=value=>value==='USA'?'United States':value==='UAE'?'United Arab Emirates':nativeCountryName(value)
const one=(values,label)=>{need(values.length===1,'one '+label+' required');return values[0]}
const walk=(node,visit)=>{if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node))if(Array.isArray(value))value.forEach(v=>walk(v,visit));else if(value&&typeof value==='object')walk(value,visit)}
const whole=node=>typeof node==='string'?node:{tag:node.tag,attrs:{...node.attrs},children:node.children.map(whole),...(node.raw===undefined?{}:{raw:node.raw})}
const rawText=node=>typeof node==='string'?decodeNativeEntities(node):node.children.map(rawText).join(' ')
const exactKeys=(value,keys,label)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).sort().join('|')===keys.slice().sort().join('|'),label+' native fields changed')
const string=node=>node?.type==='Literal'&&typeof node.value==='string'?node.value:node?.type==='TemplateLiteral'&&!node.expressions.length?node.quasis[0].value.cooked:null

export function publisher(html){
 const d=readNativeDocument(html),head=activeHead(html),scripts=d.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src),description=d.nodes(n=>n.tag==='meta'&&n.attrs.name==='description'),roots=d.nodes(n=>n.attrs.id==='root')
 need(head.titles.length===1&&head.titles[0]==='Groupon Careers'&&description.length===1&&/^Join Groupon [\s\S]*explore open roles, meet our teams/.test(description[0].attrs.content),'current first-party careers identity changed')
 need(roots.length===1&&!d.text(roots[0])&&scripts.length===1&&MODULE_PROFILES.some(modules=>new URL(scripts[0].attrs.src,PRIMARY).href===profileModuleURL('main',modules)),'current declared main module changed')
 return{head,description:whole(description[0]),root:whole(roots[0]),module:whole(scripts[0]),originalHTML:html,bodySHA256:sha(html)}
}
export function program(code,key,modules=MODULES){
 need(typeof code==='string'&&sha(code)===modules[key].sha,'declared '+key+' program changed; review before native API reads')
 let ast;try{ast=parse(code,{sourceType:'module',ecmaVersion:'latest'})}catch{need(false,'unreadable current declaration')}
 return{key,url:profileModuleURL(key,modules),bodySHA256:sha(code),wholeProgram:code,ast}
}
export function loadingContract(programs){
 const {main,origins,roles,detail,locations}=programs
 const modules=MODULE_PROFILES.find(profile=>profileModuleURL('main',profile)===main.url)
 need(modules&&Object.keys(modules).every(key=>programs[key].url===profileModuleURL(key,modules)),'mixed reviewed native program graphs')
 need(main.wholeProgram.includes('nS=q(()=>$(()=>import(`./' + modules.roles.path + '`)')&&main.wholeProgram.includes('path:`roles`,element:(0,P.jsx)(nS,{}'),'current roles route binding changed')
 need(main.wholeProgram.includes('function nv(){return d(`production`,!0)}function rv(){return a(`core`,nv())}function iv(){return tv({baseUrl:rv()})}')&&main.wholeProgram.includes('.careers.jobsList()'),'current production inventory client changed')
 need(origins.wholeProgram.includes('core:{')&&origins.wholeProgram.includes('production:`api-core.livingsocial.com`'),'native production core origin changed')
 need(detail.wholeProgram.includes('async jobsList(){return await(await this.baseClient.callTypedAPI(`GET`,`/careers/jobs`)).json()}')&&detail.wholeProgram.includes('async jobGetById(e){return await(await this.baseClient.callTypedAPI(`GET`,`/careers/jobs/${encodeURIComponent(e)}`)).json()}'),'native GET declarations changed')
 need(roles.wholeProgram.includes('t.contentHtml')&&roles.wholeProgram.includes('dangerouslySetInnerHTML:{__html:t.contentHtml}')&&roles.wholeProgram.includes('/apply/?job=${e}'),'whole current role rendering contract changed')
 return{inventoryURL:API,method:'GET',detailPath:'/careers/jobs/{literal-published-id}',publishedApplicationTemplate:PRIMARY+'apply/?job={literal-published-id}',programs:Object.fromEntries(Object.entries(programs).map(([k,p])=>[k,{url:p.url,bodySHA256:p.bodySHA256}])),officeCountryModels:officeModels(locations),publisherProgramsExecuted:false,initialSSRInventoryClaimed:false}
}
function officeModels(module){
 const bindings=new Map(),maps=[]
 for(const declaration of module.ast.body.filter(n=>n.type==='VariableDeclaration'))for(const node of declaration.declarations)if(node.id.type==='Identifier')bindings.set(node.id.name,node.init)
 walk(module.ast,node=>{if(node.type==='ObjectExpression'&&node.properties.length&&node.properties.every(p=>p.type==='Property'&&string(p.key)?.startsWith('/content/locations/')))maps.push(node)})
 const map=one(maps,'native office data map'),models=map.properties.map(property=>{
  const path=string(property.key),node=bindings.get(property.value.name),raw=string(node);need(typeof raw==='string'&&raw.startsWith('---\n')&&raw.endsWith('---\n'),'literal whole office frontmatter required')
  const fields={},lines=raw.slice(4,-4).split('\n');let list
  for(const line of lines){if(!line)continue;const item=/^  - (.+)$/.exec(line);if(item){need(list&&Array.isArray(fields[list]),'unbound native office list');fields[list].push(item[1]);continue}const match=/^([A-Za-z]+):(?: (.*))?$/.exec(line);need(match&&!Object.hasOwn(fields,match[1]),'duplicate or unreadable native office field');list=match[1];fields[list]=match[2]===undefined?[]:match[2].replace(/^'(.*)'$/,'$1')}
  need(path==='/content/locations/'+fields.slug+'.mdx'&&typeof fields.title==='string'&&typeof fields.city==='string'&&typeof fields.region==='string','office country identity changed')
  const country=countryLabel(fields.title);return{path,raw,fields,country:country||null,cities:fields.city.split(' & ').filter(c=>c!=='Remote')}
 })
 need(models.length===11&&new Set(models.map(m=>m.fields.slug)).size===models.length,'native office data inventory changed')
 return models
}
const listingKeys=['absoluteUrl','departments','firstPublished','id','location','offices','title','updatedAt']
function identity(row){
 need(Number.isSafeInteger(row.id)&&row.id>0&&typeof row.title==='string'&&norm(row.title)&&typeof row.location==='string'&&row.location&&Array.isArray(row.departments)&&row.departments.every(s=>typeof s==='string')&&Array.isArray(row.offices)&&row.offices.every(s=>typeof s==='string'),'literal native role identity required')
 need(row.absoluteUrl==='https://job-boards.eu.greenhouse.io/groupon/jobs/'+row.id,'native role account or ID conflict')
}
export function inventory(text){const payload=parseJSON(text);exactKeys(payload,['jobs'],'inventory');need(Array.isArray(payload.jobs)&&payload.jobs.length>0&&payload.jobs.length<=80,'bounded nonempty current cohort required');const seen=new Set();for(const row of payload.jobs){exactKeys(row,listingKeys,'listing');identity(row);need(!seen.has(row.id),'duplicate native role ID');seen.add(row.id)}return payload}
export function parseJSON(text){let value,ast;try{value=JSON.parse(text);ast=parse('('+text+')',{ecmaVersion:'latest'})}catch{need(false,'unreadable whole native JSON')};walk(ast,n=>{if(n.type==='ObjectExpression'){const keys=n.properties.map(p=>p.key.name??p.key.value);need(new Set(keys).size===keys.length,'duplicate native JSON keys')}});return value}
function geography(row,offices){
 const place=label=>{
  const countryWords=label.split(/,\s*|\s+-\s+/).map(s=>countryLabel(s.length>3||s==='USA'||s==='UAE'?s:null)).filter(Boolean)
  if(/\b(?:worldwide|global|anywhere|multiple locations|APAC|EMEA)\b/i.test(label)||new Set(countryWords).size>1)return{label,country:null,method:'contradictory-or-unqualified-compound-workplace',office:null}
  const literal=label.split(/,\s*|\s+-\s+/).at(-1),explicit=countryLabel(literal.length>3||literal==='USA'||literal==='UAE'?literal:null)
  if(explicit)return{label,country:explicit,method:'literal-native-workplace-country',office:null}
  const matches=offices.flatMap(office=>office.cities.filter(city=>{if(label===city)return true;if(!label.startsWith(city+' (')||!label.endsWith(')'))return false;const suffix=label.slice(city.length+2,-1);return /^\d+[A-Za-z]?\s+(?:[A-Za-z.]+\s+){0,8}(?:St\.?|Street|Rd\.?|Road|Dr\.?|Drive|Ave\.?|Avenue|Blvd\.?|Boulevard)$/i.test(suffix)}).map(city=>({office,city})))
  if(matches.length!==1||!matches[0].office.country)return{label,country:null,method:'unqualified-native-workplace',office:null}
  return{label,country:matches[0].office.country,method:'exact-workplace-to-own-published-office-country',office:matches[0].office}
 }
 const placements=row.location.split(';').map(norm).map(place),assignedOffices=row.offices.map(label=>{const original=place(label);if(original.country)return original;const own=placements.filter(p=>p.country&&p.method==='literal-native-workplace-country'&&norm(p.label.slice(0,p.label.lastIndexOf(',')))===label);return own.length===1?{label,country:own[0].country,method:'exact-office-label-to-own-explicit-compound-workplace-country',nativeWorkplace:own[0].label}:original}),countries=[...new Set(placements.map(p=>p.country).filter(Boolean))],assignmentCountries=assignedOffices.map(p=>p.country),unknown=placements.some(p=>!p.country)||assignedOffices.some(p=>!p.country),conflict=assignmentCountries.some(c=>c&&!countries.includes(c)),qualified=!unknown&&!conflict
 return{placements,assignedOffices,countries,unknown,conflict,qualified,cityDictionaryUsed:false,exactCampusEstablished:false,country:qualified&&countries.length===1?countries[0]:null}
}
const timestamp=value=>typeof value==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(value)&&Number.isFinite(Date.parse(value))?value:null
function roleDeclarations(nodes,d){
 const result=[],label=/^(Country|Work Country|Job Country|Country of Employment|Work assignment|Mandatory work assignment|Employer|Hiring Organization|Company)$/i
 for(const node of nodes){
  const direct=/^(Country|Work Country|Job Country|Country of Employment|Work assignment|Mandatory work assignment|Employer|Hiring Organization|Company)\s*(?::|[-\u2013\u2014])\s*(.+)$/i.exec(d.text(node));if(direct)result.push({label:direct[1],value:direct[2]})
  const children=node.children.filter(c=>typeof c!=='string')
  if(node.tag==='tr'&&children.length===2&&['th','td'].includes(children[0].tag)&&children[1].tag==='td'){const name=d.text(children[0]).replace(/:$/,'');if(label.test(name)&&d.text(children[1]))result.push({label:name,value:d.text(children[1])})}
  for(let i=0;i+1<children.length;i++)if(children[i].tag==='dt'&&children[i+1].tag==='dd'){const name=d.text(children[i]).replace(/:$/,'');if(label.test(name)&&d.text(children[i+1]))result.push({label:name,value:d.text(children[i+1])})}
 }
 return result
}
export function detail(text,listing,contract){
 const payload=parseJSON(text);exactKeys(payload,['job'],'detail envelope');const job=payload.job;exactKeys(job,[...listingKeys,'contentHtml','questions'],'detail');identity(job)
 need(equal(Object.fromEntries(listingKeys.map(k=>[k,job[k]])),listing),'listing and complete detail model differ')
 need(typeof job.contentHtml==='string'&&Buffer.byteLength(job.contentHtml)<=1000000&&Array.isArray(job.questions),'whole native criteria and questions required')
 const d=readNativeDocument(job.contentHtml),visible=readVisibleNativeDocument(job.contentHtml,{strict:true}),root=one(d.nodes(n=>n.tag==='root'),'whole role criteria root'),full=d.text(root),employer=d.nodes(n=>n.tag==='p')[0]
 const allCriteriaNodes=[];walk(root,n=>{if(typeof n.tag==='string'&&n.attrs)allCriteriaNodes.push(n)})
 const unsupported=allCriteriaNodes.filter(n=>['script','style','title','xmp','noembed','noframes','plaintext','iframe','object','embed','img','form','input','textarea','template','noscript'].includes(n.tag)||n.nativeTagUnqualified===true),readable=full.length>=150&&norm(rawText(root))===full&&visible.text(one(visible.nodes(n=>n.tag==='root'),'visible criteria root'))===full&&!unsupported.length
 const typed=allCriteriaNodes.filter(n=>Object.entries(n.attrs).some(([k,v])=>/^(?:data-)?(?:country|work-country|job-country|location|workplace|employer|hiring-organization)$/i.test(k)||['itemprop','name','property'].includes(k)&&/(?:country|jobLocation|hiringOrganization|employer)/i.test(v)))
 const firstEmployer=Boolean(employer&&/^Groupon connects\b/.test(d.text(employer))),closed=/\b(?:(?:this|the) (?:job|position|role) (?:is no longer (?:available|active|accepting applications)|(?:has been|is) filled)|no longer accepting applications)\b/i.test(full)
 const published=timestamp(job.firstPublished),publicationDateConflict=job.firstPublished!=null&&!published||published!==null&&Date.parse(published)>Date.now()
 const country=geography(job,contract.officeCountryModels),declarations=roleDeclarations(allCriteriaNodes,d),employerConflict=declarations.some(m=>/employer|organization|company/i.test(m.label)&&m.value!=='Groupon'),employerReconciled=firstEmployer&&!employerConflict,metadataConflict=employerConflict||declarations.some(m=>/country/i.test(m.label)?!country.countries.includes(countryLabel(m.value)):/assignment/i.test(m.label)?m.value!==job.location&&!country.countries.includes(countryLabel(m.value)):false),qualified=readable&&employerReconciled&&!closed&&!publicationDateConflict&&!typed.length&&!metadataConflict&&country.qualified
 const nativePublication={closed,publicationDateConflict,criteriaReadable:readable,employerReconciled,typedRoleMetadataUnqualified:typed.length>0,countryQualified:country.qualified,qualified}
 const unqualifiedCountry=typed.length>0||metadataConflict||!employerReconciled
 return{jobId:job.id,title:norm(job.title),company:'Groupon',sourceUrl:job.absoluteUrl,link:job.absoluteUrl,applyUrl:PRIMARY+'apply/?job='+job.id,nativePublishedApplyURL:PRIMARY+'apply/?job='+job.id,nativeCanonicalRoleURL:null,nativePublishedRoleURL:job.absoluteUrl,nativePostingID:String(job.id),requisitionId:null,legalEmployer:null,nativeInternalJobID:null,location:job.location,city:null,state:null,country:unqualifiedCountry?null:country.country,locations:country.placements.map(p=>({location:p.label,country:unqualifiedCountry?null:p.country})),nativeWorkplaceCountryModel:country,nativeExplicitDeclarations:declarations,sourceCountryScopeUnresolved:!country.qualified||unqualifiedCountry,sourceWorksiteCountryProof:{...country,qualified:country.qualified&&!unqualifiedCountry,explicitMetadataConflict:metadataConflict,cityDictionaryUsed:false,exactCampusEstablished:false},department:job.departments.length===1?norm(job.departments[0]):null,employmentType:null,remoteStatus:null,minimumQualification:null,preferredQualification:null,experienceRequired:null,requiredSkills:[],postingDate:timestamp(job.firstPublished),nativeFirstPublished:job.firstPublished,nativeUpdatedAt:job.updatedAt,firstEverPublication:null,sourceDatePrecision:timestamp(job.firstPublished)?'second-with-offset':null,closingDate:null,sourceDescription:job.contentHtml,jobDescription:job.contentHtml,nativeWholeCriteriaText:full,nativeWholeCriteriaModel:whole(root),nativeScreeningQuestions:structuredClone(job.questions),nativeRoleIdentityReconciled:true,nativeEmployerReconciled:employerReconciled,nativeRoleCriteriaReconciled:qualified,nativePublication,nativePublishedClosedNotice:closed,nativeSourceRecord:{publisher:{brand:'Groupon',loadingContract:contract},listing,detail:job},sourceRawNativeResponse:text,sourceRawNativeResponseSHA256:sha(text),sourceDetailComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false}
}
