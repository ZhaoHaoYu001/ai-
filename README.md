# FluentLoop - AI 英语口语陪练

[![Quality checks](https://github.com/ZhaoHaoYu001/ai-/actions/workflows/check.yml/badge.svg)](https://github.com/ZhaoHaoYu001/ai-/actions/workflows/check.yml)

FluentLoop 是一款面向真实交流场景的英语口语练习工具。它通过场景化角色扮演、浏览器实时语音、回答后智能纠错和可量化课后报告，帮助用户从“知道怎么说”走向“能够自然说出来”。

> Demo 视频：待录制后将可访问链接更新在此处。

> AI 模式：配置服务端 Anthropic Messages API 兼容凭据或 `OPENAI_API_KEY` 后，Coach 会基于最近对话上下文生成角色追问、语境化纠错和表达反馈；未配置或请求失败时，界面会明确标记并降级为离线规则模式。

## 在线体验

这是一个零依赖 Web 应用，克隆后可直接运行：

```bash
npm start
```

启用真实 AI 对话与纠错：

```powershell
$env:ANTHROPIC_BASE_URL="https://your-compatible-endpoint/anthropic"
$env:ANTHROPIC_AUTH_TOKEN="your-token"
$env:ANTHROPIC_MODEL="mimo-v2.5"
npm.cmd start
```

也可使用 OpenAI Responses API：

```powershell
$env:OPENAI_API_KEY="your-api-key"
$env:OPENAI_MODEL="gpt-5.4-mini"
npm.cmd start
```

启用真实单词、音素、重音与韵律评测：

```powershell
$env:AZURE_SPEECH_KEY="your-speech-resource-key"
$env:AZURE_SPEECH_REGION="eastus"
npm.cmd start
```

同一组 Azure Speech 配置也会启用服务端语音转写兜底。当浏览器自带
`SpeechRecognition` 没有返回文字时，项目会在用户结束回答后上传本轮
16 kHz WAV 录音并自动完成转写。

详细接口、隐私与降级策略见 `docs/AI_COACH.md` 和 `docs/AZURE_PRONUNCIATION.md`。

打开 `http://localhost:4173`。推荐使用最新版 Chrome 或 Edge，以体验实时英语语音识别和语音合成。

## 核心功能

- **场景选择**：覆盖求职面试、餐厅点餐、工作会议、旅行问路，并为不同 CEFR 难度设置目标。
- **自然追问**：AI Coach 根据回答长度、礼貌表达和因果表达动态回应，而不是固定脚本播放。
- **语境化 AI 对话与纠错**：配置服务端模型后，Coach 会读取最近对话和场景目标，生成不重复的角色追问，并返回结构化语法、词汇与表达建议。
- **稳定半双工语音引擎**：AI 与练习者交替说话，避免扬声器回声污染录音；浏览器识别服务重连不会拆散回答，服务不可用时自动使用本轮 WAV 录音转写。
- **AI 语音电话模式**：进入场景后自动接通，AI 说完即自动聆听；本地 VAD 在确认用户开口后检测约 1.4 秒停顿并提交回答，AI 回复后继续下一轮。用户仍可手动结束本轮、文字降级或挂断生成报告。
- **录音中回答支架**：每个场景持续展示当前问题、正确句型开头、关键词和自然示例，避免练习者因没有参考而冷场，同时不覆盖或自动提交正在录制的回答。
- **非阻塞语音启动**：点击开始后立即进入文字转写，麦克风录音与发音评测链路并行初始化；权限弹窗或设备启动缓慢不会再阻塞回答录入。
- **流式 AI 与延迟观测**：AI 模式转发模型增量事件，并展示首字节、AI、发音评测和本轮总延迟。
- **适时纠错**：不在用户说话中途打断，回答结束后集中展示语法和表达建议。
- **专业发音评测**：配置 Azure Speech 后展示准确度、流利度、完整度、韵律、具体单词和 IPA 音素问题；未配置时明确降级为浏览器清晰度代理。
- **录音回放**：训练结束后可回听本次原始录音，复盘停顿、语速和表达清晰度。
- **课后总结**：展示综合得分、对话轮数、单词数、语速和纠错数量，并给出下一步建议。
- **个性化学习洞察**：识别本次优势、重点能力、高频错误、历史趋势和下一次复练目标。
- **成长记录**：在浏览器本地保存最近练习结果，形成持续学习反馈。
- **文字降级方案**：无法使用麦克风时仍能完整体验全部产品流程。

## 产品创新点

### 1. “不中断表达”的反馈时机

口语练习最重要的是保持表达意愿。FluentLoop 在用户说完后再给反馈，既避免实时纠错带来的挫败感，也让建议与刚完成的表达保持强关联。

### 2. 可解释的量化反馈

分数不是黑盒结果。系统同时展示真实回答时长、WPM、单词数、填充词、纠错数量、语音证据等级和评分可信度，让用户知道分数为何变化、下次应该怎么练。短回答会被标记为低可信度，也不会因人为最低分而获得虚高结果。

### 3. 零门槛演示

语音链路默认使用浏览器能力，避免因 API Key、网络额度或服务过期导致评委无法复现。架构保留了替换真实 LLM 和专业发音评测服务的扩展空间。

## 技术架构

```mermaid
flowchart LR
  A[场景选择] --> B[对话训练界面]
  B --> C[Web Speech API]
  B --> D[文字输入降级]
  C --> E[Coach 分析引擎]
  D --> E
  E --> F[自然追问]
  E --> G[语法与表达纠错]
  E --> H[四维能力评分]
  F --> B
  G --> I[课后总结]
  H --> I
  I --> J[LocalStorage 成长记录]
```

## 评分设计

| 指标 | 当前 MVP 计算依据 | 可扩展方向 |
| --- | --- | --- |
| 流利度 | 语速与填充词数量 | 停顿位置、连续发音时长 |
| 语法 | 规则命中数量 | LLM 语境化评估 |
| 词汇 | 去重词数与回答长度 | CEFR 词汇等级、搭配丰富度 |
| 语音清晰度 | 仅语音输入；识别置信度、音频信号质量和有效发声比例，并明确标记为代理指标 | 可替换专业服务返回音素、重音与语调 |

文字输入不会生成发音或语音清晰度分数。浏览器清晰度代理不代表音素、重音、语调或口音准确度。

## 项目结构

```text
.
├── index.html            # 应用入口
├── server.js             # 静态服务与受保护的 AI Coach 接口
├── ai-service.js         # Anthropic-compatible / OpenAI 服务端适配器
├── pronunciation-service.js # Azure Speech 发音评测适配器
├── src/
│   ├── app.js            # 页面状态与交互流程
│   ├── ai-coach.js       # 浏览器 AI 客户端与离线降级
│   ├── coach.js          # 对话、纠错与评分引擎
│   ├── data.js           # 场景和规则数据
│   ├── progress.js       # 成长日历聚合
│   ├── speech-assessment.js # 发音评测证据与适配器
│   ├── voice.js          # 实时转写、翻译与录音采集
│   └── styles.css        # 响应式视觉系统
├── test/                 # 单元与服务集成测试
└── docs/
    ├── ARCHITECTURE.md
    ├── DEMO_SCRIPT.md
    └── SUBMISSION_CHECKLIST.md
```

## 测试

```bash
npm run check
npm run test:e2e
```

`npm run test:e2e` 使用真实 Chromium 自动验证完整文字训练流程、麦克风权限拒绝降级和移动端核心布局。

手动验收建议：

1. 从首页进入任意场景。
2. 使用“填入纠错示例”快速触发对话和纠错；进入电话式语音通话后验证回答支架始终可见。
3. 使用 Chrome / Edge 麦克风完成一轮英语回答。
4. 验证 AI Coach 语音播放、实时评分、表达建议。
5. 结束练习，检查课后报告与首页成长记录。

## 评审快速复现

1. 运行 `npm start`，打开 `http://127.0.0.1:4173`。
2. 选择“求职面试”，点击“填入纠错示例”并发送，验证离线纠错和评分。
3. 在 Chrome / Edge 进入场景，等待 AI 开场后直接回答，验证停顿自动提交、连续追问、手动结束本轮和清晰度代理。
4. 可选配置 Anthropic-compatible 凭据或 `OPENAI_API_KEY`，验证上下文追问和语境化反馈。
5. 结束练习，验证录音回放、个性化课后洞察和成长日历。

完整提交检查表见 [`docs/SUBMISSION_CHECKLIST.md`](docs/SUBMISSION_CHECKLIST.md)。

## 持续交付记录

核心能力均通过单一职责 PR 交付，并在合并前通过 GitHub Actions：

- [PR #9](https://github.com/ZhaoHaoYu001/ai-/pull/9)：质量门禁与 PR 模板
- [PR #10](https://github.com/ZhaoHaoYu001/ai-/pull/10)：实时语音控制
- [PR #11](https://github.com/ZhaoHaoYu001/ai-/pull/11)：可信语音评测
- [PR #12](https://github.com/ZhaoHaoYu001/ai-/pull/12)：上下文 AI Coach
- [PR #13](https://github.com/ZhaoHaoYu001/ai-/pull/13)：服务端安全边界
- [PR #14](https://github.com/ZhaoHaoYu001/ai-/pull/14)：可解释评分
- [PR #15](https://github.com/ZhaoHaoYu001/ai-/pull/15)：个性化课后报告
- [PR #16](https://github.com/ZhaoHaoYu001/ai-/pull/16)：对话状态韧性
- [PR #18](https://github.com/ZhaoHaoYu001/ai-/pull/18)：Azure 单词与音素级发音评测
- [PR #19](https://github.com/ZhaoHaoYu001/ai-/pull/19)：流式 AI 与端到端延迟指标
- [PR #20](https://github.com/ZhaoHaoYu001/ai-/pull/20)：真实 Chromium E2E 质量门禁

## 第三方依赖与原创说明

- 产品运行时无第三方 JavaScript 库或框架；开发测试使用 `@playwright/test`。
- 使用浏览器标准能力：Web Speech API、Speech Synthesis API、LocalStorage。
- 使用 MediaRecorder 与 Web Audio API 采集真实音频信号并提供本地录音回放；默认不上传音频。
- 可选使用 Anthropic Messages API 兼容服务（已验证 `mimo-v2.5`）或 OpenAI Responses API 提供上下文角色对话与结构化语言反馈；API Key 仅保存在本地服务端环境变量中。
- 可选使用 Azure Speech Pronunciation Assessment 提供单词、音素、重音和韵律反馈；密钥仅保存在本地服务端环境变量中。
- 页面设计、场景数据、对话逻辑、评分逻辑、纠错规则、报告系统及全部代码均为本项目原创实现。
- 浏览器语音识别的可用性取决于浏览器和网络环境。

## 当前边界与后续规划

- 当前 AI Coach 已流式转发模型输出，语音输入采用稳定的显式半双工轮次控制；后续可升级为带服务端 VAD 的 WebRTC 全双工语音链路。
- Azure Speech 未配置时，发音结果会明确降级为浏览器清晰度代理。
- 增加可交互的错题复练与掌握状态跟踪。
- 增加教师端能力报告与分享链接。
