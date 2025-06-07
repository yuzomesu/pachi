import { supabase } from '/assets/js/supabase-init.js';
const user = (await supabase.auth.getUser()).data.user;
if(!user) location.href = '/login.html';


const { data } = await supabase
  .from('v_daily_sum')
  .select('balance')
  .eq('user_id',user.id);

const n        = data.length;
const wins     = data.filter(d=>d.balance>0).length;
const totalBal = data.reduce((s,d)=>s+Number(d.balance),0);
const avg      = totalBal / n || 0;
const sd       = Math.sqrt(data.reduce((s,d)=>s+Math.pow(d.balance-avg,2),0)/n || 0);

const rows = [
  ['プレイ日数',        n],
  ['勝率',             (wins/n*100||0).toFixed(1)+' %'],
  ['総収支',           totalBal.toLocaleString()+' 円'],
  ['平均収支/日',      avg.toFixed(1)],
  ['標準偏差',         sd.toFixed(1)]
];
tbody.innerHTML = rows.map(r=>`<tr><th>${r[0]}</th><td>${r[1]}</td></tr>`).join('');
