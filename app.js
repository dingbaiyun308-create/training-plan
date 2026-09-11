'use strict';
const PLAN=window.PLAN, C=window.TrainingCore;
const STORE='training-plan-phase4-v1', BEFORE_IMPORT=STORE+'-before-import';
const $=selector=>document.querySelector(selector);
const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const icon=name=>`<i data-lucide="${name}" aria-hidden="true"></i>`;
let storageBlocked=false, damagedRaw=null, activeView='home', nutritionDate=C.localDate(), editorMode=null, toastTimeout;
let state=load();
function load(){
  try {
    const raw=localStorage.getItem(STORE);
    if(!raw)return C.blankState();
    const saved=JSON.parse(raw), parsed=C.validateState(PLAN,saved);
    if(saved.timer && Number.isFinite(saved.timer.duration) && saved.timer.duration>=0 && saved.timer.duration<=7200 &&
      Number.isFinite(saved.timer.remaining) && saved.timer.remaining>=0 && saved.timer.remaining<=7200 &&
      (saved.timer.endsAt===null || Number.isFinite(saved.timer.endsAt)) && typeof saved.timer.label==='string') parsed.timer=saved.timer;
    return parsed;
  } catch(e){storageBlocked=true;try{damagedRaw=localStorage.getItem(STORE);}catch{} return C.blankState();}
}
function hydrateIcons(){window.lucide?.createIcons({attrs:{'stroke-width':1.8}});}
function persist(){
  if(storageBlocked){toast('本机存储暂不可写，请先导出记录。');return false;}
  try{state.updatedAt=new Date().toISOString();localStorage.setItem(STORE,JSON.stringify(state));$('#saveStatus').textContent='已保存到本机';return true;}
  catch(e){storageBlocked=true;showStorageWarning();toast('保存失败，请导出备份');return false;}
}
function showStorageWarning(){
  if(!storageBlocked)return;
  $('#saveStatus').textContent='尚未保存';
  $('#storageWarning').hidden=false;
  $('#storageWarning').innerHTML='本机记录读取或保存失败。当前操作仍可导出备份。'+(damagedRaw?' <button class="button" data-action="export-damaged">导出原始记录</button>':'');
}
function toast(message){clearTimeout(toastTimeout);$('#toast').textContent=message;$('#toast').classList.add('show');toastTimeout=setTimeout(()=>$('#toast').classList.remove('show'),2600);}
function rowById(id){return PLAN.exercises.find(r=>r.id===id);}
function session(){return PLAN.sessions[state.current-1];}
function rows(){return C.rowsFor(PLAN,state.current);}
function getRecord(row){return C.record(PLAN,state,row);}
function getSession(index=state.current){return state.sessions[index] ||= {};}
function invalidateFinished(index){if(state.sessions[index]?.completedAt)delete state.sessions[index].completedAt;}
function refresh(){
  const openDetails=[...document.querySelectorAll('#main details[open][id]')].map(x=>x.id);
  const y=window.scrollY;
  render();
  openDetails.forEach(id=>{const detail=document.getElementById(id);if(detail)detail.open=true;});
  window.scrollTo({top:y,behavior:'instant'});
}
function go(view){activeView=view;render();window.scrollTo({top:0,behavior:'instant'});}
function render(){
  document.querySelectorAll('.main-nav [data-view]').forEach(button=>{
    if(button.dataset.view===activeView)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
  });
  $('#sessionPicker').hidden=!['home','warmup','training'].includes(activeView);
  renderSessions();
  $('#main').innerHTML=({home:homeView,warmup:warmupView,training:trainingView,nutrition:nutritionView,records:recordsView,plan:planView}[activeView])();
  hydrateIcons();renderTimer();
}
function renderSessions(){
  const bar=$('#sessionList'), left=bar.scrollLeft;
  $('#roundLabel').textContent=`第${session().round}轮 · 模板 ${session().template}`;
  bar.innerHTML=PLAN.sessions.map(s=>`<button class="session-item ${state.sessions[s.index]?.completedAt?'finished':''}" data-action="session" data-index="${s.index}" aria-pressed="${s.index===state.current}"><strong>训练 ${String(s.index).padStart(2,'0')}</strong><small>第${s.round}轮 · ${s.template}${state.sessions[s.index]?.completedAt?' · 已结束':''}</small></button>`).join('');
  bar.scrollLeft=left;
}
function focusSession(){const bar=$('#sessionList'), button=bar.querySelector('[aria-pressed="true"]');if(button)bar.scrollTo({left:Math.max(0,button.offsetLeft-bar.offsetLeft-(bar.clientWidth-button.clientWidth)/2),behavior:'smooth'});}
function loadText(value){return typeof value==='number'?`${value} kg`:String(value);}
function shortLoad(value){return value==='首轮校准；后续+2.5/轮'?'首轮校准':loadText(value);}
function restText(seconds){return seconds%60===0?`${seconds/60} 分钟`:`${Math.floor(seconds/60)?Math.floor(seconds/60)+'分':''}${seconds%60}秒`;}
function warmStats(){const items=PLAN.warmups[session().template];return {done:items.filter(w=>state.sessions[state.current]?.warmup?.[w.order]).length,total:items.length};}
function sessionTitle(){const s=session(),started=rows().some(r=>state.records[r.id]);return `<div class="view-title"><div><h2>训练 ${String(s.index).padStart(2,'0')} <span class="muted">/ ${s.template}</span></h2><p>第${s.round}轮 · ${rows().length}个动作</p></div><span class="pill ${state.sessions[s.index]?.completedAt?'green':''}">${state.sessions[s.index]?.completedAt?'已结束':started?'进行中':'待开始'}</span></div>`;}
function homeView(){
  const s=session(),stats=C.stats(PLAN,state,state.current),all=C.stats(PLAN,state),warm=warmStats();
  const complete=PLAN.sessions.filter(s=>state.sessions[s.index]?.completedAt).length;
  const focus={A:'深蹲、卧推与上肢容量',B:'硬拉、背部与单腿训练',C:'卧推、深蹲与标准引体'}[s.template];
  return `<section class="home-focus"><div class="focus-top"><div><p class="eyebrow">${state.sessions[s.index]?.completedAt?'本次已结束':'当前训练'} · 第${s.round}轮</p><h2>训练 ${String(s.index).padStart(2,'0')}</h2><p>${focus}</p></div><div class="template-letter" aria-label="模板${s.template}">${s.template}</div></div>
    <div class="target-preview">${rows().slice(0,3).map(r=>{const t=C.target(PLAN,state,r);return `<div class="preview-item"><small>${h(r.actionName)}</small><strong>${h(shortLoad(t.load))}</strong><span>${t.sets}组 × ${h(t.reps)}</span></div>`;}).join('')}</div>
    <div class="button-row"><button class="button primary" data-action="view" data-view="warmup">${icon('activity')}${warm.done===warm.total?'查看热身':'开始热身'}</button><button class="button" data-action="view" data-view="training">${icon('dumbbell')}进入训练</button></div>
    ${state.sessions[s.index]?.completedAt&&s.index<12?'<button class="button quiet" data-action="next" style="margin-top:10px">下一次训练 '+icon('arrow-right')+'</button>':''}
  </section><section class="progress-band"><div><small>训练进度</small><strong>${complete}<span> / 12练</span></strong></div><div><small>本次工作组</small><strong>${stats.done}<span> / ${stats.total}组</span></strong></div><div><small>本次热身</small><strong>${warm.done}<span> / ${warm.total}项</span></strong></div></section>
  <section class="band"><div class="section-line"><h3>阶段进展</h3><span>${all.done} / ${all.total}组</span></div><div class="meter"><span style="width:${all.total?all.done/all.total*100:0}%"></span></div><p class="note">肌肥大 · 肌肉耐力 · 力量维持</p><p class="small muted">按训练次数推进，恢复好再进入下一次。</p></section>
  <section class="band"><h3>本轮重点</h3><ul class="rule-list">${PLAN.principles.slice(1,2).concat(PLAN.principles.slice(3)).map(p=>`<li>${h(p)}</li>`).join('')}</ul></section>`;
}
function warmupView(){
  const warm=warmStats();
  return `${sessionTitle()}<div class="section-line"><span>训练前热身</span><span>${warm.done} / ${warm.total}项完成</span></div><p class="note">${h(PLAN.warmupSource)}</p><div class="exercise-list">${PLAN.warmups[session().template].map(w=>{
    const checked=!!state.sessions[state.current]?.warmup?.[w.order];
    return `<article class="exercise warm-card"><button class="set-check" data-action="warmup" data-order="${w.order}" aria-pressed="${checked}" aria-label="${h(w.actionName)} ${checked?'已完成':'未完成'}"><span class="check-circle">${icon('check')}</span></button><div><h3>${h(w.actionName)}</h3><span class="dose">${h(w.dose)}</span><p class="note">${h(w.feeling)}</p></div><details id="warm-${w.order}"><summary>动作要点与调整</summary><p class="note">${h(w.purpose)}</p><p class="notice warning">${h(w.downshift)}</p></details></article>`;
  }).join('')}</div><div class="notice">${h(PLAN.recoveryRules[2].condition)}：${h(PLAN.recoveryRules[2].action)}。</div><div class="session-end"><button class="button primary" data-action="view" data-view="training">进入正式训练 ${icon('arrow-right')}</button></div>`;
}
function trainingView(){
  const stats=C.stats(PLAN,state,state.current),warm=warmStats();
  return `${sessionTitle()}<div class="section-line"><span id="trainingSummary">${stats.done}/${stats.total}组完成${stats.skipped?' · '+stats.skipped+'组跳过':''}</span><button class="button quiet" data-action="view" data-view="warmup">热身 ${warm.done}/${warm.total} ${icon('chevron-right')}</button></div>
    <div class="exercise-list">${rows().map(exerciseCard).join('')}</div><div class="session-end"><button class="button primary" data-action="finish">${icon('check-check')}${state.sessions[state.current]?.completedAt?'本次已结束':'结束本次训练'}</button><button class="button" data-action="next" ${state.current===12?'disabled':''}>下一次训练 ${icon('arrow-right')}</button></div>`;
}
function exerciseCard(row){
  const t=C.target(PLAN,state,row),r=state.records[row.id]||{},prior=C.previous(PLAN,state,row);
  const status=C.exerciseStatus(PLAN,state,row),priorStatus=prior?C.exerciseStatus(PLAN,state,prior):'';
  const hold=prior&&(priorStatus==='调整'||priorStatus==='跳过');
  const actual=prior?Object.values(state.records[prior.id].sets).filter(s=>s.load!==''&&s.load!=null).map(s=>s.load):[];
  return `<article class="exercise" data-exercise="${row.id}"><div class="exercise-heading"><span class="order">${row.order}</span><div class="exercise-name"><p class="small muted">${h(row.category)}</p><h3>${h(row.actionName)}</h3></div><button class="icon-button" data-action="edit-target" data-id="${row.id}" aria-label="调整${h(row.actionName)}目标" title="调整训练目标">${icon('sliders-horizontal')}</button></div>
    <div class="plan-stats"><div><span>目标负重</span><strong class="load ${typeof t.load==='number'?'':'text-load'}">${h(shortLoad(t.load))}</strong></div><div><span>组数 × 次数</span><strong>${t.sets} × ${h(t.reps)}</strong></div><div><span>剩余次数 RIR</span><strong>${h(t.rir)}</strong></div></div>
    ${hold?`<div class="notice warning">上次同动作标记为「${priorStatus}」。本次负重可手动调整。<button class="button quiet" data-action="reuse-load" data-id="${row.id}">沿用上次重量</button></div>`:''}
    <div class="exercise-tools"><button class="rest-button" data-action="timer-start" data-id="${row.id}" title="开始组间休息">${icon('timer')}休息 ${restText(t.rest)}</button><span class="exercise-status" data-status-for="${row.id}">${status}</span></div>
    <div class="set-grid"><div class="set-head"><span>组次 / 完成</span><span>实际重量 kg</span><span>实际次数${row.reps.includes('/侧')?' / 侧':''}</span></div>${Array.from({length:t.sets},(_,index)=>{
      const n=index+1,set=r.sets?.[n]||{},skipped=r.mode==='skipped'||set.skipped;
      return `<div class="set-row ${set.done&&!skipped?'completed':''} ${skipped?'skipped':''}"><button class="set-check ${skipped?'skipped':''}" data-action="set" data-id="${row.id}" data-set="${n}" aria-pressed="${!!set.done&&!skipped}" aria-label="${h(row.actionName)} 第${n}组 ${skipped?'跳过':set.done?'完成':'未完成'}" ${r.mode==='skipped'?'disabled':''}><span>第${n}组</span><span class="check-circle">${icon(skipped?'minus':'check')}</span></button><input type="number" inputmode="decimal" min="0" max="1500" step="any" placeholder="—" aria-label="${h(row.actionName)} 第${n}组实际重量" data-record="load" data-id="${row.id}" data-set="${n}" value="${h(set.load??'')}" ${skipped?'disabled':''}><input type="number" inputmode="numeric" min="0" max="10000" step="1" placeholder="—" aria-label="${h(row.actionName)} 第${n}组实际次数" data-record="reps" data-id="${row.id}" data-set="${n}" value="${h(set.reps??'')}" ${skipped?'disabled':''}></div>`;
    }).join('')}</div>
    <details id="exercise-detail-${row.id}"><summary>余力、不适与备注</summary><p class="note">${h(row.progression)}</p>${prior?`<p class="note">上次：训练${prior.trainingIndex} · ${h(priorStatus)}${actual.length?' · '+h(actual.join(' / '))+' kg':''}</p>`:''}
    <div class="form-grid"><label>实际 RIR<input type="number" min="0" max="20" step="0.5" inputmode="decimal" placeholder="剩余可完成次数" data-feedback="rir" data-id="${row.id}" value="${h(r.rir??'')}"></label><label>不适 0–10<input type="number" min="0" max="10" step="1" inputmode="numeric" data-feedback="discomfort" data-id="${row.id}" value="${h(r.discomfort??'')}"></label><label class="wide">动作状态<select data-mode="${row.id}"><option value="normal" ${!r.mode||r.mode==='normal'?'selected':''}>正常训练</option><option value="adjusted" ${r.mode==='adjusted'?'selected':''}>调整训练</option><option value="skipped" ${r.mode==='skipped'?'selected':''}>跳过本动作</option></select></label><label class="wide">备注<textarea data-feedback="note" data-id="${row.id}" placeholder="如第三组减重、肩部感受" maxlength="5000">${h(r.note||'')}</textarea></label></div><div class="button-row" style="margin-top:12px"><button class="button" data-action="fill-target" data-id="${row.id}">填入目标重量</button><button class="button" data-action="skip-remaining" data-id="${row.id}">跳过剩余组</button></div></details></article>`;
}
const nutrientFields=[['weight','晨起体重 kg',0.1,20,400],['protein','蛋白质 g',1,0,1000],['calories','总热量 kcal',1,0,20000]];
const extraFields=[['fat','脂肪 g',1,0,1000],['carbs','碳水 g',1,0,2000],['creatine','肌酸 g',0.1,0,100],['sleep','睡眠 h',0.5,0,24],['energy','精力 1–5',1,1,5],['pain','身体不适 0–10',1,0,10]];
function nutrientInput(field,entry){const[k,label,step,min,max]=field;return `<label>${label}<input type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" data-nutrient="${k}" value="${h(entry[k]??'')}" placeholder="未记录"></label>`;}
function weeklyView(){
  const previous=C.weekAverage(state.nutrition,nutritionDate,-1),current=C.weekAverage(state.nutrition,nutritionDate);
  const diff=current.average!=null&&previous.average!=null?current.average-previous.average:null;
  return `<div class="weight-weeks">${[previous,current].map((w,i)=>`<div class="weight-week"><small>${i?'本周':'上周'}均重</small><strong>${w.average==null?'—':w.average.toFixed(2)}<span class="small muted"> kg</span></strong><small>${w.start.slice(5)} 至 ${w.end.slice(5)} · ${w.count}次记录</small></div>`).join('')}</div><p class="note">${diff==null?'周平均体重将在填写晨重后显示。':`两周已有记录均值相差 ${diff>=0?'+':''}${diff.toFixed(2)} kg。`}${current.count<7||previous.count<7?' 当前有未记录日期，均值按已填日期计算。':''}</p>`;
}
function nutritionView(){
  const entry=state.nutrition[nutritionDate]||{};
  const p=id=>C.parameter(PLAN,state,id);
  const targets={'蛋白质':`160–180（当前目标${p('protein_target')}）`,'脂肪':`75–85（当前目标${p('fat_target')}）`,'碳水':`${p('carb_low')}–${p('carb_high')}`,'热量':`${p('kcal_low')}–${p('kcal_high')}`,'肌酸':`${p('creatine_low')}–${p('creatine_high')}`};
  return `<div class="view-title"><div><h2>营养与恢复</h2><p>晨起体重 · 饮食 · 训练恢复</p></div>${icon('apple')}</div><div class="nutrition-grid"><section class="band"><div class="date-line"><label for="nutritionDate">记录日期</label><input id="nutritionDate" type="date" value="${nutritionDate}" aria-label="营养记录日期"></div><div class="form-grid">${nutrientFields.map(f=>nutrientInput(f,entry)).join('')}</div><details id="nutrition-more" style="margin-top:12px"><summary>更多营养与恢复记录</summary><div class="form-grid">${extraFields.map(f=>nutrientInput(f,entry)).join('')}<label class="wide">备注<textarea data-nutrient="note" maxlength="5000">${h(entry.note||'')}</textarea></label></div></details><div class="band"><h3>周平均体重</h3><div id="weeklyWeights">${weeklyView()}</div></div></section>
  <section class="band"><h3>本阶段营养目标</h3><dl class="fact-list">${PLAN.nutrition.map(n=>`<div><dt>${h(n.name)}</dt><dd><strong>${h(targets[n.name]??n.target)} ${h(n.unit)}</strong><p>${h(n.method)}</p>${n.note?`<p class="note">${h(n.note)}</p>`:''}</dd></div>`).join('')}</dl><details id="nutrition-tips"><summary>进餐与两周趋势调整</summary><ul class="rule-list">${PLAN.meals.map(m=>`<li><strong>${h(m.time)}</strong>${h(m.suggestion)}<p class="small">${h(m.note)}</p></li>`).join('')}${PLAN.dietRules.map(r=>`<li><strong>${h(r.condition)}</strong>${h(r.action)}</li>`).join('')}</ul></details></section></div>`;
}
function recordsView(){
  return `<div class="view-title"><div><h2>记录与备份</h2><p>每组记录均包含动作名称</p></div>${icon('notebook-pen')}</div><div class="backup-tools"><button class="button primary" data-action="export-text">${icon('file-text')}导出给 GPT</button><button class="button" data-action="export-json">${icon('file-json')}训练记录 JSON</button><button class="button" data-action="backup">${icon('download')}完整备份</button><button class="button" data-action="import">${icon('upload')}恢复备份</button><button class="button" data-action="undo-import">${icon('undo-2')}撤销上次恢复</button></div><section class="band"><h3>12次训练记录</h3><div class="history-list">${PLAN.sessions.map(s=>{
    const st=C.stats(PLAN,state,s.index),end=state.sessions[s.index]?.completedAt;
    return `<button class="history-item" data-action="history" data-index="${s.index}"><span class="letter">${s.template}</span><div><strong>训练 ${String(s.index).padStart(2,'0')} · 第${s.round}轮</strong><small>${st.done}/${st.total}组完成${st.skipped?' · '+st.skipped+'组跳过':''}${end?' · '+new Date(end).toLocaleDateString('zh-CN'):''}</small></div><span class="pill ${end?'green':''}">${end?'已结束':st.done?'进行中':'待训练'}</span>${icon('chevron-right')}</button>`;
  }).join('')}</div></section><section class="band"><h3>历史阶段</h3><a class="button" href="./第3阶段旧版.html">${icon('history')}查看第3阶段记录</a><p class="note">旧记录读取当前网址下原有的本机数据。</p></section>`;
}
function progressionTable(){return `<table class="data-table"><thead><tr><th>轮次</th><th>深蹲</th><th>卧推</th><th>硬拉</th><th>海豹卧拉</th></tr></thead><tbody>${[1,2,3,4].map(round=>`<tr><td>第${round}轮</td>${['squat','bench','deadlift','seal_row'].map(key=>`<td>${Number(C.parameter(PLAN,state,'start_'+key))+(round-1)*Number(C.parameter(PLAN,state,key==='seal_row'?'inc_back':'inc_'+key))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;}
function planView(){return `<div class="view-title"><div><h2>第4阶段计划</h2><p>${h(PLAN.subtitle)}</p></div><button class="icon-button" data-action="settings" aria-label="修改计划参数" title="修改计划参数">${icon('settings-2')}</button></div><div class="plan-grid"><section class="band"><h3>四轮主项负重 <span class="small muted">kg</span></h3>${progressionTable()}<p class="note">已记录动作使用当时的目标；调整参数适用于尚未记录的动作。</p><ul class="rule-list">${PLAN.principles.map(p=>`<li>${h(p)}</li>`).join('')}</ul></section><section class="band"><h3>恢复与手动调整</h3><ul class="rule-list">${PLAN.recoveryRules.map(r=>`<li><strong>${h(r.name)}</strong><p>${h(r.condition)}</p>${h(r.action)}</li>`).join('')}</ul></section></div><details class="band" id="source-detail"><summary>计划来源与参数</summary><p class="note">${h(PLAN.source)}</p><dl class="fact-list">${PLAN.parameters.map(p=>`<div><dt>${h(p.name)}</dt><dd>${h(C.parameter(PLAN,state,p.id))} ${h(p.unit)}<p class="note">${h(p.note)}</p></dd></div>`).join('')}</dl></details>`;}
function openTarget(row){
  const t=C.target(PLAN,state,row);editorMode={kind:'target',id:row.id};
  $('#editorTitle').textContent=row.actionName+' · 目标';
  $('#editorBody').innerHTML=`<p class="note">仅调整训练${row.trainingIndex}的这个动作。</p><div class="form-grid"><label class="wide">目标重量 kg / 负荷<input name="load" value="${h(t.load)}" required maxlength="200"></label><label>组数<input name="sets" type="number" min="1" max="12" step="1" value="${t.sets}" required></label><label>每组目标次数<input name="reps" value="${h(t.reps)}" maxlength="200" required></label><label>目标 RIR<input name="rir" value="${h(t.rir)}" maxlength="200" required></label><label>休息时间 秒<input name="rest" type="number" min="0" max="1800" step="1" value="${t.rest}" required></label></div>`;
  $('#editor').showModal();
}
function openSettings(){
  editorMode={kind:'settings'};$('#editorTitle').textContent='计划参数';
  $('#editorBody').innerHTML=`<p class="note">已开始记录的动作保留原目标。尚未记录的动作按新参数计算。</p><div class="form-grid">${PLAN.parameters.map(p=>`<label>${h(p.name)} (${h(p.unit)})<input name="${p.id}" type="number" inputmode="decimal" min="0" max="10000" step="any" value="${h(C.parameter(PLAN,state,p.id))}" required></label>`).join('')}<label class="wide">高位下拉首轮校准重量 kg<input name="start_pulldown" type="number" min="0" max="1000" step="any" value="${h(state.parameters.start_pulldown??'')}" placeholder="尚未校准"></label></div>`;$('#editor').showModal();
}
$('#editorForm').addEventListener('submit',event=>{
  event.preventDefault();const form=new FormData(event.target);
  if(editorMode.kind==='target') {
    const row=rowById(editorMode.id),r=getRecord(row),load=String(form.get('load')).trim();
    if(C.numberOrNull(load)!=null&&(Number(load)<0||Number(load)>1500)){toast('目标重量应在0至1500 kg之间');return;}
    const sets=Number(form.get('sets'));
    if(sets<r.target.sets && Object.keys(r.sets).some(k=>Number(k)>sets) && !confirm('减少组数后，原有多余组的记录仍会保留在导出中。继续？'))return;
    r.target={load:C.numberOrNull(load)??load,sets,reps:String(form.get('reps')),rir:String(form.get('rir')),rest:Number(form.get('rest'))};
    r.mode='adjusted';invalidateFinished(row.trainingIndex);
  } else {
    const parameters={};
    for(const p of PLAN.parameters)parameters[p.id]=Number(form.get(p.id));
    if(String(form.get('start_pulldown')).trim()!=='')parameters.start_pulldown=Number(form.get('start_pulldown'));
    for(const key of ['carb','kcal','creatine'])if(parameters[key+'_low']>parameters[key+'_high']){toast('下限不能大于上限');return;}
    state.parameters=parameters;
  }
  persist();$('#editor').close();refresh();toast('调整已保存');
});
function notifyStats(row){const status=document.querySelector(`[data-status-for="${row.id}"]`);if(status)status.textContent=C.exerciseStatus(PLAN,state,row);}
document.addEventListener('input',event=>{
  const el=event.target;
  if(!el.matches('[data-record],[data-feedback],[data-nutrient]'))return;
  if(el.type==='number' && !el.validity.valid)return;
  if(el.dataset.record){const row=rowById(el.dataset.id),r=getRecord(row);const set=r.sets[el.dataset.set] ||= {};set[el.dataset.record]=el.value;notifyStats(row);}
  else if(el.dataset.feedback){const row=rowById(el.dataset.id);getRecord(row)[el.dataset.feedback]=el.value;notifyStats(row);}
  else if(el.dataset.nutrient){const entry=state.nutrition[nutritionDate] ||= {};entry[el.dataset.nutrient]=el.value;if(el.dataset.nutrient==='weight')$('#weeklyWeights').innerHTML=weeklyView();}
  persist();
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='nutritionDate'){if(C.validDate(el.value)){nutritionDate=el.value;refresh();}return;}
  if(el.dataset.mode){const row=rowById(el.dataset.mode);getRecord(row).mode=el.value;invalidateFinished(row.trainingIndex);persist();refresh();}
});
document.addEventListener('focusout',event=>{
  const el=event.target;
  if(el.matches('input[type="number"][data-record],input[type="number"][data-feedback],input[type="number"][data-nutrient]')&&!el.validity.valid){toast('数值超出范围，请检查后重新填写');el.reportValidity();}
});
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-action]');if(!button||button.disabled)return;
  const action=button.dataset.action,id=button.dataset.id,row=id?rowById(id):null;
  switch(action){
    case 'view':go(button.dataset.view);break;
    case 'session':state.current=Number(button.dataset.index);persist();render();focusSession();break;
    case 'history':state.current=Number(button.dataset.index);persist();go('training');focusSession();break;
    case 'warmup':{const s=getSession();s.warmup ||= {};s.warmup[button.dataset.order]=!s.warmup[button.dataset.order];persist();refresh();break;}
    case 'set':{
      const r=getRecord(row),set=r.sets[button.dataset.set] ||= {};
      if(set.skipped){set.skipped=false;set.done=false;}else set.done=!set.done;
      if(set.done)set.completedAt=new Date().toISOString();else delete set.completedAt;
      invalidateFinished(row.trainingIndex);persist();refresh();break;
    }
    case 'edit-target':openTarget(row);break;
    case 'settings':openSettings();break;
    case 'close-dialog':$('#editor').close();break;
    case 'close-export':$('#exportDialog').close();break;
    case 'fill-target':{
      const t=C.target(PLAN,state,row);
      if(typeof t.load!=='number'){toast('请先填写或调整具体目标重量');break;}
      const r=getRecord(row);for(let i=1;i<=t.sets;i++){const s=r.sets[i] ||= {};if(s.load==null||s.load==='')s.load=String(t.load);}
      persist();refresh();toast('已填入空白重量栏');break;
    }
    case 'reuse-load':{
      const prev=C.previous(PLAN,state,row);if(!prev)break;
      const old=state.records[prev.id],set=Object.values(old.sets).find(s=>C.numberOrNull(s.load)!=null);
      const load=set?Number(set.load):old.target.load;const r=getRecord(row);r.target.load=load;r.mode='adjusted';invalidateFinished(row.trainingIndex);persist();refresh();toast('已沿用上次重量');break;
    }
    case 'skip-remaining':{
      if(!confirm('跳过这个动作尚未完成的组？已有记录会保留。'))break;
      const r=getRecord(row);for(let i=1;i<=r.target.sets;i++){const s=r.sets[i] ||= {};if(!s.done)s.skipped=true;}
      r.mode='adjusted';invalidateFinished(row.trainingIndex);persist();refresh();break;
    }
    case 'finish':{
      if(C.stats(PLAN,state,state.current).remaining){toast('还有未完成组，请先勾选完成或标记跳过');break;}
      getSession().completedAt ||= new Date().toISOString();persist();refresh();toast('本次训练已结束');break;
    }
    case 'next':{
      if(state.current===12)break;
      if(!state.sessions[state.current]?.completedAt&&!confirm('本次尚未结束，仍要切换到下一次训练？现有记录会保留。'))break;
      state.current++;persist();go('warmup');focusSession();break;
    }
    case 'timer-start':startTimer(row);break;
    case 'timer-pause':pauseTimer();break;
    case 'timer-add':if(state.timer){if(state.timer.endsAt)state.timer.endsAt+=30000;else state.timer.remaining+=30;state.timer.duration+=30;persist();renderTimer();}break;
    case 'timer-close':state.timer=null;persist();renderTimer();break;
    case 'export-text':$('#exportText').value=C.textExport(PLAN,state);$('#exportDialog').showModal();break;
    case 'download-text':download($('#exportText').value,`第4阶段训练记录_${C.localDate()}.txt`,'text/plain;charset=utf-8');break;
    case 'copy-export':copyExport();break;
    case 'export-json':download(JSON.stringify({app:'训练计划器',phase:4,exportedAt:new Date().toISOString(),source:PLAN.source,
      trainingRecords:C.exportRecords(PLAN,state),warmupRecords:C.warmupExport(PLAN,state),nutritionRecords:state.nutrition},null,2),`第4阶段训练记录_${C.localDate()}.json`,'application/json');break;
    case 'backup':download(JSON.stringify({app:'训练计划器',backupVersion:1,phase:4,exportedAt:new Date().toISOString(),sourceSha256:PLAN.sourceSha256,state},null,2),`第4阶段完整备份_${C.localDate()}.json`,'application/json');break;
    case 'import':$('#backupFile').click();break;
    case 'undo-import':undoImport();break;
    case 'export-damaged':download(damagedRaw||'',`第4阶段原始记录_${C.localDate()}.json`,'application/json');break;
  }
});
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('已生成下载文件');}
async function copyExport(){
  try{await navigator.clipboard.writeText($('#exportText').value);toast('已复制训练记录');}
  catch{$('#exportText').focus();$('#exportText').select();toast('请在选中的文字上选择复制，或下载 TXT');}
}
$('#backupFile').addEventListener('change',async event=>{
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>8*1024*1024)throw Error('备份文件过大，请选择训练计划器导出的 JSON。');
    const backup=JSON.parse(await file.text());
    if(backup.backupVersion!==1||backup.phase!==4||backup.sourceSha256!==PLAN.sourceSha256)throw Error('备份与当前第4阶段计划不匹配。');
    const next=C.validateState(PLAN,backup.state);
    if(!confirm('用这份备份恢复第4阶段记录？当前记录将保留为可撤销副本。'))return;
    localStorage.setItem(BEFORE_IMPORT,JSON.stringify(state));
    if(damagedRaw)localStorage.setItem(STORE+'-damaged',damagedRaw);
    localStorage.setItem(STORE,JSON.stringify(next));state=next;storageBlocked=false;damagedRaw=null;$('#storageWarning').hidden=true;
    go('records');toast('记录已恢复');
  }catch(error){toast(error.message||'备份恢复失败');}finally{event.target.value='';}
});
function undoImport(){
  try{
    const raw=localStorage.getItem(BEFORE_IMPORT);if(!raw){toast('没有可撤销的恢复记录');return;}
    const previous=C.validateState(PLAN,JSON.parse(raw));
    if(!confirm('恢复到上次导入前的记录？当前状态也会保留，支持再次切换。'))return;
    localStorage.setItem(BEFORE_IMPORT,JSON.stringify(state));localStorage.setItem(STORE,JSON.stringify(previous));state=previous;go('records');toast('已恢复导入前记录');
  }catch(error){toast(error.message||'恢复失败');}
}
function remaining(){const t=state.timer;return t ? t.endsAt ? Math.max(0,Math.ceil((t.endsAt-Date.now())/1000)):t.remaining : 0;}
function startTimer(row){
  if(state.timer&&remaining()>0&&!confirm('替换正在进行的休息计时？'))return;
  const seconds=C.target(PLAN,state,row).rest;
  state.timer={label:row.actionName,duration:seconds,endsAt:Date.now()+seconds*1000,remaining:seconds};persist();renderTimer();
}
function pauseTimer(){const t=state.timer;if(!t)return;if(t.endsAt){t.remaining=remaining();t.endsAt=null;}else{t.endsAt=Date.now()+t.remaining*1000;}persist();renderTimer();}
function timerValue(){const n=remaining();return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;}
function renderTimer(){
  const bar=$('#timerBar');bar.hidden=!state.timer;document.body.classList.toggle('has-timer',!!state.timer);if(!state.timer)return;
  bar.innerHTML=`${icon('timer')}<div class="timer-copy"><small>${h(state.timer.label)}</small><strong id="timerValue">${timerValue()}</strong></div><button class="icon-button" data-action="timer-pause" aria-label="${state.timer.endsAt?'暂停计时':'继续计时'}" title="${state.timer.endsAt?'暂停':'继续'}">${icon(state.timer.endsAt?'pause':'play')}</button><button class="icon-button add-time" data-action="timer-add" title="增加30秒" aria-label="增加30秒">+30</button><button class="icon-button" data-action="timer-close" aria-label="关闭计时" title="关闭">${icon('x')}</button>`;hydrateIcons();
}
setInterval(()=>{if(!state.timer)return;const value=$('#timerValue');if(value)value.textContent=remaining()===0?'休息结束':timerValue();},500);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&state.timer)renderTimer();});
window.addEventListener('storage',event=>{if(event.key===STORE){toast('其他页面已更新记录，重新打开可载入最新内容');}});
if('serviceWorker' in navigator&&location.protocol!=='file:'){
  window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>toast('离线缓存未就绪，请联网重新打开一次')));
}
showStorageWarning();render();focusSession();
