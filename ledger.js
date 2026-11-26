"use strict";
const Ledger=(()=>{
const zero=()=>({base_amount:0,cash_idr:0,trade_amount:0,lkr_in_hand:0,profit_month_idr:0});
const create=()=>({format:"money-changer-lkr",version:1,settings:{buy_margin:0,sell_margin:0,rounding_unit:0.01,market:0,market_mode:"auto",google_rate:0,google_set_at:null,bank_name:"",bank_account_name:"",bank_account_number:""},balance:zero(),transactions:[],profitHistory:[]});
const number=(x,min=0,max=1e12)=>typeof x==="number"&&Number.isFinite(x)&&x>=min&&x<=max;
const ok=(v,msg)=>{if(!v)throw Error(msg)};
const str=(x,n=140)=>typeof x==="string"&&x.length<=n;
const types=["ADD_CAPITAL","INITIAL_CAPITAL","CUSTOMER_BUY","CUSTOMER_SELL"];
const validDate=x=>str(x,55)&&Number.isFinite(Date.parse(x));
const money=(x,d)=>Number(x.toFixed(d));
const fmt=(x,d=2)=>new Intl.NumberFormat("id-ID",{maximumFractionDigits:d}).format(x);
const idr=x=>"Rp "+fmt(x,0);
const parse=(val,negative=false)=>{
 let s=val.trim();
 if(s==="")return 0;
 ok((negative?/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/:/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/).test(s),"Gunakan angka seperti 17.500 atau 12,50.");
 const x=Number(s.replaceAll(".","").replace(",","."));
 ok(number(x,negative?-1e12:0),"Angka di luar batas.");
 return x;
};
const validate=d=>{
 ok(d&&d.format==="money-changer-lkr"&&d.version===1,"Pilih cadangan JSON dari Money Changer LKR. Buku lain tidak dapat diimpor.");
 const b=d.balance,s=d.settings;
 ok(b&&Object.keys(zero()).every(k=>number(b[k],k==="profit_month_idr"?-1e12:0)),"Saldo cadangan tidak valid.");
 ok(s&&number(s.buy_margin,0,1)&&number(s.sell_margin,0,.99)&&number(s.rounding_unit,.01,1e6)&&money(s.rounding_unit,2)===s.rounding_unit&&number(s.market)&&["auto","manual","google"].includes(s.market_mode??"auto")&&number(s.google_rate??0,0,1e6)&&(s.google_set_at==null||validDate(s.google_set_at))&&["bank_name","bank_account_name","bank_account_number"].every(k=>str(s[k])),"Pengaturan cadangan tidak valid.");
 ok(Array.isArray(d.transactions)&&d.transactions.length<=25000&&d.transactions.every(t=>t&&types.includes(t.transaction_type)&&validDate(t.created_at)&&number(t.trade_amount)&&money(t.trade_amount,2)===t.trade_amount&&number(t.base_amount)&&Number.isInteger(t.base_amount)&&number(t.customer_rate??0)&&number(t.profit_idr??0,-1e12)&&str(t.customer_name??"")),"Riwayat transaksi tidak valid.");
 ok(Array.isArray(d.profitHistory)&&d.profitHistory.length<=1000&&d.profitHistory.every(t=>t&&str(t.period_start,10)&&/^\d{4}-\d{2}-\d{2}$/.test(t.period_start)&&validDate(t.period_start)&&validDate(t.closed_at)&&number(t.profit_idr,-1e12)),"Riwayat profit tidak valid.");
 // Whitelist fields so no authorization or database credentials enter the local backup.
 return {format:d.format,version:1,balance:Object.fromEntries(Object.keys(zero()).map(k=>[k,b[k]])),settings:Object.fromEntries(Object.keys(create().settings).map(k=>[k,s[k]??create().settings[k]])),transactions:d.transactions.map(t=>({transaction_type:t.transaction_type,created_at:t.created_at,trade_amount:t.trade_amount,base_amount:t.base_amount,customer_rate:t.customer_rate??0,profit_idr:t.profit_idr??0,customer_name:t.customer_name??""})),profitHistory:d.profitHistory.map(({period_start,closed_at,profit_idr})=>({period_start,closed_at,profit_idr}))};
};
const basis=d=>d.balance.trade_amount>0?d.balance.base_amount/d.balance.trade_amount:0;
const parseGoogle=val=>{
 const v=val.trim();
 ok(/^\d+(?:[.,]\d{1,6})?$/.test(v),"Masukkan angka kurs, contoh 55,2921 atau 55.2921.");
 const rate=Number(v.replace(",","."));
 ok(number(rate,.000001,1e6),"Kurs harus positif dan dalam batas yang wajar.");
 return rate;
};
const google=d=>d.settings.market_mode==="google"&&d.settings.google_set_at?d.settings.google_rate:0;
const buy=(d,market=d.settings.market)=>money(Math.floor((market*(1-d.settings.buy_margin)+1e-9)/d.settings.rounding_unit)*d.settings.rounding_unit,2);
const sell=(d,market=d.settings.market)=>money(market*985/1000,2);
const rate=x=>"Rp "+fmt(x,2);
const capital=(d,base,lkr,at=new Date().toISOString())=>{
 ok(number(base)&&number(lkr)&&Number.isInteger(base)&&money(lkr,2)===lkr,"Modal IDR harus bulat; LKR maksimal dua desimal.");
 ok(base||lkr,"Isi modal IDR atau LKR.");
 d.balance.base_amount+=base;d.balance.cash_idr+=base;
 d.balance.trade_amount=money(d.balance.trade_amount+lkr,2);
 d.balance.lkr_in_hand=money(d.balance.lkr_in_hand+lkr,2);
 d.transactions.unshift({transaction_type:"ADD_CAPITAL",base_amount:base,trade_amount:lkr,created_at:at});
};
const exchange=(d,{type,amount,paid,profit,name},at=new Date().toISOString())=>{
 ok(["CUSTOMER_BUY","CUSTOMER_SELL"].includes(type),"Jenis transaksi tidak valid.");
 ok(number(amount,.01)&&money(amount,2)===amount&&number(paid,1)&&Number.isInteger(paid)&&number(profit,-1e12)&&Number.isInteger(profit)&&str(name),"Masukkan LKR (maks. 2 desimal) dan IDR bulat.");
 const b=d.balance,weSell=type==="CUSTOMER_BUY";
 ok(weSell?amount<=b.lkr_in_hand:paid<=b.cash_idr,weSell?"Saldo LKR di tangan tidak cukup.":"Kas IDR tidak cukup.");
 b.lkr_in_hand=money(b.lkr_in_hand+(weSell?-amount:amount),2);
 b.cash_idr=money(b.cash_idr+(weSell?paid:-paid),0);
 b.profit_month_idr+=profit;
 d.transactions.unshift({transaction_type:type,trade_amount:amount,base_amount:paid,customer_rate:money(paid/amount,6),profit_idr:profit,customer_name:name,created_at:at});
};
const closeProfit=(d,date=new Date())=>{
 const period=date.getFullYear()+"-"+String(date.getMonth()+1).padStart(2,"0")+"-01";
 ok(!d.profitHistory.some(p=>p.period_start===period),"Bulan ini sudah ditutup.");
 d.profitHistory.unshift({period_start:period,closed_at:date.toISOString(),profit_idr:d.balance.profit_month_idr});
 d.balance.profit_month_idr=0;
};
return {create,validate,parse,fmt,idr,rate,parseGoogle,google,basis,buy,sell,capital,exchange,closeProfit};
})();
if(typeof module!=="undefined")module.exports=Ledger;
