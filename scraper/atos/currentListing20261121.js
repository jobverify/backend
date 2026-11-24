import {createHash} from 'node:crypto'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'

const failure=message=>Object.assign(Error('Atos current native: '+message),{softFailure:true,abortRetries:true,failureKind:'coverage_gap',sourceScopeComplete:false,lifecycleCleanupAllowed:false})
const need=(value,message)=>{if(!value)throw failure(message)}
const one=(values,name)=>{need(values.length===1,'missing or ambiguous '+name);return values[0]}
const sha=value=>createHash('sha256').update(value).digest('hex')
const hasClass=(node,name)=>(node.attrs.class??'').split(/\s+/).includes(name)
const norm=value=>decodeNativeEntities(value).replace(/\s+/g,' ').trim()

// Only the original selected row's route, title, placement and displayed date
// are data. Every tag, attribute, control and surrounding text remains in its
// reviewed row shape; foreign countries are rejected before this projection.
function rowShape(row){
 const path=new URL(row.url).pathname
 const visit=(node,field=null)=>{
  if(typeof node==='string'){
   if(!field||!norm(node))return node
   const values=field==='title'?[row.title]:field==='location'?row.locations:[row.publishDate]
   need(values.includes(norm(node)),'unbound native row '+field+' value')
   return node.replace(/\S[\s\S]*\S|\S/,'CURRENT_NATIVE_'+field.toUpperCase())
  }
  if(hasClass(node,'jobTitle'))field='title'
  else if(hasClass(node,'jobLocation'))field='location'
  else if(hasClass(node,'jobDate'))field='date'
  const attrs={...node.attrs}
  if(node.tag==='a'&&attrs.href===path)attrs.href='CURRENT_NATIVE_ROLE_ROUTE'
  return{...node,attrs,children:node.children.map(child=>visit(child,field))}
 }
 return sha(JSON.stringify(visit(row.originalTree)))
}

export function projectAtosNativeListing(proof,rows,reviewedRows){
 need(rows.length>0&&rows.length<=500&&new Set(rows.map(row=>row.url)).size===rows.length&&new Set(rows.map(row=>row.routeID)).size===rows.length,'native selected row count or identity changed')
 const shapes=new Set(reviewedRows.map(rowShape))
 need(rows.every(row=>shapes.has(rowShape(row))),'unreviewed complete native row schema/control')
 const table=one(proof.nodes.filter(node=>node.tag==='table'&&node.attrs.id==='searchresults'),'native selected results table')
 const body=one(table.children.filter(node=>typeof node!=='string'&&node.tag==='tbody'),'native selected rows owner')
 const children=body.children.filter(node=>typeof node!=='string'||norm(node))
 need(children.length===rows.length&&children.every((node,index)=>node===rows[index].originalTree),'unbound native selected row content')
 const count=rows.length,label='Search results for India. Page 1 of 1, Results 1 to '+count+' of '+count
 need(table.attrs['aria-label']===label,'native selected table country/count changed')
 let context=proof.projectedHTML
 need(typeof context==='string','original native projection unavailable')
 const open='<tbody>',close='</tbody>',start=context.indexOf(open),end=context.indexOf(close,start)
 need(start>=0&&end>start&&context.indexOf(open,start+open.length)===-1&&context.indexOf(close,end+close.length)===-1,'ambiguous original native rows boundary')
 const isolated=readNativeDocument('<table>'+context.slice(start,end+close.length)+'</table>')
 need(isolated.nodes(node=>node.tag==='tr'&&hasClass(node,'data-row')).length===rows.length,'original/native rows boundary disagreement')
 context=context.slice(0,start+open.length)+'CURRENT_NATIVE_SELECTED_ROWS'+context.slice(end)
 for(const[original,replacement,occurrences]of[
  ['aria-label="Results 1 – '+count+'"','aria-label="Results 1 – CURRENT_COUNT"',2],
  ['Results <b>1 – '+count+'</b> of <b>'+count+'</b>','Results <b>1 – CURRENT_COUNT</b> of <b>CURRENT_COUNT</b>',2],
  ['aria-label="'+label+'"','aria-label="CURRENT_NATIVE_INDIA_TERMINAL_COUNT"',1],
 ]){
  need(context.split(original).length-1===occurrences,'native complete terminal count binding changed')
  context=context.replaceAll(original,replacement)
 }
 return{contextSHA256:sha(context),observedRows:count,reviewedRowShapes:shapes.size,wholeRemainingContextPreserved:true}
}
