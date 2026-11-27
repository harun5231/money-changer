"use strict";
const $=id=>document.getElementById(id), E=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el}, L=Ledger;
const key="money-changer-lkr-v1";
const googleURL="https://www.google.com/finance/quote/LKR-IDR";
const autoKey="money-changer-lkr-auto-source-v1";
let auto=false,fx=null,fxLoading=false,tappedAt=0;
try{auto=localStorage.getItem(autoKey)==="exchangerate.dev"}catch{}
const reference=()=>auto?(FX.eligible(fx)?fx.rate:0):L.google(state);
const sellQuote=()=>Math.floor(reference()*985/1000);
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
 let idr=0n,lkrCents=0n;
 for(const t of transactions){
  if(t.transaction_type!=="ADD_CAPITAL"&&t.transaction_type!=="CUSTOMER_SELL")continue;
  idr+=BigInt(t.base_amount);lkrCents+=BigInt(Math.round(t.trade_amount*100));
 }
 return {idr,lkrCents};
}
function buyQuote({idr,lkrCents}=cardCapitalTotals(state.transactions)){
 // IDR/LKR × 1.01, rounded up exactly using LKR hundredths.
 return lkrCents>0n?(idr*101n+lkrCents-1n)/lkrCents:0n;
}
function render(){
 const b=state.balance,s=state.settings,m=reference(),capital=cardCapitalTotals(state.transactions);
 const basis=capital.lkrCents>0n?Number(capital.idr)*100/Number(capital.lkrCents):null,buy=buyQuote(capital);
 $("rateSource").textContent=auto?"KURS OTOMATIS":"KURS GOOGLE";$("fxCredit").classList.toggle("hidden",!auto);
 const stamp=m?new Date(auto?fx.at:s.google_set_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
 const vals={baseBal:L.idr(b.base_amount),cashIdr:L.idr(b.cash_idr),tradeBal:L.fmt(b.trade_amount)+" LKR",lkrHand:L.fmt(b.lkr_in_hand)+" LKR",basis:basis===null?"—":L.rate(basis),buyRate:buy?L.rate(buy):"—",sellRate:sellQuote()?L.rate(sellQuote()):"—",marketRate:m?"Rp "+L.fmt(m,6):"—",rateMsg:auto?(fxLoading?"Memuat…":m?stamp:"Data belum tersedia"):(m?"Manual · "+stamp:"Pilih sumber kurs")};
 for(const [k,v] of Object.entries(vals))$(k).textContent=v;
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
  i.value=value??"";wrap.append(l,i);form.append(wrap);els[name]=i;
 }
 const b=E("button",action);b.className="primary";form.append(b);box.append(form);
 form.onsubmit=e=>{e.preventDefault();try{cb(els);close()}catch(err){const out=$("modalMsg");out.className="status err";out.textContent=err.name==="QuotaExceededError"?"Penyimpanan browser penuh. Unduh cadangan sebelum lanjut.":err.message}};
 return els;
}
function close(){$("modal").classList.add("hidden")}
$("close").onclick=close;
const field=(name,label,n)=>[name,label,n==null||n===0?"":L.fmt(n,6)];
const val=(els,k,negative=false)=>L.parse(els[k].value,negative);
$("fresh").onclick=()=>{try{save(L.create());notice("Buku LKR baru dibuat. Masukkan modal untuk mulai.");refreshAuto()}catch(e){notice(e.message)}};
$("capitalBtn").onclick=()=>modal("Tambah Modal","Masukkan jumlah yang benar-benar kau tambahkan ke kas atau stok.",[field("a","Modal IDR"),field("u","Modal LKR")],"Simpan",e=>{change(d=>L.capital(d,val(e,"a"),val(e,"u")));notice("Modal tersimpan.")});
for(const [id,type,title] of [["buyBtn","CUSTOMER_BUY","Customer beli LKR"],["sellBtn","CUSTOMER_SELL","Customer jual LKR"]]){
 $(id).onclick=()=>{
 const weBuy=type==="CUSTOMER_SELL";
 modal(title,null,[field("qty","Jumlah LKR"),field("cash",weBuy?"IDR dibayar":"IDR diterima"),["n","Nama customer (opsional)","",null,"text"]],"Catat transaksi",e=>{
  change(d=>L.exchange(d,{type,amount:val(e,"qty"),paid:val(e,"cash"),profit:0,name:e.n.value.trim()}));notice("Transaksi LKR tersimpan.")
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
$("settingsBtn").onclick=()=>{
 const s=state.settings;
 modal("Pengaturan","Kurs jual berlaku saat customer menjual LKR. Harga dibulatkan ke bawah ke rupiah utuh.",[["bank","Nama bank",s.bank_name,null,"text"],["acc","Nomor rekening",s.bank_account_number,null,"text"],["holder","Atas nama",s.bank_account_name,null,"text"]],"Simpan",e=>{
 change(d=>Object.assign(d.settings,{bank_name:e.bank.value.trim(),bank_account_number:e.acc.value.trim(),bank_account_name:e.holder.value.trim()}));notice("Pengaturan tersimpan.");
 });
 if(auto){
  const mode=E("button","Kurs Google manual");mode.type="button";mode.style.marginTop="12px";
  mode.onclick=showGoogleRate;$("modalBody").append(mode);
 }
 const actions=E("div");actions.className="actions";actions.style.marginTop="12px";
 const exp=E("button","Unduh cadangan"),imp=E("button","Impor cadangan LKR");
 exp.type=imp.type="button";exp.onclick=download;imp.onclick=()=>$("importFile").click();
 actions.append(exp,imp);$("modalBody").append(actions);
};
const showHistory=(title,customer)=>{
 const box=modal(title,"");
 const list=state.transactions.filter(t=>t.transaction_type.startsWith("CUSTOMER_")===customer).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 const visible=customer?list.slice(0,10):list;
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
 if(!rate){notice(isBuy?"Kurs dasar modal belum tersedia.":"Isi kurs dulu sebelum membagikan.");return}
 const text=(isBuy?"KURS BELI LKR":"KURS JUAL LKR")+"\n1 LKR = "+L.rate(rate)+(isBuy&&s.bank_account_number?"\n\n"+s.bank_name+"\n"+s.bank_account_number+"\n"+s.bank_account_name:"");
 if(navigator.share){navigator.share({title:"Money Changer",text}).catch(e=>{if(e.name!=="AbortError")previewQuote(text)});return}
 previewQuote(text)
}
function previewQuote(text){const b=modal("Salin kurs","");b.append(E("pre",text));const c=E("button","Salin");b.append(c);c.onclick=async()=>{try{await navigator.clipboard.writeText(text);$("modalMsg").textContent="Disalin."}catch{$("modalMsg").textContent="Pilih teks di atas dan salin secara manual."}}}
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
