import {getDocument,OPS,VerbosityLevel} from 'pdfjs-dist/legacy/build/pdf.mjs'
import {fileURLToPath} from 'node:url'
const check=(ok,message)=>{if(!ok)throw Object.assign(Error("btlindia"+' native PDF: '+message),{abortRetries:true})}
export const readNativePdf=async(value,{signal}={})=>{
 signal?.throwIfAborted();const bytes=Buffer.from(value);check(bytes.length<5000000&&bytes.subarray(0,5).toString()==='%PDF-','unavailable/non-PDF document')
 const task=getDocument({data:new Uint8Array(bytes),useWorkerFetch:false,isEvalSupported:false,disableAutoFetch:true,verbosity:VerbosityLevel.ERRORS,standardFontDataUrl:fileURLToPath(new URL('../../node_modules/pdfjs-dist/standard_fonts/',import.meta.url)).replaceAll('\\','/')})
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(Object.assign(Error('Native PDF extraction deadline'),{abortRetries:true})),20000),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
 let listener;const aborted=new Promise((_,reject)=>{listener=()=>reject(signal?.aborted?signal.reason:combined.reason);combined.addEventListener('abort',listener,{once:true});if(combined.aborted)listener()})
 try{return await Promise.race([(async()=>{const pdf=await task.promise;check(pdf.numPages>0&&pdf.numPages<=8,'unreviewed document page scope');const pages=[],visibilityLimits=[]
  const optional=await pdf.getOptionalContentConfig();if([...optional].some(([,group])=>group.visible===false))visibilityLimits.push('inactive-optional-content')
  for(let pageNo=1;pageNo<=pdf.numPages;pageNo++){combined.throwIfAborted();const page=await pdf.getPage(pageNo),content=await page.getTextContent(),operators=await page.getOperatorList(),stack=[];let state={mode:0,fill:1,stroke:1}
   for(let i=0;i<operators.fnArray.length;i++){const op=operators.fnArray[i],args=operators.argsArray[i];if(op===OPS.save)stack.push({...state});else if(op===OPS.restore)state=stack.pop()||state;else if(op===OPS.setTextRenderingMode)state.mode=args[0];else if(op===OPS.setGState)for(const[key,value]of args[0]||[]){if(key==='ca')state.fill=value;if(key==='CA')state.stroke=value}
    if([OPS.showText,OPS.showSpacedText,OPS.nextLineShowText,OPS.nextLineSetSpacingShowText].includes(op)){const mode=state.mode%4,invisible=mode===3||mode===0&&state.fill===0||mode===1&&state.stroke===0||mode===2&&state.fill===0&&state.stroke===0;if(invisible)visibilityLimits.push('invisible-text-rendering')}
   }
   const fragments=[];for(const item of content.items){if(typeof item.str!=='string')continue;const[x0,y0,x1,y1]=page.view,x=item.transform?.[4],y=item.transform?.[5],height=Math.abs(item.height||0);if(Number.isFinite(x)&&Number.isFinite(y)&&(x<x0-height||x>x1+height||y<y0-height||y>y1+height))visibilityLimits.push('off-page-text');fragments.push(item.str);if(item.hasEOL)fragments.push('\n')}
   pages.push(fragments.join(' ').replace(/[ \t]+\n/g,'\n').trim())
  }
  const metadata=await pdf.getMetadata();return {text:pages.join('\n\n'),pages:pdf.numPages,visibilityQualified:visibilityLimits.length===0,visibilityLimits:[...new Set(visibilityLimits)],documentMetadata:metadata.info,publicationDateQualified:false}
 })(),aborted])}finally{clearTimeout(timer);combined.removeEventListener('abort',listener);await task.destroy()}
}
