/*  calendar.js  –  収支カレンダーすべてのロジック
   -------------------------------------------------
   * 実収支は daily_records   （1 日 1 行、投資・回収）
   * 期待値は expect_records  （1 日 1 行、sim.html が保存）
   * フロントは v_daily_sum  を読むだけ
   * 日セルをタップすると既存データを編集 or 新規入力
   * UI レイアウトは calendar.html 側のまま
   ------------------------------------------------- */

import { supabase }    from '../assets/js/supabase-init.js';
import { requireAuth } from '../assets/js/requireAuth.js';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, format, isToday
} from 'https://cdn.jsdelivr.net/npm/date-fns@2.30.0/+esm';

/* ---- 認証（未ログインなら /login.html へ） ---- */
const uid = (await requireAuth()).id;

/* ---- DOM 取得 ---- */
const calEl        = document.getElementById('calendar');
const ymEl         = document.getElementById('ym');
const monthSumEl   = document.getElementById('monthSum');
const prevBtn      = document.getElementById('prev');
const nextBtn      = document.getElementById('next');
const dlg          = document.getElementById('rec-modal');

/* ---- 状態 ---- */
let current   = new Date();   // 表示中の月
let balanceMap = {};          // { "YYYY-MM-DD": { bal, ex } }

/* ---- 初期ロード ---- */
refresh();

/* ---- 月送り ---- */
prevBtn.onclick = () => { current = addMonths(current, -1); refresh(); };
nextBtn.onclick = () => { current = addMonths(current,  1); refresh(); };

/* ====================================================
   関数群
   ==================================================== */
function refresh(){
  drawGrid();
  loadMonthData();
}

/* カレンダーのマスを描く（データはあとで詰める） */
function drawGrid(){
  calEl.innerHTML = '';
  ymEl.textContent = format(current, 'yyyy年 M月');

  eachDayOfInterval({
    start: startOfMonth(current),
    end  : endOfMonth  (current)
  }).forEach(d => {
    const ymd  = format(d, 'yyyy-MM-dd');
    const cell = document.createElement('div');
    cell.className = 'day' + (isToday(d) ? ' today' : '');
    cell.dataset.date = ymd;
    cell.innerHTML = `<div class="daynum">${d.getDate()}</div>`;
    cell.onclick = () => openModal(ymd);
    calEl.appendChild(cell);
  });
}

/* 今月の実収支＋期待値を取得 → セルに流し込む */
async function loadMonthData(){
  const start = format(startOfMonth(current),'yyyy-MM-dd');
  const end   = format(endOfMonth  (current),'yyyy-MM-dd');

  const { data, error } = await supabase
    .from('v_daily_sum')
    .select('date,balance,ex_total')
    .eq('user_id', uid)
    .gte('date', start).lte('date', end);

  if(error){ console.error(error); return; }

  balanceMap = Object.fromEntries(
    data.map(d => [d.date, { bal:+d.balance, ex:+d.ex_total } ])
  );

  let sumBal = 0, sumEx = 0;

  document.querySelectorAll('.day').forEach(cell => {
    const v = balanceMap[cell.dataset.date];
    if(!v) return;

    sumBal += v.bal; sumEx += v.ex;

    const span = document.createElement('span');
    span.className = 'profit ' + (v.bal>0?'pos':v.bal<0?'neg':'zero');
    span.innerHTML =
      (v.bal>0?'+':'') + v.bal.toLocaleString() +
      '<br><small style="color:#888">' +
      (v.ex>=0?'+':'') + v.ex.toLocaleString() + ' 期待</small>';
    cell.appendChild(span);
  });

  monthSumEl.textContent =
    `${sumBal>=0?'+':''}${sumBal.toLocaleString()}円 ／ 期待 ${(sumEx>=0?'+':'')+sumEx.toLocaleString()}円`;
}

/* ──────────────────────────────
   日次モーダル  （INSERT or UPDATE）
   ────────────────────────────── */
async function openModal(dateStr){
  /* フォーム要素 */
  const investI = dlg.querySelector('#rec-invest');
  const payoutI = dlg.querySelector('#rec-payout');
  const memoI   = dlg.querySelector('#rec-memo');
  const hallI   = dlg.querySelector('#rec-hall');
  const machI   = dlg.querySelector('#rec-machine');

  dlg.querySelector('#rec-date').value = dateStr;

  /* 既存レコード 1 行を取っておく */
  let exist = null;
  {
    const res = await supabase
      .from('daily_records')
      .select('id,invest,payout,memo,daily_record_halls(hall_id),daily_record_machines(machine_id)')
      .eq('user_id', uid).eq('date', dateStr).single();
    if(!res.error) exist = res.data;
  }

  /* Tagify 初期化 */
  const tgHall = await initTagify(hallI,  'halls');
  const tgMach = await initTagify(machI,  'machines');

  /* 既存があれば値を詰める */
  if(exist){
    investI.value = exist.invest;
    payoutI.value = exist.payout;
    memoI.value   = exist.memo ?? '';

    tgHall.removeAllTags();
    tgMach.removeAllTags();

    tgHall.addTags(
      exist.daily_record_halls.map(h => tgHall.settings.whitelist
        .find(w => w.id === h.hall_id))
    );
    tgMach.addTags(
      exist.daily_record_machines.map(m => tgMach.settings.whitelist
        .find(w => w.id === m.machine_id))
    );
  }else{
    investI.value = payoutI.value = memoI.value = '';
    tgHall.removeAllTags();
    tgMach.removeAllTags();
  }

  dlg.showModal();

  /* 送信ハンドラ（upsert） */
  dlg.querySelector('form').onsubmit = async e=>{
    e.preventDefault();

    const invest = +investI.value || 0;
    const payout = +payoutI.value || 0;
    const memo   = memoI.value;

    let recId;

    if(exist){
      /* UPDATE */
      await supabase.from('daily_records')
        .update({ invest, payout, memo })
        .eq('id', exist.id);
      recId = exist.id;

      /* タグを置き換えるので削除→挿入 */
      await supabase.from('daily_record_halls')   .delete().eq('record_id', recId);
      await supabase.from('daily_record_machines').delete().eq('record_id', recId);
    }else{
      /* INSERT */
      const { data:newRec } = await supabase.from('daily_records')
        .insert({ user_id:uid, date:dateStr, invest, payout, memo })
        .select('id').single();
      recId = newRec.id;
    }

    /* タグ再挿入 */
    await supabase.from('daily_record_halls')
      .insert(tgHall.value.map(t => ({ record_id:recId, hall_id:t.id })));
    await supabase.from('daily_record_machines')
      .insert(tgMach.value.map(t => ({ record_id:recId, machine_id:t.id })));

    dlg.close(); refresh();
  };
}

/* ──────────────────────────────
   Tagify 共通初期化
   ────────────────────────────── */
async function initTagify(el, tbl){
  if(el._tagify) return el._tagify;

  const { data } = await supabase
    .from(tbl).select('id,name').order('name');

  const tg = new Tagify(el,{
    whitelist       : data.map(r => ({ id:r.id, value:r.name })),
    enforceWhitelist: false,
    skipInvalid     : true
  });

  /* 新タグ → Auto インサート → ID 振り直し */
  tg.on('add', async e=>{
    if(e.detail.data.id) return;               // 既存タグ
    const label = e.detail.data.value.trim();
    if(!label) return;

    const { data:n } = await supabase
      .from(tbl)
      .insert({ name:label, created_by:uid })
      .select('id').single();

    tg.replaceTag(e.detail.tag, { id:n.id, value:label });
  });

  return el._tagify = tg;
}
