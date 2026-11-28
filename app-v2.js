const HISTORY_KEY='study337.history.v1';
const $=selector=>document.querySelector(selector);
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayKey=()=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const get=type=>parts.find(p=>p.type===type).value;return `${get('year')}-${get('month')}-${get('day')}`};
const previousDay=day=>{const [year,month,date]=day.split('-').map(Number);return new Date(Date.UTC(year,month-1,date-1)).toISOString().slice(0,10)};
const formatTime=value=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false});
const questionById=id=>BANK.find(q=>q.id===id);
const sourceMarkup=q=>`${escapeHtml(q.source)}${q.sourceUrl?` · <a href="${escapeHtml(q.sourceUrl)}" target="_blank" rel="noopener">查看原始资料</a>`:''}`;
const types=['全部','选择题','名词解释','简答','论述','案例应用'];
const typeMarks={'选择题':2,'名词解释':5,'简答':10,'论述':25,'案例应用':25};
const marksFor=q=>typeMarks[q.type]??10;
const rubricMarks=(q,i)=>Math.floor(marksFor(q)/q.points.length)+(i<marksFor(q)%q.points.length?1:0);
const awarded=(r,q)=>r.score===null?null:r.earned??Math.round(r.score*marksFor(q)/100);
const paperKey=()=>`337-${todayKey()}`;
const areas=['全部','设计史','交互设计','设计方法','产品设计'];
let records=[];try{records=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{records=[]}
let todayFilter='全部',todayStatus='未答',bankFilter='全部',bankArea='全部';
let studyQueue=[],studyIndex=0;
let activeMode='today';
const drafts=new Map();
const photoDrafts=new Map();
const saveRecords=()=>localStorage.setItem(HISTORY_KEY,JSON.stringify(records));
const photoIdsOf=r=>Array.isArray(r.photoIds)?r.photoIds:[];
const photoMarkup=r=>photoIdsOf(r).length?`<div class="photo-review"><strong>你的手写答卷</strong><div class="photo-review-grid">${photoIdsOf(r).map((id,i)=>`<button type="button" class="photo-open" data-photo-open="${escapeHtml(id)}"><img data-photo-id="${escapeHtml(id)}" alt="手写答卷第 ${i+1} 页"><span>第 ${i+1} 页 · 点按放大</span></button>`).join('')}</div></div>`:'';
async function loadPhotos(scope){for(const img of scope.querySelectorAll('img[data-photo-id]')){try{const blob=await PhotoStore.get(img.dataset.photoId);if(blob){const url=URL.createObjectURL(blob);img.src=url;img.onload=()=>URL.revokeObjectURL(url)}else img.alt+='（照片未随记录导入）'}catch{img.alt+='（读取失败）'}}for(const button of scope.querySelectorAll('[data-photo-open]'))button.onclick=async()=>{const blob=await PhotoStore.get(button.dataset.photoOpen);if(!blob)return;const url=URL.createObjectURL(blob),dialog=$('#photoDialog'),img=$('#photoLarge');img.src=url;dialog.showModal();dialog.onclose=()=>{img.src='';URL.revokeObjectURL(url)}}}
function renderDraftPhotos(id){const items=photoDrafts.get(id)??[],scope=$('#photoDraftList');if(!scope)return;scope.innerHTML=items.map((item,i)=>`<div class="draft-photo"><img src="${item.url}" alt="待提交的手写答卷第 ${i+1} 页"><button type="button" data-remove-photo="${i}" aria-label="移除第 ${i+1} 页照片">移除</button></div>`).join('');scope.querySelectorAll('[data-remove-photo]').forEach(button=>button.onclick=()=>{const removed=items.splice(Number(button.dataset.removePhoto),1)[0];URL.revokeObjectURL(removed.url);photoDrafts.set(id,items);renderDraftPhotos(id)})}
const hash=value=>{let h=2166136261;for(const c of String(value)){h=Math.imul(h^c.codePointAt(0),16777619)}h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return(h^(h>>>16))>>>0};
function latest(id,day=todayKey()){return records.filter(r=>r.qid===id&&r.day===day).at(-1)}
function latestEver(id){return records.filter(r=>r.qid===id).at(-1)}
function examLatest(id){return records.filter(r=>r.qid===id&&r.session==='exam'&&r.paper===paperKey()).at(-1)}
function examQuestions(){
  const key=`study337.exam.v2.${todayKey()}`;
  let planned;try{planned=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  if(Array.isArray(planned)&&planned.length===23){const saved=planned.map(questionById).filter(Boolean);if(saved.length===23)return saved}
  const mix={
    '选择题':{'设计史':5,'交互设计':3,'设计方法':1,'产品设计':1},
    '名词解释':{'设计史':3,'交互设计':2,'设计方法':1},
    '简答':{'设计史':2,'交互设计':2,'设计方法':1},
    '论述':{'设计史':1,'交互设计':1}
  },selected=[];
  for(const [type,areasMix] of Object.entries(mix)){
    const pool=BANK.filter(q=>q.type===type).sort((a,b)=>hash(todayKey()+'exam'+a.id)-hash(todayKey()+'exam'+b.id));
    for(const [area,count] of Object.entries(areasMix))selected.push(...pool.filter(q=>q.area===area).slice(0,count));
  }
  localStorage.setItem(key,JSON.stringify(selected.map(q=>q.id)));
  return selected;
}
function dailyQuestions(){
  const day=todayKey(),key=`study337.plan.v3.${day}`;
  let planned;try{planned=JSON.parse(localStorage.getItem(key)||'null')}catch{}
  if(Array.isArray(planned)&&planned.length===20){const saved=planned.map(questionById).filter(Boolean);if(saved.length===20)return saved}
  const quotas={'选择题':8,'名词解释':4,'简答':5,'论述':2,'案例应用':1};
  const interaction={'选择题':3,'名词解释':1,'简答':2,'论述':1,'案例应用':0};
  const previous=new Map();for(const r of records){const old=previous.get(r.qid);if(!old||old.at<r.at)previous.set(r.qid,r)}
  const yesterday=previousDay(day);
  let previousPlan=[];for(const oldKey of [`study337.plan.v3.${yesterday}`,`study337.plan.v2.${yesterday}`]){try{const ids=JSON.parse(localStorage.getItem(oldKey)||'null');if(Array.isArray(ids)&&ids.length===20){previousPlan=ids;break}}catch{}}
  const yesterdayIds=new Set(previousPlan),selected=[];
  for(const [type,count] of Object.entries(quotas)){
    const pool=BANK.filter(q=>q.type===type&&!yesterdayIds.has(q.id));
    pool.sort((a,b)=>{
      const ra=previous.get(a.id),rb=previous.get(b.id);
      const wa=ra&&Number.isFinite(ra.score)&&ra.score<70?-100:0,wb=rb&&Number.isFinite(rb.score)&&rb.score<70?-100:0;
      return wa-wb||hash(day+a.id)-hash(day+b.id);
    });
    const inter=pool.filter(q=>q.area==='交互设计'),other=pool.filter(q=>q.area!=='交互设计'),n=interaction[type];
    selected.push(...inter.slice(0,n),...other.slice(0,count-n));
  }
  localStorage.setItem(key,JSON.stringify(selected.map(q=>q.id)));
  return selected;
}
function scoreText(q,answer){
  const normalize=s=>String(s).toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
  const clauses=String(answer).split(/[。！？；;\n]+/).map(s=>s.trim()).filter(Boolean);
  const length=countTyped(answer),max=marksFor(q);
  const generic=new Set(['设计','产品','使用','用户','功能','形式','技术','材料','结构','方法','过程','问题','影响','意义','特点','目标','研究','需要','现代','艺术','文化','发展','分析','通过','实现','体现','相关','重要']);
  const details=q.points.map(([label,alts],i)=>{
    const marks=rubricMarks(q,i),terms=[...new Set([label,...alts].map(normalize).filter(Boolean))];
    const labelText=normalize(label),labelPairs=[...new Set([...labelText].slice(0,-1).map((c,j)=>c+labelText[j+1]).filter(x=>x.length===2))];
    const candidates=clauses.map(clause=>{
      const compact=normalize(clause),matched=terms.filter(term=>compact.includes(term));
      const distinctive=matched.filter(term=>term.length>=3&&!generic.has(term));
      const short=matched.filter(term=>term.length>=2&&!generic.has(term));
      const pairCount=labelPairs.filter(pair=>compact.includes(pair)).length;
      let level=0;
      if(compact.length>=8&&(matched.includes(labelText)&&labelText.length>=4||pairCount>=2||matched.filter(x=>x.length>=2).length>=2))level=1;
      else if(compact.length>=10&&distinctive.length>=1&&alts.length===1)level=1;
      else if(compact.length>=10&&(distinctive.length>=1||short.length>=1||pairCount>=1))level=.5;
      if(compact.length<8)level=Math.min(level,.25);
      const contradiction=matched.filter(term=>term.length>=2).some(term=>{for(let at=compact.indexOf(term);at>=0;at=compact.indexOf(term,at+term.length)){const before=compact.slice(Math.max(0,at-10),at);if(/(?:不重视|不强调|不遵循|不需要|不具备|不采用|并非|不是|无关|否认).{0,4}$/.test(before))return true}return false});
      if(contradiction)level=0;
      return{level,matched,evidence:clause,contradiction};
    }).sort((a,b)=>b.level-a.level||b.matched.length-a.matched.length);
    const best=candidates[0]??{level:0,matched:[],evidence:''};
    const pointEarned=Math.round(marks*best.level*2)/2;
    return{label,marks,earned:pointEarned,hit:pointEarned>0,status:best.level>=1?'full':pointEarned>0?'partial':'miss',evidence:best.level?best.evidence:'',reason:best.level>=1?'表述较完整':pointEarned>0?'只捕捉到部分关键词，解释或联系还不充分':candidates.some(x=>x.contradiction)?'出现疑似否定该要点的表述，请对照原书核实':'没有找到可核对的对应表述'};
  });
  const raw=details.reduce((n,x)=>n+x.earned,0);
  const target=Math.max(({'名词解释':35,'简答':65,'论述':220,'案例应用':180}[q.type]??65),Math.round(countTyped(q.answer)*.75));
  const lengthCap=Math.round(max*(.2+.8*Math.min(1,length/target))*2)/2;
  const earned=Math.min(raw,lengthCap);
  return{score:Math.round(earned/max*100),earned,details,rawEarned:raw,length,lengthTarget:target,lengthCap};
}
function questionCard(q,i,mode){
  const r=mode==='bank'?latestEver(q.id):mode==='exam'?examLatest(q.id):latest(q.id);return `<article class="question ${r?'done':''}"><div class="q-main"><div class="q-index">${String(i+1).padStart(2,'0')}</div><div class="q-content"><div class="tags"><span>${escapeHtml(q.type)}</span><span>${escapeHtml(q.area)}</span><span class="marks-tag">${marksFor(q)} 分</span>${r?`<span class="result-tag">✓ 已答 · ${r.score===null?'待自评':`${awarded(r,q)}/${marksFor(q)} 分`}</span>`:''}</div><h3>${escapeHtml(q.title)}</h3><p>依据：${sourceMarkup(q)}</p></div></div><button class="primary" data-open="${q.id}">${r?'查看 / 重答':'开始作答'}</button></article>`
}
function bindQuestionButtons(scope,queue,mode){scope.querySelectorAll('[data-open]').forEach(button=>button.onclick=()=>openQuestion(Number(button.dataset.open),queue,mode))}
function filterButtons(active,attribute){return types.map(t=>`<button class="filter ${active===t?'selected':''}" ${attribute}="${t}">${t}</button>`).join('')}
function renderToday(){
  const qs=dailyQuestions(),done=qs.map(q=>latest(q.id)).filter(Boolean),graded=done.filter(r=>Number.isFinite(r.score)),avg=graded.length?Math.round(graded.reduce((n,r)=>n+r.score,0)/graded.length):null;
  $('#doneNum').textContent=done.length;$('#progressText').textContent=`${done.length} / 20`;$('#progressBar').style.width=`${done.length*5}%`;
  $('#averageText').textContent=avg===null?'—':`${avg}%`;$('#weakText').textContent=graded.filter(r=>r.score<70).length;
  $('#filters').innerHTML=filterButtons(todayFilter,'data-today-type');
  $('#statusFilters').innerHTML=['未答','已答','全部'].map(s=>`<button class="filter ${todayStatus===s?'selected':''}" data-status="${s}">${s}${s==='未答'?` · ${20-done.length}`:s==='已答'?` · ${done.length}`:''}</button>`).join('');
  $('#todayQuestionMap').innerHTML=`<div class="map-label"><strong>快速定位</strong><span>绿色已答 · 蓝色未答。点编号直接进入题目。</span></div><div class="map-grid">${qs.map((q,i)=>{const r=latest(q.id);return `<button class="map-cell ${r?'answered':''}" data-jump="${q.id}" title="第 ${i+1} 题 · ${escapeHtml(q.title)} · ${r?r.score===null?'待自评':`已得 ${awarded(r,q)} / ${marksFor(q)} 分`:'未答'}" aria-label="第 ${i+1} 题，${r?'已答':'未答'}">${r?'✓':String(i+1).padStart(2,'0')}</button>`}).join('')}</div>`;
  $('#todayQuestionMap').querySelectorAll('[data-jump]').forEach(button=>button.onclick=()=>openQuestion(Number(button.dataset.jump),qs.map(q=>q.id),'today'));
  const visible=qs.filter(q=>(todayFilter==='全部'||q.type===todayFilter)&&(todayStatus==='全部'||(todayStatus==='已答')===Boolean(latest(q.id))));
  $('#questionList').innerHTML=visible.length?visible.map(q=>questionCard(q,qs.indexOf(q),'today')).join(''):`<div class="empty">${todayStatus==='未答'?'这一组已经答完。去“已答”里回看，或到完整题库继续练习。':'这一组还没有作答记录。'}</div>`;
  $('#filters').querySelectorAll('button').forEach(b=>b.onclick=()=>{todayFilter=b.dataset.todayType;renderToday()});
  $('#statusFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>{todayStatus=b.dataset.status;renderToday()});
  bindQuestionButtons($('#questionList'),visible.map(q=>q.id),'today');
}
function renderExam(){
  const qs=examQuestions(),done=qs.map(q=>({q,r:examLatest(q.id)})).filter(x=>x.r),earned=done.reduce((n,{q,r})=>n+(awarded(r,q)??0),0);
  $('#examDone').textContent=`${done.length} / 23 题`;
  $('#examScore').textContent=`${earned} / 150 分`;
  $('#examQuestionMap').innerHTML=`<div class="map-label"><strong>模拟卷答题卡</strong><span>依照你提供的 2024 配分图；绿色已答，可点编号回看。</span></div><div class="map-grid">${qs.map((q,i)=>{const r=examLatest(q.id);return `<button class="map-cell ${r?'answered':''}" data-exam-jump="${q.id}" aria-label="第 ${i+1} 题，${q.type} ${marksFor(q)} 分，${r?'已答':'未答'}">${r?'✓':String(i+1).padStart(2,'0')}</button>`}).join('')}</div>`;
  $('#examQuestionMap').querySelectorAll('[data-exam-jump]').forEach(button=>button.onclick=()=>openQuestion(Number(button.dataset.examJump),qs.map(q=>q.id),'exam'));
  const groups=[['选择题',10,20],['名词解释',6,30],['简答',5,50],['论述',2,50]];
  $('#examQuestionList').innerHTML=groups.map(([type,count,total])=>`<div class="paper-group"><h3>${type} <small>${count} 题 · 共 ${total} 分</small></h3>${qs.filter(q=>q.type===type).map(q=>questionCard(q,qs.indexOf(q),'exam')).join('')}</div>`).join('');
  bindQuestionButtons($('#examQuestionList'),qs.map(q=>q.id),'exam');
}
function renderBank(){
  const term=$('#bankSearch').value.trim().toLowerCase();
  const found=BANK.filter(q=>(bankFilter==='全部'||q.type===bankFilter)&&(bankArea==='全部'||q.area===bankArea)&&[q.title,q.area,q.source].join(' ').toLowerCase().includes(term));
  $('#bankCount').textContent=`共 ${BANK.length} 题 · 当前显示 ${found.length} 题`;
  $('#bankFilters').innerHTML=filterButtons(bankFilter,'data-bank-type');
  $('#areaFilters').innerHTML=areas.map(a=>`<button class="filter ${bankArea===a?'selected':''}" data-area="${a}">${a}${a==='全部'?'':` · ${BANK.filter(q=>q.area===a).length}`}</button>`).join('');
  $('#bankList').innerHTML=found.length?found.map((q,i)=>questionCard(q,i,'bank')).join(''):'<div class="empty">没有找到匹配的题目。</div>';
  $('#bankFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>{bankFilter=b.dataset.bankType;renderBank()});bindQuestionButtons($('#bankList'),found.map(q=>q.id),'bank');
  $('#areaFilters').querySelectorAll('button').forEach(b=>b.onclick=()=>{bankArea=b.dataset.area;renderBank()});
}
function countTyped(text){return Array.from(text.replace(/\s/g,'')).length}
function studyRecord(id){return activeMode==='exam'?examLatest(id):activeMode==='bank'?latestEver(id):latest(id)}
function nextStudyIndex(direction){for(let i=studyIndex+direction;i>=0&&i<studyQueue.length;i+=direction){if(activeMode==='today'&&todayStatus==='已答'||!studyRecord(studyQueue[i]))return i}return -1}
function studyNav(){return `<div class="study-nav"><button type="button" class="quiet" data-move="-1" ${nextStudyIndex(-1)<0?'disabled':''}>上一题</button><span>${studyIndex+1} / ${studyQueue.length}</span><button type="button" class="primary" data-move="1" ${nextStudyIndex(1)<0?'disabled':''}>下一道未答</button></div>`}
function bindStudyNav(){document.querySelectorAll('#answerDialog [data-move]').forEach(button=>button.onclick=()=>{const next=nextStudyIndex(Number(button.dataset.move));if(next>=0)openQuestion(studyQueue[next])})}
function simpleHint(q){if(q.type!=='选择题')return q.tip;if(/谁|哪位|设计者|人物/.test(q.title))return '先想相关运动或流派，再想它的代表人物。';if(/年份|哪年|时期/.test(q.title))return '先放回设计史时间线，再判断前后顺序。';return '先抓住题干中的核心概念，再排除与该概念目标或特征相反的选项。'}
function openQuestion(id,queue,mode){
  if(mode)activeMode=mode;
  if(queue){studyQueue=[...queue];studyIndex=studyQueue.indexOf(id)}else studyIndex=studyQueue.indexOf(id);
  if(studyIndex<0){studyQueue=[id];studyIndex=0}
  const q=questionById(id),previous=activeMode==='exam'?examLatest(id):activeMode==='bank'?latestEver(id):latest(id),choice=q.type==='选择题';
  const draft=drafts.get(id),input=choice?`<fieldset class="choice-options" tabindex="-1"><legend>选择一个答案</legend>${q.options.map((option,i)=>`<label class="choice-option"><input type="radio" name="choice" value="${i}" ${draft===i?'checked':''}><span class="option-letter">${'ABCD'[i]}</span><span>${escapeHtml(option)}</span></label>`).join('')}</fieldset>`:`<label class="answer-label" for="answerInput">文字作答（可留空，改用手写照片）</label><textarea id="answerInput" rows="8" placeholder="先独立回忆，再提交。可以按“定义—要点—案例/意义”组织答案。">${escapeHtml(draft??(previous?.gradingMode==='self'?'':previous?.answer)??'')}</textarea><div class="char-count" id="charCount" aria-live="polite"></div>`;
  const photoPanel=choice?'':`<div class="photo-panel"><div><strong>手写作答</strong><p>先在纸上写，再用手机拍照。可连续添加多页；只上传照片时，对照答案自评。</p></div><label class="photo-upload" for="photoInput">拍照或选照片</label><input id="photoInput" type="file" accept="image/*" capture="environment" hidden><div id="photoDraftList" class="draft-photo-list"></div></div>`;
  $('#dialogContent').innerHTML=`<div class="dialog-top"><span class="eyebrow">${escapeHtml(q.type)} · ${escapeHtml(q.area)} · ${marksFor(q)} 分</span><h2>${escapeHtml(q.title)}</h2><p>资料依据：${sourceMarkup(q)}</p></div>${studyNav()}<div class="hint-box"><button type="button" id="hintButton">确实想不起来？查看一点提示</button><p id="hintText" hidden></p></div>${input}${photoPanel}<div class="dialog-actions"><span>${choice?'先独立判断，再提交查看解析':'文字或手写照片均可提交'}</span><button class="primary" id="submitAnswer">${choice?'提交并批改':'提交并核对'}</button></div><div id="feedback"></div>`;
  const dialog=$('#answerDialog');if(!dialog.open)dialog.showModal();dialog.scrollTop=0;bindStudyNav();
  let hintStep=0;$('#hintButton').onclick=()=>{hintStep++;if(hintStep===1){$('#hintButton').textContent='再点一次确认显示提示';$('#hintText').hidden=false;$('#hintText').textContent='先尝试写下或默念一个要点。需要时再点一次。'}else{$('#hintButton').hidden=true;$('#hintText').textContent=simpleHint(q)}};
  if(choice){document.querySelectorAll('input[name="choice"]').forEach(radio=>radio.onchange=()=>drafts.set(id,Number(radio.value)))}
  else{const update=()=>{drafts.set(id,$('#answerInput').value);$('#charCount').textContent=`已输入 ${countTyped($('#answerInput').value)} 字（不含空格，含标点）`};$('#answerInput').addEventListener('input',update);update();renderDraftPhotos(id);$('#photoInput').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{const blob=await PhotoStore.compress(file),items=photoDrafts.get(id)??[];items.push({blob,url:URL.createObjectURL(blob)});photoDrafts.set(id,items);renderDraftPhotos(id)}catch(error){alert(error.message)}event.target.value=''}}
  $('#submitAnswer').onclick=async()=>{
    let answer,score,earned,details,selectedIndex,grade,gradingMode='automatic';
    if(choice){const selected=$('input[name="choice"]:checked');if(!selected){$('.choice-options').focus();return}selectedIndex=Number(selected.value);answer=q.options[selectedIndex];score=selectedIndex===q.correctIndex?100:0;earned=score?2:0;details=[{label:q.options[q.correctIndex],hit:score===100,marks:2}]}
    else{answer=$('#answerInput').value.trim();if(!answer&&!(photoDrafts.get(id)?.length)){$('#answerInput').focus();return}if(answer){grade=scoreText(q,answer);({score,earned,details}=grade)}else{answer='[手写照片]';score=null;earned=null;gradingMode='self';details=q.points.map(([label],i)=>({label,marks:rubricMarks(q,i),hit:false}))}}
    const photoIds=[];try{for(const photo of photoDrafts.get(id)??[])photoIds.push(await PhotoStore.put(photo.blob))}catch(error){alert(`手写照片保存失败：${error.message}`);return}
    const record={qid:id,day:todayKey(),at:new Date().toISOString(),answer,score,earned,maxScore:marksFor(q),details,reference:q.answer,source:q.source,session:activeMode,gradingMode,photoIds,...(grade?{gradingVersion:2,length:grade.length,lengthTarget:grade.lengthTarget,lengthCap:grade.lengthCap,rawEarned:grade.rawEarned}:{}),...(activeMode==='exam'?{paper:paperKey()}:{}),...(choice?{selectedIndex}:{})};
    for(const photo of photoDrafts.get(id)??[])URL.revokeObjectURL(photo.url);photoDrafts.delete(id);drafts.delete(id);
    records.push(record);saveRecords();showFeedback(q,record);renderToday();renderExam();renderBank();$('#feedback').scrollIntoView({behavior:'smooth',block:'start'});
  };
  if(previous)showFeedback(q,previous);
}
function enhancedMarkup(answer){
  const sentences=answer.match(/[^。；]+[。；]?/g)?.map(s=>s.trim()).filter(Boolean)??[answer];
  return sentences.map((sentence,i)=>`${i===0?'':`<span class="bridge">${i===sentences.length-1?'由此可见，':i===1?'在此基础上，':'进一步看，'}</span>`}${escapeHtml(sentence)}`).join('<br><br>');
}
function answerFramework(q){return q.type==='名词解释'?'一句话界定 → 时间/背景（适用时）→ 2—3 个关键特征 → 代表或意义':q.type==='简答'?'先概括结论 → 按得分点分条回答 → 用一句话收束':q.type==='论述'||q.type==='案例应用'?'开头提出观点 → 分点展开并结合资料案例 → 分析影响或适用条件 → 结尾回应题意':'先判断概念，再排除不符选项'}
function regradeLegacyRecords(){
  let changed=false;
  for(const r of records){
    const q=questionById(r.qid);
    if(!q||q.type==='选择题'||r.gradingMode!=='automatic'||r.gradingVersion===2||!r.answer)continue;
    const old=r.earned??Math.round((r.score??0)*marksFor(q)/100),grade=scoreText(q,r.answer);
    r.previousEarned=old;r.score=grade.score;r.earned=grade.earned;r.details=grade.details;r.gradingVersion=2;r.length=grade.length;r.lengthTarget=grade.lengthTarget;r.lengthCap=grade.lengthCap;r.rawEarned=grade.rawEarned;changed=true;
  }
  if(changed)saveRecords();
}
function showFeedback(q,r){
  const choice=q.type==='选择题',pending=r.score===null,missing=r.details.filter(x=>!x.hit).map(x=>x.label);
  const partial=choice||pending?[]:r.details.filter(x=>x.status==='partial');
  const summary=pending?'手写照片已保存。对照完整答案和得分点，自行勾选写到的内容。':choice?(r.score?'回答正确。继续保持。':'回答错误。看完解析，再试一次。'):r.score>=85?'核心要点较完整，检查事实准确性和论证。':'当前答案还不足以支撑高分，先补内容再练表达。';
  const advice=pending?'照片作答暂不做自动文字识别，避免误识别造成误判。可按下方每条得分点自检，或补录文字后重新提交获得文字估分。':choice?(r.score?'记住正确选项所对应的概念，并想想其余选项为什么不符。':`正确答案是 ${escapeHtml(q.options[q.correctIndex])}。${escapeHtml(q.explanation)}`):`${missing.length?`缺少：${escapeHtml(missing.slice(0,3).join('、'))}。`:''}${partial.length?`展开不够：${escapeHtml(partial.slice(0,2).map(x=>x.label).join('、'))}。`:''}${r.lengthCap<marksFor(q)?`当前约 ${r.length} 字，${q.type}建议写到约 ${r.lengthTarget} 字，短答会限制估分上限。`:''}下一次按“观点／定义—依据与解释—案例或意义”补成完整句。纯关键词罗列只能拿部分分。`;
  const teacherNotes=!choice&&!pending&&r.gradingMode==='automatic'?`<div class="feedback-block teacher-notes"><h3>逐点评语 <small>按文字证据保守估分</small></h3><p>先看原回答里有没有明确论述，再核对得分点。系统无法可靠判断隐含意思、事实错误或论证质量；这不是正式阅卷分数。</p><ol>${r.details.map(x=>`<li class="${x.status|| (x.hit?'full':'miss')}"><strong>${escapeHtml(x.label)} · ${x.earned??(x.hit?x.marks:0)}/${x.marks} 分</strong><span>${escapeHtml(x.reason|| (x.hit?'检测到关键词，请自行核对表述是否正确':'未检测到对应表述'))}${x.evidence?`；你的原句：“${escapeHtml(x.evidence.slice(0,90))}”`:''}</span></li>`).join('')}</ol>${r.rawEarned>r.earned?`<p>内容分 ${r.rawEarned} 分，因展开字数不足，当前估分上限为 ${r.lengthCap} 分。</p>`:''}${Number.isFinite(r.previousEarned)?`<p>旧规则曾估 ${r.previousEarned} 分；已按更严格规则重算。</p>`:''}</div>`:'';
  const sectionGuide=q.answerSections?`<details class="section-guide"><summary>按开头、分点、结尾拆解</summary><div class="answer-sections">${q.answerSections.map(([heading,body])=>`<div><strong>${escapeHtml(heading)}</strong><p>${escapeHtml(body)}</p></div>`).join('')}</div></details>`:'';
  const answerPanel=choice?`<div class="feedback-block reference"><h3>完整答案与解析</h3><p>${escapeHtml(q.answer)}</p><span>来源：${sourceMarkup(q)}</span></div>`:`<div class="framework"><strong>答题框架</strong><p>${answerFramework(q)}</p></div><div class="answer-compare"><div class="feedback-block reference"><h3>完整成文答案</h3><p>${escapeHtml(q.answer)}</p>${sectionGuide}<span>来源：${sourceMarkup(q)}</span></div><div class="feedback-block memory-points"><h3>分点背诵与参考分值</h3><ol>${q.points.map(([label],i)=>`<li>${escapeHtml(label)} <b>${rubricMarks(q,i)} 分</b></li>`).join('')}</ol></div><div class="feedback-block enhanced"><h3>精进表达 <small>蓝色为衔接句</small></h3><p>${enhancedMarkup(q.answer)}</p></div></div>`;
  const scoredPoints=pending?`<div class="self-check"><strong>逐点自检</strong><p>对照照片，勾选你确实写出的要点；没有写到的留空。</p>${q.points.map(([label],i)=>`<label><input type="checkbox" data-self-point="${i}"><span>${escapeHtml(label)}</span><b>${rubricMarks(q,i)} 分</b></label>`).join('')}<button type="button" class="primary" id="saveSelfScore">保存自评分</button></div>`:choice?'':`<div class="points">${r.details.map((x,i)=>`<div class="point ${x.status==='full'?'hit':x.status==='partial'?'partial':'miss'}"><span>${x.status==='full'?'✓':x.status==='partial'?'△':'＋'}</span>${escapeHtml(x.label)} <b>${x.earned??(x.hit?rubricMarks(q,i):0)}/${rubricMarks(q,i)} 分</b></div>`).join('')}</div>`;
  $('#feedback').innerHTML=`<div class="feedback"><div class="feedback-head"><div><span>${pending?'手写作答 · 待自评':choice?'单选题结果':r.gradingMode==='self-reviewed'?'手写自评分':'严格文字估分'}</span><strong>${pending?'—':awarded(r,q)}<small> / ${marksFor(q)} 分</small></strong><em>${pending?'照片已存入本机':choice?'客观题判分':r.gradingMode==='self-reviewed'?'本人逐点自评':'仅供练习参考'}</em></div><p>${summary}</p></div>${photoMarkup(r)}${scoredPoints}${teacherNotes}<div class="feedback-block"><h3>${choice?'题目解析':pending?'如何核对':'修改意见'}</h3><p>${advice}</p></div>${answerPanel}<div class="memory"><strong>记忆钩子</strong><p>${escapeHtml(q.tip)}</p></div><div class="after-answer"><button class="quiet" id="retryBtn">遮住答案，再答一次</button>${studyNav()}</div></div>`;
  loadPhotos($('#feedback'));
  if(pending)$('#saveSelfScore').onclick=()=>{const selected=new Set([...$('#feedback').querySelectorAll('[data-self-point]:checked')].map(input=>Number(input.dataset.selfPoint)));r.details=q.points.map(([label],i)=>({label,marks:rubricMarks(q,i),hit:selected.has(i)}));r.earned=r.details.reduce((n,x)=>n+(x.hit?x.marks:0),0);r.score=Math.round(r.earned/marksFor(q)*100);r.gradingMode='self-reviewed';saveRecords();showFeedback(q,r);renderToday();renderExam();renderHistory();renderBank()};
  $('#retryBtn').onclick=()=>{$('#feedback').innerHTML='';if(choice){document.querySelectorAll('input[name="choice"]').forEach(x=>x.checked=false);drafts.delete(q.id)}else{$('#answerInput').value='';$('#answerInput').dispatchEvent(new Event('input'));$('#answerInput').focus()}};
  bindStudyNav();
}
function renderHistory(){
  const term=$('#historySearch').value.trim().toLowerCase();
  const sorted=records.filter(r=>{const q=questionById(r.qid);return q&&[r.day,r.answer,r.reference,q.title,q.type].join(' ').toLowerCase().includes(term)}).reverse();
  const graded=records.filter(r=>Number.isFinite(r.score));
  const avg=graded.length?Math.round(graded.reduce((n,r)=>n+r.score,0)/graded.length):null,days=new Set(records.map(r=>r.day)).size;
  $('#historyStats').innerHTML=`<div><span>累计作答</span><strong>${records.length}</strong></div><div><span>练习天数</span><strong>${days}</strong></div><div><span>平均得分</span><strong>${avg===null?'—':avg+'%'}</strong></div>`;
  if(!sorted.length){$('#historyList').innerHTML='<div class="empty">没有找到作答记录。</div>';return}
  const chart=sorted.filter(r=>Number.isFinite(r.score)).slice(0,20).reverse();
  $('#historyList').innerHTML=`${chart.length?`<div class="chart-card"><h3>最近 ${chart.length} 次得分（百分比）</h3><div class="chart">${chart.map(r=>`<div class="chart-col" title="${escapeHtml(formatTime(r.at))} · ${r.score}%"><span>${r.score}</span><i style="height:${Math.max(5,r.score)}%" class="${r.score<70?'low':''}"></i></div>`).join('')}</div></div>`:''}<div class="history-items">${sorted.map(r=>{const q=questionById(r.qid);return `<details class="history-item"><summary><div><span>${escapeHtml(formatTime(r.at))} · ${escapeHtml(q.type)}${r.session==='exam'?' · 150分模拟':''}</span><strong>${escapeHtml(q.title)}</strong></div><b>${r.score===null?'待自评':`${awarded(r,q)} / ${marksFor(q)} 分`}</b></summary><div class="history-detail"><div><h4>你的回答</h4><p>${escapeHtml(r.answer)}</p>${photoMarkup(r)}</div><div><h4>完整参考答案</h4><p>${escapeHtml(q.answer)}</p></div><div><h4>${q.type==='选择题'?'解析':'得分点'}</h4>${q.type==='选择题'?`<p>${escapeHtml(q.explanation)}</p>`:`<div class="points">${q.points.map(([label],i)=>`<span class="point ${r.details?.[i]?.hit?'hit':'miss'}">${r.details?.[i]?.hit?'✓':'＋'} ${escapeHtml(label)} · ${r.details?.[i]?.earned??(r.details?.[i]?.hit?rubricMarks(q,i):0)}/${rubricMarks(q,i)} 分</span>`).join('')}</div>`}</div><button class="quiet" data-review="${q.id}" data-record="${records.indexOf(r)}">查看详细批改</button><small>资料依据：${sourceMarkup(q)}</small></div></details>`}).join('')}</div>`;
  $('#historyList').querySelectorAll('.history-item').forEach(item=>item.addEventListener('toggle',()=>{if(item.open)loadPhotos(item)}));
  $('#historyList').querySelectorAll('[data-review]').forEach(button=>button.onclick=()=>{const q=questionById(Number(button.dataset.review)),r=records[Number(button.dataset.record)];openQuestion(q.id);showFeedback(q,r)});
}
function renderSources(){const names=[...new Set(BANK.flatMap(q=>q.source.split('；')))];$('#sourceList').innerHTML=names.map(n=>`<div class="source-row"><span>文档</span><strong>${escapeHtml(n)}</strong></div>`).join('')}
function showView(view){for(const v of ['today','exam','bank','history','sources'])$(`#${v}View`).hidden=v!==view;document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view));$('#pageTitle').textContent={today:'今日练习',exam:'150分模拟',bank:'完整题库',history:'历史记录',sources:'资料说明'}[view];if(view==='exam')renderExam();if(view==='bank')renderBank();if(view==='history')renderHistory();if(view==='sources')renderSources();window.scrollTo?.(0,0)}
document.querySelectorAll('.nav').forEach(n=>n.onclick=()=>showView(n.dataset.view));
$('#bankSearch').oninput=renderBank;$('#historySearch').oninput=renderHistory;
$('#exportBtn').onclick=async()=>{try{const photos=await PhotoStore.exportPhotos(records.flatMap(photoIdsOf));const blob=new Blob([JSON.stringify({exportedAt:new Date().toISOString(),records,photos})],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`337-练习与手写照片-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}catch(error){alert(`导出失败：${error.message}`)}};
$('#importBtn').onclick=()=>$('#importFile').click();
$('#importFile').onchange=async event=>{const file=event.target.files?.[0];if(!file)return;try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.records))throw Error('格式不正确');const incoming=parsed.records.filter(r=>Number.isInteger(r.qid)&&questionById(r.qid)&&typeof r.answer==='string'&&typeof r.at==='string'&&typeof r.day==='string'&&(Number.isFinite(r.score)||r.score===null)&&Array.isArray(r.details));if(!incoming.length)throw Error('没有可导入的作答记录');await PhotoStore.importPhotos(parsed.photos??[]);const known=new Set(records.map(r=>`${r.qid}|${r.at}|${r.answer}`));let added=0;for(const r of incoming){const key=`${r.qid}|${r.at}|${r.answer}`;if(!known.has(key)){records.push(r);known.add(key);added++}}records.sort((a,b)=>a.at.localeCompare(b.at));regradeLegacyRecords();saveRecords();renderToday();renderExam();renderHistory();renderBank();alert(`导入完成，新增 ${added} 条作答记录。`)}catch(error){alert(`导入失败：${error.message}`)}event.target.value=''};
$('#clearBtn').onclick=async()=>{if(confirm('确定清空当前浏览器中的全部练习记录及手写照片？建议先导出备份。')){try{await PhotoStore.clear();records=[];saveRecords();renderHistory();renderToday();renderExam();renderBank()}catch(error){alert(`清空失败：${error.message}`)}}};
$('#todayDate').textContent=new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'});
regradeLegacyRecords();
renderToday();
renderExam();
let displayedDay=todayKey();
function refreshDay(){const day=todayKey();if(day===displayedDay||$('#answerDialog').open)return;displayedDay=day;todayStatus='未答';$('#todayDate').textContent=new Date().toLocaleDateString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',weekday:'long'});renderToday();renderExam();if(!$('#historyView').hidden)renderHistory()}
setInterval(refreshDay,60000);
document.addEventListener('visibilitychange',refreshDay);
$('#answerDialog').addEventListener('close',refreshDay);
