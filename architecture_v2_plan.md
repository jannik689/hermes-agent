# Agent Architecture Evolution Plan (v2.0)

## 1. Background & PM Rules
- **Core Principle**: Agent is a persistent, evolving system (not just chat).
- **Goal**: Support parallel execution, interruptibility, and sub-agent delegation.
- **Current Constraint**: The current `AIAgent.run_conversation` is a massive, synchronous, blocking `while` loop that violates Single Responsibility Principle (SRP) and makes true multi-agent/async execution difficult.

## 2. The Tech Debt (Current Architecture)
- **God Class (`AIAgent`)**: Handles network retries, model routing, prompt assembly, tool orchestration, and token estimation all in one place.
- **Synchronous Blocking Loop**: Forces a strict `User -> Assistant -> Tool -> Result` linear pipeline. Cannot easily handle long-running background tasks with proactive notifications without blocking threads.
- **Implicit State Coupling**: Mutates instance variables (e.g., `_invalid_tool_retries`) and triggers side-effects (DB flushing) implicitly during the loop.

## 3. The Target Architecture (Event-Driven / State Machine)
To realize the PM vision (Multi-Agent, Proactive, Interruptible), we must transition from a linear pipeline to an event-driven state machine.

### Phase 1: Decoupling the God Class (Isolation)
Extract pure, stateless components from `AIAgent`:
- **`LLMProvider`**: Pure interface for API communication and failover.
- **`ToolExecutor`**: Pure sandbox for executing tool calls and returning results.
- **`ContextManager`**: Pure logic for prompt assembly, preflight compression, and prompt caching protection.

### Phase 2: State Machine Implementation
Replace the `while` loop with an explicit State Machine (`AgentState`):
- **States**: `WaitingForInput`, `Thinking`, `ToolExecuting`, `AwaitingApproval`, `Reflecting`.
- **Event Loop**: Input -> Generate Event -> Transition State -> Execute Side Effect (e.g., call LLM, run tool) -> Generate New Event.

### Phase 3: Advanced UX Features
Build on top of the async state machine:
- **Interruptibility**: Allow incoming user events to transition the state out of `ToolExecuting` or `Thinking`.
- **Parallel Sub-Agents**: `ToolExecutor` can dispatch multiple sub-agents asynchronously and await a `SubAgentsComplete` event.
- **Proactive Notifications**: Background tasks can emit `Notification` events independently of the main chat loop.

## 4. Reusable Assets (Do Not Rewrite)
- **`SessionDB` (SQLite WAL + FTS5)**: Perfect foundation for structured, searchable long-term memory.
- **Gateway Session Routing (`gateway/session.py`)**: The dual-key mapping (`session_key` -> `session_id`) and reset policies are robust and platform-agnostic.
- **Prompt Caching Logic**: The strict protection of the System Prompt to maximize Anthropic caching hits must be preserved in the new `ContextManager`.

## 5. Migration Strategy
1. **v1.x (Current)**: Build frontend features reusing the existing synchronous `AIAgent` and `SessionDB` APIs without modifying core backend logic.
2. **v2.0 (This Plan)**: Implement the Event-Driven Architecture side-by-side with the old `AIAgent` (as a compatibility layer), then migrate endpoints one by one.