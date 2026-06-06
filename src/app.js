import { scenarios } from "./data.js";
import { buildSessionInsights, summarize } from "./coach.js";
import { buildGrowthCalendar } from "./progress.js";
import { createAudioCapture, recognitionTranscript, translateCoachText } from "./voice.js";
import { createSpeechAssessmentClient } from "./speech-assessment.js";
import { createAiCoachClient } from "./ai-coach.js";

const state = { view: "home", scenario: null, sessionId: 0, messages: [], answerQueue: [], processingAnswer: false, elapsed: 0, timer: null, listening: false, recognition: null, speechStartedAt: null, liveVoice: false, interim: "", coachSpeaking: false, coachPaused: false, audioCapture: null, sessionAudioUrl: null, aiBusy: false, aiMode: "checking", assessmentClient: createSpeechAssessmentClient(window.FLUENTLOOP_SPEECH_SERVICE || {}), aiCoach: createAiCoachClient() };
const app = document.querySelector("#app");
const safe = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);
const header = () => {
  const history = JSON.parse(localStorage.getItem("fluentloop-history") || "[]");
  const streak = buildGrowthCalendar(history).streak;
  return `<header><button class="brand" data-home><b>F</b> FluentLoop</button><nav>练习场景　 学习方法　 成长记录</nav><span class="streak">● <b>${streak}</b> 天连续练习</span></header>`;
};

function home() {
  const history = JSON.parse(localStorage.getItem("fluentloop-history") || "[]");
  app.innerHTML = `${header()}<main>
    <section class="hero"><div class="hero-copy"><label>● AI-POWERED SPEAKING STUDIO</label><h1>把每一次开口，<em>变成真实进步。</em></h1><p>沉浸式场景对话、即时智能纠错和可量化成长报告，让英语口语练习更自然、更有效。</p><button class="primary" data-start>开始练习 →</button></div>
    <div class="visual"><div class="orb"></div><article class="coach-card"><div class="coach-title"><i>FL</i><span><b>Fluent Coach</b><small>● Ready to practice</small></span></div><h2>“Tell me about a challenge you solved at work.”</h2><div class="wave">${"<i></i>".repeat(24)}</div><footer><span><b>86</b> Fluency</span><span><b>92</b> Grammar</span><span><b>84</b> Pronunciation</span></footer></article></div></section>
    <section class="scenes" id="scenes"><div class="section-title"><span><label>CHOOSE A SCENE</label><h2>今天想练什么？</h2></span><p>每个场景都由 AI 扮演真实角色，并根据你的水平动态追问。</p></div><div class="scene-grid">${scenarios.map(card).join("")}</div></section>
    <section class="loop"><div><label>LEARNING LOOP</label><h2>不只告诉你哪里错，<br>更告诉你如何变好。</h2></div><div class="steps"><article><b>01</b><h3>自然对话</h3><p>AI 根据上下文追问，避免背答案式练习。</p></article><article><b>02</b><h3>适时反馈</h3><p>不中断表达，回答结束后再给精准建议。</p></article><article><b>03</b><h3>量化成长</h3><p>持续追踪流利度、语法、词汇和发音。</p></article></div></section>
    ${growthCalendar(history)}
    ${history.length ? `<section class="history"><label>YOUR PROGRESS</label><h2>持续练习，变化看得见</h2><article><span><small>最近一次</small><b>${history[0].scenario}</b></span><strong>${history[0].overall}<small>综合得分</small></strong><span><b>↗ 保持练习</b><small>下一次会更自然</small></span></article></section>` : ""}
    </main>${pageFooter()}`;
  document.querySelector("[data-start]").onclick = () => document.querySelector("#scenes").scrollIntoView({behavior:"smooth"});
  document.querySelectorAll("[data-scene]").forEach(el => el.onclick = () => start(el.dataset.scene));
  bindHome();
}

function growthCalendar(history) {
  const calendar = buildGrowthCalendar(history);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `<section class="growth-calendar">
    <div class="calendar-heading"><div><label>DAILY GROWTH</label><h2>练习日历</h2><p>完成一次口语练习，即可点亮当天成长记录。</p></div>
    <div class="calendar-stats"><span><b>${calendar.streak}</b>连续天数</span><span><b>${calendar.activeDays}</b>本月签到</span><span><b>${calendar.totalWords}</b>累计单词</span></div></div>
    <article class="calendar-card"><header><b>${calendar.label}</b><small>${calendar.activeDays ? "坚持正在发生，继续保持。" : "完成今天的第一场练习吧。"}</small></header>
    <div class="weekdays">${weekdays.map(day => `<span>${day}</span>`).join("")}</div>
    <div class="calendar-grid">${calendar.cells.map(cell => cell ? `<div class="calendar-day ${cell.activity ? "checked" : ""} ${cell.isToday ? "today" : ""}" title="${cell.activity ? `${cell.activity.sessions} 次练习 · 最高 ${cell.activity.bestScore} 分` : "尚未练习"}"><span>${cell.day}</span>${cell.activity ? `<i>✓</i><small>${cell.activity.bestScore}</small>` : ""}</div>` : "<div></div>").join("")}</div></article>
  </section>`;
}

const card = s => `<article class="scene" data-scene="${s.id}" style="--accent:${s.color}"><div><i>${s.icon}</i><small>${s.level}</small></div><h3>${s.title}</h3><label>${s.en}</label><p>${s.description}</p><footer><span>◷ ${s.time}</span><b>开始 →</b></footer></article>`;

function practice() {
  const s = state.scenario, last = [...state.messages].reverse().find(m => m.role === "user");
  app.innerHTML = `${header()}<main class="practice"><aside><button class="back" data-home>← 返回场景</button><div class="current" style="--accent:${s.color}"><i>${s.icon}</i><span><small>当前场景</small><b>${s.title}</b><label>${s.en}</label></span></div><div class="goal"><small>本次目标</small><p>${s.goal}</p></div><div class="live"><small>实时表现</small>${mini("流利度",last?.analysis.scores.fluency)}${mini("语法",last?.analysis.scores.grammar)}${mini("词汇",last?.analysis.scores.vocabulary)}${mini("语音清晰度",last?.analysis.scores.pronunciation)}</div><button class="finish" data-finish>结束练习并查看报告</button></aside>
  <section class="conversation"><div class="conv-head"><span>● <b>实时语音训练</b><small>${state.liveVoice ? "持续转写已开启，Coach 发言结束后自动恢复监听" : "开启持续转写后，无需反复点击麦克风"}</small></span><div class="voice-status"><em class="ai-mode ${state.aiMode}">${state.aiMode === "ai" ? "AI CONTEXT COACH" : state.aiMode === "offline" ? "OFFLINE FALLBACK" : "AI CHECKING"}</em><button data-voice-toggle>${state.liveVoice ? "■ 关闭持续转写" : "● 开启持续转写"}</button><b id="timer">${format(state.elapsed)}</b></div></div><div class="messages">${state.messages.map(message).join("")}${state.aiBusy ? `<div class="listening ai-thinking"><b>AI Coach 正在理解上下文</b><span>正在生成角色回应与语境化纠错...</span></div>` : ""}${state.listening ? `<div class="listening"><b>● 正在持续聆听</b><span>${state.interim || "请开始说英语，完整句子将自动发送…"}</span></div>` : ""}</div><div class="composer"><small>💡 试着说：${s.prompts[state.messages.filter(m=>m.role==="user").length%s.prompts.length]}</small><div><button data-demo>填入演示回答</button><input placeholder="也可以输入英文回答…" ${state.aiBusy ? "disabled" : ""}><button data-send ${state.aiBusy ? "disabled" : ""}>↑</button><button class="mic ${state.listening?"active":""}" data-mic>${state.listening?"■ 暂停录入":"● 单次录入"}</button></div></div></section></main>`;
  bindHome(); document.querySelector("[data-finish]").onclick=finish;
  document.querySelector("[data-demo]").onclick=()=>document.querySelector("input").value=s.demo;
  document.querySelector("[data-send]").onclick=send; document.querySelector("input").onkeydown=e=>e.key==="Enter"&&send();
  document.querySelector("[data-mic]").onclick=mic; document.querySelectorAll("[data-speak]").forEach(b=>b.onclick=()=>speak(decodeURIComponent(b.dataset.speak)));
  document.querySelector("[data-voice-toggle]").onclick=toggleLiveVoice;
  document.querySelectorAll("[data-speech-pause]").forEach(b=>b.onclick=pauseCoach);
  document.querySelectorAll("[data-speech-resume]").forEach(b=>b.onclick=resumeCoach);
  document.querySelectorAll("[data-speech-stop]").forEach(b=>b.onclick=stopCoach);
  requestAnimationFrame(()=>{ const el=document.querySelector(".messages"); el.scrollTop=el.scrollHeight; });
}
const mini=(name,value=0)=>`<div><span>${name}</span><i><b style="width:${value}%"></b></i><strong>${value||"—"}</strong></div>`;
const message=m=>m.role==="coach"?`<article class="msg coach"><i>FL</i><div><small>FLUENT COACH</small><p>${safe(m.text)}</p><p class="translation">${safe(m.translation || translateCoachText(m.text,state.scenario?.id))}</p><div class="speech-controls"><button data-speak="${encodeURIComponent(m.text)}">▶ 播放</button><button data-speech-pause>Ⅱ 暂停</button><button data-speech-resume>▷ 继续</button><button data-speech-stop>■ 停止</button></div></div></article>`:
`<article class="msg user"><div><small>YOU ${m.analysis.assessmentMode === "ai" ? "· AI REVIEWED" : "· OFFLINE REVIEW"}</small><p>${safe(m.text)}</p><section class="feedback"><strong>${m.analysis.scores.overall}</strong><span><b>${safe(m.analysis.encouragement || (m.analysis.corrections.length?"表达清晰，留意下面的小调整。":"表达自然且清晰，句型使用得很好。"))}</b><small>${m.analysis.wpm} WPM · ${m.analysis.words} words · ${safe(m.analysis.scoringEvidence?.confidence || "low")} confidence</small></span><div class="score-reasons">${(m.analysis.scoringEvidence?.reasons || []).map(reason=>`<small>${safe(reason)}</small>`).join("")}</div>${m.analysis.speechEvidence ? `<div class="evidence"><b>${m.analysis.speechEvidence.level==="phoneme"?"音素级评测":"浏览器清晰度代理"} · ${m.analysis.scores.pronunciation}</b><small>${safe(m.analysis.speechEvidence.disclaimer)}</small></div>` : `<div class="evidence muted"><b>未进行语音评测</b><small>文字输入不会生成发音或语音清晰度分数。</small></div>`}${m.analysis.corrections.map(c=>`<article><label>表达建议</label><del>${safe(c.original)}</del><b>→ ${safe(c.improved)}</b><small>${safe(c.reason)}</small></article>`).join("")||"<em>✓ 本轮没有发现明显语法问题</em>"}</section></div><i>YOU</i></article>`;

function report() {
  const r=summarize(state.messages), s=state.scenario;
  const history=JSON.parse(localStorage.getItem("fluentloop-history")||"[]"),insights=buildSessionInsights(state.messages,s,history.slice(1));
  app.innerHTML=`${header()}<main class="report"><section class="report-top"><div><label>● SESSION COMPLETE</label><h1>很棒，你完成了<br><em>${s.title}</em>练习。</h1><p>${safe(insights.trend)}</p></div><div class="ring" style="--score:${r.overall}"><span><b>${r.overall||"--"}</b><small>综合得分</small></span></div></section><section class="metrics">${metric("流利度",r.fluency)}${metric("语法准确度",r.grammar)}${metric("词汇丰富度",r.vocabulary)}${metric("语音清晰度",r.pronunciation)}</section>${state.sessionAudioUrl ? `<section class="audio-review"><label>SESSION AUDIO</label><h2>回听本次口语录音</h2><audio controls src="${state.sessionAudioUrl}"></audio><p>录音仅保存在当前浏览器内存中，刷新页面后自动清除。</p></section>` : ""}<section class="details"><article><label>PERSONAL INSIGHTS</label><h2>本次练习洞察</h2><div class="stats"><span><b>${r.turns}</b>轮对话</span><span><b>${r.words}</b>个单词</span><span><b>${r.wpm}</b>WPM</span><span><b>${r.corrections}</b>个建议</span></div><p class="note"><b>优势</b>${safe(insights.strength)}</p><p class="note"><b>重点</b>${safe(insights.focus)}</p><p class="note"><b>复练</b>${safe(insights.correction)}</p></article><aside><label>NEXT STEP</label><h2>把建议变成能力</h2><p>${safe(insights.nextTask)}</p><button data-retry>再练一次 →</button><button data-home>选择其他场景</button></aside></section></main>${pageFooter()}`;
  document.querySelector("[data-retry]").onclick=()=>start(s.id); bindHome();
}
const metric=(name,score)=>`<article><span><small>${name}</small><b>${Number.isFinite(score)?score:"N/A"}</b></span><i><b style="width:${Number.isFinite(score)?score:0}%"></b></i><p>${Number.isFinite(score)?"保持练习，下一次表达会更自然。":"仅语音回答可获得此项评测。"}</p></article>`;

async function start(id){ state.sessionId++;state.answerQueue=[];state.scenario=scenarios.find(s=>s.id===id); state.messages=[{role:"coach",text:state.scenario.opening,translation:translateCoachText(state.scenario.opening,id)}]; state.view="practice"; state.liveVoice=true; state.interim=""; state.sessionAudioUrl=null; state.elapsed=0;clearInterval(state.timer);state.timer=setInterval(()=>{state.elapsed++;const t=document.querySelector("#timer");if(t)t.textContent=format(state.elapsed)},1000);try{state.audioCapture=await createAudioCapture()}catch{state.audioCapture=null;state.liveVoice=false}practice();setTimeout(()=>speak(state.scenario.opening),300)}
function handleAnswer(text,seconds,speechEvidence=null){return new Promise(resolve=>{state.answerQueue.push({text,seconds,speechEvidence,sessionId:state.sessionId,resolve});processAnswerQueue()})}
async function processAnswerQueue(){if(state.processingAnswer)return;const item=state.answerQueue.shift();if(!item)return;if(item.sessionId!==state.sessionId||state.view!=="practice"){item.resolve(false);return processAnswerQueue()}state.processingAnswer=true;state.aiBusy=true;practice();try{const result=await state.aiCoach.respond({scenario:state.scenario,messages:state.messages,text:item.text,seconds:item.seconds,speechEvidence:item.speechEvidence});if(item.sessionId!==state.sessionId||state.view!=="practice"){item.resolve(false);return}state.aiMode=result.mode;state.messages.push({role:"user",text:item.text,analysis:result.analysis},{role:"coach",...result.coach});item.resolve(true);practice();speak(result.coach.text)}finally{state.processingAnswer=false;state.aiBusy=false;if(state.view==="practice")practice();processAnswerQueue()}}
function send(){const input=document.querySelector("input"),text=input.value.trim();if(!text)return;handleAnswer(text,Math.max(7,text.split(/\s+/).length/1.8))}
function mic(){if(state.listening){state.liveVoice=false;state.recognition?.stop();return}startRecognition(false)}
function toggleLiveVoice(){state.liveVoice=!state.liveVoice;if(state.liveVoice)startRecognition(true);else{state.recognition?.stop();state.listening=false;state.interim="";practice()}}
function startRecognition(continuous=state.liveVoice){const SR=window.SpeechRecognition||window.webkitSpeechRecognition;if(!SR){state.liveVoice=false;alert("请使用 Chrome 或 Edge 体验持续语音转写，也可使用文字输入。");return}if(state.coachSpeaking)return;const rec=new SR();rec.lang="en-US";rec.interimResults=true;rec.continuous=continuous;state.recognition=rec;state.listening=true;state.speechStartedAt=null;practice();rec.onspeechstart=()=>{state.speechStartedAt=Date.now()};rec.onresult=e=>{const transcript=recognitionTranscript(Array.from(e.results).slice(e.resultIndex));state.interim=transcript.interimText;practice();if(transcript.finalText)addVoiceMessage(transcript.finalText,transcript.confidence,state.speechStartedAt?Math.max(1,(Date.now()-state.speechStartedAt)/1000):10)};rec.onerror=()=>{state.listening=false;state.interim="";practice()};rec.onend=()=>{state.listening=false;state.interim="";practice();if(state.liveVoice&&!state.coachSpeaking)setTimeout(()=>startRecognition(true),350)};rec.start()}
async function addVoiceMessage(text,confidence,seconds){const audioBlob=state.audioCapture?.utteranceBlob()||null;const evidence=await state.assessmentClient.assess(audioBlob,text,{confidence,...(state.audioCapture?.snapshot()||{})});state.interim="";state.speechStartedAt=null;await handleAnswer(text,seconds,evidence)}
function speak(text){if(!speechSynthesis)return;state.coachSpeaking=true;state.coachPaused=false;if(state.listening)state.recognition?.stop();speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=.94;u.onend=u.onerror=()=>{state.coachSpeaking=false;state.coachPaused=false;if(state.liveVoice)setTimeout(()=>startRecognition(true),250)};speechSynthesis.speak(u);practice()}
function pauseCoach(){if(!speechSynthesis?.speaking)return;speechSynthesis.pause();state.coachPaused=true;practice()}
function resumeCoach(){if(!speechSynthesis?.paused)return;speechSynthesis.resume();state.coachPaused=false;practice()}
function stopCoach(){speechSynthesis?.cancel();state.coachSpeaking=false;state.coachPaused=false;if(state.liveVoice)setTimeout(()=>startRecognition(true),250);practice()}
async function finish(){state.sessionId++;state.answerQueue.splice(0).forEach(item=>item.resolve(false));await stopVoiceSession(true);clearInterval(state.timer);const r=summarize(state.messages),h=JSON.parse(localStorage.getItem("fluentloop-history")||"[]");h.unshift({...r,scenario:state.scenario.title,date:new Date().toISOString()});localStorage.setItem("fluentloop-history",JSON.stringify(h.slice(0,180)));state.view="report";report()}
async function stopVoiceSession(keepRecording=false){state.liveVoice=false;state.listening=false;state.coachSpeaking=false;state.coachPaused=false;state.interim="";state.recognition?.stop();speechSynthesis?.cancel();if(state.audioCapture){const blob=await state.audioCapture.stop();if(keepRecording)state.sessionAudioUrl=URL.createObjectURL(blob);state.audioCapture=null}}
function bindHome(){document.querySelectorAll("[data-home]").forEach(el=>el.onclick=()=>{state.sessionId++;state.answerQueue.splice(0).forEach(item=>item.resolve(false));stopVoiceSession();clearInterval(state.timer);state.view="home";home()})}
const format=s=>`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
const pageFooter=()=>`<footer class="page-footer"><span class="brand"><b>F</b> FluentLoop</span><p>Practice boldly. Speak naturally.</p><small>Built for AI speaking practice · 2026</small></footer>`;
home();
