"use strict";
const FX=(()=>{
 const url="https://api.exchangerate.dev/v1/latest/LKR?symbols=IDR";
 const maxAge=45*60*1000;
 function eligible(q,now=Date.now()){
  return !!q&&Number.isFinite(q.rate)&&q.rate>0&&q.rate<1e6&&Number.isFinite(q.at)&&q.at<=now+60000&&now-q.at<=maxAge&&q.stale===false;
 }
 function fromResponse(j,now=Date.now()){
  const x={rate:j?.rates?.IDR,at:Date.parse(j?.effective_at?.IDR??""),stale:j?.stale?.IDR!==false||j?.sources?.IDR!=="live"||j?.market_session!=="open"};
  if(j?.result!=="success"||j.base!=="LKR"||!Number.isFinite(x.rate)||x.rate<=0||!Number.isFinite(x.at)||x.at>now+60000)throw Error("Data kurs pasar tidak valid.");
  return x;
 }
 async function request(){
  const c=new AbortController();const timer=setTimeout(()=>c.abort(),8000);
  try{
   const r=await fetch(url,{signal:c.signal,credentials:"omit",referrerPolicy:"no-referrer",cache:"no-store"});
   if(!r.ok)throw Error("Kurs pasar belum tersedia.");
   return fromResponse(await r.json());
  }finally{clearTimeout(timer)}
 }
 return {eligible,fromResponse,request};
})();
if(typeof module!=="undefined")module.exports=FX;
