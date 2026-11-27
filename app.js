"use strict";
const $=id=>document.getElementById(id), E=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el}, L=Ledger;
const key="money-changer-lkr-v1";
const googleURL="https://www.google.com/finance/quote/LKR-IDR";
const autoKey="money-changer-lkr-auto-source-v1";
let auto=false,fx=null,fxLoading=false,tappedAt=0;
try{auto=localStorage.getItem(autoKey)==="exchangerate.dev"}catch{}
const reference=()=>auto?(FX.eligible(fx)?fx.rate:0):L.google(state);
const sellQuote=()=>Math.floor(reference()*(10000-state.settings.sell_discount_bps)/10000);
async function refreshAuto(force=false){
 if(!state||!auto||fxLoading||(!force&&Date.now()-tappedAt<120000))return;
 tappedAt=Date.now();fxLoading=true;render();
 try{const incoming=await FX.request();if(auto)fx=incoming}catch{}
 finally{fxLoading=false;if(state)render()}
}
function chooseAuto(on){
 localStorage.setItem(autoKey,on?"exchangerate.dev":"google");
 auto=on;close();render();if(on)refreshAuto(true)
}
let state=null, raw=null, writable=true;
const notice=x=>{$("notice").textContent=x};
function active(){ $("welcome").classList.toggle("hidden",!!state||!writable);$("app").classList.toggle("hidden",!state); }
function read(){
 try{raw=localStorage.getItem(key);state=raw?L.validate(JSON.parse(raw)):null;writable=true;notice(state?"":"Versi pribadi · Mulai buku LKR atau impor cadangan LKR.")}
 catch(e){writable=false;state=null;notice("Data di browser tidak dapat dibaca. Jangan hapus data browser. "+e.message)}
 active();if(state){render();refreshAuto()}
}
function save(candidate){
 if(!writable)throw Error("Penyimpanan sedang tidak tersedia.");
 const safe=L.validate(candidate), next=JSON.stringify(safe);
 if(localStorage.getItem(key)!==raw)throw Error("Catatan sudah berubah di tab lain. Muat ulang sebelum menyimpan.");
 localStorage.setItem(key,next);raw=next;state=safe;active();render()
}
const change=fn=>{const d=JSON.parse(raw);fn(d);save(d)};
function cardCapitalTotals(transactions){
 let idr=0n,lkrCents=0n,customerSellIdr=0n;
 for(const t of transactions){
  if(t.transaction_type!=="ADD_CAPITAL"&&t.transaction_type!=="CUSTOMER_SELL")continue;
  const amount=BigInt(t.base_amount);
  idr+=amount;lkrCents+=BigInt(Math.round(t.trade_amount*100));
  if(t.transaction_type==="CUSTOMER_SELL")customerSellIdr+=amount;
 }
 return {idr,lkrCents,customerSellIdr};
}
function buyQuote({idr,lkrCents}=cardCapitalTotals(state.transactions)){
 // Apply markup and ceil exactly, using LKR hundredths and percentage basis points.
 const denominator=lkrCents*100n;
 return denominator>0n?(idr*BigInt(10000+state.settings.buy_markup_bps)+denominator-1n)/denominator:0n;
}
function render(){
 const b=state.balance,s=state.settings,m=reference(),capital=cardCapitalTotals(state.transactions);
 const basis=capital.lkrCents>0n?Number(capital.idr)*100/Number(capital.lkrCents):null,buy=buyQuote(capital);
 $("rateSource").textContent=auto?"KURS OTOMATIS":"KURS GOOGLE";$("fxCredit").classList.toggle("hidden",!auto);
 const stamp=m?new Date(auto?fx.at:s.google_set_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
 // Modal IDR shows customer sales at 101% of actual paid IDR; cash and cost basis stay actual.
 const modalIdr=BigInt(Math.round(b.base_amount))+(capital.customerSellIdr*101n+50n)/100n;
 const vals={baseBal:L.idr(modalIdr),tradeBal:L.fmt(b.trade_amount)+" LKR",lkrHand:L.fmt(b.lkr_in_hand)+" LKR",idrHand:L.idr(b.cash_idr),basis:basis===null?"—":L.rate(basis),buyRate:buy?L.rate(buy):"—",sellRate:sellQuote()?L.rate(sellQuote()):"—",marketRate:m?"Rp "+L.fmt(m,6):"—",rateMsg:auto?(fxLoading?"Memuat…":m?stamp:"Data belum tersedia"):(m?"Manual · "+stamp:"Pilih sumber kurs")};
 for(const [k,v] of Object.entries(vals))$(k).textContent=v;
}
function groupAmount(input,event){
 const raw=input.value, pos=input.selectionStart;
 if(event?.inputType==="insertFromPaste"&&raw.includes(".")&&!/^\d{1,3}(?:\.\d{3})+(?:,\d*)?$/.test(raw))return;
 if(!/^[\d.]*(?:,\d*)?$/.test(raw))return;
 let plain=raw.replaceAll(".","");
 let left=pos===null?null:raw.slice(0,pos).replaceAll(".","").length;
 // If backspace removed only a separator, remove the digit just before it.
 if(event?.inputType==="deleteContentBackward"&&plain===input.dataset.plainAmount&&left>0){
  plain=plain.slice(0,left-1)+plain.slice(left);left--;
 }
 const grouped=plain.replace(/^\d+/,digits=>digits.replace(/\B(?=(\d{3})+(?!\d))/g,"."));
 input.dataset.plainAmount=plain;
 if(grouped===raw)return;
 input.value=grouped;
 if(left===null)return;
 let i=0,n=0;
 for(;i<grouped.length&&n<left;i++)if(grouped[i]!==".")n++;
 input.setSelectionRange(i,i);
}
function modal(title,help,fields,action,cb){
 const box=$("modalBody");box.replaceChildren();$("modalTitle").textContent=title;$("modalMsg").textContent="";$("modalMsg").className="status";$("modal").classList.remove("hidden");
 if(help){const p=E("p",help);p.className="inline-help";box.append(p)}
 if(!action)return box;
 const form=E("form");const els={};
 for(const f of fields){
  const [name,label,value,opts,kind]=f, wrap=E("div"), l=E("label",label), i=E(opts?"select":"input");wrap.className="field";l.htmlFor=i.id="f_"+name;
  if(opts){for(const o of opts){const e=E("option",o);e.value=o;i.append(e)}}
  else {i.inputMode=kind==="text"?"text":"decimal";i.autocomplete="off";i.maxLength=140}
  i.value=value??"";if(kind==="amount"){i.dataset.plainAmount=i.value.replaceAll(".","");i.oninput=e=>groupAmount(i,e)}
  wrap.append(l,i);form.append(wrap);els[name]=i;
 }
 const b=E("button",action);b.className="primary";form.append(b);box.append(form);
 form.onsubmit=e=>{e.preventDefault();try{cb(els);close()}catch(err){const out=$("modalMsg");out.className="status err";out.textContent=err.name==="QuotaExceededError"?"Penyimpanan browser penuh. Perubahan tidak tersimpan.":err.message}};
 return els;
}
function close(){$("modal").classList.add("hidden")}
$("close").onclick=close;
const field=(name,label,n)=>[name,label,n==null||n===0?"":L.fmt(n,6),null,name==="rate"?null:"amount"];
const val=(els,k,negative=false)=>L.parse(els[k].value,negative);
$("fresh").onclick=()=>{try{save(L.create());notice("Buku LKR baru dibuat. Masukkan modal untuk mulai.");refreshAuto()}catch(e){notice(e.message)}};
$("capitalBtn").onclick=()=>modal("Tambah Modal","Masukkan jumlah yang benar-benar kau tambahkan ke kas atau stok.",[field("a","Modal IDR"),field("u","Modal LKR")],"Simpan",e=>{change(d=>L.capital(d,val(e,"a"),val(e,"u")));notice("Modal tersimpan.")});
for(const [id,type,title] of [["buyBtn","CUSTOMER_BUY","Customer beli LKR"],["sellBtn","CUSTOMER_SELL","Customer jual LKR"]]){
 $(id).onclick=()=>{
 const weBuy=type==="CUSTOMER_SELL";
 const els=modal(title,null,[field("qty","Jumlah LKR"),field("cash",weBuy?"IDR dibayar":"IDR diterima"),["n","Nama customer (opsional)","",null,"text"]],"Catat transaksi",e=>{
  change(d=>L.exchange(d,{type,amount:val(e,"qty"),paid:val(e,"cash"),profit:0,name:e.n.value.trim()}));notice("Transaksi LKR tersimpan.")
 });
 let derived=null;
 const setAmount=(name,value)=>{
  const input=els[name];input.value=value;input.dataset.plainAmount=value.replaceAll(".","");
  derived=value?name:null;
 };
 const clearDerived=name=>{if(derived===name)setAmount(name,"")};
 els.cash.addEventListener("input",()=>{
  if(derived==="cash")derived=null;
  if(weBuy)return;
  let idr=0;try{idr=val(els,"cash")}catch{}
  const rate=buyQuote();
  if(!rate||idr<=0||!Number.isInteger(idr)){clearDerived("qty");return}
  const cents=(BigInt(idr)*100n+rate/2n)/rate;
  const decimals=String(cents%100n).padStart(2,"0").replace(/0+$/,"");
  setAmount("qty",cents?L.fmt(cents/100n,0)+(decimals?","+decimals:""):"");
 });
 els.qty.addEventListener("input",()=>{
  if(derived==="qty")derived=null;
  let amount=0;try{amount=val(els,"qty")}catch{}
  const rate=weBuy?sellQuote():buyQuote();
  if(!rate||amount<=0||Number(amount.toFixed(2))!==amount){clearDerived("cash");return}
  const total=(BigInt(Math.round(amount*100))*BigInt(rate)+50n)/100n;
  setAmount("cash",L.fmt(total,0));
 });
 };
}
$("refreshRate").onclick=()=>{
 if(auto){refreshAuto(true);return;}
 showGoogleRate();
};
function showGoogleRate(){
 modal("Kurs Google LKR → IDR","Masukkan angka untuk 1 LKR.",[field("rate","IDR per 1 LKR",L.google(state))],"Simpan kurs Google",e=>{
  const x=L.parseGoogle(e.rate.value);
  change(d=>{d.settings.google_rate=x;d.settings.google_set_at=new Date().toISOString();d.settings.market_mode="google"});
  if(auto){localStorage.setItem(autoKey,"google");auto=false;render()}
  notice("Kurs Google disimpan.");
 });
 const box=$("modalBody"),p=E("p"),source=E("a","Buka Google Finance (LKR → IDR)");
 source.href=googleURL;source.target="_blank";source.rel="noopener noreferrer";source.style.color="var(--text)";
 p.append(source);box.prepend(p);
 const opt=E("button","Pakai kurs otomatis (bukan Google)");
 opt.type="button";opt.style.marginTop="12px";
 opt.onclick=()=>{try{chooseAuto(true)}catch(e){$("modalMsg").textContent=e.message}};
 box.append(opt,E("p","Jeda ±15 menit."));
};
function percentage(input,max,label){
 const value=input.value.trim();
 const match=/^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(value);
 const points=match?Number(match[1])*100+Number((match[2]??"").padEnd(2,"0")):-1;
 if(points<0||points>max)throw Error(label+" harus 0–"+L.fmt(max/100)+"%, maksimal dua desimal.");
 return points;
}
$("settingsBtn").onclick=()=>{
 const s=state.settings;
 modal("Pengaturan","Kurs Beli ditambah dari Kurs Dasar Modal dan dibulatkan ke atas. Kurs Jual dipotong dari kurs acuan dan dibulatkan ke bawah.",[["bp","Persentase Kurs Beli (%)",L.fmt(s.buy_markup_bps/100)],["sp","Persentase Kurs Jual (%)",L.fmt(s.sell_discount_bps/100)],["bank","Nama bank",s.bank_name,null,"text"],["acc","Nomor rekening",s.bank_account_number,null,"text"],["holder","Atas nama",s.bank_account_name,null,"text"]],"Simpan",e=>{
 const buy=percentage(e.bp,10000,"Persentase Kurs Beli"),sell=percentage(e.sp,9999,"Persentase Kurs Jual");
 change(d=>Object.assign(d.settings,{buy_markup_bps:buy,sell_discount_bps:sell,bank_name:e.bank.value.trim(),bank_account_number:e.acc.value.trim(),bank_account_name:e.holder.value.trim()}));notice("Pengaturan tersimpan.");
 });
 const update=E("button","Atur IDR di Tangan");update.type="button";update.style.marginTop="12px";
 update.onclick=adjustCash;$("modalBody").append(update);
 const reset=E("button","Reset Data");reset.type="button";reset.className="danger";reset.style.marginTop="12px";
 reset.onclick=()=>resetData();$("modalBody").append(reset);
};
function adjustCash(){
 modal("Atur IDR di Tangan","Saldo sekarang: "+L.idr(state.balance.cash_idr)+". Isi salah satu kolom. IDR aktual mengganti saldo, sedangkan Tambah IDR menambah saldo.",[field("actual","IDR aktual (Rp)"),field("add","Tambah IDR (Rp)")],"Simpan saldo",e=>{
  const actual=e.actual.value.trim()!=="",add=e.add.value.trim()!=="";
  if(actual===add)throw Error("Isi salah satu kolom saja.");
  const amount=val(e,actual?"actual":"add");
  if(!Number.isInteger(amount)||(add&&amount<=0))throw Error("Masukkan rupiah bulat. Tambah IDR harus lebih dari nol.");
  change(d=>{d.balance.cash_idr=actual?amount:d.balance.cash_idr+amount});
  notice("Saldo IDR di Tangan diperbarui.");
 });
 const back=E("button","Kembali");back.type="button";back.style.marginTop="12px";
 back.onclick=$("settingsBtn").onclick;$("modalBody").append(back);
}
function resetData(){
 modal("Reset Data","Ini menghapus saldo, transaksi, dan riwayat profit di browser ini. Pengaturan kurs dan rekening tetap. Tindakan ini tidak bisa dibatalkan.",[["confirm","Ketik RESET untuk mengonfirmasi","",null,"text"]],"Hapus data",e=>{
  if(e.confirm.value.trim()!=="RESET")throw Error("Ketik RESET untuk melanjutkan.");
  change(d=>{d.balance=L.create().balance;d.transactions=[];d.profitHistory=[]});notice("Data transaksi dan saldo sudah direset.");
 });
 const box=$("modalBody");
 const submit=box.querySelector("form button");submit.className="danger";
 const cancel=E("button","Batal");cancel.type="button";cancel.style.marginTop="12px";cancel.onclick=$("settingsBtn").onclick;box.append(cancel);
}
const showHistory=(title,customer)=>{
 const box=modal(title,"");
 const list=state.transactions.filter(t=>t.transaction_type.startsWith("CUSTOMER_")===customer).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const visible=list.slice(0,customer?10:5);
 if(!visible.length)box.append(E("p","Belum ada transaksi."));
 for(const t of visible){
  const item=E("div");item.className="history-item entry";
  const label={INITIAL_CAPITAL:"Modal awal",ADD_CAPITAL:"Tambah modal",CUSTOMER_BUY:"Customer beli LKR",CUSTOMER_SELL:"Customer jual LKR"}[t.transaction_type];
  item.append(E("strong",label+(t.customer_name?" · "+t.customer_name:"")),E("p",L.idr(t.base_amount)+" · "+L.fmt(t.trade_amount,6)+" LKR"),E("small",new Date(t.created_at).toLocaleString("id-ID")+(t.customer_rate?" · "+L.rate(t.customer_rate)+"/LKR":"")));
  box.append(item)
 }
};
$("customerHistoryBtn").onclick=()=>showHistory("Riwayat Transaksi Customer",true);
$("capitalHistoryBtn").onclick=()=>showHistory("Riwayat Tambah Modal",false);
function quote(isBuy){
 const rate=isBuy?buyQuote():sellQuote(),s=state.settings;
 if(!rate){
  if(!isBuy){notice("Isi kurs dulu sebelum membagikan.");return}
  const box=modal("Bagikan Kurs Beli","Kurs beli belum tersedia. Catat modal IDR dan LKR atau transaksi Customer Jual LKR untuk menghitung Kurs Dasar Modal.");
  const b=E("button","Tambah Modal");b.type="button";b.onclick=$("capitalBtn").onclick;box.append(b);return;
 }
 const text=(isBuy?"KURS BELI LKR":"KURS JUAL LKR")+"\n1 LKR = "+L.rate(rate)+(isBuy&&s.bank_account_number?"\n\n"+s.bank_name+"\n"+s.bank_account_number+"\n"+s.bank_account_name:"");
 if(typeof navigator.share==="function"){
  try{Promise.resolve(navigator.share({title:"Money Changer",text})).catch(e=>{if(e?.name!=="AbortError")previewQuote(text)});return}catch(e){if(e?.name==="AbortError")return}
 }
 previewQuote(text);
}
function previewQuote(text){
 const b=modal("Salin kurs",""),message=E("textarea"),c=E("button","Salin");
 message.value=text;message.readOnly=true;message.rows=text.split("\n").length+1;message.className="quote-text";message.setAttribute("aria-label","Teks kurs untuk dibagikan");
 b.append(message,c);c.onclick=async()=>{try{await navigator.clipboard.writeText(text);$("modalMsg").textContent="Disalin."}catch{message.focus();message.select();$("modalMsg").textContent="Salin teks yang dipilih."}};
}
$("shareBuyBtn").onclick=()=>quote(true);$("shareSellBtn").onclick=()=>quote(false);
function download(){
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));const a=E("a");a.href=url;a.download="money-changer-lkr-"+new Date().toISOString().slice(0,10)+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$("welcomeImport").onclick=()=>$("importFile").click();
$("importFile").onchange=async e=>{
 const f=e.target.files[0];e.target.value="";if(!f)return;
 try{
  if(f.size>9e6)throw Error("Cadangan terlalu besar.");
  const d=L.validate(JSON.parse(await f.text()));
  if(state){download();notice("Cadangan buku yang sedang dipakai sudah diminta untuk diunduh.");if(!confirm("Impor ini akan mengganti buku LKR di perangkat ini. Lanjut setelah buku yang sekarang sudah dicadangkan?"))return}
  if(!confirm("Impor "+d.transactions.length+" transaksi LKR dan "+d.profitHistory.length+" riwayat profit?"))return;
  save(d);notice("Cadangan LKR berhasil diimpor.");
 }catch(e){notice("Impor gagal. Data yang sekarang tidak diganti. "+e.message)}
};
function clock(){const d=new Date();$("todayDate").textContent=d.toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"});$("todayTime").textContent=d.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})}
clock();setInterval(clock,30000);setInterval(()=>{if(!document.hidden)refreshAuto()},300000);document.addEventListener("visibilitychange",()=>{if(!document.hidden)refreshAuto()});addEventListener("storage",e=>{if(e.key===key||e.key===null){read();notice("Catatan diperbarui dari tab lain.");close()}});read();
