# TypeClaw 前后端协议草案（v0.1）

本文定义：前端（claw_web）如何与执行引擎/后端（基于 hermes-agent）通信，以支持任务/会话/技能执行，以及“工具执行过程可视化（Run Card）”的实时流式更新与审批。

## 1. 设计目标

- 可解释：UI 能逐步展示执行步骤、输入输出、日志与产物
- 可控：支持暂停/取消/重试/审批
- 可中断：任何执行都可以取消且不会污染状态机
- 可复现：每次执行都有 Context Snapshot 与事件流
- 可扩展：技能与专家均为可插拔实体

## 2. 架构选型（两种方案对比）

### 方案 A：HTTP + SSE（推荐 v0.1）
- HTTP 用于 CRUD；SSE 用于会话与 Run 的流式事件
- 优点：实现简单、调试友好、浏览器天然支持
- 缺点：客户端到服务端的实时双向能力弱（但审批/取消可走 HTTP）

### 方案 B：WebSocket 双向通道（推荐 v0.2+）
- 单连接承载所有事件流 + 控制命令
- 优点：实时双向更自然，适合长任务、多并发
- 缺点：需要更完整的连接管理与重连语义

本文以 **方案 A（HTTP + SSE）** 为主，关键消息格式对方案 B 同样适用。

## 3. 通用约定

### 3.1 标识与时间
- 所有 id 使用 string（UUID 或可读短 id）
- 时间戳统一用 Unix ms（number）

### 3.2 错误格式

```json
{
  "error": {
    "code": "SKILL_TIMEOUT",
    "message": "Tool execution timed out",
    "details": { "retryable": true }
  }
}
```

### 3.3 脱敏与引用
- Message.meta、RunStep.input/output 可能包含敏感信息
- 允许用引用式字段：
  - `{"$ref":"artifact://<id>"}` 或 `{"$ref":"secret://<id>"}`（前端不可直接读取 secret）

## 4. API（HTTP）

Base: `/api/v1`

### 4.1 Tasks

- `GET /tasks?workspaceId=...`
- `POST /tasks`
- `GET /tasks/:taskId`
- `PATCH /tasks/:taskId`
- `POST /tasks/:taskId/mode`（plan/chat 切换）
- `POST /tasks/:taskId/plan/commit`（将 planDoc 生成执行）

Task 示例（简化）：

```json
{
  "id": "t_123",
  "title": "整理会议纪要并生成行动项",
  "status": "active",
  "mode": "chat",
  "selectedSkillIds": ["skill.transcribe", "skill.summarize"],
  "selectedExpertIds": ["expert.pm"]
}
```

### 4.2 Sessions / Messages

- `GET /tasks/:taskId/sessions`
- `POST /tasks/:taskId/sessions`
- `GET /sessions/:sessionId/messages?cursor=...`
- `POST /sessions/:sessionId/messages`（用户发言）

请求（发送消息）：

```json
{
  "role": "user",
  "type": "text",
  "content": "帮我把附件里的内容总结成 5 条行动项",
  "meta": {
    "attachments": ["artifact://a_1"]
  }
}
```

### 4.3 Skills

- `GET /skills`
- `GET /skills/:skillId`
- `POST /skills/import`（从目录/仓库导入，v0.1 可选）
- `PATCH /skills/:skillId`（enabled/config）

### 4.4 Experts

- `GET /experts`
- `GET /experts/:expertId`
- `POST /experts` / `PATCH /experts/:expertId`（可选，v0.1 允许本地编辑）

### 4.5 Runs（工具执行）

Run 是可审计执行单元，UI 通过 Run Card 展示。

- `POST /runs` 创建并启动执行
- `GET /runs/:runId`
- `POST /runs/:runId/cancel`
- `POST /runs/:runId/retry`

创建 Run 请求：

```json
{
  "taskId": "t_123",
  "sessionId": "s_123",
  "mode": "chat_tool",
  "skillId": "skill.search",
  "input": { "query": "..." },
  "context": {
    "expertIds": ["expert.pm"],
    "allowedSkillIds": ["skill.search", "skill.summarize"]
  }
}
```

返回：

```json
{
  "runId": "r_123",
  "status": "queued"
}
```

### 4.6 Approvals（审批）

- `POST /approvals`（请求审批）
- `POST /approvals/:approvalId/decision`（approve/deny）

请求审批：

```json
{
  "runId": "r_123",
  "scope": "fs_write",
  "reason": "需要把总结写入本地文件 notes.md",
  "proposal": { "path": "notes.md", "preview": "..." }
}
```

审批决策：

```json
{
  "decision": "approved"
}
```

## 5. 流式协议（SSE）

### 5.1 连接

- `GET /api/v1/stream?workspaceId=...`
  - 返回 `text/event-stream`
  - 事件以 `event:` 标识类型，`data:` 为 JSON
  - 支持 `Last-Event-ID` 进行断线续传

### 5.2 Event Envelope（统一包裹）

```json
{
  "id": "evt_000001",
  "ts": 1710000000000,
  "type": "run.step.updated",
  "payload": {}
}
```

### 5.3 事件类型（最小集合）

#### 会话类
- `session.message.created`
  - 新消息（assistant/user/system/tool）
- `session.summary.updated`

#### Run 类（核心）
- `run.created`
- `run.updated`（status 变化）
- `run.step.created`
- `run.step.updated`（status、log、output 增量）
- `run.log.appended`
- `run.artifact.created`
- `run.finished`

#### 审批类
- `approval.requested`
- `approval.decided`

#### 任务类
- `task.updated`
- `task.mode.changed`
- `plan.updated`

### 5.4 Run Card 渲染映射（前端规则）

前端渲染建议：
- 收到 `run.created`：在消息流插入一条 `type=run_card` 的 tool 消息（或本地虚拟节点）
- 收到 `run.step.*`：更新 run_card 内部步骤列表
- 收到 `run.log.appended`：写入步骤的日志面板（默认折叠）
- 收到 `approval.requested`：在 run_card 上显示审批 UI，阻塞该 step 继续执行
- 收到 `run.artifact.created`：展示产物区（文件/链接/结构化结果）

## 6. 执行与审批的控制语义

### 6.1 Cancel（取消）
- UI 触发：`POST /runs/:runId/cancel`
- 后端保证：
  - 进入 `cancelled` 状态
  - 后续不再写入步骤输出（允许写入“已取消”日志）
  - 若技能支持中断，传递取消信号；不支持则标记并尽快终止

### 6.2 Retry（重试）
- UI 触发：`POST /runs/:runId/retry`
- 语义：
  - 新 runId 或复用同 runId + attempt（推荐新 runId，旧 run 不可变）
  - 事件流标记来源 runId，UI 显示“重试 #n”

### 6.3 Approval Gate（审批门）
- 后端在敏感步骤前发出 `approval.requested`
- 步骤状态进入 `blocked`（可作为 `run.step.updated` 的 status 扩展）
- 用户 approve/deny 后继续或失败

## 7. 与“记忆系统 / 学习闭环”的协议挂钩（v0.2+）

为符合“每次交互沉淀资产”的目标，建议后端在任务完成后触发：
- `memory.extraction.started`
- `memory.item.created` / `memory.item.updated`
- `template.created`（技能链/专家组合/流程模板）

并提供：
- `GET /memory?query=...`
- `POST /memory` / `PATCH /memory/:id`

## 8. 协议扩展点（为多模型/多入口预留）

- `meta.model`: 本次响应使用的模型信息（provider/model/price）
- `meta.entry`: 来自哪个入口（web/cli/gateway）
- `context.snapshotRef`: 本次执行上下文快照引用

