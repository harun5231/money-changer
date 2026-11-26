"use strict";
const $=id=>document.getElementById(id), E=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el}, L=Ledger;
const key="money-changer-lkr-v1";
const googleURL="https://www.google.com/finance/quote/LKR-IDR";
const buyQuote=()=>L.buy(state,L.google(state)),sellQuote=()=>L.sell(state,L.google(state));
let state=null, raw=null, writable=true;
const notice=x=>{$("notice").textContent=x};
function active(){ $("welcome").classList.toggle("hidden",!!state||!writable);$("app").classList.toggle("hidden",!state); }
function read(){
 try{raw=localStorage.getItem(key);state=raw?L.validate(JSON.parse(raw)):null;writable=true;notice(state?"":"Versi pribadi · Mulai buku LKR atau impor cadangan LKR.")}
 catch(e){writable=false;state=null;notice("Data di browser tidak dapat dibaca. Jangan hapus data browser. "+e.message)}
 active();if(state)render()
}
function save(candidate){
 if(!writable)throw Error("Penyimpanan sedang tidak tersedia.");
 const safe=L.validate(candidate), next=JSON.stringify(safe);
 if(localStorage.getItem(key)!==raw)throw Error("Catatan sudah berubah di tab lain. Muat ulang sebelum menyimpan.");
 localStorage.setItem(key,next);raw=next;state=safe;active();render()
}
const change=fn=>{const d=JSON.parse(raw);fn(d);save(d)};
function render(){
 const b=state.balance,s=state.settings,m=L.google(state);
 const stamp=m?new Date(s.google_set_at).toLocaleString("id-ID",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}):"";
 const vals={baseBal:L.idr(b.base_amount),cashIdr:L.idr(b.cash_idr),tradeBal:L.fmt(b.trade_amount)+" LKR",lkrHand:L.fmt(b.lkr_in_hand)+" LKR",profit:L.idr(b.profit_month_idr),basis:L.basis(state)?L.rate(L.basis(state)):"—",buyRate:buyQuote()?L.rate(buyQuote()):"—",sellRate:sellQuote()?L.rate(sellQuote()):"—",marketRate:m?"Rp "+L.fmt(m,6):"—",rateMsg:m?"Manual · "+stamp:"Ketuk untuk isi"};
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
$("fresh").onclick=()=>{try{save(L.create());notice("Buku LKR baru dibuat. Masukkan modal untuk mulai.")}catch(e){notice(e.message)}};
$("capitalBtn").onclick=()=>modal("Tambah Modal","Masukkan jumlah yang benar-benar kau tambahkan ke kas atau stok.",[field("a","Modal IDR"),field("u","Modal LKR")],"Simpan",e=>{change(d=>L.capital(d,val(e,"a"),val(e,"u")));notice("Modal tersimpan.")});
for(const [id,type,title] of [["buyBtn","CUSTOMER_SELL","Beli LKR dari customer"],["sellBtn","CUSTOMER_BUY","Jual LKR ke customer"]]){
 $(id).onclick=()=>{
 const weBuy=type==="CUSTOMER_SELL", quote=weBuy?buyQuote():sellQuote();
 const els=modal(title,"Isi IDR yang benar-benar "+(weBuy?"kau bayarkan.":"kau terima.")+" Profit diisi manual (kosong berarti nol).",[field("qty","Jumlah LKR"),field("cash",weBuy?"IDR dibayar":"IDR diterima"),field("p","Profit IDR (opsional, boleh negatif)"),["n","Nama customer (opsional)","",null,"text"]],"Catat transaksi",e=>{
  change(d=>L.exchange(d,{type,amount:val(e,"qty"),paid:val(e,"cash"),profit:val(e,"p",true),name:e.n.value.trim()}));notice("Transaksi LKR tersimpan.")
 });
 const p=E("p");p.className="inline-help";$("modalBody").prepend(p);
 const hint=()=>{let x=0;try{x=val(els,"qty")}catch{}p.textContent=quote?"Kurs acuan: "+L.rate(quote)+"/LKR"+(x?" · estimasi "+L.idr(Math.round(x*quote)):""):"Kurs acuan belum diisi. Kau tetap bisa mencatat jumlah IDR aktual.";};
 els.qty.oninput=hint;hint();
 };
}
$("refreshRate").onclick=()=>{
 modal("Kurs Google LKR → IDR","Buka Google Finance dan masukkan angka untuk 1 LKR. Kurs di sini tidak berubah otomatis.",[field("rate","IDR per 1 LKR",L.google(state))],"Simpan kurs Google",e=>{
  const x=L.parseGoogle(e.rate.value);
  change(d=>{d.settings.google_rate=x;d.settings.google_set_at=new Date().toISOString();d.settings.market_mode="google"});
  notice("Kurs Google yang kau masukkan sudah disimpan.");
 });
 const box=$("modalBody"),p=E("p"),source=E("a","Buka Google Finance (LKR → IDR)");
 source.href=googleURL;source.target="_blank";source.rel="noopener noreferrer";source.style.color="var(--text)";
 p.append(source);box.prepend(p);
};
$("settingsBtn").onclick=()=>{
 const s=state.settings;
 modal("Pengaturan","Kurs beli dari customer: kurs pasar dikurangi margin. Kurs jual ke customer: kurs Google yang kau masukkan ditambah margin. Kurs dasar modal tetap ditampilkan sebagai pembanding.",[field("bm","Margin beli (%)",100*s.buy_margin),field("sm","Margin jual (%)",100*s.sell_margin),field("u","Pembulatan kurs (IDR)",s.rounding_unit),["bank","Nama bank",s.bank_name,null,"text"],["acc","Nomor rekening",s.bank_account_number,null,"text"],["holder","Atas nama",s.bank_account_name,null,"text"]],"Simpan",e=>{
 change(d=>Object.assign(d.settings,{buy_margin:val(e,"bm")/100,sell_margin:val(e,"sm")/100,rounding_unit:val(e,"u"),bank_name:e.bank.value.trim(),bank_account_number:e.acc.value.trim(),bank_account_name:e.holder.value.trim()}));notice("Pengaturan tersimpan.");
 });
};
const showHistory=(title,customer)=>{
 const box=modal(title,"");
 const list=state.transactions.filter(t=>t.transaction_type.startsWith("CUSTOMER_")===customer).sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at));
 if(!list.length)box.append(E("p","Belum ada transaksi."));
 for(const t of list){
  const item=E("div");item.className="history-item entry";
  const label={INITIAL_CAPITAL:"Modal awal",ADD_CAPITAL:"Tambah modal",CUSTOMER_BUY:"Jual LKR ke customer",CUSTOMER_SELL:"Beli LKR dari customer"}[t.transaction_type];
  item.append(E("strong",label+(t.customer_name?" · "+t.customer_name:"")),E("p",L.idr(t.base_amount)+" · "+L.fmt(t.trade_amount,6)+" LKR"),E("small",new Date(t.created_at).toLocaleString("id-ID")+(t.customer_rate?" · "+L.rate(t.customer_rate)+"/LKR":"")));
  box.append(item)
 }
};
$("customerHistoryBtn").onclick=()=>showHistory("Riwayat Transaksi Customer",true);
$("capitalHistoryBtn").onclick=()=>showHistory("Riwayat Tambah Modal",false);
$("profitHistoryBtn").onclick=()=>{
 const box=modal("Profit Bulanan","Tutup bulan menyimpan profit dan mengosongkan profit bulan ini. Saldo dan transaksi tidak diubah.");
 for(const t of [...state.profitHistory].sort((a,b)=>b.period_start.localeCompare(a.period_start)))box.append(E("p",t.period_start.slice(0,7)+" · "+L.idr(t.profit_idr)));
 const b=E("button","Tutup profit bulan ini");box.append(b);
 b.onclick=()=>{if(!confirm("Simpan profit bulan ini dan set profit berjalan ke nol?"))return;try{change(d=>L.closeProfit(d));close();notice("Profit bulan ini sudah ditutup.")}catch(e){$("modalMsg").textContent=e.message}};
};
function quote(isBuy){
 const rate=isBuy?buyQuote():sellQuote(),s=state.settings;
 if(!rate){notice("Isi kurs dulu sebelum membagikan.");return}
 const text=(isBuy?"KURS BELI LKR":"KURS JUAL LKR")+"\n1 LKR = "+L.rate(rate)+(isBuy&&s.bank_account_number?"\n\n"+s.bank_name+"\n"+s.bank_account_number+"\n"+s.bank_account_name:"");
 if(navigator.share){navigator.share({title:"Money Changer",text}).catch(e=>{if(e.name!=="AbortError")previewQuote(text)});return}
 previewQuote(text)
}
function previewQuote(text){const b=modal("Salin kurs","");b.append(E("pre",text));const c=E("button","Salin");b.append(c);c.onclick=async()=>{try{await navigator.clipboard.writeText(text);$("modalMsg").textContent="Disalin."}catch{$("modalMsg").textContent="Pilih teks di atas dan salin secara manual."}}}
$("shareBuyBtn").onclick=()=>quote(true);$("shareSellBtn").onclick=()=>quote(false);
function download(){
 const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:"application/json"}));const a=E("a");a.href=url;a.download="money-changer-lkr-"+new Date().toISOString().slice(0,10)+".json";document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
$("exportBtn").onclick=download;
$("importBtn").onclick=$("welcomeImport").onclick=()=>$("importFile").click();
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
clock();setInterval(clock,30000);addEventListener("storage",e=>{if(e.key===key||e.key===null){read();notice("Catatan diperbarui dari tab lain.");close()}});read();
