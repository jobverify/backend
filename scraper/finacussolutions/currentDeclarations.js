import {createHash} from 'node:crypto'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {need,failure} from './currentErrors.js'
export {need,failure,isFailure} from './currentErrors.js'

export const HOME='https://www.finacus.co.in/',CAREERS=HOME+'careers/',ABOUT=HOME+'about/',AJAX=HOME+'wp-admin/admin-ajax.php',APPLY=CAREERS+'#careerform'
export const BRAND='Finacus Solutions Private Limited'
export const COUNTRY_RELATION='From our headquarters in Mumbai, India, we are expanding steadily across Asia, Africa, and the Americas.'
export const CLIENT_HASHES={
 'simple-ajax-careers-position.js':'9a10b456b2e472d4c9505215fe60c3aa61137d62032d021bf5d1a596b38b24d2',
 'main.js':'2202c72ddd8a408be600e4dbc102f26f91231dfcc0d95ce5a8be65880d1be1ab',
 'rocket-loader.min.js':'ccf00d1923b0131a10e0c6d26f95e5dee6ebf8621a27e83c5a2f68a2e0093142',
}
export const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
export const numeric=value=>typeof value==='string'&&/^[1-9]\d*$/.test(value)&&Number.isSafeInteger(Number(value))
export const one=(nodes,label)=>{need(nodes.length===1,'expected one '+label);return nodes[0]}
export const all=node=>typeof node==='string'?[]:[node,...node.children.flatMap(all)]
export const within=(node,predicate)=>all(node).filter(n=>!n.inert&&predicate(n))
export const hasClass=(node,name)=>(node.attrs.class||'').split(/\s+/).includes(name)
// Concatenate inline text as the authored DOM does. Block boundaries alone
// add separators; a mandatory inline qualifier must never be split or lost.
const blocks=new Set(['h1','h2','h3','h4','h5','h6','p','li','ul','ol','div','br','section'])
const decode=value=>{try{return decodeNativeEntities(value)}catch(error){throw failure('HTML text: '+error.message)}}
export const flow=node=>typeof node==='string'?decode(node):node.inert||['script','style'].includes(node.tag)?'':(blocks.has(node.tag)?'\n':'')+node.children.map(flow).join('')+(blocks.has(node.tag)?'\n':'')
export const snapshot=node=>typeof node==='string'?decode(node):{tag:node.tag,attrs:{...node.attrs},children:node.children.map(snapshot),...(typeof node.raw==='string'?{raw:node.raw}:{})}
export function document(html){
 try{return readVisibleNativeDocument(html,{strict:true})}catch(error){throw failure('HTML contract: '+error.message)}
}
const identity=doc=>{
 need(doc.nodes(n=>n.tag==='base').length===0,'unreviewed document base')
 need(doc.nodes(n=>n.tag==='footer'&&norm(flow(n)).includes(BRAND)).length===1,'own corporate publisher identity missing')
}
export function readHome(html){
 const doc=document(html);identity(doc)
 for(const url of [CAREERS,ABOUT])need(doc.nodes(n=>n.tag==='a'&&n.attrs.href===url&&norm(flow(n))).length>0,'active own navigation missing: '+url)
 return{publisher:BRAND,careersURL:CAREERS,aboutURL:ABOUT,programsExecuted:false}
}
export const detailURL=id=>{need(numeric(id),'invalid native posting ID');return AJAX+'?action=finacus_careers_position_ajax_request&get_position_id='+id}
export function readCareers(html){
 const doc=document(html);identity(doc)
 one(doc.nodes(n=>n.tag==='h2'&&norm(flow(n))==='Current Openings'),'current openings heading')
 const scripts=doc.nodes(n=>n.tag==='script'),standard=n=>[undefined,'','text/javascript','application/javascript'].includes(n.attrs.type)&&!Object.hasOwn(n.attrs,'nomodule')
 const loader=one(scripts.filter(n=>standard(n)&&n.attrs.src==='/cdn-cgi/scripts/7d0fa10a/cloudflare-static/rocket-loader.min.js'),'declared active loader'),settings=loader.attrs['data-cf-settings']?.match(/^([a-f0-9]{24}-)\|\d+$/)
 need(settings,'unreviewed native loader settings')
 const effective=scripts.filter(n=>!Object.hasOwn(n.attrs,'nomodule')&&(standard(n)||n.attrs.type===settings[1]+'text/javascript'))
 const clients=['simple-ajax-careers-position.js','main.js'].map(file=>{
  const n=one(effective.filter(n=>n.attrs.src?.startsWith(HOME+'wp-content/themes/finacus/js/'+file+'?ver=')),'declared '+file),url=new URL(n.attrs.src)
  need(/^\d+(?:\.\d+)*$/.test(url.searchParams.get('ver'))&&[...url.searchParams].length===1,'unreviewed public client query')
  return{url:url.href,sha256:CLIENT_HASHES[file]}
 })
 clients.push({url:new URL(loader.attrs.src,HOME).href,sha256:CLIENT_HASHES['rocket-loader.min.js']})
 const config=one(effective.filter(n=>n.raw?.includes('finacus_ajax_obj')),'active public AJAX configuration')
 need(!config.attrs.src&&/^\s*var finacus_ajax_obj\s*=\s*\{\s*"ajaxurl"\s*:\s*"https:\/\/www\.finacus\.co\.in\/wp-admin\/admin-ajax\.php"\s*\};\s*(?:\/\/#[^\r\n]*)?\s*$/.test(config.raw),'unreviewed effective AJAX configuration')
 const application=one(doc.nodes(n=>n.tag==='form'&&n.attrs.action==='/careers/#wpcf7-f234-p190-o1'),'declared generic application form')
 need(application.attrs.method?.toLowerCase()==='post','generic application method changed')
 const input=one(within(application,n=>n.tag==='input'&&n.attrs.name==='c_position'),'generic position input');need(input.attrs.type==='text','generic position input changed')
 need(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='#careerform').length>0,'generic application anchor missing')
 const root=one(doc.nodes(n=>n.tag==='root'),'careers document'),cardNodes=all(root).filter(n=>n.tag==='a'&&hasClass(n,'positionget'))
 need(cardNodes.length>0&&cardNodes.length<=100,'missing or excessive native posting cards')
 const cards=cardNodes.map(n=>{
  need(!n.inert&&numeric(n.attrs['data-id'])&&norm(n.attrs['data-career-position']).length>2&&!/[<>]/.test(n.attrs['data-career-position'])&&!Object.hasOwn(n.attrs,'href'),'inactive or malformed native posting card')
  need(norm(flow(n))===norm(n.attrs['data-career-position']),'card heading and application position disagree')
  need(Object.keys(n.attrs).every(k=>['data-id','class','data-career-position'].includes(k)),'unreviewed native card attributes')
  return{jobId:n.attrs['data-id'],title:norm(n.attrs['data-career-position']),nativeApplicationPosition:n.attrs['data-career-position'],nativeCard:snapshot(n)}
 })
 need(new Set(cards.map(c=>c.jobId)).size===cards.length&&new Set(cards.map(c=>c.title)).size===cards.length,'duplicate native posting identity')
 return{publisher:BRAND,cards,clients,ajaxURL:AJAX,applicationURL:APPLY,reportedTotal:null,programsExecuted:false}
}
export function readCountryContext(html){
 const doc=document(html);identity(doc)
 const section=one(doc.nodes(n=>n.tag==='section'&&hasClass(n,'zoom-image-row')),'own company introduction')
 one(within(section,n=>/^h[1-6]$/.test(n.tag)&&norm(flow(n))==='Empowering Banks Through Digital Intelligence'),'own company introduction heading')
 need(norm(flow(section)).includes('Finacus Solutions has been at the forefront'),'own introduction employer missing')
 const relationBlock=n=>['p','li','div','section','h1','h2','h3','h4','h5','h6'].includes(n.tag)&&/\bheadquarters?\b|\b(?:(?:worksite|workplace|work|office|headquarters)\s+)?country\s*:/i.test(norm(flow(n)))
 const candidates=doc.nodes(relationBlock),contexts=candidates.filter(n=>!within(n,c=>c!==n&&relationBlock(c)).length)
 const paragraph=one(contexts,'active own city-country relation')
 need(paragraph.tag==='p'&&within(section,n=>n===paragraph).length===1&&norm(flow(paragraph))===COUNTRY_RELATION,'own city-country relation unavailable or changed')
 need(Object.keys(paragraph.attrs).length===0&&paragraph.children.every(c=>typeof c==='string'),'unreviewed country relation markup')
 // This relation supplies only the country of the literally named city. It
 // supplies neither a company-wide default nor a precise Seepz address.
 return{url:ABOUT,publisher:BRAND,city:'Mumbai',country:'India',paragraph:COUNTRY_RELATION,paragraphModel:snapshot(paragraph),introductionParagraphs:within(section,n=>n.tag==='p').map(snapshot),cityDictionaryUsed:false,headquartersCountryDefaultUsed:false,exactWorksiteAddressVerified:false}
}
export const verifyClient=(bytes,contract)=>need(createHash('sha256').update(bytes).digest('hex')===contract.sha256,'declared public client contract changed: '+new URL(contract.url).pathname)
