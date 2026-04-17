"""
Hermes Agent — Web UI server.

Provides a FastAPI backend serving the Vite/React frontend and REST API
endpoints for managing configuration, environment variables, and sessions.

Usage:
    python -m hermes_cli.main web          # Start on http://127.0.0.1:9119
    python -m hermes_cli.main web --port 8080
"""

import asyncio
import hmac
import json
import logging
import os
import secrets
import sys
import threading
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

import yaml

PROJECT_ROOT = Path(__file__).parent.parent.resolve()
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from hermes_cli import __version__, __release_date__
from hermes_cli.config import (
    DEFAULT_CONFIG,
    OPTIONAL_ENV_VARS,
    get_config_path,
    get_env_path,
    get_hermes_home,
    load_config,
    load_env,
    save_config,
    save_env_value,
    remove_env_value,
    check_config_version,
    redact_key,
)
from gateway.status import get_running_pid, read_runtime_status

try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, StreamingResponse
    from fastapi.staticfiles import StaticFiles
    from pydantic import BaseModel
except ImportError:
    raise SystemExit(
        "Web UI requires fastapi and uvicorn.\n"
        "Run 'hermes web' to auto-install, or: pip install hermes-agent[web]"
    )

WEB_DIST = Path(__file__).parent / "web_dist"
_log = logging.getLogger(__name__)

app = FastAPI(title="Hermes Agent", version=__version__)

# ---------------------------------------------------------------------------
# Session token for protecting sensitive endpoints (reveal).
# Generated fresh on every server start — dies when the process exits.
# Injected into the SPA HTML so only the legitimate web UI can use it.
# ---------------------------------------------------------------------------
_SESSION_TOKEN = secrets.token_urlsafe(32)

# Simple rate limiter for the reveal endpoint
_reveal_timestamps: List[float] = []
_REVEAL_MAX_PER_WINDOW = 5
_REVEAL_WINDOW_SECONDS = 30

# CORS: restrict to localhost origins only.  The web UI is intended to run
# locally; binding to 0.0.0.0 with allow_origins=["*"] would let any website
# read/modify config and secrets.

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Endpoints that do NOT require the session token.  Everything else under
# /api/ is gated by the auth middleware below.  Keep this list minimal —
# only truly non-sensitive, read-only endpoints belong here.
# ---------------------------------------------------------------------------
_PUBLIC_API_PATHS: frozenset = frozenset({
    "/api/status",
    "/api/session-token",
    "/api/config/defaults",
    "/api/config/schema",
    "/api/model/info",
})


def _require_token(request: Request) -> None:
    """Validate the ephemeral session token.  Raises 401 on mismatch.

    Uses ``hmac.compare_digest`` to prevent timing side-channels.
    """
    auth = request.headers.get("authorization", "")
    expected = f"Bearer {_SESSION_TOKEN}"
    if not hmac.compare_digest(auth.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Unauthorized")


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    """Require the session token on all /api/ routes except the public list."""
    path = request.url.path
    if (
        path.startswith("/api/")
        and path not in _PUBLIC_API_PATHS
        and not path.startswith("/api/v1/demo/")
    ):
        auth = request.headers.get("authorization", "")
        if not auth:
            token = request.query_params.get("token", "")
            if token:
                auth = f"Bearer {token}"
        
        expected = f"Bearer {_SESSION_TOKEN}"
        if not hmac.compare_digest(auth.encode(), expected.encode()):
            return JSONResponse(
                status_code=401,
                content={"detail": "Unauthorized"},
            )
    return await call_next(request)


class _DemoRunCreate(BaseModel):
    prompt: str
    sessionId: Optional[str] = None
    mode: Optional[str] = "plan"


class _DemoApprovalDecision(BaseModel):
    decision: str


_demo_runs: Dict[str, Dict[str, Any]] = {}


def _demo_emit(run_id: str, event: Dict[str, Any]) -> None:
    run = _demo_runs.get(run_id)
    if not run:
        return
    run["events"].append(event)
    run["queue"].put_nowait(event)


async def _demo_worker(run_id: str, prompt: str) -> None:
    run = _demo_runs.get(run_id)
    if not run:
        return

    def _evt(t: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        run["seq"] += 1
        return {"id": f"evt_{run['seq']:06d}", "ts": int(time.time() * 1000), "type": t, "payload": payload}

    _demo_emit(run_id, _evt("run.created", {"runId": run_id, "prompt": prompt}))
    _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "running"}))

    steps = [
        {"id": "s1", "name": "解析需求"},
        {"id": "s2", "name": "选择技能"},
        {"id": "s3", "name": "执行技能"},
        {"id": "s4", "name": "整理输出"},
    ]

    for step in steps:
        if run.get("cancelled"):
            _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "cancelled"}))
            _demo_emit(run_id, _evt("run.finished", {"runId": run_id, "status": "cancelled"}))
            run["done"] = True
            return

        _demo_emit(
            run_id,
            _evt(
                "run.step.created",
                {"runId": run_id, "step": {**step, "status": "queued"}},
            ),
        )
        await asyncio.sleep(0.25)

        if step["id"] == "s3":
            approval_id = f"ap_{secrets.token_hex(6)}"
            gate = asyncio.Event()
            run["approvals"][approval_id] = {"id": approval_id, "decision": None, "event": gate}

            _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "blocked"}))
            _demo_emit(
                run_id,
                _evt(
                    "run.step.updated",
                    {"runId": run_id, "step": {**step, "status": "blocked"}},
                ),
            )
            _demo_emit(
                run_id,
                _evt(
                    "approval.requested",
                    {
                        "runId": run_id,
                        "approvalId": approval_id,
                        "scope": "fs_write",
                        "reason": "需要写入本地文件（demo）",
                        "proposal": {"path": "notes.md", "preview": "写入 3 条行动项…"},
                    },
                ),
            )

            while True:
                if run.get("cancelled"):
                    _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "cancelled"}))
                    _demo_emit(run_id, _evt("run.finished", {"runId": run_id, "status": "cancelled"}))
                    run["done"] = True
                    return
                try:
                    await asyncio.wait_for(gate.wait(), timeout=1.0)
                    break
                except asyncio.TimeoutError:
                    continue

            decision = run["approvals"][approval_id]["decision"]
            _demo_emit(
                run_id,
                _evt(
                    "approval.decided",
                    {"runId": run_id, "approvalId": approval_id, "decision": decision},
                ),
            )
            if decision != "approved":
                _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "failed"}))
                _demo_emit(
                    run_id,
                    _evt(
                        "run.finished",
                        {
                            "runId": run_id,
                            "status": "failed",
                            "finalText": "审批被拒绝，执行已停止。",
                        },
                    ),
                )
                run["done"] = True
                return

            _demo_emit(run_id, _evt("run.updated", {"runId": run_id, "status": "running"}))

        _demo_emit(
            run_id,
            _evt(
                "run.step.updated",
                {"runId": run_id, "step": {**step, "status": "running"}},
            ),
        )

        _demo_emit(
            run_id,
            _evt(
                "run.log.appended",
                {"runId": run_id, "stepId": step["id"], "log": {"level": "info", "message": f"{step['name']}…"}},
            ),
        )

        await asyncio.sleep(0.55)

        _demo_emit(
            run_id,
            _evt(
                "run.step.updated",
                {
                    "runId": run_id,
                    "step": {
                        **step,
                        "status": "succeeded",
                        "output": {"preview": f"{step['name']}完成"},
                    },
                },
            ),
        )

    _demo_emit(
        run_id,
        _evt(
            "run.artifact.created",
            {
                "runId": run_id,
                "artifact": {
                    "id": f"af_{secrets.token_hex(6)}",
                    "type": "file",
                    "title": "notes.md",
                    "uri": "file://notes.md",
                },
            },
        ),
    )

    _demo_emit(
        run_id,
        _evt(
            "run.updated",
            {"runId": run_id, "status": "succeeded"},
        ),
    )

    _demo_emit(
        run_id,
        _evt(
            "run.finished",
            {
                "runId": run_id,
                "status": "succeeded",
                "finalText": f"已完成：{prompt}\n\n- 行动项 1\n- 行动项 2\n- 行动项 3",
            },
        ),
    )
    run["done"] = True


import threading
from concurrent.futures import ThreadPoolExecutor

_run_executor = ThreadPoolExecutor(max_workers=10)

def _real_worker_sync(run_id: str, prompt: str, loop: asyncio.AbstractEventLoop, session_id: str = None, mode: str = "plan") -> None:
    print(f"[{run_id}] _real_worker_sync started, prompt: {prompt[:50]}...", flush=True)
    
    import time
    import traceback
    run = _demo_runs.get(run_id)
    if not run:
        print(f"[{run_id}] Run dict not found!", flush=True)
        return

    def _evt(t: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        run["seq"] += 1
        return {"id": f"evt_{run['seq']:06d}", "ts": int(time.time() * 1000), "type": t, "payload": payload}

    def emit(event: Dict[str, Any]) -> None:
        print(f"[{run_id}] EMIT {event['type']}", flush=True)
        run["events"].append(event)
        loop.call_soon_threadsafe(run["queue"].put_nowait, event)

    try:
        emit(_evt("run.created", {"runId": run_id, "prompt": prompt}))
        emit(_evt("run.updated", {"runId": run_id, "status": "running"}))

        import secrets
        from run_agent import AIAgent
        from hermes_cli.config import load_config
        
        config = load_config()
        from hermes_cli.models import _PROVIDER_ALIASES
        model_cfg = config.get("model")

        req_provider = ""
        req_model = ""
        if isinstance(model_cfg, dict):
            req_provider = str(model_cfg.get("provider") or "").strip().lower()
            req_model = str(model_cfg.get("default") or "").strip()
        elif isinstance(model_cfg, str):
            req_model = model_cfg.strip()

        if not req_model:
            req_provider = "anthropic"
            req_model = "claude-3-haiku-20240307"

        if not req_provider:
            if "/" in req_model:
                req_provider = "openrouter"
            else:
                req_provider = "auto"

        req_provider = _PROVIDER_ALIASES.get(req_provider, req_provider)

        from hermes_cli.runtime_provider import resolve_runtime_provider
        print(f"[{run_id}] Resolving provider: {req_provider}", flush=True)
        runtime = resolve_runtime_provider(requested=req_provider)
        if not runtime:
            print(f"[{run_id}] Provider resolve failed for: {req_provider}", flush=True)
            emit(_evt("run.updated", {"runId": run_id, "status": "failed"}))
            emit(_evt("run.finished", {"runId": run_id, "status": "failed", "finalText": f"执行失败: 无法解析提供商配置 {req_provider}"}))
            run["done"] = True
            return
            
        provider = runtime.get("provider", "")
        api_mode = runtime.get("api_mode", "chat_completions")
        base_url = runtime.get("base_url", "")
        api_key = runtime.get("api_key", "")
        print(f"[{run_id}] Provider resolved: {provider}, model: {req_model}", flush=True)
        
        # We will build callbacks to hook into AIAgent
        def on_tool_start(tool_id: str, name: str, args: dict):
            print(f"[{run_id}] TOOL START: {name}", flush=True)
            step_id = tool_id or f"step_{secrets.token_hex(4)}"
            step = {"id": step_id, "name": f"调用工具 {name}", "status": "running"}
            emit(_evt("run.step.created", {"runId": run_id, "step": step}))
            if "_steps" not in run:
                run["_steps"] = {}
            run["_steps"][name] = step_id
            run["_steps"][tool_id] = step_id

        def on_tool_progress(event_type: str, tool_name: str, preview: str, args: dict = None):
            step_id = run.get("_steps", {}).get(tool_name)
            if not step_id:
                return
            emit(_evt("run.log.appended", {
                "runId": run_id, 
                "stepId": step_id, 
                "log": {"level": "info", "message": str(preview)[:500]}
            }))

        def on_tool_complete(tool_id: str, name: str, args: dict, result: Any):
            print(f"[{run_id}] TOOL COMPLETE: {name}", flush=True)
            step_id = run.get("_steps", {}).get(name) or tool_id
            step = {"id": step_id, "name": f"调用工具 {name}", "status": "succeeded", "output": {"preview": "执行完毕"}}
            emit(_evt("run.step.updated", {"runId": run_id, "step": step}))
            if name in run.get("_steps", {}):
                del run["_steps"][name]

        # Add thinking and reasoning callbacks to capture thinking process
        def on_thinking(message: str):
            # If message is empty, it means thinking is done
            if not message and "step_thinking_current" in run.get("_steps", {}):
                step_id = run["_steps"]["step_thinking_current"]
                step = {"id": step_id, "name": "思考", "status": "succeeded"}
                emit(_evt("run.step.updated", {"runId": run_id, "step": step}))
                del run["_steps"]["step_thinking_current"]
                return

            # Ignore empty messages if no active thinking step
            if not message:
                return

            # Use a special step id for thinking so we can append to it
            if "step_thinking_current" not in run.get("_steps", {}):
                step_id = f"step_thinking_{secrets.token_hex(4)}"
                if "_steps" not in run:
                    run["_steps"] = {}
                run["_steps"]["step_thinking_current"] = step_id
                step = {"id": step_id, "name": "思考", "status": "running"}
                emit(_evt("run.step.created", {"runId": run_id, "step": step}))
            else:
                step_id = run["_steps"]["step_thinking_current"]
            
            emit(_evt("run.log.appended", {
                "runId": run_id, 
                "stepId": step_id, 
                "log": {"level": "info", "message": message}
            }))

        def on_reasoning(text: str):
            on_thinking(text)

        # Approval Hook
        from tools.approval import set_current_session_key, register_gateway_notify, unregister_gateway_notify, resolve_gateway_approval
        set_current_session_key(run_id)

        def on_approval_request(approval_data: dict):
            print(f"[{run_id}] APPROVAL REQUESTED", flush=True)
            approval_id = f"ap_{secrets.token_hex(6)}"
            run["approvals"][approval_id] = {
                "id": approval_id, 
                "decision": None, 
            }
            run["approvals"][approval_id]["run_id"] = run_id
            
            emit(_evt("run.updated", {"runId": run_id, "status": "blocked"}))
            
            emit(_evt("approval.requested", {
                "runId": run_id,
                "approvalId": approval_id,
                "scope": "terminal_command",
                "reason": approval_data.get("description", "Dangerous command detected"),
                "proposal": {"path": "Command", "preview": approval_data.get("command", "")},
            }))

        register_gateway_notify(run_id, on_approval_request)

        agent_kwargs = {
            "model": req_model,
            "provider": provider,
            "api_mode": api_mode,
            "api_key": api_key,
            "base_url": base_url,
            "session_id": session_id,
            "tool_start_callback": on_tool_start,
            "tool_progress_callback": on_tool_progress,
            "tool_complete_callback": on_tool_complete,
            "thinking_callback": on_thinking,
            "reasoning_callback": on_reasoning,
            "save_trajectories": False,
            "quiet_mode": True
        }

        if mode == "chat":
            print(f"[{run_id}] Chat mode enabled. Disabling tools.", flush=True)
            agent_kwargs["enabled_toolsets"] = []
            agent_kwargs["max_iterations"] = 1

        print(f"[{run_id}] Initializing AIAgent...", flush=True)
        agent = AIAgent(**agent_kwargs)

        print(f"[{run_id}] Agent chat started...", flush=True)
        
        def on_stream(delta: str):
            # Send the incremental delta to the frontend
            emit(_evt("run.chunk", {"runId": run_id, "chunk": delta}))
            
        # Load conversation history
        conversation_history = []
        if session_id:
            try:
                from hermes_state import SessionDB
                db = SessionDB()
                history = db.get_messages_as_conversation(session_id)
                if history:
                    # Filter out session_meta and other non-standard roles
                    conversation_history = [m for m in history if m.get("role") != "session_meta"]
                    print(f"[{run_id}] Loaded {len(conversation_history)} past messages for session {session_id}", flush=True)
            except Exception as e:
                print(f"[{run_id}] Failed to load session history: {e}", flush=True)

        final_text = agent.chat(prompt, stream_callback=on_stream, conversation_history=conversation_history)
        print(f"[{run_id}] Agent chat finished. Result length: {len(final_text)}", flush=True)
        
        emit(_evt("run.updated", {"runId": run_id, "status": "succeeded"}))
        emit(_evt("run.finished", {
            "runId": run_id,
            "status": "succeeded",
            "finalText": final_text
        }))
    except Exception as e:
        print(f"[{run_id}] ERROR in _real_worker_sync: {e}", flush=True)
        traceback.print_exc()
        emit(_evt("run.updated", {"runId": run_id, "status": "failed"}))
        emit(_evt("run.finished", {
            "runId": run_id,
            "status": "failed",
            "finalText": f"执行失败: {str(e)}"
        }))
    finally:
        try:
            from tools.approval import unregister_gateway_notify
            unregister_gateway_notify(run_id)
        except Exception as e:
            print(f"[{run_id}] ERROR unregistering notify: {e}", flush=True)
        run["done"] = True
        print(f"[{run_id}] Worker sync done.", flush=True)

async def _real_worker(run_id: str, prompt: str, session_id: str = None, mode: str = "plan") -> None:
    loop = asyncio.get_running_loop()
    await loop.run_in_executor(_run_executor, _real_worker_sync, run_id, prompt, loop, session_id, mode)

@app.post("/api/v1/runs")
async def create_run(body: _DemoRunCreate):
    print(f"POST /api/v1/runs called with prompt: {body.prompt[:20]}, sessionId: {body.sessionId}, mode: {body.mode}", flush=True)
    run_id = f"run_{secrets.token_hex(8)}"
    _demo_runs[run_id] = {
        "id": run_id,
        "created_at": time.time(),
        "queue": asyncio.Queue(),
        "events": [],
        "seq": 0,
        "done": False,
        "approvals": {},
        "cancelled": False,
        "_steps": {},
    }
    asyncio.create_task(_real_worker(run_id, body.prompt, body.sessionId, body.mode))
    return {"id": run_id, "status": "running", "createdAt": int(time.time() * 1000)}

@app.get("/api/v1/runs/{run_id}/events")
async def run_events(run_id: str, request: Request):
    print(f"GET /api/v1/runs/{run_id}/events called", flush=True)
    run = _demo_runs.get(run_id)
    if not run:
        print(f"GET events: Run {run_id} not found", flush=True)
        raise HTTPException(status_code=404)

    async def event_generator():
        print(f"GET events: generator started for {run_id}", flush=True)
        
        # Send already stored events that might have been popped from the queue
        # Wait, to avoid duplication and lost events, we just consume the queue.
        # But if the generator restarts, it needs past events.
        # For simplicity, we just send everything from the queue until it's empty and done.
        
        # We need an index to know which events we've sent
        last_idx = 0
        
        while True:
            if await request.is_disconnected():
                print(f"GET events: client disconnected for {run_id}", flush=True)
                break
                
            # Send any events we haven't sent yet from the list
            while last_idx < len(run["events"]):
                evt = run["events"][last_idx]
                yield f"event: {evt['type']}\ndata: {json.dumps(evt)}\n\n"
                last_idx += 1
                
            if run["done"] and last_idx >= len(run["events"]):
                break
                
            try:
                # We just wait for new events to be added to the list
                # Since emit appends to the list, we can just sleep a bit
                await asyncio.sleep(0.1)
            except Exception:
                break
                
        print(f"GET events: generator done for {run_id}", flush=True)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.post("/api/v1/runs/{run_id}/cancel")
async def cancel_run(run_id: str):
    run = _demo_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404)
    run["cancelled"] = True
    return {"ok": True}

@app.post("/api/v1/approvals/{approval_id}/decision")
async def run_approval_decision(approval_id: str, body: _DemoApprovalDecision):
    # we need to find which run has this approval
    for run_id, run in _demo_runs.items():
        if approval_id in run.get("approvals", {}):
            approval = run["approvals"][approval_id]
            approval["decision"] = body.decision
            if "event" in approval:
                # set threadsafe? Actually this is async, so event.set() is fine if event is asyncio.Event
                # wait, if event is threading.Event, we just set it
                if hasattr(approval["event"], "set_result"):
                    # it's a future or asyncio object maybe?
                    approval["event"].set()
                else:
                    # assuming threading.Event
                    approval["event"].set()
            else:
                # Real worker approval
                from tools.approval import resolve_gateway_approval
                # map body.decision to 'approved' / 'denied' (or once/session/always)
                choice = "once" if body.decision == "approved" else "deny"
                resolve_gateway_approval(run_id, choice)
                # We should emit run.updated status running
                run["queue"].put_nowait({"id": f"evt_{run['seq']:06d}", "ts": int(time.time() * 1000), "type": "run.updated", "payload": {"runId": run_id, "status": "running"}})
                run["events"].append({"id": f"evt_{run['seq']:06d}", "ts": int(time.time() * 1000), "type": "run.updated", "payload": {"runId": run_id, "status": "running"}})
            return {"ok": True}
    raise HTTPException(status_code=404)

@app.get("/api/settings/models")
async def get_models_settings():
    from hermes_cli.auth import PROVIDER_REGISTRY, get_auth_status
    from hermes_cli.config import load_config, load_env
    from hermes_cli.models import CANONICAL_PROVIDERS, _PROVIDER_ALIASES, get_default_model_for_provider

    config = load_config()
    env = load_env()

    model_cfg = config.get("model")
    active_provider = ""
    active_model = ""
    if isinstance(model_cfg, dict):
        active_provider = str(model_cfg.get("provider") or "").strip()
        active_model = str(model_cfg.get("default") or "").strip()
    elif isinstance(model_cfg, str):
        active_model = model_cfg.strip()

    provider_models = config.get("provider_models")
    if not isinstance(provider_models, dict):
        provider_models = {}

    providers = []
    for p in CANONICAL_PROVIDERS:
        pid = p.slug
        pconfig = PROVIDER_REGISTRY.get(pid)
        api_key_set = False
        base_url = ""
        url_env = ""
        key_env = ""
        if pconfig:
            base_url = str(env.get(pconfig.base_url_env_var or "", "") or "").strip()
            url_env = str(pconfig.base_url_env_var or "")
            if pconfig.auth_type == "api_key":
                key_env = str(pconfig.api_key_env_vars[0]) if pconfig.api_key_env_vars else ""
                api_key_set = any(bool(str(env.get(k, "") or "").strip()) for k in pconfig.api_key_env_vars)
            else:
                try:
                    status = get_auth_status(pid)
                    api_key_set = bool(status.get("logged_in"))
                except Exception:
                    api_key_set = False
        default_model = str(provider_models.get(pid) or "") or get_default_model_for_provider(pid)
        providers.append(
            {
                "id": pid,
                "name": p.label,
                "isCustom": False,
                "apiKeySet": api_key_set,
                "baseUrl": base_url,
                "keyEnv": key_env,
                "urlEnv": url_env,
                "defaultModel": default_model,
            }
        )

    customs = config.get("providers", {})
    if isinstance(customs, dict):
        for pid, pdata in customs.items():
            providers.append(
                {
                    "id": pid,
                    "name": pdata.get("name", pid),
                    "isCustom": True,
                    "apiKeySet": bool(str(pdata.get("api_key") or "").strip()),
                    "baseUrl": pdata.get("api", ""),
                    "defaultModel": pdata.get("default_model", ""),
                    "transport": pdata.get("transport", "openai"),
                }
            )

    canonical_active_provider = str(active_provider or "").strip().lower()
    canonical_active_provider = _PROVIDER_ALIASES.get(canonical_active_provider, canonical_active_provider)

    return {
        "activeProvider": canonical_active_provider,
        "activeModel": active_model,
        "providers": providers,
    }

class ProviderUpdate(BaseModel):
    id: str
    isCustom: bool
    name: str = ""
    apiKey: str = ""
    baseUrl: str = ""
    defaultModel: str = ""
    transport: str = "openai"

@app.post("/api/settings/providers")
async def update_provider(body: ProviderUpdate):
    from hermes_cli.auth import PROVIDER_REGISTRY
    from hermes_cli.config import load_config, save_config, save_env_value
    from hermes_cli.models import _PROVIDER_ALIASES
    import secrets

    if not body.isCustom:
        pid = str(body.id or "").strip().lower()
        pid = _PROVIDER_ALIASES.get(pid, pid)
        pconfig = PROVIDER_REGISTRY.get(pid)
        if not pconfig:
            raise HTTPException(status_code=404, detail="Built-in provider not found")

        if body.apiKey and body.apiKey != "********":
            if pconfig.api_key_env_vars:
                save_env_value(pconfig.api_key_env_vars[0], body.apiKey)

        if pconfig.base_url_env_var and body.baseUrl is not None:
            save_env_value(pconfig.base_url_env_var, body.baseUrl)

        config = load_config()
        provider_models = config.get("provider_models")
        if not isinstance(provider_models, dict):
            provider_models = {}
        if body.defaultModel is not None:
            provider_models[pid] = body.defaultModel
        config["provider_models"] = provider_models
        save_config(config)

        return {"ok": True}
    else:
        config = load_config()
        if "providers" not in config or not isinstance(config["providers"], dict):
            config["providers"] = {}
            
        pid = body.id or f"custom-{secrets.token_hex(4)}"
        
        # If it exists, update it
        existing = config["providers"].get(pid, {})
        
        api_key = body.apiKey
        if api_key == "********":
            api_key = existing.get("api_key", "")
            
        config["providers"][pid] = {
            "name": body.name or pid,
            "api": body.baseUrl,
            "api_key": api_key,
            "default_model": body.defaultModel,
            "transport": body.transport
        }
        
        save_config(config)
        return {"ok": True, "id": pid}

@app.delete("/api/settings/providers/{provider_id}")
async def delete_provider(provider_id: str):
    from hermes_cli.config import load_config, save_config
    config = load_config()
    if "providers" in config and isinstance(config["providers"], dict):
        if provider_id in config["providers"]:
            del config["providers"][provider_id]
            save_config(config)
            return {"ok": True}
    raise HTTPException(status_code=404, detail="Custom provider not found")

class ActiveModelUpdate(BaseModel):
    provider: str | None = None
    model: str

@app.put("/api/settings/active_model")
async def update_active_model(body: ActiveModelUpdate):
    from hermes_cli.config import load_config, save_config
    from hermes_cli.models import _PROVIDER_ALIASES
    
    config = load_config()
    
    pid = str(body.provider or "").strip().lower()
    model_name = body.model
    if not pid and "/" in model_name:
        pid, model_name = model_name.split("/", 1)
        
    pid = _PROVIDER_ALIASES.get(pid, pid)
    
    if pid:
        config["model"] = {"provider": pid, "default": model_name}
    else:
        config["model"] = model_name
        
    provider_models = config.get("provider_models")
    if not isinstance(provider_models, dict):
        provider_models = {}
    if pid:
        provider_models[pid] = model_name
        config["provider_models"] = provider_models
        
    save_config(config)
    return {"ok": True}

class ProviderTestRequest(BaseModel):
    model: str = ""

@app.post("/api/settings/providers/{provider_id}/test")
async def test_provider_connectivity(provider_id: str, body: ProviderTestRequest | None = None):
    from hermes_cli.models import _PROVIDER_ALIASES, get_default_model_for_provider
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from hermes_cli.config import load_config

    pid = str(provider_id or "").strip().lower()
    pid = _PROVIDER_ALIASES.get(pid, pid)
    runtime = resolve_runtime_provider(requested=pid)

    base_url = str(runtime.get("base_url") or "").strip().rstrip("/")
    api_key = str(runtime.get("api_key") or "").strip()
    api_mode = str(runtime.get("api_mode") or "chat_completions").strip()

    cfg = load_config()
    provider_models = cfg.get("provider_models")
    if not isinstance(provider_models, dict):
        provider_models = {}
    model = ""
    if body and isinstance(body.model, str) and body.model.strip():
        model = body.model.strip()
    else:
        model = str(provider_models.get(pid) or "").strip() or get_default_model_for_provider(pid)

    try:
        import urllib.error
        if api_mode == "anthropic_messages":
            import urllib.request
            payload = json.dumps(
                {"model": model, "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]}
            ).encode()
            req = urllib.request.Request(
                base_url + "/v1/messages",
                data=payload,
                headers={
                    "content-type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if 200 <= resp.status < 300:
                    return {"ok": True, "message": "连接成功"}
                raise HTTPException(status_code=400, detail=f"连接失败: HTTP {resp.status}")
        else:
            import urllib.request

            url = base_url
            if not url.endswith("/v1") and "/v1/" not in url:
                url = url + "/v1"
            url = url + "/chat/completions"
            payload = json.dumps(
                {"model": model, "max_tokens": 1, "messages": [{"role": "user", "content": "ping"}]}
            ).encode()
            req = urllib.request.Request(
                url,
                data=payload,
                headers={"authorization": f"Bearer {api_key}", "content-type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                if 200 <= resp.status < 300:
                    return {"ok": True, "message": "连接成功"}
                raise HTTPException(status_code=400, detail=f"连接失败: HTTP {resp.status}")
    except urllib.error.HTTPError as e:
        try:
            detail = e.read().decode("utf-8", errors="ignore")
        except Exception:
            detail = str(e)
        raise HTTPException(status_code=400, detail=detail)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))




@app.post("/api/v1/demo/runs")
async def demo_create_run(body: _DemoRunCreate):
    run_id = f"demo_{secrets.token_hex(8)}"
    _demo_runs[run_id] = {
        "id": run_id,
        "created_at": time.time(),
        "queue": asyncio.Queue(),
        "events": [],
        "seq": 0,
        "done": False,
        "cancelled": False,
        "approvals": {},
    }
    asyncio.create_task(_demo_worker(run_id, body.prompt))
    return {"runId": run_id}


@app.post("/api/v1/demo/runs/{run_id}/cancel")
async def demo_cancel_run(run_id: str):
    run = _demo_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    run["cancelled"] = True
    for a in run.get("approvals", {}).values():
        ev = a.get("event")
        if ev:
            ev.set()
    return {"ok": True}


@app.post("/api/v1/demo/approvals/{approval_id}/decision")
async def demo_approval_decision(approval_id: str, body: _DemoApprovalDecision):
    decision = body.decision
    if decision not in ("approved", "denied"):
        raise HTTPException(status_code=400, detail="Invalid decision")

    for run in _demo_runs.values():
        approval = run.get("approvals", {}).get(approval_id)
        if approval:
            approval["decision"] = decision
            ev = approval.get("event")
            if ev:
                ev.set()
            return {"ok": True}

    raise HTTPException(status_code=404, detail="Approval not found")


@app.get("/api/v1/demo/runs/{run_id}/events")
async def demo_run_events(run_id: str):
    run = _demo_runs.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def gen():
        for ev in run["events"]:
            yield f"id: {ev['id']}\nevent: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n".encode("utf-8")

        while True:
            if run["done"] and run["queue"].empty():
                break
            try:
                ev = await asyncio.wait_for(run["queue"].get(), timeout=15.0)
            except asyncio.TimeoutError:
                yield b": keepalive\n\n"
                continue
            yield f"id: {ev['id']}\nevent: {ev['type']}\ndata: {json.dumps(ev, ensure_ascii=False)}\n\n".encode("utf-8")

    return StreamingResponse(gen(), media_type="text/event-stream")


# ---------------------------------------------------------------------------
# Config schema — auto-generated from DEFAULT_CONFIG
# ---------------------------------------------------------------------------

# Manual overrides for fields that need select options or custom types
_SCHEMA_OVERRIDES: Dict[str, Dict[str, Any]] = {
    "model": {
        "type": "string",
        "description": "Default model (e.g. anthropic/claude-sonnet-4.6)",
        "category": "general",
    },
    "model_context_length": {
        "type": "number",
        "description": "Context window override (0 = auto-detect from model metadata)",
        "category": "general",
    },
    "terminal.backend": {
        "type": "select",
        "description": "Terminal execution backend",
        "options": ["local", "docker", "ssh", "modal", "daytona", "singularity"],
    },
    "terminal.modal_mode": {
        "type": "select",
        "description": "Modal sandbox mode",
        "options": ["sandbox", "function"],
    },
    "tts.provider": {
        "type": "select",
        "description": "Text-to-speech provider",
        "options": ["edge", "elevenlabs", "openai", "neutts"],
    },
    "stt.provider": {
        "type": "select",
        "description": "Speech-to-text provider",
        "options": ["local", "openai", "mistral"],
    },
    "display.skin": {
        "type": "select",
        "description": "CLI visual theme",
        "options": ["default", "ares", "mono", "slate"],
    },
    "display.resume_display": {
        "type": "select",
        "description": "How resumed sessions display history",
        "options": ["minimal", "full", "off"],
    },
    "display.busy_input_mode": {
        "type": "select",
        "description": "Input behavior while agent is running",
        "options": ["queue", "interrupt", "block"],
    },
    "memory.provider": {
        "type": "select",
        "description": "Memory provider plugin",
        "options": ["builtin", "honcho"],
    },
    "approvals.mode": {
        "type": "select",
        "description": "Dangerous command approval mode",
        "options": ["ask", "yolo", "deny"],
    },
    "context.engine": {
        "type": "select",
        "description": "Context management engine",
        "options": ["default", "custom"],
    },
    "human_delay.mode": {
        "type": "select",
        "description": "Simulated typing delay mode",
        "options": ["off", "typing", "fixed"],
    },
    "logging.level": {
        "type": "select",
        "description": "Log level for agent.log",
        "options": ["DEBUG", "INFO", "WARNING", "ERROR"],
    },
    "agent.service_tier": {
        "type": "select",
        "description": "API service tier (OpenAI/Anthropic)",
        "options": ["", "auto", "default", "flex"],
    },
    "delegation.reasoning_effort": {
        "type": "select",
        "description": "Reasoning effort for delegated subagents",
        "options": ["", "low", "medium", "high"],
    },
}

# Categories with fewer fields get merged into "general" to avoid tab sprawl.
_CATEGORY_MERGE: Dict[str, str] = {
    "privacy": "security",
    "context": "agent",
    "skills": "agent",
    "cron": "agent",
    "network": "agent",
    "checkpoints": "agent",
    "approvals": "security",
    "human_delay": "display",
    "smart_model_routing": "agent",
}

# Display order for tabs — unlisted categories sort alphabetically after these.
_CATEGORY_ORDER = [
    "general", "agent", "terminal", "display", "delegation",
    "memory", "compression", "security", "browser", "voice",
    "tts", "stt", "logging", "discord", "auxiliary",
]


def _infer_type(value: Any) -> str:
    """Infer a UI field type from a Python value."""
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "number"
    if isinstance(value, float):
        return "number"
    if isinstance(value, list):
        return "list"
    if isinstance(value, dict):
        return "object"
    return "string"


def _build_schema_from_config(
    config: Dict[str, Any],
    prefix: str = "",
) -> Dict[str, Dict[str, Any]]:
    """Walk DEFAULT_CONFIG and produce a flat dot-path → field schema dict."""
    schema: Dict[str, Dict[str, Any]] = {}
    for key, value in config.items():
        full_key = f"{prefix}.{key}" if prefix else key

        # Skip internal / version keys
        if full_key in ("_config_version",):
            continue

        # Category is the first path component for nested keys, or "general"
        # for top-level scalar fields (model, toolsets, timezone, etc.).
        if prefix:
            category = prefix.split(".")[0]
        elif isinstance(value, dict):
            category = key
        else:
            category = "general"

        if isinstance(value, dict):
            # Recurse into nested dicts
            schema.update(_build_schema_from_config(value, full_key))
        else:
            entry: Dict[str, Any] = {
                "type": _infer_type(value),
                "description": full_key.replace(".", " → ").replace("_", " ").title(),
                "category": category,
            }
            # Apply manual overrides
            if full_key in _SCHEMA_OVERRIDES:
                entry.update(_SCHEMA_OVERRIDES[full_key])
            # Merge small categories
            entry["category"] = _CATEGORY_MERGE.get(entry["category"], entry["category"])
            schema[full_key] = entry
    return schema


CONFIG_SCHEMA = _build_schema_from_config(DEFAULT_CONFIG)

# Inject virtual fields that don't live in DEFAULT_CONFIG but are surfaced
# by the normalize/denormalize cycle.  Insert model_context_length right after
# the "model" key so it renders adjacent in the frontend.
_mcl_entry = _SCHEMA_OVERRIDES["model_context_length"]
_ordered_schema: Dict[str, Dict[str, Any]] = {}
for _k, _v in CONFIG_SCHEMA.items():
    _ordered_schema[_k] = _v
    if _k == "model":
        _ordered_schema["model_context_length"] = _mcl_entry
CONFIG_SCHEMA = _ordered_schema


class ConfigUpdate(BaseModel):
    config: dict


class EnvVarUpdate(BaseModel):
    key: str
    value: str


class EnvVarDelete(BaseModel):
    key: str


class EnvVarReveal(BaseModel):
    key: str


_GATEWAY_HEALTH_URL = os.getenv("GATEWAY_HEALTH_URL")
_GATEWAY_HEALTH_TIMEOUT = float(os.getenv("GATEWAY_HEALTH_TIMEOUT", "3"))


def _probe_gateway_health() -> tuple[bool, dict | None]:
    """Probe the gateway via its HTTP health endpoint (cross-container).

    Uses ``/health/detailed`` first (returns full state), falling back to
    the simpler ``/health`` endpoint.  Returns ``(is_alive, body_dict)``.

    Accepts any of these as ``GATEWAY_HEALTH_URL``:
    - ``http://gateway:8642``                (base URL — recommended)
    - ``http://gateway:8642/health``         (explicit health path)
    - ``http://gateway:8642/health/detailed`` (explicit detailed path)

    This is a **blocking** call — run via ``run_in_executor`` from async code.
    """
    if not _GATEWAY_HEALTH_URL:
        return False, None

    # Normalise to base URL so we always probe the right paths regardless of
    # whether the user included /health or /health/detailed in the env var.
    base = _GATEWAY_HEALTH_URL.rstrip("/")
    if base.endswith("/health/detailed"):
        base = base[: -len("/health/detailed")]
    elif base.endswith("/health"):
        base = base[: -len("/health")]

    for path in (f"{base}/health/detailed", f"{base}/health"):
        try:
            req = urllib.request.Request(path, method="GET")
            with urllib.request.urlopen(req, timeout=_GATEWAY_HEALTH_TIMEOUT) as resp:
                if resp.status == 200:
                    body = json.loads(resp.read())
                    return True, body
        except Exception:
            continue
    return False, None


@app.get("/api/status")
async def get_status():
    current_ver, latest_ver = check_config_version()

    # --- Gateway liveness detection ---
    # Try local PID check first (same-host).  If that fails and a remote
    # GATEWAY_HEALTH_URL is configured, probe the gateway over HTTP so the
    # dashboard works when the gateway runs in a separate container.
    gateway_pid = get_running_pid()
    gateway_running = gateway_pid is not None
    remote_health_body: dict | None = None

    if not gateway_running and _GATEWAY_HEALTH_URL:
        loop = asyncio.get_event_loop()
        alive, remote_health_body = await loop.run_in_executor(
            None, _probe_gateway_health
        )
        if alive:
            gateway_running = True
            # PID from the remote container (display only — not locally valid)
            if remote_health_body:
                gateway_pid = remote_health_body.get("pid")

    gateway_state = None
    gateway_platforms: dict = {}
    gateway_exit_reason = None
    gateway_updated_at = None
    configured_gateway_platforms: set[str] | None = None
    try:
        from gateway.config import load_gateway_config

        gateway_config = load_gateway_config()
        configured_gateway_platforms = {
            platform.value for platform in gateway_config.get_connected_platforms()
        }
    except Exception:
        configured_gateway_platforms = None

    # Prefer the detailed health endpoint response (has full state) when the
    # local runtime status file is absent or stale (cross-container).
    runtime = read_runtime_status()
    if runtime is None and remote_health_body and remote_health_body.get("gateway_state"):
        runtime = remote_health_body

    if runtime:
        gateway_state = runtime.get("gateway_state")
        gateway_platforms = runtime.get("platforms") or {}
        if configured_gateway_platforms is not None:
            gateway_platforms = {
                key: value
                for key, value in gateway_platforms.items()
                if key in configured_gateway_platforms
            }
        gateway_exit_reason = runtime.get("exit_reason")
        gateway_updated_at = runtime.get("updated_at")
        if not gateway_running:
            gateway_state = gateway_state if gateway_state in ("stopped", "startup_failed") else "stopped"
            gateway_platforms = {}
        elif gateway_running and remote_health_body is not None:
            # The health probe confirmed the gateway is alive, but the local
            # runtime status file may be stale (cross-container).  Override
            # stopped/None state so the dashboard shows the correct badge.
            if gateway_state in (None, "stopped"):
                gateway_state = "running"

    # If there was no runtime info at all but the health probe confirmed alive,
    # ensure we still report the gateway as running (no shared volume scenario).
    if gateway_running and gateway_state is None and remote_health_body is not None:
        gateway_state = "running"

    active_sessions = 0
    try:
        from hermes_state import SessionDB
        db = SessionDB()
        try:
            sessions = db.list_sessions_rich(limit=50)
            now = time.time()
            active_sessions = sum(
                1 for s in sessions
                if s.get("ended_at") is None
                and (now - s.get("last_active", s.get("started_at", 0))) < 300
            )
        finally:
            db.close()
    except Exception:
        pass

    return {
        "version": __version__,
        "release_date": __release_date__,
        "hermes_home": str(get_hermes_home()),
        "config_path": str(get_config_path()),
        "env_path": str(get_env_path()),
        "config_version": current_ver,
        "latest_config_version": latest_ver,
        "gateway_running": gateway_running,
        "gateway_pid": gateway_pid,
        "gateway_state": gateway_state,
        "gateway_platforms": gateway_platforms,
        "gateway_exit_reason": gateway_exit_reason,
        "gateway_updated_at": gateway_updated_at,
        "active_sessions": active_sessions,
    }


@app.get("/api/session-token")
async def get_session_token():
    return {"token": _SESSION_TOKEN}


@app.get("/api/sessions")
async def get_sessions(limit: int = 20, offset: int = 0):
    try:
        from hermes_state import SessionDB
        db = SessionDB()
        try:
            sessions = db.list_sessions_rich(limit=limit, offset=offset)
            total = db.session_count()
            now = time.time()
            for s in sessions:
                s["id"] = s["session_id"]
                s["is_active"] = (
                    s.get("ended_at") is None
                    and (now - s.get("last_active", s.get("started_at", 0))) < 300
                )
            return {"sessions": sessions, "total": total, "limit": limit, "offset": offset}
        finally:
            db.close()
    except Exception as e:
        _log.exception("GET /api/sessions failed")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/sessions/search")
async def search_sessions(q: str = "", limit: int = 20):
    """Full-text search across session message content using FTS5."""
    if not q or not q.strip():
        return {"results": []}
    try:
        from hermes_state import SessionDB
        db = SessionDB()
        try:
            # Auto-add prefix wildcards so partial words match
            # e.g. "nimb" → "nimb*" matches "nimby"
            # Preserve quoted phrases and existing wildcards as-is
            import re
            terms = []
            for token in re.findall(r'"[^"]*"|\S+', q.strip()):
                if token.startswith('"') or token.endswith("*"):
                    terms.append(token)
                else:
                    terms.append(token + "*")
            prefix_query = " ".join(terms)
            matches = db.search_messages(query=prefix_query, limit=limit)
            # Group by session_id — return unique sessions with their best snippet
            seen: dict = {}
            for m in matches:
                sid = m["session_id"]
                if sid not in seen:
                    seen[sid] = {
                        "session_id": sid,
                        "snippet": m.get("snippet", ""),
                        "role": m.get("role"),
                        "source": m.get("source"),
                        "model": m.get("model"),
                        "session_started": m.get("session_started"),
                    }
            return {"results": list(seen.values())}
        finally:
            db.close()
    except Exception:
        _log.exception("GET /api/sessions/search failed")
        raise HTTPException(status_code=500, detail="Search failed")


def _normalize_config_for_web(config: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize config for the web UI.

    Hermes supports ``model`` as either a bare string (``"anthropic/claude-sonnet-4"``)
    or a dict (``{default: ..., provider: ..., base_url: ...}``).  The schema is built
    from DEFAULT_CONFIG where ``model`` is a string, but user configs often have the
    dict form.  Normalize to the string form so the frontend schema matches.

    Also surfaces ``model_context_length`` as a top-level field so the web UI can
    display and edit it.  A value of 0 means "auto-detect".
    """
    config = dict(config)  # shallow copy
    model_val = config.get("model")
    if isinstance(model_val, dict):
        # Extract context_length before flattening the dict
        ctx_len = model_val.get("context_length", 0)
        config["model"] = model_val.get("default", model_val.get("name", ""))
        config["model_context_length"] = ctx_len if isinstance(ctx_len, int) else 0
    else:
        config["model_context_length"] = 0
    return config


@app.get("/api/config")
async def get_config():
    config = _normalize_config_for_web(load_config())
    # Strip internal keys that the frontend shouldn't see or send back
    return {k: v for k, v in config.items() if not k.startswith("_")}


@app.get("/api/config/defaults")
async def get_defaults():
    return DEFAULT_CONFIG


@app.get("/api/config/schema")
async def get_schema():
    return {"fields": CONFIG_SCHEMA, "category_order": _CATEGORY_ORDER}


_EMPTY_MODEL_INFO: dict = {
    "model": "",
    "provider": "",
    "auto_context_length": 0,
    "config_context_length": 0,
    "effective_context_length": 0,
    "capabilities": {},
}


@app.get("/api/model/info")
def get_model_info():
    """Return resolved model metadata for the currently configured model.

    Calls the same context-length resolution chain the agent uses, so the
    frontend can display "Auto-detected: 200K" alongside the override field.
    Also returns model capabilities (vision, reasoning, tools) when available.
    """
    try:
        cfg = load_config()
        model_cfg = cfg.get("model", "")

        # Extract model name and provider from the config
        if isinstance(model_cfg, dict):
            model_name = model_cfg.get("default", model_cfg.get("name", ""))
            provider = model_cfg.get("provider", "")
            base_url = model_cfg.get("base_url", "")
            config_ctx = model_cfg.get("context_length")
        else:
            model_name = str(model_cfg) if model_cfg else ""
            provider = ""
            base_url = ""
            config_ctx = None

        if not model_name:
            return dict(_EMPTY_MODEL_INFO, provider=provider)

        # Resolve auto-detected context length (pass config_ctx=None to get
        # purely auto-detected value, then separately report the override)
        try:
            from agent.model_metadata import get_model_context_length
            auto_ctx = get_model_context_length(
                model=model_name,
                base_url=base_url,
                provider=provider,
                config_context_length=None,  # ignore override — we want auto value
            )
        except Exception:
            auto_ctx = 0

        config_ctx_int = 0
        if isinstance(config_ctx, int) and config_ctx > 0:
            config_ctx_int = config_ctx

        # Effective is what the agent actually uses
        effective_ctx = config_ctx_int if config_ctx_int > 0 else auto_ctx

        # Try to get model capabilities from models.dev
        caps = {}
        try:
            from agent.models_dev import get_model_capabilities
            mc = get_model_capabilities(provider=provider, model=model_name)
            if mc is not None:
                caps = {
                    "supports_tools": mc.supports_tools,
                    "supports_vision": mc.supports_vision,
                    "supports_reasoning": mc.supports_reasoning,
                    "context_window": mc.context_window,
                    "max_output_tokens": mc.max_output_tokens,
                    "model_family": mc.model_family,
                }
        except Exception:
            pass

        return {
            "model": model_name,
            "provider": provider,
            "auto_context_length": auto_ctx,
            "config_context_length": config_ctx_int,
            "effective_context_length": effective_ctx,
            "capabilities": caps,
        }
    except Exception:
        _log.exception("GET /api/model/info failed")
        return dict(_EMPTY_MODEL_INFO)


def _denormalize_config_from_web(config: Dict[str, Any]) -> Dict[str, Any]:
    """Reverse _normalize_config_for_web before saving.

    Reconstructs ``model`` as a dict by reading the current on-disk config
    to recover model subkeys (provider, base_url, api_mode, etc.) that were
    stripped from the GET response.  The frontend only sees model as a flat
    string; the rest is preserved transparently.

    Also handles ``model_context_length`` — writes it back into the model dict
    as ``context_length``.  A value of 0 or absent means "auto-detect" (omitted
    from the dict so get_model_context_length() uses its normal resolution).
    """
    config = dict(config)
    # Remove any _model_meta that might have leaked in (shouldn't happen
    # with the stripped GET response, but be defensive)
    config.pop("_model_meta", None)

    # Extract and remove model_context_length before processing model
    ctx_override = config.pop("model_context_length", 0)
    if not isinstance(ctx_override, int):
        try:
            ctx_override = int(ctx_override)
        except (TypeError, ValueError):
            ctx_override = 0

    model_val = config.get("model")
    if isinstance(model_val, str) and model_val:
        # Read the current disk config to recover model subkeys
        try:
            disk_config = load_config()
            disk_model = disk_config.get("model")
            if isinstance(disk_model, dict):
                # Preserve all subkeys, update default with the new value
                disk_model["default"] = model_val
                # Write context_length into the model dict (0 = remove/auto)
                if ctx_override > 0:
                    disk_model["context_length"] = ctx_override
                else:
                    disk_model.pop("context_length", None)
                config["model"] = disk_model
            else:
                # Model was previously a bare string — upgrade to dict if
                # user is setting a context_length override
                if ctx_override > 0:
                    config["model"] = {
                        "default": model_val,
                        "context_length": ctx_override,
                    }
        except Exception:
            pass  # can't read disk config — just use the string form
    return config


@app.put("/api/config")
async def update_config(body: ConfigUpdate):
    try:
        save_config(_denormalize_config_from_web(body.config))
        return {"ok": True}
    except Exception as e:
        _log.exception("PUT /api/config failed")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.get("/api/env")
async def get_env_vars():
    env_on_disk = load_env()
    result = {}
    for var_name, info in OPTIONAL_ENV_VARS.items():
        value = env_on_disk.get(var_name)
        result[var_name] = {
            "is_set": bool(value),
            "redacted_value": redact_key(value) if value else None,
            "description": info.get("description", ""),
            "url": info.get("url"),
            "category": info.get("category", ""),
            "is_password": info.get("password", False),
            "tools": info.get("tools", []),
            "advanced": info.get("advanced", False),
        }
    return result


@app.put("/api/env")
async def set_env_var(body: EnvVarUpdate):
    try:
        save_env_value(body.key, body.value)
        return {"ok": True, "key": body.key}
    except Exception as e:
        _log.exception("PUT /api/env failed")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.delete("/api/env")
async def remove_env_var(body: EnvVarDelete):
    try:
        removed = remove_env_value(body.key)
        if not removed:
            raise HTTPException(status_code=404, detail=f"{body.key} not found in .env")
        return {"ok": True, "key": body.key}
    except HTTPException:
        raise
    except Exception as e:
        _log.exception("DELETE /api/env failed")
        raise HTTPException(status_code=500, detail="Internal server error")


@app.post("/api/env/reveal")
async def reveal_env_var(body: EnvVarReveal, request: Request):
    """Return the real (unredacted) value of a single env var.

    Protected by:
    - Ephemeral session token (generated per server start, injected into SPA)
    - Rate limiting (max 5 reveals per 30s window)
    - Audit logging
    """
    # --- Token check ---
    _require_token(request)

    # --- Rate limit ---
    now = time.time()
    cutoff = now - _REVEAL_WINDOW_SECONDS
    _reveal_timestamps[:] = [t for t in _reveal_timestamps if t > cutoff]
    if len(_reveal_timestamps) >= _REVEAL_MAX_PER_WINDOW:
        raise HTTPException(status_code=429, detail="Too many reveal requests. Try again shortly.")
    _reveal_timestamps.append(now)

    # --- Reveal ---
    env_on_disk = load_env()
    value = env_on_disk.get(body.key)
    if value is None:
        raise HTTPException(status_code=404, detail=f"{body.key} not found in .env")

    _log.info("env/reveal: %s", body.key)
    return {"key": body.key, "value": value}


# ---------------------------------------------------------------------------
# OAuth provider endpoints — status + disconnect (Phase 1)
# ---------------------------------------------------------------------------
#
# Phase 1 surfaces *which OAuth providers exist* and whether each is
# connected, plus a disconnect button. The actual login flow (PKCE for
# Anthropic, device-code for Nous/Codex) still runs in the CLI for now;
# Phase 2 will add in-browser flows. For unconnected providers we return
# the canonical ``hermes auth add <provider>`` command so the dashboard
# can surface a one-click copy.


def _truncate_token(value: Optional[str], visible: int = 6) -> str:
    """Return ``...XXXXXX`` (last N chars) for safe display in the UI.

    We never expose more than the trailing ``visible`` characters of an
    OAuth access token. JWT prefixes (the part before the first dot) are
    stripped first when present so the visible suffix is always part of
    the signing region rather than a meaningless header chunk.
    """
    if not value:
        return ""
    s = str(value)
    if "." in s and s.count(".") >= 2:
        # Looks like a JWT — show the trailing piece of the signature only.
        s = s.rsplit(".", 1)[-1]
    if len(s) <= visible:
        return s
    return f"…{s[-visible:]}"


def _anthropic_oauth_status() -> Dict[str, Any]:
    """Combined status across the three Anthropic credential sources we read.

    Hermes resolves Anthropic creds in this order at runtime:
    1. ``~/.hermes/.anthropic_oauth.json`` — Hermes-managed PKCE flow
    2. ``~/.claude/.credentials.json`` — Claude Code CLI credentials (auto)
    3. ``ANTHROPIC_TOKEN`` / ``ANTHROPIC_API_KEY`` env vars
    The dashboard reports the highest-priority source that's actually present.
    """
    try:
        from agent.anthropic_adapter import (
            read_hermes_oauth_credentials,
            read_claude_code_credentials,
            _HERMES_OAUTH_FILE,
        )
    except ImportError:
        read_claude_code_credentials = None  # type: ignore
        read_hermes_oauth_credentials = None  # type: ignore
        _HERMES_OAUTH_FILE = None  # type: ignore

    hermes_creds = None
    if read_hermes_oauth_credentials:
        try:
            hermes_creds = read_hermes_oauth_credentials()
        except Exception:
            hermes_creds = None
    if hermes_creds and hermes_creds.get("accessToken"):
        return {
            "logged_in": True,
            "source": "hermes_pkce",
            "source_label": f"Hermes PKCE ({_HERMES_OAUTH_FILE})",
            "token_preview": _truncate_token(hermes_creds.get("accessToken")),
            "expires_at": hermes_creds.get("expiresAt"),
            "has_refresh_token": bool(hermes_creds.get("refreshToken")),
        }

    cc_creds = None
    if read_claude_code_credentials:
        try:
            cc_creds = read_claude_code_credentials()
        except Exception:
            cc_creds = None
    if cc_creds and cc_creds.get("accessToken"):
        return {
            "logged_in": True,
            "source": "claude_code",
            "source_label": "Claude Code (~/.claude/.credentials.json)",
            "token_preview": _truncate_token(cc_creds.get("accessToken")),
            "expires_at": cc_creds.get("expiresAt"),
            "has_refresh_token": bool(cc_creds.get("refreshToken")),
        }

    env_token = os.getenv("ANTHROPIC_TOKEN") or os.getenv("CLAUDE_CODE_OAUTH_TOKEN")
    if env_token:
        return {
            "logged_in": True,
            "source": "env_var",
            "source_label": "ANTHROPIC_TOKEN environment variable",
            "token_preview": _truncate_token(env_token),
            "expires_at": None,
            "has_refresh_token": False,
        }
    return {"logged_in": False, "source": None}


def _claude_code_only_status() -> Dict[str, Any]:
    """Surface Claude Code CLI credentials as their own provider entry.

    Independent of the Anthropic entry above so users can see whether their
    Claude Code subscription tokens are actively flowing into Hermes even
    when they also have a separate Hermes-managed PKCE login.
    """
    try:
        from agent.anthropic_adapter import read_claude_code_credentials
        creds = read_claude_code_credentials()
    except Exception:
        creds = None
    if creds and creds.get("accessToken"):
        return {
            "logged_in": True,
            "source": "claude_code_cli",
            "source_label": "~/.claude/.credentials.json",
            "token_preview": _truncate_token(creds.get("accessToken")),
            "expires_at": creds.get("expiresAt"),
            "has_refresh_token": bool(creds.get("refreshToken")),
        }
    return {"logged_in": False, "source": None}


# Provider catalog. The order matters — it's how we render the UI list.
# ``cli_command`` is what the dashboard surfaces as the copy-to-clipboard
# fallback while Phase 2 (in-browser flows) isn't built yet.
# ``flow`` describes the OAuth shape so the future modal can pick the
# right UI: ``pkce`` = open URL + paste callback code, ``device_code`` =
# show code + verification URL + poll, ``external`` = read-only (delegated
# to a third-party CLI like Claude Code or Qwen).
_OAUTH_PROVIDER_CATALOG: tuple[Dict[str, Any], ...] = (
    {
        "id": "anthropic",
        "name": "Anthropic (Claude API)",
        "flow": "pkce",
        "cli_command": "hermes auth add anthropic",
        "docs_url": "https://docs.claude.com/en/api/getting-started",
        "status_fn": _anthropic_oauth_status,
    },
    {
        "id": "claude-code",
        "name": "Claude Code (subscription)",
        "flow": "external",
        "cli_command": "claude setup-token",
        "docs_url": "https://docs.claude.com/en/docs/claude-code",
        "status_fn": _claude_code_only_status,
    },
    {
        "id": "nous",
        "name": "Nous Portal",
        "flow": "device_code",
        "cli_command": "hermes auth add nous",
        "docs_url": "https://portal.nousresearch.com",
        "status_fn": None,  # dispatched via auth.get_nous_auth_status
    },
    {
        "id": "openai-codex",
        "name": "OpenAI Codex (ChatGPT)",
        "flow": "device_code",
        "cli_command": "hermes auth add openai-codex",
        "docs_url": "https://platform.openai.com/docs",
        "status_fn": None,  # dispatched via auth.get_codex_auth_status
    },
    {
        "id": "qwen-oauth",
        "name": "Qwen (via Qwen CLI)",
        "flow": "external",
        "cli_command": "hermes auth add qwen-oauth",
        "docs_url": "https://github.com/QwenLM/qwen-code",
        "status_fn": None,  # dispatched via auth.get_qwen_auth_status
    },
)


def _resolve_provider_status(provider_id: str, status_fn) -> Dict[str, Any]:
    """Dispatch to the right status helper for an OAuth provider entry."""
    if status_fn is not None:
        try:
            return status_fn()
        except Exception as e:
            return {"logged_in": False, "error": str(e)}
    try:
        from hermes_cli import auth as hauth
        if provider_id == "nous":
            raw = hauth.get_nous_auth_status()
            return {
                "logged_in": bool(raw.get("logged_in")),
                "source": "nous_portal",
                "source_label": raw.get("portal_base_url") or "Nous Portal",
                "token_preview": _truncate_token(raw.get("access_token")),
                "expires_at": raw.get("access_expires_at"),
                "has_refresh_token": bool(raw.get("has_refresh_token")),
            }
        if provider_id == "openai-codex":
            raw = hauth.get_codex_auth_status()
            return {
                "logged_in": bool(raw.get("logged_in")),
                "source": raw.get("source") or "openai_codex",
                "source_label": raw.get("auth_mode") or "OpenAI Codex",
                "token_preview": _truncate_token(raw.get("api_key")),
                "expires_at": None,
                "has_refresh_token": False,
                "last_refresh": raw.get("last_refresh"),
            }
        if provider_id == "qwen-oauth":
            raw = hauth.get_qwen_auth_status()
            return {
                "logged_in": bool(raw.get("logged_in")),
                "source": "qwen_cli",
                "source_label": raw.get("auth_store_path") or "Qwen CLI",
                "token_preview": _truncate_token(raw.get("access_token")),
                "expires_at": raw.get("expires_at"),
                "has_refresh_token": bool(raw.get("has_refresh_token")),
            }
    except Exception as e:
        return {"logged_in": False, "error": str(e)}
    return {"logged_in": False}


@app.get("/api/providers/oauth")
async def list_oauth_providers():
    """Enumerate every OAuth-capable LLM provider with current status.

    Response shape (per provider):
        id              stable identifier (used in DELETE path)
        name            human label
        flow            "pkce" | "device_code" | "external"
        cli_command     fallback CLI command for users to run manually
        docs_url        external docs/portal link for the "Learn more" link
        status:
          logged_in        bool — currently has usable creds
          source           short slug ("hermes_pkce", "claude_code", ...)
          source_label     human-readable origin (file path, env var name)
          token_preview    last N chars of the token, never the full token
          expires_at       ISO timestamp string or null
          has_refresh_token bool
    """
    providers = []
    for p in _OAUTH_PROVIDER_CATALOG:
        status = _resolve_provider_status(p["id"], p.get("status_fn"))
        providers.append({
            "id": p["id"],
            "name": p["name"],
            "flow": p["flow"],
            "cli_command": p["cli_command"],
            "docs_url": p["docs_url"],
            "status": status,
        })
    return {"providers": providers}


@app.delete("/api/providers/oauth/{provider_id}")
async def disconnect_oauth_provider(provider_id: str, request: Request):
    """Disconnect an OAuth provider. Token-protected (matches /env/reveal)."""
    _require_token(request)

    valid_ids = {p["id"] for p in _OAUTH_PROVIDER_CATALOG}
    if provider_id not in valid_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown provider: {provider_id}. "
                   f"Available: {', '.join(sorted(valid_ids))}",
        )

    # Anthropic and claude-code clear the same Hermes-managed PKCE file
    # AND forget the Claude Code import. We don't touch ~/.claude/* directly
    # — that's owned by the Claude Code CLI; users can re-auth there if they
    # want to undo a disconnect.
    if provider_id in ("anthropic", "claude-code"):
        try:
            from agent.anthropic_adapter import _HERMES_OAUTH_FILE
            if _HERMES_OAUTH_FILE.exists():
                _HERMES_OAUTH_FILE.unlink()
        except Exception:
            pass
        # Also clear the credential pool entry if present.
        try:
            from hermes_cli.auth import clear_provider_auth
            clear_provider_auth("anthropic")
        except Exception:
            pass
        _log.info("oauth/disconnect: %s", provider_id)
        return {"ok": True, "provider": provider_id}

    try:
        from hermes_cli.auth import clear_provider_auth
        cleared = clear_provider_auth(provider_id)
        _log.info("oauth/disconnect: %s (cleared=%s)", provider_id, cleared)
        return {"ok": bool(cleared), "provider": provider_id}
    except Exception as e:
        _log.exception("disconnect %s failed", provider_id)
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------------------------------------------------------------
# OAuth Phase 2 — in-browser PKCE & device-code flows
# ---------------------------------------------------------------------------
#
# Two flow shapes are supported:
#
#   PKCE (Anthropic):
#     1. POST /api/providers/oauth/anthropic/start
#          → server generates code_verifier + challenge, builds claude.ai
#            authorize URL, stashes verifier in _oauth_sessions[session_id]
#          → returns { session_id, flow: "pkce", auth_url }
#     2. UI opens auth_url in a new tab. User authorizes, copies code.
#     3. POST /api/providers/oauth/anthropic/submit { session_id, code }
#          → server exchanges (code + verifier) → tokens at console.anthropic.com
#          → persists to ~/.hermes/.anthropic_oauth.json AND credential pool
#          → returns { ok: true, status: "approved" }
#
#   Device code (Nous, OpenAI Codex):
#     1. POST /api/providers/oauth/{nous|openai-codex}/start
#          → server hits provider's device-auth endpoint
#          → gets { user_code, verification_url, device_code, interval, expires_in }
#          → spawns background poller thread that polls the token endpoint
#            every `interval` seconds until approved/expired
#          → stores poll status in _oauth_sessions[session_id]
#          → returns { session_id, flow: "device_code", user_code,
#                      verification_url, expires_in, poll_interval }
#     2. UI opens verification_url in a new tab and shows user_code.
#     3. UI polls GET /api/providers/oauth/{provider}/poll/{session_id}
#          every 2s until status != "pending".
#     4. On "approved" the background thread has already saved creds; UI
#        refreshes the providers list.
#
# Sessions are kept in-memory only (single-process FastAPI) and time out
# after 15 minutes. A periodic cleanup runs on each /start call to GC
# expired sessions so the dict doesn't grow without bound.

_OAUTH_SESSION_TTL_SECONDS = 15 * 60
_oauth_sessions: Dict[str, Dict[str, Any]] = {}
_oauth_sessions_lock = threading.Lock()

# Import OAuth constants from canonical source instead of duplicating.
# Guarded so hermes web still starts if anthropic_adapter is unavailable;
# Phase 2 endpoints will return 501 in that case.
try:
    from agent.anthropic_adapter import (
        _OAUTH_CLIENT_ID as _ANTHROPIC_OAUTH_CLIENT_ID,
        _OAUTH_TOKEN_URL as _ANTHROPIC_OAUTH_TOKEN_URL,
        _OAUTH_REDIRECT_URI as _ANTHROPIC_OAUTH_REDIRECT_URI,
        _OAUTH_SCOPES as _ANTHROPIC_OAUTH_SCOPES,
        _generate_pkce as _generate_pkce_pair,
    )
    _ANTHROPIC_OAUTH_AVAILABLE = True
except ImportError:
    _ANTHROPIC_OAUTH_AVAILABLE = False
_ANTHROPIC_OAUTH_AUTHORIZE_URL = "https://claude.ai/oauth/authorize"


def _gc_oauth_sessions() -> None:
    """Drop expired sessions. Called opportunistically on /start."""
    cutoff = time.time() - _OAUTH_SESSION_TTL_SECONDS
    with _oauth_sessions_lock:
        stale = [sid for sid, sess in _oauth_sessions.items() if sess["created_at"] < cutoff]
        for sid in stale:
            _oauth_sessions.pop(sid, None)


def _new_oauth_session(provider_id: str, flow: str) -> tuple[str, Dict[str, Any]]:
    """Create + register a new OAuth session, return (session_id, session_dict)."""
    sid = secrets.token_urlsafe(16)
    sess = {
        "session_id": sid,
        "provider": provider_id,
        "flow": flow,
        "created_at": time.time(),
        "status": "pending",  # pending | approved | denied | expired | error
        "error_message": None,
    }
    with _oauth_sessions_lock:
        _oauth_sessions[sid] = sess
    return sid, sess


def _save_anthropic_oauth_creds(access_token: str, refresh_token: str, expires_at_ms: int) -> None:
    """Persist Anthropic PKCE creds to both Hermes file AND credential pool.

    Mirrors what auth_commands.add_command does so the dashboard flow leaves
    the system in the same state as ``hermes auth add anthropic``.
    """
    from agent.anthropic_adapter import _HERMES_OAUTH_FILE
    payload = {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "expiresAt": expires_at_ms,
    }
    _HERMES_OAUTH_FILE.parent.mkdir(parents=True, exist_ok=True)
    _HERMES_OAUTH_FILE.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    # Best-effort credential-pool insert. Failure here doesn't invalidate
    # the file write — pool registration only matters for the rotation
    # strategy, not for runtime credential resolution.
    try:
        from agent.credential_pool import (
            PooledCredential,
            load_pool,
            AUTH_TYPE_OAUTH,
            SOURCE_MANUAL,
        )
        import uuid
        pool = load_pool("anthropic")
        # Avoid duplicate entries: delete any prior dashboard-issued OAuth entry
        existing = [e for e in pool.entries() if getattr(e, "source", "").startswith(f"{SOURCE_MANUAL}:dashboard_pkce")]
        for e in existing:
            try:
                pool.remove_entry(getattr(e, "id", ""))
            except Exception:
                pass
        entry = PooledCredential(
            provider="anthropic",
            id=uuid.uuid4().hex[:6],
            label="dashboard PKCE",
            auth_type=AUTH_TYPE_OAUTH,
            priority=0,
            source=f"{SOURCE_MANUAL}:dashboard_pkce",
            access_token=access_token,
            refresh_token=refresh_token,
            expires_at_ms=expires_at_ms,
        )
        pool.add_entry(entry)
    except Exception as e:
        _log.warning("anthropic pool add (dashboard) failed: %s", e)


def _start_anthropic_pkce() -> Dict[str, Any]:
    """Begin PKCE flow. Returns the auth URL the UI should open."""
    if not _ANTHROPIC_OAUTH_AVAILABLE:
        raise HTTPException(status_code=501, detail="Anthropic OAuth not available (missing adapter)")
    verifier, challenge = _generate_pkce_pair()
    sid, sess = _new_oauth_session("anthropic", "pkce")
    sess["verifier"] = verifier
    sess["state"] = verifier  # Anthropic round-trips verifier as state
    params = {
        "code": "true",
        "client_id": _ANTHROPIC_OAUTH_CLIENT_ID,
        "response_type": "code",
        "redirect_uri": _ANTHROPIC_OAUTH_REDIRECT_URI,
        "scope": _ANTHROPIC_OAUTH_SCOPES,
        "code_challenge": challenge,
        "code_challenge_method": "S256",
        "state": verifier,
    }
    auth_url = f"{_ANTHROPIC_OAUTH_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"
    return {
        "session_id": sid,
        "flow": "pkce",
        "auth_url": auth_url,
        "expires_in": _OAUTH_SESSION_TTL_SECONDS,
    }


def _submit_anthropic_pkce(session_id: str, code_input: str) -> Dict[str, Any]:
    """Exchange authorization code for tokens. Persists on success."""
    with _oauth_sessions_lock:
        sess = _oauth_sessions.get(session_id)
    if not sess or sess["provider"] != "anthropic" or sess["flow"] != "pkce":
        raise HTTPException(status_code=404, detail="Unknown or expired session")
    if sess["status"] != "pending":
        return {"ok": False, "status": sess["status"], "message": sess.get("error_message")}

    # Anthropic's redirect callback page formats the code as `<code>#<state>`.
    # Strip the state suffix if present (we already have the verifier server-side).
    parts = code_input.strip().split("#", 1)
    code = parts[0].strip()
    if not code:
        return {"ok": False, "status": "error", "message": "No code provided"}
    state_from_callback = parts[1] if len(parts) > 1 else ""

    exchange_data = json.dumps({
        "grant_type": "authorization_code",
        "client_id": _ANTHROPIC_OAUTH_CLIENT_ID,
        "code": code,
        "state": state_from_callback or sess["state"],
        "redirect_uri": _ANTHROPIC_OAUTH_REDIRECT_URI,
        "code_verifier": sess["verifier"],
    }).encode()
    req = urllib.request.Request(
        _ANTHROPIC_OAUTH_TOKEN_URL,
        data=exchange_data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "hermes-dashboard/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            result = json.loads(resp.read().decode())
    except Exception as e:
        sess["status"] = "error"
        sess["error_message"] = f"Token exchange failed: {e}"
        return {"ok": False, "status": "error", "message": sess["error_message"]}

    access_token = result.get("access_token", "")
    refresh_token = result.get("refresh_token", "")
    expires_in = int(result.get("expires_in") or 3600)
    if not access_token:
        sess["status"] = "error"
        sess["error_message"] = "No access token returned"
        return {"ok": False, "status": "error", "message": sess["error_message"]}

    expires_at_ms = int(time.time() * 1000) + (expires_in * 1000)
    try:
        _save_anthropic_oauth_creds(access_token, refresh_token, expires_at_ms)
    except Exception as e:
        sess["status"] = "error"
        sess["error_message"] = f"Save failed: {e}"
        return {"ok": False, "status": "error", "message": sess["error_message"]}
    sess["status"] = "approved"
    _log.info("oauth/pkce: anthropic login completed (session=%s)", session_id)
    return {"ok": True, "status": "approved"}


async def _start_device_code_flow(provider_id: str) -> Dict[str, Any]:
    """Initiate a device-code flow (Nous or OpenAI Codex).

    Calls the provider's device-auth endpoint via the existing CLI helpers,
    then spawns a background poller. Returns the user-facing display fields
    so the UI can render the verification page link + user code.
    """
    from hermes_cli import auth as hauth
    if provider_id == "nous":
        from hermes_cli.auth import _request_device_code, PROVIDER_REGISTRY
        import httpx
        pconfig = PROVIDER_REGISTRY["nous"]
        portal_base_url = (
            os.getenv("HERMES_PORTAL_BASE_URL")
            or os.getenv("NOUS_PORTAL_BASE_URL")
            or pconfig.portal_base_url
        ).rstrip("/")
        client_id = pconfig.client_id
        scope = pconfig.scope
        def _do_nous_device_request():
            with httpx.Client(timeout=httpx.Timeout(15.0), headers={"Accept": "application/json"}) as client:
                return _request_device_code(
                    client=client,
                    portal_base_url=portal_base_url,
                    client_id=client_id,
                    scope=scope,
                )
        device_data = await asyncio.get_event_loop().run_in_executor(None, _do_nous_device_request)
        sid, sess = _new_oauth_session("nous", "device_code")
        sess["device_code"] = str(device_data["device_code"])
        sess["interval"] = int(device_data["interval"])
        sess["expires_at"] = time.time() + int(device_data["expires_in"])
        sess["portal_base_url"] = portal_base_url
        sess["client_id"] = client_id
        threading.Thread(
            target=_nous_poller, args=(sid,), daemon=True, name=f"oauth-poll-{sid[:6]}"
        ).start()
        return {
            "session_id": sid,
            "flow": "device_code",
            "user_code": str(device_data["user_code"]),
            "verification_url": str(device_data["verification_uri_complete"]),
            "expires_in": int(device_data["expires_in"]),
            "poll_interval": int(device_data["interval"]),
        }

    if provider_id == "openai-codex":
        # Codex uses fixed OpenAI device-auth endpoints; reuse the helper.
        sid, _ = _new_oauth_session("openai-codex", "device_code")
        # Use the helper but in a thread because it polls inline.
        # We can't extract just the start step without refactoring auth.py,
        # so we run the full helper in a worker and proxy the user_code +
        # verification_url back via the session dict. The helper prints
        # to stdout — we capture nothing here, just status.
        threading.Thread(
            target=_codex_full_login_worker, args=(sid,), daemon=True,
            name=f"oauth-codex-{sid[:6]}",
        ).start()
        # Block briefly until the worker has populated the user_code, OR error.
        deadline = time.time() + 10
        while time.time() < deadline:
            with _oauth_sessions_lock:
                s = _oauth_sessions.get(sid)
            if s and (s.get("user_code") or s["status"] != "pending"):
                break
            await asyncio.sleep(0.1)
        with _oauth_sessions_lock:
            s = _oauth_sessions.get(sid, {})
        if s.get("status") == "error":
            raise HTTPException(status_code=500, detail=s.get("error_message") or "device-auth failed")
        if not s.get("user_code"):
            raise HTTPException(status_code=504, detail="device-auth timed out before returning a user code")
        return {
            "session_id": sid,
            "flow": "device_code",
            "user_code": s["user_code"],
            "verification_url": s["verification_url"],
            "expires_in": int(s.get("expires_in") or 900),
            "poll_interval": int(s.get("interval") or 5),
        }

    raise HTTPException(status_code=400, detail=f"Provider {provider_id} does not support device-code flow")


def _nous_poller(session_id: str) -> None:
    """Background poller that drives a Nous device-code flow to completion."""
    from hermes_cli.auth import _poll_for_token, refresh_nous_oauth_from_state
    from datetime import datetime, timezone
    import httpx
    with _oauth_sessions_lock:
        sess = _oauth_sessions.get(session_id)
    if not sess:
        return
    portal_base_url = sess["portal_base_url"]
    client_id = sess["client_id"]
    device_code = sess["device_code"]
    interval = sess["interval"]
    expires_in = max(60, int(sess["expires_at"] - time.time()))
    try:
        with httpx.Client(timeout=httpx.Timeout(15.0), headers={"Accept": "application/json"}) as client:
            token_data = _poll_for_token(
                client=client,
                portal_base_url=portal_base_url,
                client_id=client_id,
                device_code=device_code,
                expires_in=expires_in,
                poll_interval=interval,
            )
        # Same post-processing as _nous_device_code_login (mint agent key)
        now = datetime.now(timezone.utc)
        token_ttl = int(token_data.get("expires_in") or 0)
        auth_state = {
            "portal_base_url": portal_base_url,
            "inference_base_url": token_data.get("inference_base_url"),
            "client_id": client_id,
            "scope": token_data.get("scope"),
            "token_type": token_data.get("token_type", "Bearer"),
            "access_token": token_data["access_token"],
            "refresh_token": token_data.get("refresh_token"),
            "obtained_at": now.isoformat(),
            "expires_at": (
                datetime.fromtimestamp(now.timestamp() + token_ttl, tz=timezone.utc).isoformat()
                if token_ttl else None
            ),
            "expires_in": token_ttl,
        }
        full_state = refresh_nous_oauth_from_state(
            auth_state, min_key_ttl_seconds=300, timeout_seconds=15.0,
            force_refresh=False, force_mint=True,
        )
        # Save into credential pool same as auth_commands.py does
        from agent.credential_pool import (
            PooledCredential,
            load_pool,
            AUTH_TYPE_OAUTH,
            SOURCE_MANUAL,
        )
        pool = load_pool("nous")
        entry = PooledCredential.from_dict("nous", {
            **full_state,
            "label": "dashboard device_code",
            "auth_type": AUTH_TYPE_OAUTH,
            "source": f"{SOURCE_MANUAL}:dashboard_device_code",
            "base_url": full_state.get("inference_base_url"),
        })
        pool.add_entry(entry)
        # Also persist to auth store so get_nous_auth_status() sees it
        # (matches what _login_nous in auth.py does for the CLI flow).
        try:
            from hermes_cli.auth import (
                _load_auth_store, _save_provider_state, _save_auth_store,
                _auth_store_lock,
            )
            with _auth_store_lock():
                auth_store = _load_auth_store()
                _save_provider_state(auth_store, "nous", full_state)
                _save_auth_store(auth_store)
        except Exception as store_exc:
            _log.warning(
                "oauth/device: credential pool saved but auth store write failed "
                "(session=%s): %s", session_id, store_exc,
            )
        with _oauth_sessions_lock:
            sess["status"] = "approved"
        _log.info("oauth/device: nous login completed (session=%s)", session_id)
    except Exception as e:
        _log.warning("nous device-code poll failed (session=%s): %s", session_id, e)
        with _oauth_sessions_lock:
            sess["status"] = "error"
            sess["error_message"] = str(e)


def _codex_full_login_worker(session_id: str) -> None:
    """Run the complete OpenAI Codex device-code flow.

    Codex doesn't use the standard OAuth device-code endpoints; it has its
    own ``/api/accounts/deviceauth/usercode`` (JSON body, returns
    ``device_auth_id``) and ``/api/accounts/deviceauth/token`` (JSON body
    polled until 200). On success the response carries an
    ``authorization_code`` + ``code_verifier`` that get exchanged at
    CODEX_OAUTH_TOKEN_URL with grant_type=authorization_code.

    The flow is replicated inline (rather than calling
    _codex_device_code_login) because that helper prints/blocks/polls in a
    single function — we need to surface the user_code to the dashboard the
    moment we receive it, well before polling completes.
    """
    try:
        import httpx
        from hermes_cli.auth import (
            CODEX_OAUTH_CLIENT_ID,
            CODEX_OAUTH_TOKEN_URL,
            DEFAULT_CODEX_BASE_URL,
        )
        issuer = "https://auth.openai.com"

        # Step 1: request device code
        with httpx.Client(timeout=httpx.Timeout(15.0)) as client:
            resp = client.post(
                f"{issuer}/api/accounts/deviceauth/usercode",
                json={"client_id": CODEX_OAUTH_CLIENT_ID},
                headers={"Content-Type": "application/json"},
            )
        if resp.status_code != 200:
            raise RuntimeError(f"deviceauth/usercode returned {resp.status_code}")
        device_data = resp.json()
        user_code = device_data.get("user_code", "")
        device_auth_id = device_data.get("device_auth_id", "")
        poll_interval = max(3, int(device_data.get("interval", "5")))
        if not user_code or not device_auth_id:
            raise RuntimeError("device-code response missing user_code or device_auth_id")
        verification_url = f"{issuer}/codex/device"
        with _oauth_sessions_lock:
            sess = _oauth_sessions.get(session_id)
            if not sess:
                return
            sess["user_code"] = user_code
            sess["verification_url"] = verification_url
            sess["device_auth_id"] = device_auth_id
            sess["interval"] = poll_interval
            sess["expires_in"] = 15 * 60  # OpenAI's effective limit
            sess["expires_at"] = time.time() + sess["expires_in"]

        # Step 2: poll until authorized
        deadline = time.time() + sess["expires_in"]
        code_resp = None
        with httpx.Client(timeout=httpx.Timeout(15.0)) as client:
            while time.time() < deadline:
                time.sleep(poll_interval)
                poll = client.post(
                    f"{issuer}/api/accounts/deviceauth/token",
                    json={"device_auth_id": device_auth_id, "user_code": user_code},
                    headers={"Content-Type": "application/json"},
                )
                if poll.status_code == 200:
                    code_resp = poll.json()
                    break
                if poll.status_code in (403, 404):
                    continue  # user hasn't authorized yet
                raise RuntimeError(f"deviceauth/token poll returned {poll.status_code}")

        if code_resp is None:
            with _oauth_sessions_lock:
                sess["status"] = "expired"
                sess["error_message"] = "Device code expired before approval"
            return

        # Step 3: exchange authorization_code for tokens
        authorization_code = code_resp.get("authorization_code", "")
        code_verifier = code_resp.get("code_verifier", "")
        if not authorization_code or not code_verifier:
            raise RuntimeError("device-auth response missing authorization_code/code_verifier")
        with httpx.Client(timeout=httpx.Timeout(15.0)) as client:
            token_resp = client.post(
                CODEX_OAUTH_TOKEN_URL,
                data={
                    "grant_type": "authorization_code",
                    "code": authorization_code,
                    "redirect_uri": f"{issuer}/deviceauth/callback",
                    "client_id": CODEX_OAUTH_CLIENT_ID,
                    "code_verifier": code_verifier,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        if token_resp.status_code != 200:
            raise RuntimeError(f"token exchange returned {token_resp.status_code}")
        tokens = token_resp.json()
        access_token = tokens.get("access_token", "")
        refresh_token = tokens.get("refresh_token", "")
        if not access_token:
            raise RuntimeError("token exchange did not return access_token")

        # Persist via credential pool — same shape as auth_commands.add_command
        from agent.credential_pool import (
            PooledCredential,
            load_pool,
            AUTH_TYPE_OAUTH,
            SOURCE_MANUAL,
        )
        import uuid as _uuid
        pool = load_pool("openai-codex")
        base_url = (
            os.getenv("HERMES_CODEX_BASE_URL", "").strip().rstrip("/")
            or DEFAULT_CODEX_BASE_URL
        )
        entry = PooledCredential(
            provider="openai-codex",
            id=_uuid.uuid4().hex[:6],
            label="dashboard device_code",
            auth_type=AUTH_TYPE_OAUTH,
            priority=0,
            source=f"{SOURCE_MANUAL}:dashboard_device_code",
            access_token=access_token,
            refresh_token=refresh_token,
            base_url=base_url,
        )
        pool.add_entry(entry)
        with _oauth_sessions_lock:
            sess["status"] = "approved"
        _log.info("oauth/device: openai-codex login completed (session=%s)", session_id)
    except Exception as e:
        _log.warning("codex device-code worker failed (session=%s): %s", session_id, e)
        with _oauth_sessions_lock:
            s = _oauth_sessions.get(session_id)
            if s:
                s["status"] = "error"
                s["error_message"] = str(e)


@app.post("/api/providers/oauth/{provider_id}/start")
async def start_oauth_login(provider_id: str, request: Request):
    """Initiate an OAuth login flow. Token-protected."""
    _require_token(request)
    _gc_oauth_sessions()
    valid = {p["id"] for p in _OAUTH_PROVIDER_CATALOG}
    if provider_id not in valid:
        raise HTTPException(status_code=400, detail=f"Unknown provider {provider_id}")
    catalog_entry = next(p for p in _OAUTH_PROVIDER_CATALOG if p["id"] == provider_id)
    if catalog_entry["flow"] == "external":
        raise HTTPException(
            status_code=400,
            detail=f"{provider_id} uses an external CLI; run `{catalog_entry['cli_command']}` manually",
        )
    try:
        if catalog_entry["flow"] == "pkce":
            return _start_anthropic_pkce()
        if catalog_entry["flow"] == "device_code":
            return await _start_device_code_flow(provider_id)
    except HTTPException:
        raise
    except Exception as e:
        _log.exception("oauth/start %s failed", provider_id)
        raise HTTPException(status_code=500, detail=str(e))
    raise HTTPException(status_code=400, detail="Unsupported flow")


class OAuthSubmitBody(BaseModel):
    session_id: str
    code: str


@app.post("/api/providers/oauth/{provider_id}/submit")
async def submit_oauth_code(provider_id: str, body: OAuthSubmitBody, request: Request):
    """Submit the auth code for PKCE flows. Token-protected."""
    _require_token(request)
    if provider_id == "anthropic":
        return await asyncio.get_event_loop().run_in_executor(
            None, _submit_anthropic_pkce, body.session_id, body.code,
        )
    raise HTTPException(status_code=400, detail=f"submit not supported for {provider_id}")


@app.get("/api/providers/oauth/{provider_id}/poll/{session_id}")
async def poll_oauth_session(provider_id: str, session_id: str):
    """Poll a device-code session's status (no auth — read-only state)."""
    with _oauth_sessions_lock:
        sess = _oauth_sessions.get(session_id)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    if sess["provider"] != provider_id:
        raise HTTPException(status_code=400, detail="Provider mismatch for session")
    return {
        "session_id": session_id,
        "status": sess["status"],
        "error_message": sess.get("error_message"),
        "expires_at": sess.get("expires_at"),
    }


@app.delete("/api/providers/oauth/sessions/{session_id}")
async def cancel_oauth_session(session_id: str, request: Request):
    """Cancel a pending OAuth session. Token-protected."""
    _require_token(request)
    with _oauth_sessions_lock:
        sess = _oauth_sessions.pop(session_id, None)
    if sess is None:
        return {"ok": False, "message": "session not found"}
    return {"ok": True, "session_id": session_id}


# ---------------------------------------------------------------------------
# Session detail endpoints
# ---------------------------------------------------------------------------


@app.get("/api/sessions/{session_id}")
async def get_session_detail(session_id: str):
    from hermes_state import SessionDB
    db = SessionDB()
    try:
        sid = db.resolve_session_id(session_id)
        session = db.get_session(sid) if sid else None
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session
    finally:
        db.close()


@app.get("/api/sessions/{session_id}/messages")
async def get_session_messages(session_id: str):
    from hermes_state import SessionDB
    db = SessionDB()
    try:
        sid = db.resolve_session_id(session_id)
        if not sid:
            raise HTTPException(status_code=404, detail="Session not found")
        messages = db.get_messages(sid)
        return {"session_id": sid, "messages": messages}
    finally:
        db.close()


@app.delete("/api/sessions/{session_id}")
async def delete_session_endpoint(session_id: str):
    from hermes_state import SessionDB
    db = SessionDB()
    try:
        if not db.delete_session(session_id):
            raise HTTPException(status_code=404, detail="Session not found")
        return {"ok": True}
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Log viewer endpoint
# ---------------------------------------------------------------------------


@app.get("/api/logs")
async def get_logs(
    file: str = "agent",
    lines: int = 100,
    level: Optional[str] = None,
    component: Optional[str] = None,
    search: Optional[str] = None,
):
    from hermes_cli.logs import _read_tail, LOG_FILES

    log_name = LOG_FILES.get(file)
    if not log_name:
        raise HTTPException(status_code=400, detail=f"Unknown log file: {file}")
    log_path = get_hermes_home() / "logs" / log_name
    if not log_path.exists():
        return {"file": file, "lines": []}

    try:
        from hermes_logging import COMPONENT_PREFIXES
    except ImportError:
        COMPONENT_PREFIXES = {}

    # Normalize "ALL" / "all" / empty → no filter. _matches_filters treats an
    # empty tuple as "must match a prefix" (startswith(()) is always False),
    # so passing () instead of None silently drops every line.
    min_level = level if level and level.upper() != "ALL" else None
    if component and component.lower() != "all":
        comp_prefixes = COMPONENT_PREFIXES.get(component)
        if comp_prefixes is None:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown component: {component}. "
                       f"Available: {', '.join(sorted(COMPONENT_PREFIXES))}",
            )
    else:
        comp_prefixes = None

    has_filters = bool(min_level or comp_prefixes or search)
    result = _read_tail(
        log_path, min(lines, 500) if not search else 2000,
        has_filters=has_filters,
        min_level=min_level,
        component_prefixes=comp_prefixes,
    )
    # Post-filter by search term (case-insensitive substring match).
    # _read_tail doesn't support free-text search, so we filter here and
    # trim to the requested line count afterward.
    if search:
        needle = search.lower()
        result = [l for l in result if needle in l.lower()][-min(lines, 500):]
    return {"file": file, "lines": result}


# ---------------------------------------------------------------------------
# Cron job management endpoints
# ---------------------------------------------------------------------------


class CronJobCreate(BaseModel):
    prompt: str
    schedule: str
    name: str = ""
    deliver: str = "local"


class CronJobUpdate(BaseModel):
    updates: dict


@app.get("/api/cron/jobs")
async def list_cron_jobs():
    from cron.jobs import list_jobs
    return list_jobs(include_disabled=True)


@app.get("/api/cron/jobs/{job_id}")
async def get_cron_job(job_id: str):
    from cron.jobs import get_job
    job = get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/cron/jobs")
async def create_cron_job(body: CronJobCreate):
    from cron.jobs import create_job
    try:
        job = create_job(prompt=body.prompt, schedule=body.schedule,
                         name=body.name, deliver=body.deliver)
        return job
    except Exception as e:
        _log.exception("POST /api/cron/jobs failed")
        raise HTTPException(status_code=400, detail=str(e))


@app.put("/api/cron/jobs/{job_id}")
async def update_cron_job(job_id: str, body: CronJobUpdate):
    from cron.jobs import update_job
    job = update_job(job_id, body.updates)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/cron/jobs/{job_id}/pause")
async def pause_cron_job(job_id: str):
    from cron.jobs import pause_job
    job = pause_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/cron/jobs/{job_id}/resume")
async def resume_cron_job(job_id: str):
    from cron.jobs import resume_job
    job = resume_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.post("/api/cron/jobs/{job_id}/trigger")
async def trigger_cron_job(job_id: str):
    from cron.jobs import trigger_job
    job = trigger_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.delete("/api/cron/jobs/{job_id}")
async def delete_cron_job(job_id: str):
    from cron.jobs import remove_job
    if not remove_job(job_id):
        raise HTTPException(status_code=404, detail="Job not found")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Experts endpoint (Mock Data)
# ---------------------------------------------------------------------------

_MOCK_EXPERTS = [
    # 设计 (design)
    {"id": "e_d1", "name": "UI/UX 设计专家", "category": "design", "tag": "界面设计", "description": "请作为一名拥有10年经验的UI/UX设计专家，为我评估当前的产品界面并提供至少3条改进转化率的设计建议。"},
    {"id": "e_d2", "name": "品牌视觉顾问", "category": "design", "tag": "品牌", "description": "请扮演资深品牌视觉设计师，根据我提供的产品定位，构思一套完整的品牌色彩规范与排版指南。"},
    {"id": "e_d3", "name": "交互动效导师", "category": "design", "tag": "动效", "description": "作为交互动效专家，请为我的移动端App设计流畅的页面切换与按钮点击反馈，要求提升用户的操作沉浸感。"},
    {"id": "e_d4", "name": "海报排版大师", "category": "design", "tag": "平面设计", "description": "请扮演专业平面设计师，为即将到来的促销活动设计一张海报的视觉层级结构和文案排版布局。"},
    {"id": "e_d5", "name": "设计系统架构师", "category": "design", "tag": "Design System", "description": "作为设计系统架构师，请帮我规划一套适用于React项目的Design System组件库规范，包含色彩、间距和基础组件。"},
    {"id": "e_d6", "name": "用户体验研究员", "category": "design", "tag": "UX研究", "description": "请作为UX研究员，为我的新产品设计一份完整的用户访谈问卷，以挖掘目标用户的核心痛点和使用场景。"},

    # 工程技术 (engineering)
    {"id": "e_e1", "name": "资深前端架构师", "category": "engineering", "tag": "前端架构", "description": "请作为资深前端架构师，为我评估当前React项目的状态管理方案，并对比Zustand与Redux在当前场景下的优劣。"},
    {"id": "e_e2", "name": "Python 后端专家", "category": "engineering", "tag": "后端开发", "description": "作为拥有高并发处理经验的Python后端专家，请帮我审查这段FastAPI代码，并提供性能优化与安全加固建议。"},
    {"id": "e_e3", "name": "DevOps 运维工程师", "category": "engineering", "tag": "DevOps", "description": "请扮演DevOps专家，为我的微服务架构编写一份标准的GitHub Actions CI/CD流水线配置文件。"},
    {"id": "e_e4", "name": "数据库优化专家", "category": "engineering", "tag": "DBA", "description": "作为资深DBA，请帮我分析以下慢查询SQL语句，并给出加索引及重写查询的优化方案。"},
    {"id": "e_e5", "name": "网络安全顾问", "category": "engineering", "tag": "安全", "description": "请作为网络安全顾问，为我的Web应用列出防范XSS、CSRF和SQL注入的具体代码层面防范措施。"},
    {"id": "e_e6", "name": "系统架构师", "category": "engineering", "tag": "系统设计", "description": "请扮演分布式系统架构师，帮我设计一个支持百万日活的电商秒杀系统架构，包含缓存、队列和数据库的设计。"},

    # 市场营销 (marketing)
    {"id": "e_m1", "name": "爆款文案写手", "category": "marketing", "tag": "文案", "description": "请作为小红书/公众号爆款文案专家，根据我的产品特点，写出3个吸引眼球的标题和一篇高转化率的种草文案。"},
    {"id": "e_m2", "name": "SEO 增长黑客", "category": "marketing", "tag": "SEO", "description": "作为SEO增长专家，请为我的独立站制定一份包含关键词研究、内容布局和外链建设的3个月增长计划。"},
    {"id": "e_m3", "name": "社群运营操盘手", "category": "marketing", "tag": "社群", "description": "请扮演资深社群运营，帮我策划一个为期7天的微信群裂变拉新活动方案，包含诱饵设计和话术话术矩阵。"},
    {"id": "e_m4", "name": "短视频编导", "category": "marketing", "tag": "视频营销", "description": "作为短视频爆款编导，请为我的产品写一个15秒的抖音/TikTok短视频脚本，包含画面分镜、旁白和背景音效提示。"},
    {"id": "e_m5", "name": "公关传播专家", "category": "marketing", "tag": "PR", "description": "请作为资深PR专家，为我们即将发布的新产品撰写一份专业的新闻通稿，并列出适合的媒体投放矩阵。"},
    {"id": "e_m6", "name": "营销活动策划", "category": "marketing", "tag": "活动策划", "description": "请扮演品牌营销策划，结合即将到来的节日，帮我设计一套完整的线上+线下整合营销活动方案及预算分配建议。"},

    # 付费媒体 (paid)
    {"id": "e_p1", "name": "信息流投放优化师", "category": "paid", "tag": "投放", "description": "请作为资深信息流优化师，帮我分析目前CTR低的原因，并给出修改落地页及调整定向人群的具体建议。"},
    {"id": "e_p2", "name": "Google Ads 专家", "category": "paid", "tag": "SEM", "description": "作为Google Ads高级投手，请为我的B2B出海业务设计一套包含搜索广告、展示广告的账户结构及出价策略。"},
    {"id": "e_p3", "name": "ROI 数据分析师", "category": "paid", "tag": "数据分析", "description": "请扮演广告ROI分析专家，根据我提供的消耗、转化和客单价数据，建立一个动态监控模型来预警亏损计划。"},
    {"id": "e_p4", "name": "创意素材策划", "category": "paid", "tag": "素材", "description": "作为买量素材策划专家，请帮我构思3个跑量短视频的开头“黄金3秒”钩子，以提升广告停留率。"},
    {"id": "e_p5", "name": "电商直通车车手", "category": "paid", "tag": "电商投放", "description": "请扮演资深淘宝/京东直通车车手，为我的新品打造一份包含测款、打爆和长线维护的7天螺旋起量投放计划。"},
    {"id": "e_p6", "name": "媒体采买顾问", "category": "paid", "tag": "媒介", "description": "作为资深媒介采买，请为我制定一份品牌曝光投放策略，涵盖KOL/KOC组合建议、刊例砍价技巧及效果评估标准。"},

    # 销售 (sales)
    {"id": "e_s1", "name": "B2B 大客户销售", "category": "sales", "tag": "ToB销售", "description": "请作为拥有15年经验的B2B大客户销售总监，帮我撰写一封开发信（Cold Email），用于向世界500强企业的采购总监破冰。"},
    {"id": "e_s2", "name": "销售话术培训师", "category": "sales", "tag": "话术", "description": "作为金牌销售培训师，请针对客户常说的“价格太贵了”、“我再考虑考虑”，为我的团队制定标准的反驳话术与逼单技巧。"},
    {"id": "e_s3", "name": "SCRM 私域销售", "category": "sales", "tag": "私域", "description": "请扮演私域转化专家，为我的高客单价产品设计一套从加微信、日常朋友圈剧本到最终一对一成交的完整SOP。"},
    {"id": "e_s4", "name": "跨境电商销冠", "category": "sales", "tag": "跨境销售", "description": "作为亚马逊/独立站的资深卖家，请帮我优化产品Listing，包括标题埋词、五点描述(Bullet Points)和A+页面文案。"},
    {"id": "e_s5", "name": "客户成功经理 (CSM)", "category": "sales", "tag": "客户成功", "description": "请扮演资深CSM，为SaaS产品设计一套客户Onboarding（引导激活）流程，以降低首月流失率并促进客户续费。"},
    {"id": "e_s6", "name": "销售团队管理专家", "category": "sales", "tag": "销售管理", "description": "作为销售VP，请为我制定一份兼顾公平与狼性的销售薪酬绩效考核方案，包含底薪、提成阶梯及销冠激励机制。"},
]

@app.get("/api/experts")
async def get_experts():
    categories = [
        {"key": "all", "label": "全部"},
        {"key": "design", "label": "设计", "count": 6},
        {"key": "engineering", "label": "工程技术", "count": 6},
        {"key": "marketing", "label": "市场营销", "count": 6},
        {"key": "paid", "label": "付费媒体", "count": 6},
        {"key": "sales", "label": "销售", "count": 6},
    ]
    return {
        "categories": categories,
        "experts": _MOCK_EXPERTS
    }


# ---------------------------------------------------------------------------
# Skills & Tools endpoints
# ---------------------------------------------------------------------------


class SkillToggle(BaseModel):
    name: str
    enabled: bool


@app.get("/api/skills")
async def get_skills():
    from tools.skills_tool import _find_all_skills
    from hermes_cli.skills_config import get_disabled_skills
    config = load_config()
    disabled = get_disabled_skills(config)
    skills = _find_all_skills(skip_disabled=True)
    for s in skills:
        s["enabled"] = s["name"] not in disabled
    return skills


@app.get("/api/skills/{skill_name:path}")
async def get_skill_detail(skill_name: str):
    from tools.skills_tool import skill_view, _is_skill_disabled
    from hermes_cli.skills_config import get_disabled_skills
    import json
    
    # Temporarily un-disable the skill if it's disabled so skill_view can read it
    config = load_config()
    disabled = get_disabled_skills(config)
    was_disabled = skill_name in disabled
    
    # Actually skill_view doesn't accept a "skip_disabled" flag, but it reads from config.
    # We can just mock _is_skill_disabled during the call.
    import unittest.mock
    with unittest.mock.patch("tools.skills_tool._is_skill_disabled", return_value=False):
        result_str = skill_view(skill_name)
        
    try:
        result = json.loads(result_str)
        if not result.get("success"):
            raise HTTPException(status_code=404, detail=result.get("error", "Skill not found"))
        
        # Add enabled status
        result["enabled"] = not was_disabled
        
        return result
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid response from skill_view")


@app.put("/api/skills/toggle")
async def toggle_skill(body: SkillToggle):
    from hermes_cli.skills_config import get_disabled_skills, save_disabled_skills
    config = load_config()
    disabled = get_disabled_skills(config)
    if body.enabled:
        disabled.discard(body.name)
    else:
        disabled.add(body.name)
    save_disabled_skills(config, disabled)
    return {"ok": True, "name": body.name, "enabled": body.enabled}


# ---------------------------------------------------------------------------
# MCP Endpoints
# ---------------------------------------------------------------------------

class McpToggle(BaseModel):
    name: str
    enabled: bool

class McpRawUpdate(BaseModel):
    json_text: str

@app.get("/api/mcp")
async def get_mcp_servers():
    config = load_config()
    servers = config.get("mcp_servers", {})
    
    # Let's get tools info from the backend. We'll use the _probe_single_server
    # from mcp_config to check if we want, but that's slow. We can just return
    # what's in the config, and the frontend will display it.
    
    config_path = get_config_path()
    
    return {
        "servers": servers,
        "config_path": str(config_path)
    }

@app.put("/api/mcp/toggle")
async def toggle_mcp_server(body: McpToggle):
    config = load_config()
    servers = config.get("mcp_servers", {})
    if body.name not in servers:
        raise HTTPException(status_code=404, detail="MCP Server not found")
        
    server_config = servers[body.name]
    tool_names = []
    
    if body.enabled:
        from hermes_cli.mcp_config import _probe_single_server, _unwrap_exception_group
        try:
            tools = await asyncio.get_event_loop().run_in_executor(
                None, _probe_single_server, body.name, server_config
            )
            tool_names = [t[0] for t in tools]
        except Exception as e:
            err = _unwrap_exception_group(e) if hasattr(e, 'exceptions') else e
            raise HTTPException(status_code=400, detail=f"服务连接失败: {str(err)}")
            
    # Instead of 'disabled', hermes_cli uses 'enabled'
    servers[body.name]["enabled"] = body.enabled
    config["mcp_servers"] = servers
    save_config(config)
    return {"ok": True, "name": body.name, "enabled": body.enabled, "tools": tool_names}

@app.get("/api/mcp/{server_name}/tools")
async def get_mcp_server_tools(server_name: str):
    config = load_config()
    servers = config.get("mcp_servers", {})
    if server_name not in servers:
        raise HTTPException(status_code=404, detail="MCP Server not found")
    
    server_config = servers[server_name]
    from hermes_cli.mcp_config import _probe_single_server, _unwrap_exception_group
    try:
        tools = await asyncio.get_event_loop().run_in_executor(
            None, _probe_single_server, server_name, server_config
        )
        return {"ok": True, "tools": [t[0] for t in tools]}
    except Exception as e:
        err = _unwrap_exception_group(e) if hasattr(e, 'exceptions') else e
        raise HTTPException(status_code=400, detail=f"服务连接失败: {str(err)}")

@app.put("/api/mcp/raw")
async def update_mcp_raw(body: McpRawUpdate):
    try:
        parsed = json.loads(body.json_text)
        if "mcpServers" not in parsed:
            raise HTTPException(status_code=400, detail="Missing 'mcpServers' root key")
            
        config = load_config()
        # Convert 'disabled: true' (Cursor/Claude format) back to 'enabled: false' for Hermes
        servers = parsed["mcpServers"]
        for k, v in servers.items():
            if "disabled" in v:
                v["enabled"] = not v["disabled"]
                del v["disabled"]
        
        config["mcp_servers"] = servers
        save_config(config)
        return {"ok": True}
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {e}")


@app.delete("/api/mcp/{server_name}")
async def delete_mcp_server(server_name: str):
    config = load_config()
    servers = config.get("mcp_servers", {})
    if server_name in servers:
        del servers[server_name]
        if not servers:
            config.pop("mcp_servers", None)
        else:
            config["mcp_servers"] = servers
        save_config(config)
        return {"ok": True}
    raise HTTPException(status_code=404, detail="MCP Server not found")


@app.get("/api/tools/toolsets")
async def get_toolsets():
    from hermes_cli.tools_config import (
        _get_effective_configurable_toolsets,
        _get_platform_tools,
        _toolset_has_keys,
    )
    from toolsets import resolve_toolset

    config = load_config()
    enabled_toolsets = _get_platform_tools(
        config,
        "cli",
        include_default_mcp_servers=False,
    )
    result = []
    for name, label, desc in _get_effective_configurable_toolsets():
        try:
            tools = sorted(set(resolve_toolset(name)))
        except Exception:
            tools = []
        is_enabled = name in enabled_toolsets
        result.append({
            "name": name, "label": label, "description": desc,
            "enabled": is_enabled,
            "available": is_enabled,
            "configured": _toolset_has_keys(name, config),
            "tools": tools,
        })
    return result


# ---------------------------------------------------------------------------
# Raw YAML config endpoint
# ---------------------------------------------------------------------------


class RawConfigUpdate(BaseModel):
    yaml_text: str


@app.get("/api/config/raw")
async def get_config_raw():
    path = get_config_path()
    if not path.exists():
        return {"yaml": ""}
    return {"yaml": path.read_text(encoding="utf-8")}


@app.put("/api/config/raw")
async def update_config_raw(body: RawConfigUpdate):
    try:
        parsed = yaml.safe_load(body.yaml_text)
        if not isinstance(parsed, dict):
            raise HTTPException(status_code=400, detail="YAML must be a mapping")
        save_config(parsed)
        return {"ok": True}
    except yaml.YAMLError as e:
        raise HTTPException(status_code=400, detail=f"Invalid YAML: {e}")


# ---------------------------------------------------------------------------
# Token / cost analytics endpoint
# ---------------------------------------------------------------------------


@app.get("/api/analytics/usage")
async def get_usage_analytics(days: int = 30):
    from hermes_state import SessionDB
    db = SessionDB()
    try:
        cutoff = time.time() - (days * 86400)
        cur = db._conn.execute("""
            SELECT date(started_at, 'unixepoch') as day,
                   SUM(input_tokens) as input_tokens,
                   SUM(output_tokens) as output_tokens,
                   SUM(cache_read_tokens) as cache_read_tokens,
                   SUM(reasoning_tokens) as reasoning_tokens,
                   COALESCE(SUM(estimated_cost_usd), 0) as estimated_cost,
                   COALESCE(SUM(actual_cost_usd), 0) as actual_cost,
                   COUNT(*) as sessions
            FROM sessions WHERE started_at > ?
            GROUP BY day ORDER BY day
        """, (cutoff,))
        daily = [dict(r) for r in cur.fetchall()]

        cur2 = db._conn.execute("""
            SELECT model,
                   SUM(input_tokens) as input_tokens,
                   SUM(output_tokens) as output_tokens,
                   COALESCE(SUM(estimated_cost_usd), 0) as estimated_cost,
                   COUNT(*) as sessions
            FROM sessions WHERE started_at > ? AND model IS NOT NULL
            GROUP BY model ORDER BY SUM(input_tokens) + SUM(output_tokens) DESC
        """, (cutoff,))
        by_model = [dict(r) for r in cur2.fetchall()]

        cur3 = db._conn.execute("""
            SELECT SUM(input_tokens) as total_input,
                   SUM(output_tokens) as total_output,
                   SUM(cache_read_tokens) as total_cache_read,
                   SUM(reasoning_tokens) as total_reasoning,
                   COALESCE(SUM(estimated_cost_usd), 0) as total_estimated_cost,
                   COALESCE(SUM(actual_cost_usd), 0) as total_actual_cost,
                   COUNT(*) as total_sessions
            FROM sessions WHERE started_at > ?
        """, (cutoff,))
        totals = dict(cur3.fetchone())

        return {"daily": daily, "by_model": by_model, "totals": totals, "period_days": days}
    finally:
        db.close()


def mount_spa(application: FastAPI):
    """Mount the built SPA. Falls back to index.html for client-side routing.

    The session token is injected into index.html via a ``<script>`` tag so
    the SPA can authenticate against protected API endpoints without a
    separate (unauthenticated) token-dispensing endpoint.
    """
    if not WEB_DIST.exists():
        @application.get("/{full_path:path}")
        async def no_frontend(full_path: str):
            return JSONResponse(
                {"error": "Frontend not built. Run: cd web && npm run build"},
                status_code=404,
            )
        return

    _index_path = WEB_DIST / "index.html"

    def _serve_index():
        """Return index.html with the session token injected."""
        html = _index_path.read_text()
        token_script = (
            f'<script>window.__HERMES_SESSION_TOKEN__="{_SESSION_TOKEN}";</script>'
        )
        html = html.replace("</head>", f"{token_script}</head>", 1)
        return HTMLResponse(
            html,
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    application.mount("/assets", StaticFiles(directory=WEB_DIST / "assets"), name="assets")

    @application.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        file_path = WEB_DIST / full_path
        # Prevent path traversal via url-encoded sequences (%2e%2e/)
        if (
            full_path
            and file_path.resolve().is_relative_to(WEB_DIST.resolve())
            and file_path.exists()
            and file_path.is_file()
        ):
            return FileResponse(file_path)
        return _serve_index()


mount_spa(app)


def start_server(
    host: str = "127.0.0.1",
    port: int = 9119,
    open_browser: bool = True,
    allow_public: bool = False,
):
    """Start the web UI server."""
    import uvicorn

    _LOCALHOST = ("127.0.0.1", "localhost", "::1")
    if host not in _LOCALHOST and not allow_public:
        raise SystemExit(
            f"Refusing to bind to {host} — the dashboard exposes API keys "
            f"and config without robust authentication.\n"
            f"Use --insecure to override (NOT recommended on untrusted networks)."
        )
    if host not in _LOCALHOST:
        _log.warning(
            "Binding to %s with --insecure — the dashboard has no robust "
            "authentication. Only use on trusted networks.", host,
        )

    if open_browser:
        import threading
        import webbrowser

        def _open():
            import time as _t
            _t.sleep(1.0)
            webbrowser.open(f"http://{host}:{port}")

        threading.Thread(target=_open, daemon=True).start()

    print(f"  Hermes Web UI → http://{host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="warning")
