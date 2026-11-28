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
export const CURRENT_20261113_MODULES={main:{path:'index-BUJgqbI9.js',sha:'0e9a525919dfc2374369375cfee77b1f820dd5efac5106883da7316ec5565266'},origins:{path:'src-B3tk8w2V.js',sha:'950352ebd259d0efb18932b2945e023bf829edf79443f9e106ece3c76c692101'},roles:{path:'page-mQHeHhro.js',sha:'9d0c25cb8d3eb16a6e17529f949758685d384b46ab4729ef96d2b32e1f2484ca'},detail:{path:'useJob-C89Jdq1v.js',sha:'983b98639654b238fdb40d2a22b0fb7f151e79db0e465be617f32623bfba3dd2'},locations:MODULES.locations}
export const CURRENT_20261116_MODULES={main:{path:'index-2IowuTf6.js',sha:'05fcfff9b2f7dac72999000e0909854cd67d32fb2d3573f5f8dcefc8d909d460'},origins:{path:'src-Cs2mm8JW.js',sha:'be56366730e31f8afea599b7b8bbd61b05230eb79399a2a206580fdae0de9d8c'},roles:{path:'page-DktFSOPE.js',sha:'0854f5453329187469ee899db26d0aaa8387e21671472e85c927236fa2303085'},detail:{path:'useJob-DvA4pv2Q.js',sha:'61cf45ff1dc98963ddf84aa3c4f0fcb099b55b3621cb81992d63534718824076'},locations:MODULES.locations}
// The fresh default response rolled to this exact graph after the earlier
// Nov16 capture. Only build filenames and AST-owned telemetry literals differ.
export const CURRENT_20261117_MODULES={main:{path:'index-wTVOiLWE.js',sha:'5d84003f28dedab49b02dea4fde94807ddbc9a96d93401eff93d3ed769cbc387'},origins:{path:'src-B7ntEYHL.js',sha:'8ecb515d3fddc32296c92561de2bb754cc1b6a82fedc1b1d6470fd00cb685525'},roles:{path:'page-8hIpO67b.js',sha:'564e6482847e3252a3924cedb64f8efca48b2ee06e8c87989c21e13af31505cb'},detail:{path:'useJob-CPR5-WtU.js',sha:'c6a5b8cdf8506f5cea6284389519d310f1af696ca39b2e51899a52718dad0649'},locations:MODULES.locations}
// Nov19 publishes a new exact graph: the two careers GET methods, production
// client and full criteria renderer remain unchanged. Other changes include
// generated support-desk methods and a wildcard page route; browser and company
// scope remain held. Keep every original program byte pinned as a finite tuple.
export const CURRENT_20261119_MODULES={main:{path:'index-CHl4g8nw.js',sha:'8220cf52e15a68aa735a9c0039423d1a0b0680d735d3760d4404da8a84922b29'},origins:{path:'src-BLzOSnaW.js',sha:'f14e8d4cb1c935dac309222e2b69eefbb5fe74d4227aa34235b73259fc195956'},roles:{path:'page-B1DyGGW_.js',sha:'c8281e89b42cf7f25ebf92bcf25be0391b9a7e8092db6474eaf90161d7384df4'},detail:{path:'useJob-D5vR3AG-.js',sha:'4065ace3a28f831ef1de0f539f804de763b62f72921ed79c058b67824e83a8d5'},locations:MODULES.locations}
// Nov20 retains the exact careers GET and full role renderer. The reviewed
// functional additions are generated mcp_customers OAuth methods, which this
// static reader never executes. Keep this complete graph pinned independently.
export const CURRENT_20261120_MODULES={main:{path:'index-BJfNRE2S.js',sha:'656ed17311ad56406db62001c13c654ae8ce4715929a23798f4b05677c2e40f9'},origins:{path:'src-Chmq7nvF.js',sha:'0163484043633802bc95636e171feadcab7e4a8528b9728a6b8861199b2e1b1b'},roles:{path:'page-DnT3o9iZ.js',sha:'b147d82e05d3d191599bc493ec45acbc954617f81b9b3a1509cb46242b10022a'},detail:{path:'useJob-DwsXeAll.js',sha:'bba55531fb17ce79da8d12edb96987be627d77636af840a66edeeb7b0f4670fa'},locations:MODULES.locations}
// Current published GET methods and whole role renderer remain unchanged;
// retain the complete new graph independently from earlier deployments.
export const CURRENT_20261125_MODULES={main:{path:'index-BDMW3WUv.js',sha:'393621a5bb558906574aa208fe6f89c892d611b027d831958b6d20ebcae1aef0'},origins:{path:'src-ORtK68OJ.js',sha:'485d346525a56f9c75942f468bab2620fbec8eb6b0c9a5432d22028b481cd154'},roles:{path:'page-BvsMC2Uo.js',sha:'4f060c33fb761d8cb7e4a063db3754c78d1e83d219db64943d1bf19e365969a1'},detail:{path:'useJob-jN_iMHzv.js',sha:'dafc047a61da7a4d537e2c2240d71e1331c042a4a00fbd76ceb031599fb1d948'},locations:MODULES.locations}
// This complete current graph retains the two public careers GET methods and
// whole role criteria consumer. Its route/client bindings have their own exact
// plan below; other SDK, dependency and browser behavior is not inferred.
export const CURRENT_20261128_MODULES={main:{path:'index-DMEepMtj.js',sha:'c50f11965f510bccd5d46d225dd225effe59f09121f18c0e5414c2ba7b32dde4'},origins:{path:'src-Ki0Cnzhk.js',sha:'18a770e709babc1147f92bd71ee93896420775a7b9c052e53ff2531b3920368e'},roles:{path:'page-Cco3wRb4.js',sha:'5d39ad737534e6da8ca0b192179191182dcdf43494bd7af93c7e538e225ee5e8'},detail:{path:'useJob-B43A6q3w.js',sha:'faa03b089e7930ed1a321455deb0e9e05445a526fbee94bc86ce73511a8c10bd'},locations:MODULES.locations}
export const MODULE_PROFILES=[MODULES,CURRENT_MODULES,CURRENT_20261110_MODULES,CURRENT_20261111_MODULES,CURRENT_20261113_MODULES,CURRENT_20261116_MODULES,CURRENT_20261117_MODULES,CURRENT_20261119_MODULES,CURRENT_20261120_MODULES,CURRENT_20261125_MODULES,CURRENT_20261128_MODULES]
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
 // Nov16 changes minifier bindings in the complete pinned graph. Each exact
 // graph keeps its own route/client plan; mixed or unseen programs still fail.
 const recentBindings=modules===CURRENT_20261116_MODULES||modules===CURRENT_20261117_MODULES||modules===CURRENT_20261119_MODULES||modules===CURRENT_20261120_MODULES||modules===CURRENT_20261125_MODULES
 const roleBinding=recentBindings?'eS':'nS'
 const productionClient=modules===CURRENT_20261128_MODULES?'function nv(){return c(`production`,!0)}function rv(){return s(`core`,nv())}function iv(){return tv({baseUrl:rv()})}':recentBindings?'function ev(){return c(`production`,!0)}function tv(){return s(`core`,ev())}function nv(){return $_({baseUrl:tv()})}':'function nv(){return d(`production`,!0)}function rv(){return a(`core`,nv())}function iv(){return tv({baseUrl:rv()})}'
 need(main.wholeProgram.includes(roleBinding+'=q(()=>$(()=>import(`./' + modules.roles.path + '`)')&&main.wholeProgram.includes('path:`roles`,element:(0,P.jsx)('+roleBinding+',{}'),'current roles route binding changed')
 need(main.wholeProgram.includes(productionClient)&&main.wholeProgram.includes('.careers.jobsList()'),'current production inventory client changed')
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
function geography(row){
 const place=label=>{
  const countryWords=label.split(/,\s*|\s+-\s+/).map(s=>countryLabel(s.length>3||s==='USA'||s==='UAE'?s:null)).filter(Boolean)
  if(/\b(?:worldwide|global|anywhere|multiple locations|APAC|EMEA)\b/i.test(label)||new Set(countryWords).size>1)return{label,country:null,method:'contradictory-or-unqualified-compound-workplace',office:null}
  const literal=label.split(/,\s*|\s+-\s+/).at(-1),explicit=countryLabel(literal.length>3||literal==='USA'||literal==='UAE'?literal:null)
  if(explicit)return{label,country:explicit,method:'literal-native-workplace-country',office:null}
  return{label,country:null,method:'native-workplace-country-unpublished',office:null}
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
 const country=geography(job),declarations=roleDeclarations(allCriteriaNodes,d),employerConflict=declarations.some(m=>/employer|organization|company/i.test(m.label)&&m.value!=='Groupon'),employerReconciled=firstEmployer&&!employerConflict,metadataConflict=employerConflict||declarations.some(m=>/country/i.test(m.label)?!country.countries.includes(countryLabel(m.value)):/assignment/i.test(m.label)?m.value!==job.location&&!country.countries.includes(countryLabel(m.value)):false),qualified=readable&&employerReconciled&&!closed&&!publicationDateConflict&&!typed.length&&!metadataConflict&&country.qualified
 const nativePublication={closed,publicationDateConflict,criteriaReadable:readable,employerReconciled,typedRoleMetadataUnqualified:typed.length>0,countryQualified:country.qualified,qualified}
 const unqualifiedCountry=typed.length>0||metadataConflict||!employerReconciled
 return{jobId:job.id,title:norm(job.title),company:'Groupon',sourceUrl:job.absoluteUrl,link:job.absoluteUrl,applyUrl:PRIMARY+'apply/?job='+job.id,nativePublishedApplyURL:PRIMARY+'apply/?job='+job.id,nativeCanonicalRoleURL:null,nativePublishedRoleURL:job.absoluteUrl,nativePostingID:String(job.id),requisitionId:null,legalEmployer:null,nativeInternalJobID:null,location:job.location,city:null,state:null,country:unqualifiedCountry?null:country.country,locations:country.placements.map(p=>({location:p.label,country:unqualifiedCountry?null:p.country})),nativeWorkplaceCountryModel:country,nativeExplicitDeclarations:declarations,sourceCountryScopeUnresolved:!country.qualified||unqualifiedCountry,sourceWorksiteCountryProof:{...country,qualified:country.qualified&&!unqualifiedCountry,explicitMetadataConflict:metadataConflict,cityDictionaryUsed:false,exactCampusEstablished:false},department:job.departments.length===1?norm(job.departments[0]):null,employmentType:null,remoteStatus:null,minimumQualification:null,preferredQualification:null,experienceRequired:null,requiredSkills:[],postingDate:timestamp(job.firstPublished),nativeFirstPublished:job.firstPublished,nativeUpdatedAt:job.updatedAt,firstEverPublication:null,sourceDatePrecision:timestamp(job.firstPublished)?'second-with-offset':null,closingDate:null,sourceDescription:job.contentHtml,jobDescription:job.contentHtml,nativeWholeCriteriaText:full,nativeWholeCriteriaModel:whole(root),nativeScreeningQuestions:structuredClone(job.questions),nativeRoleIdentityReconciled:true,nativeEmployerReconciled:employerReconciled,nativeRoleCriteriaReconciled:qualified,nativePublication,nativePublishedClosedNotice:closed,nativeSourceRecord:{publisher:{brand:'Groupon',loadingContract:contract},listing,detail:job},sourceRawNativeResponse:text,sourceRawNativeResponseSHA256:sha(text),sourceDetailComplete:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,applicationVisited:false,applicationFormSubmitted:false,activeApplyVerified:false}
}
