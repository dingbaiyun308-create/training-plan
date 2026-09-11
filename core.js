(function (root) {
  'use strict';
  const blankState = () => ({schema:1, phase:4, current:1, parameters:{}, records:{}, sessions:{}, nutrition:{}, timer:null});
  const numberOrNull = value => value === '' || value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null;
  function parameter(plan, state, id) {
    return state.parameters[id] ?? plan.parameters.find(item => item.id === id)?.value;
  }
  function baseTarget(plan, state, row) {
    let load = row.targetLoad;
    if (row.loadModel) load = Number(parameter(plan,state,row.loadModel.start)) + (row.round - 1) * Number(parameter(plan,state,row.loadModel.increment));
    if (row.actionName === '高位下拉' && numberOrNull(state.parameters.start_pulldown) != null) {
      load = Number(state.parameters.start_pulldown) + (row.round - 1) * Number(parameter(plan,state,'inc_back'));
    }
    return {load, sets:row.sets, reps:row.reps, rir:row.rir, rest:row.rest};
  }
  function target(plan,state,row) {return state.records[row.id]?.target || baseTarget(plan,state,row);}
  function record(plan,state,row) {
    if (!state.records[row.id]) state.records[row.id] = {target:baseTarget(plan,state,row), sets:{}, mode:'normal', rir:'', discomfort:'', note:''};
    return state.records[row.id];
  }
  function rowsFor(plan,index) {return plan.exercises.filter(row => row.trainingIndex === Number(index));}
  function exerciseStatus(plan,state,row) {
    const r = state.records[row.id];
    if (!r) return '未开始';
    if (r.mode === 'skipped') return '跳过';
    if (r.mode === 'adjusted') return '调整';
    const count=target(plan,state,row).sets;
    if (Array.from({length:count},(_,i)=>r.sets[i+1]?.done).every(Boolean)) return '完成';
    return Object.keys(r.sets).length || r.rir !== '' || r.discomfort !== '' || r.note ? '进行中' : '未开始';
  }
  function stats(plan,state,index) {
    const rows=index ? rowsFor(plan,index) : plan.exercises;
    let total=0,done=0,skipped=0;
    for (const row of rows) {
      const r=state.records[row.id], t=target(plan,state,row);
      total+=t.sets;
      for(let i=1;i<=t.sets;i++) {
        if(r?.mode==='skipped' || r?.sets[i]?.skipped) skipped++;
        else if(r?.sets[i]?.done) done++;
      }
    }
    return {total,done,skipped,remaining:total-done-skipped};
  }
  function previous(plan,state,row) {
    return plan.exercises.filter(r=>r.actionName===row.actionName && r.trainingIndex<row.trainingIndex && state.records[r.id])
      .sort((a,b)=>b.trainingIndex-a.trainingIndex)[0];
  }
  function localDate(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  function validDate(s) {return typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && localDate(new Date(s+'T12:00:00'))===s;}
  function weekAverage(nutrition,date,offset=0) {
    const d=new Date(date+'T12:00:00');
    d.setDate(d.getDate()-((d.getDay()+6)%7)+offset*7);
    const start=localDate(d); d.setDate(d.getDate()+6); const end=localDate(d);
    const samples=Object.entries(nutrition).filter(([key,row])=>key>=start && key<=end && numberOrNull(row.weight)>0);
    return {start,end,count:samples.length,average:samples.length ? samples.reduce((n,[,r])=>n+Number(r.weight),0)/samples.length : null};
  }
  const object = x => x !== null && typeof x==='object' && !Array.isArray(x);
  function validateState(plan,input) {
    if(!object(input)||input.phase!==4||input.schema!==1) throw Error('请选择第4阶段的完整备份文件。');
    if(!Number.isInteger(input.current)||input.current<1||input.current>12) throw Error('备份中的训练次数无效。');
    for(const field of ['parameters','records','sessions','nutrition']) if(!object(input[field])) throw Error('备份缺少 '+field+' 数据。');
    const parameterIds=new Set([...plan.parameters.map(p=>p.id),'start_pulldown']);
    for(const [k,v] of Object.entries(input.parameters)) if(!parameterIds.has(k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>10000) throw Error('备份含无效计划参数。');
    const knownRows=new Set(plan.exercises.map(r=>r.id));
    for(const [id,r] of Object.entries(input.records)) {
      if(!knownRows.has(id)||!object(r)||!object(r.target)||!object(r.sets)||!['normal','adjusted','skipped'].includes(r.mode)) throw Error('备份含无效动作记录。');
      const t=r.target;
      if(!Number.isInteger(t.sets)||t.sets<1||t.sets>12||!Number.isFinite(t.rest)||t.rest<0||t.rest>1800) throw Error('备份中的组数或休息时间无效。');
      for(const k of ['load','reps','rir']) if(!['number','string'].includes(typeof t[k])||String(t[k]).length>200) throw Error('备份的训练目标无效。');
      for(const [n,s] of Object.entries(r.sets)) {
        if(!/^([1-9]|1[0-2])$/.test(n)||!object(s)) throw Error('备份中的分组记录无效。');
        for(const key of ['load','reps']) if(s[key]!=null && (typeof s[key]!=='string' && typeof s[key]!=='number' || String(s[key]).length>100)) throw Error('备份的重量或次数无效。');
        for(const key of ['done','skipped']) if(s[key]!=null && typeof s[key]!=='boolean') throw Error('备份的完成状态无效。');
        if(s.done && s.skipped) throw Error('一组训练不能同时完成和跳过。');
      }
      for(const key of ['rir','discomfort','note']) if(!['string','number'].includes(typeof r[key])||String(r[key]).length>5000) throw Error('备份中的备注无效。');
    }
    for(const [index,s] of Object.entries(input.sessions)) {
      if(!/^(?:[1-9]|1[0-2])$/.test(index)||!object(s)) throw Error('备份含无效训练日。');
      if(s.warmup!=null && (!object(s.warmup)||Object.entries(s.warmup).some(([k,v])=>!/^\d+$/.test(k)||typeof v!=='boolean'))) throw Error('备份中的热身记录无效。');
      if(s.completedAt!=null && (typeof s.completedAt!=='string'||isNaN(Date.parse(s.completedAt)))) throw Error('备份的完成日期无效。');
    }
    for(const [date,entry] of Object.entries(input.nutrition)) {
      if(!validDate(date)||!object(entry)) throw Error('备份含无效营养日期。');
      for(const [k,v] of Object.entries(entry)) if(!['weight','protein','calories','fat','carbs','creatine','sleep','energy','pain','note'].includes(k)||!['number','string'].includes(typeof v)||String(v).length>5000) throw Error('备份中的营养记录无效。');
    }
    const out=JSON.parse(JSON.stringify(input));
    out.timer=null;
    return out;
  }
  function exportRecords(plan,state) {
    return plan.exercises.map(row=>{
      const r=state.records[row.id] || {},t=target(plan,state,row);
      const keys=new Set(Array.from({length:t.sets},(_,i)=>String(i+1)));
      Object.keys(r.sets||{}).forEach(k=>keys.add(k));
      return {actionName:row.actionName,exerciseId:row.id,trainingIndex:row.trainingIndex,round:row.round,template:row.template,
        category:row.category,sourceTarget:{load:row.targetLoad,sets:row.sets,reps:row.reps,rir:row.rir,restSeconds:row.rest},
        target:{load:t.load,sets:t.sets,reps:t.reps,rir:t.rir,restSeconds:t.rest},status:exerciseStatus(plan,state,row),
        setRecords:[...keys].sort((a,b)=>Number(a)-Number(b)).map(key=>{
          const set=r.sets?.[key] || {};
          return {setNumber:Number(key),actionName:row.actionName,inCurrentTarget:Number(key)<=t.sets,
            actualWeightKg:numberOrNull(set.load),actualReps:numberOrNull(set.reps),
            status:r.mode==='skipped'||set.skipped?'跳过':set.done?'完成':'未完成',completedAt:set.completedAt||null};
        }),actualRIR:r.rir??'',discomfort:r.discomfort??'',note:r.note||'',progressionRule:row.progression,
        sessionCompletedAt:state.sessions[row.trainingIndex]?.completedAt||null};
    });
  }
  function warmupExport(plan,state) {
    return plan.sessions.map(s=>({trainingIndex:s.index,template:s.template,source:plan.warmupSource,
      records:plan.warmups[s.template].map(w=>({actionName:w.actionName,dose:w.dose,completed:!!state.sessions[s.index]?.warmup?.[w.order]}))}));
  }
  function textExport(plan,state) {
    const records=exportRecords(plan,state);
    const lines=['第4阶段训练记录','目标：肌肥大、肌肉耐力、力量维持',`原计划：${plan.source}`,`导出时间：${new Date().toLocaleString('zh-CN')}`,
      '负重单位：kg。次数按原计划含单侧含义；空白表示未记录。RIR表示剩余可完成次数。',''];
    for(const s of plan.sessions) {
      const batch=records.filter(r=>r.trainingIndex===s.index && state.records[r.exerciseId]);
      if(!batch.length && !state.sessions[s.index]) continue;
      lines.push(`训练 ${s.index} / 第${s.round}轮 / 模板 ${s.template}`);
      if(state.sessions[s.index]?.completedAt) lines.push(`结束时间：${new Date(state.sessions[s.index].completedAt).toLocaleString('zh-CN')}`);
      const warm=warmupExport(plan,state).find(x=>x.trainingIndex===s.index);
      lines.push(`热身（沿用第3阶段）：${warm.records.map(w=>`${w.actionName} ${w.completed?'完成':'未勾选'}`).join('；')}`);
      for(const r of batch) {
        lines.push(`\n${r.actionName} [${r.status}]`,`目标：${r.target.load}${typeof r.target.load==='number'?' kg':''}，${r.target.sets}组 × ${r.target.reps}，RIR ${r.target.rir}，休息${r.target.restSeconds}秒`);
        for(const set of r.setRecords) lines.push(`  第${set.setNumber}组：${set.actualWeightKg??'未记录'} kg / ${set.actualReps??'未记录'} 次 / ${set.status}${set.inCurrentTarget?'':'（调整前记录）'}`);
        lines.push(`实际RIR：${r.actualRIR===''?'未记录':r.actualRIR}；不适：${r.discomfort===''?'未记录':r.discomfort}/10`);
        if(r.note)lines.push(`备注：${r.note}`);
      }
      lines.push('');
    }
    if(!Object.keys(state.records).length) lines.push('尚未填写训练动作记录。');
    const labels={weight:'晨起体重(kg)',protein:'蛋白质(g)',calories:'热量(kcal)',fat:'脂肪(g)',carbs:'碳水(g)',creatine:'肌酸(g)',sleep:'睡眠(h)',energy:'精力(1-5)',pain:'不适(0-10)',note:'备注'};
    lines.push('\n营养与恢复');
    for(const [date,row] of Object.entries(state.nutrition).sort(([a],[b])=>a.localeCompare(b))) lines.push(date+'：'+Object.entries(row).filter(([,v])=>v!=='' && v!=null).map(([k,v])=>`${labels[k]||k} ${v}`).join('；'));
    return lines.join('\n');
  }
  root.TrainingCore={blankState,numberOrNull,parameter,baseTarget,target,record,rowsFor,exerciseStatus,stats,previous,localDate,validDate,weekAverage,validateState,exportRecords,warmupExport,textExport};
})(globalThis);
