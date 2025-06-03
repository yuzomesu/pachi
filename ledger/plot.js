import { supabase }    from '../assets/js/supabase-init.js';
import { requireAuth } from '../assets/js/requireAuth.js';
import {
  eachDayOfInterval, parseISO, format, startOfYear, endOfYear
} from 'https://cdn.jsdelivr.net/npm/date-fns@2.30.0/+esm';

const uid = (await requireAuth()).id;

/* ---- 当年のデータを読み込み ---- */
const year = new Date().getFullYear();
const start = format(startOfYear(new Date(year,0,1)),'yyyy-MM-dd');
const end   = format(endOfYear  (new Date(year,0,1)),'yyyy-MM-dd');

const { data } = await supabase
  .from('v_daily_sum')
  .select('date,balance,ex_total')
  .eq('user_id',uid)
  .gte('date',start).lte('date',end)
  .order('date');

const labels=[], cumBal=[], cumEx=[];
let accBal=0, accEx=0;
data.forEach(r=>{
  labels.push(r.date);
  accBal += +r.balance;
  accEx  += +r.ex_total;
  cumBal.push(accBal);
  cumEx.push(accEx);
});

/* ---- Chart.js ---- */
const ctx=document.getElementById('chart');
new Chart(ctx,{
  type:'line',
  data:{
    labels,
    datasets:[
      { label:'累積収支', data:cumBal, borderWidth:2, tension:.15 },
      { label:'累積期待値', data:cumEx, borderWidth:2, borderDash:[6,4], tension:.15 }
] },
  options:{
    scales:{ y:{ ticks:{callback:v=>v.toLocaleString()+' 円'} } },
    plugins:{ legend:{position:'bottom'} }
  }
});
