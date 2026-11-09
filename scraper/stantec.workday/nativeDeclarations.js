import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {parseNativeJSON} from '../aecom.workday/nativeJSON.js'
import {readTemplateData,readNativeConfig} from './nativeTemplates.js'
import {need,failure} from './nativeErrors.js'
export {need,failure,isFailure} from './nativeErrors.js'

export const CORPORATE_CHAIN=['https://www.stantec.com/','https://www.stantec.com/content/stantec/en.html','https://www.stantec.com/content/stantec/en','https://www.stantec.com/en/','https://www.stantec.com/en']
export const CAREERS=CORPORATE_CHAIN[0],BOARD='https://stantec.jobs/',INDIA=BOARD+'locations/ind/jobs/',SEARCH='https://prod-search-api.jobsyn.org/api/v1/solr/search',ROLE_BASE='https://microsites.dejobs.org/stantec-jobs/data/'
export const SEARCH_HEADERS={Accept:'application/json','Content-Type':'application/json','X-Origin':'stantec.jobs'}
export const searchURL=(page,india=true)=>SEARCH+'?page='+page+(india?'&location=ind':'')+'&num_items=50'
const corporateBase='https://www.stantec.com/etc.clientlibs/stantec-core/clientlibs/clientlib-react-app'
export const CORPORATE_CLIENTS=[
 [corporateBase+'/resources/js/bootstrap.js','0ab1301558d47fcfc6d3d2531eedf7865b8df95ad6911bd7a52dc5776cba3333'],
 [corporateBase+'.js','ddd74eb9a43af3bd3b106e3b8dcdd84166100f5256eaef2ed4d34b4fe213879e'],
 [corporateBase+'/resources/js/chunk-CfVoXhG5.js','7d780926ddbeea1cc767875c936bbaf9a60bebb4c1963909f8877b9b6cfecf8f'],
 [corporateBase+'/resources/js/chunk-BBiQiAiT.js','948f23530d214f8c78dcf14a35855989055bdd7918f6385de9873f1601ac142d'],
 [corporateBase+'/resources/js/chunk-DapD6SqZ.js','8f3ee6afb14ff28522c358c88d0308faaa802535c398cc40dc92ffb028ca5f7a'],
].map(([url,sha256])=>({url,sha256}))
export const NATIVE_CLIENTS=[
 ['CPrYy6Dg.js','8f37dc916042af952e8a79044745eea43f2d4a9800dc2718a4b48abc3c41657b'],
 ['Q3Bw3YIc2.js','3ce4bad2bb99a64b89e980d678ef89d11eb490bcb3a7afc90528ed124e41b000'],
 ['BqTjO6TV.js','1e8532ff1f2f9902ce4bf0b504f39a6c4e28a5df1ba732976a13b199f888ffbf'],
 ['DQqzE7jn.js','17415d1fed520b73498a6cd899ae17ff47f0479d2281ba1d72f593e2abcf1479'],
 ['D3KNJQhc.js','7dab69885d6a45799d329f59afae365ed65e5dadecf508195eb2d5c59e463261'],
 ['BfULQbXb.js','0435837b8c21635b43637506d1d0706ba18c0c7ad534abf75f38bd33f5287d64'],
].map(([file,sha256])=>({url:BOARD+'_nuxt/'+file,sha256}))
export const json=text=>{try{return parseNativeJSON(text)}catch(error){throw failure('JSON '+error.message)}}
// DOM selectors include a template element, but never enter its content.
const domDescendants=node=>node.children.flatMap(c=>typeof c==='string'?[]:[c,...(c.tag==='template'?[]:domDescendants(c))])
const directCarrier=node=>{
 need(!Object.hasOwn(node.attrs,'data-props'),'unreviewed data-props overrides template')
 const descendants=domDescendants(node)
 need(!descendants.some(c=>c.tag==='template'&&Object.hasOwn(c.attrs,'data-react-html-prop')),'unreviewed HTML property override')
 const carriers=node.children.filter(c=>typeof c!=='string'&&c.tag==='template'&&c.attrs.type==='application/json')
 need(carriers.length===1&&descendants.find(c=>c.tag==='template'&&c.attrs.type==='application/json')===carriers[0],'missing, ambiguous or shadowed component template');return readTemplateData(carriers[0])
}
const within=(node,predicate)=>typeof node==='string'||node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.flatMap(c=>within(c,predicate))]
export function readCorporate(html){
 const doc=readVisibleNativeDocument(html,{strict:true}),headers=doc.nodes(n=>n.tag==='div'&&n.attrs['data-react-component']==='GlobalHeader'&&(n.attrs.class||'').split(/\s+/).includes('react-mount'))
 need(headers.length===1,'missing active normal corporate header');const header=headers[0],props=directCarrier(header)
 need(props.authorMode===false&&props.globalHeader?.homepageLink?.url==='/en.html'&&props.globalHeader?.logo?.imageLarge&&props.globalHeader.logoAltText==='Stantec logo','unreviewed normal header binding')
 const containers=within(header,n=>(n.attrs.class||'').split(/\s+/).includes('global-header__children'))
 need(containers.length===1,'managed header children boundary missing')
 const items=within(containers[0],n=>n.attrs['data-react-component']==='NavigationItem'&&(n.attrs.class||'').split(/\s+/).includes('react-mount')).map(directCarrier),careers=items.filter(n=>n.title==='careers')
 need(careers.length===1,'missing or ambiguous normal careers navigation');const career=careers[0]
 need((career.disableSubmenu===false||career.disableSubmenu==='false')&&career.ctaLink?.text==='Find a Job'&&career.ctaLink.url===BOARD,'disabled or conflicting careers delegation')
 need(career.subMenus?.filter(n=>n.label==='Search & Apply'&&n.link===BOARD&&Array.isArray(n.subMenuLevel2)&&n.subMenuLevel2.length===0).length===1,'unreviewed careers search link')
 const bootstrapPath=new URL(CORPORATE_CLIENTS[0].url).pathname,mainPath=new URL(CORPORATE_CLIENTS[1].url).pathname
 need(doc.nodes(n=>n.tag==='script'&&n.attrs.src===bootstrapPath&&!Object.hasOwn(n.attrs,'nomodule')).length===1,'active corporate bootstrap missing')
 need(doc.nodes(n=>n.tag==='link'&&n.attrs.rel==='modulepreload'&&n.attrs.href===mainPath).length===1,'corporate renderer preload missing')
 return{careersURL:CAREERS,finalCorporateURL:CORPORATE_CHAIN.at(-1),boardURL:BOARD,globalHeader:props.globalHeader,authorMode:false,managedChildrenSelector:'.global-header__children',careerItem:career,normalHeaderChildBinding:true,programsExecuted:false}
}
export function readBoard(html){
 const doc=readNativeDocument(html),carriers=doc.nodes(n=>n.tag==='script'&&typeof n.raw==='string'&&n.raw.includes('window.__NUXT__.config'))
 need(carriers.length===1,'missing or ambiguous native configuration')
 const carrier=carriers[0],type=(carrier.attrs.type||'').trim().toLowerCase()
 need(['','text/javascript','application/javascript'].includes(type)&&!['src','nomodule','language'].some(k=>Object.hasOwn(carrier.attrs,k)),'native configuration is not a supported executable inline script')
 const config=readNativeConfig(carrier.raw),p=config.public
 need(doc.nodes(n=>n.tag==='script'&&n.attrs.type==='module'&&n.attrs.src===new URL(NATIVE_CLIENTS[0].url).pathname).length===1,'active reviewed Nuxt entry missing')
 need(p&&['google_talent','solr'].includes(p.source)&&p['x-origin']==='stantec.jobs'&&p['job-folder']==='stantec-jobs'&&p.num_items===50&&p['add-assets']===true&&p.use_solr_filters===true,'native search or role configuration changed')
 need(!Object.hasOwn(p,'api-url')&&!Object.hasOwn(p,'buids'),'unreviewed native endpoint or business filter override')
 need(p.filters?.filter(f=>f.display==='Country'&&f.key==='country'&&f.name==='location').length===1,'native country filter changed')
 need(config.app?.baseURL==='/'&&config.app.buildAssetsDir==='/_nuxt/','native asset base changed')
 return{boardURL:BOARD,configuredSource:p.source,effectiveCountrySource:'solr',origin:p['x-origin'],jobFolder:p['job-folder'],numItems:50,addAssets:true,useSolrFilters:true,buildID:config.app.buildId,countryFilter:{display:'Country',key:'country',name:'location'},requestGeolocationUsed:false,programsExecuted:false}
}
export function verifyIndiaRoute(html){
 const doc=readVisibleNativeDocument(html,{strict:true})
 need(doc.nodes(n=>n.tag==='a'&&['/locations/ind/jobs/',INDIA].includes(n.attrs.href)).length>0,'active declared native India route missing')
}
export const verifyClient=(bytes,contract)=>need(createHash('sha256').update(bytes).digest('hex')===contract.sha256,'published client contract changed: '+new URL(contract.url).pathname)
