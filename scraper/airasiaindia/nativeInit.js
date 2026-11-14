import {createHash} from 'node:crypto'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {parseBoundedProgram} from '../../scraper-support/utils/remoteScriptData.js'
import {readAixNativeInit as readStrictNativeInit} from '../bounteous/nativeScriptContract.js'

const walk=node=>!node||typeof node!=='object'?[]:[node,...Object.values(node).flatMap(value=>Array.isArray(value)?value.flatMap(walk):walk(value))]
const sha=value=>createHash('sha256').update(value).digest('hex')
// The current SAP referrer program initializes the existing namespace and only
// writes referrerTracking.status. Qualify its complete AST, masking just the
// anonymous tracking UUID; it cannot replace init, employer, brand or query.
const trackingProfile='384703ddfdec4aac456baf1b1cf8cf16e5c2c575913292b1eed337b0c796e036'
const isReviewedTracking=source=>{
 let ast
 try{ast=parseBoundedProgram(source)}catch{return false}
 const ids=walk(ast).filter(node=>node.type==='VariableDeclarator'&&node.id?.name==='ctid')
 if(ids.length!==1||ids[0].init?.type!=='Literal'||typeof ids[0].init.value!=='string'
  ||!/^\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(ids[0].init.value))return false
 ids[0].init.value='<public-session-uuid>'
 return sha(JSON.stringify(ast,(key,value)=>['start','end','raw'].includes(key)?undefined:value))===trackingProfile
}
export function readAixNativeInit(html){
 const doc=document(html),tracking=[]
 // Match the strict reader's executable/inert contexts exactly. Ranges come
 // from the parsed document, so a copy inside a string cannot mask real code.
 const visit=node=>{
  if(typeof node==='string'||['template','noscript','textarea','title','style','iframe','plaintext','xmp','noembed','noframes'].includes(node.tag))return
  if(node.tag==='script'){
   if(!node.attrs.src&&/^(?:|text\/javascript|application\/javascript|module)$/.test((node.attrs.type||'').toLowerCase())&&isReviewedTracking(node.raw||''))tracking.push(node)
   return
  }
  node.children.forEach(visit)
 }
 visit(doc.root)
 if(tracking.length>1)throw Error('AirAsia India native tracking profile is duplicated')
 const node=tracking[0]
 return readStrictNativeInit(node?html.slice(0,node.start)+html.slice(node.end):html)
}
