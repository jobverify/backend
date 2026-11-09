import os from 'node:os';
export const cpuTotals = cpus => cpus.reduce((total,cpu)=>({idle:total.idle+cpu.times.idle,total:total.total+Object.values(cpu.times).reduce((n,value)=>n+value,0)}),{idle:0,total:0});
export const resourceSnapshot = (previous,current,totalMemory,freeMemory) => ({
 cpuPercent:previous ? 100*(1-(current.idle-previous.idle)/(current.total-previous.total)) : null,
 memoryPercent:100*(1-freeMemory/totalMemory),totalMemoryBytes:totalMemory,freeMemoryBytes:freeMemory,
});
export const createResourceSampler = () => {let previous=null;return ()=>{const current=cpuTotals(os.cpus());const sample=resourceSnapshot(previous,current,os.totalmem(),os.freemem());previous=current;return {...sample,at:new Date().toISOString()};};};
/** A threshold stop is latched. Monitoring is independent of an awaiting inference request. */
export const createResourceMonitor = ({sample=createResourceSampler(),onSample=()=>{},onStop=()=>{},limit=90,intervalMs=2000}={}) => {
 if(!Number.isFinite(limit)||limit<=0||limit>100||!Number.isFinite(intervalMs)||intervalMs<1)throw new Error('Invalid resource limits');
 let stopped=false,busy=false,timer,recordFailure;
 // Resolve with the error so timer-driven failures can be awaited without
 // creating an unhandled rejection for callers using check() directly.
 const failure=new Promise(resolve=>{recordFailure=resolve;});
 const stop=()=>{if(timer)clearInterval(timer);timer=null;};
 const halt=async(reading,reason)=>{
  if(stopped)return;
  stopped=true;stop();
  try{await onStop(reading,reason);}catch(error){recordFailure(error);throw error;}
 };
 const check=async()=>{if(stopped||busy)return;busy=true;let reading;
  try{
   try{reading=await sample();if(!reading||!(reading.cpuPercent===null||Number.isFinite(reading.cpuPercent)&&reading.cpuPercent>=0&&reading.cpuPercent<=100)||!Number.isFinite(reading.memoryPercent)||reading.memoryPercent<0||reading.memoryPercent>100)throw new Error('Invalid resource sample');
    await onSample(reading);
   }catch(error){await halt({...reading,error:error.message},'monitor_error');return;}
   if(reading.cpuPercent>limit||reading.memoryPercent>limit)await halt(reading,'resource_limit');
  }finally{busy=false;}
 };
 return {check,failure,start:async()=>{await check();if(!stopped&&!timer)timer=setInterval(()=>{void check().catch(recordFailure);},intervalMs);},stop,get stopped(){return stopped;}};
};
