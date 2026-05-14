from __future__ import annotations

import asyncio
import logging
import re
import time
from enum import Enum
from typing import Any

import httpx
import torch

from app.core.config import settings
from app.llm.providers.gemini_provider import GeminiProvider
from app.ml.manager import record_inference_result
from app.ml.models import get_cuda_memory_info, get_mistral_bundle, gpu_available

logger = logging.getLogger(__name__)


class InferenceProvider(str, Enum):
    LOCAL_GPU = "local_gpu"
    LOCAL_4BIT = "local_4bit"
    DATABRICKS = "databricks"
    GEMINI = "gemini"
    EXTRACTIVE = "extractive"


def _extract_confidence(text: str, default: float = 0.75) -> float:
    match = re.search(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", text)
    if match:
        return float(match.group(1))
    return default


def _strip_confidence(text: str) -> str:
    return re.sub(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", "", text).strip()


def _extractive_fallback(kind: str, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    context = context or {}
    chunks = [chunk.strip() for chunk in re.split(r"[.!?]\s+", text) if chunk.strip()]
    bullets = chunks[:3] if chunks else [text[:200].strip()]
    summary = "\n".join(f"- {item[:180]}" for item in bullets if item)
    if kind == "mitigation":
        summary = "\n".join(
            [
                "- Increase buffer stock for exposed commodities.",
                "- Validate alternate suppliers and reroute shipments.",
                "- Escalate monitoring on the highest-risk exposure paths.",
            ]
        )
    elif kind == "executive_report":
        organization = context.get("organization") or "your organization"
        summary = (
            f"{organization} should care because the disruption can propagate into supplier, port, and commodity exposure. "
            "Leadership should reroute critical flows, increase buffers, and review alternate sourcing immediately."
        )
    return {
        "summary": summary,
        "confidence": 0.2,
        "provider": InferenceProvider.EXTRACTIVE.value,
        "latency_ms": 0,
        "token_count": len(text.split()),
        "fallback_used": True,
        "error": None,
    }


def _build_prompt(kind: str, text: str, context: dict[str, Any] | None = None) -> tuple[str, str]:
    context_text = f"Context: {context or {}}\n\n"
    base_text = text[:2200]
    if kind == "mitigation":
        prompt = (
            "Generate 3 mitigation actions for the disruption below. Make the actions operational and specific.\n\n"
            f"{context_text}Text:\n{base_text}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are a mitigation planner for supply-chain operations."
    elif kind == "executive_report":
        prompt = (
            "Write a short executive brief explaining why this disruption matters, what is exposed, and what leadership should do next.\n\n"
            f"{context_text}Text:\n{base_text}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are writing for executive decision-makers. Be crisp, causal, and action-oriented."
    else:
        prompt = (
            "Summarize the disruption in 3 concise bullets. Focus on location, delay, and supply chain impact.\n\n"
            f"{context_text}Text:\n{base_text}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are a supply-chain intelligence analyst. Keep the answer operational and concise."
    return prompt, instruction


def _databricks_endpoint_healthy() -> bool:
    if not settings.databricks_host or not settings.databricks_token or not settings.databricks_llm_endpoint:
        return False
    url = f"{settings.databricks_host.rstrip('/')}/api/2.0/serving-endpoints/{settings.databricks_llm_endpoint}"
    headers = {"Authorization": f"Bearer {settings.databricks_token}"}
    try:
        response = httpx.get(url, headers=headers, timeout=5.0)
        response.raise_for_status()
        payload = response.json()
        state = payload.get("state") or {}
        return str(state.get("ready", "")).lower() in {"ready", "true"}
    except Exception:  # noqa: BLE001
        return False


def get_provider_health() -> dict[str, Any]:
    cuda_info = get_cuda_memory_info()
    gemini_ready = bool(settings.gemini_api_key)
    databricks_ready = _databricks_endpoint_healthy()
    return {
        "local_gpu": {
            "available": gpu_available(),
            "free_mb": cuda_info["free_mb"] if cuda_info else None,
            "total_mb": cuda_info["total_mb"] if cuda_info else None,
            "preferred": gpu_available() and (cuda_info is None or cuda_info.get("free_mb", 0) >= settings.mistral_min_free_vram_mb),
        },
        "local_4bit": {
            "available": gpu_available() and settings.allow_local_4bit_fallback,
            "preferred": gpu_available() and settings.allow_local_4bit_fallback and bool(cuda_info) and cuda_info.get("free_mb", 0) < settings.mistral_min_free_vram_mb,
        },
        "databricks": {
            "configured": bool(settings.databricks_host and settings.databricks_token and settings.databricks_llm_endpoint),
            "healthy": databricks_ready,
        },
        "gemini": {
            "configured": gemini_ready,
            "healthy": gemini_ready,
            "model": settings.gemini_model,
        },
        "extractive": {
            "available": True,
        },
    }


def choose_best_provider() -> InferenceProvider:
    cuda_info = get_cuda_memory_info()
    if gpu_available() and cuda_info and cuda_info.get("free_mb", 0) >= settings.mistral_min_free_vram_mb:
        return InferenceProvider.LOCAL_GPU
    if gpu_available() and settings.allow_local_4bit_fallback:
        return InferenceProvider.LOCAL_4BIT
    if settings.databricks_host and settings.databricks_token and settings.databricks_llm_endpoint:
        return InferenceProvider.DATABRICKS
    if settings.gemini_api_key:
        return InferenceProvider.GEMINI
    return InferenceProvider.EXTRACTIVE


def _local_generate(kind: str, text: str, context: dict[str, Any] | None = None, use_4bit: bool = False) -> dict[str, Any]:
    prompt, instruction = _build_prompt(kind, text, context)
    bundle = get_mistral_bundle(use_4bit=use_4bit)
    tokenizer = bundle["tokenizer"]
    model = bundle["model"]

    if getattr(tokenizer, "pad_token", None) is None:
        tokenizer.pad_token = tokenizer.eos_token

    if getattr(tokenizer, "apply_chat_template", None):
        messages = [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ]
        encoded = tokenizer.apply_chat_template(messages, return_tensors="pt", add_generation_prompt=True)
        inputs = {"input_ids": encoded.to(model.device)} if hasattr(encoded, "to") else {"input_ids": encoded}
    else:
        inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=2048)
        inputs = {key: value.to(model.device) for key, value in inputs.items()}

    generated = model.generate(
        **inputs,
        max_new_tokens=settings.llm_max_output_tokens,
        do_sample=False,
        temperature=0.0,
        pad_token_id=tokenizer.eos_token_id,
    )
    decoded = tokenizer.decode(generated[0], skip_special_tokens=True)
    if decoded.startswith(prompt):
        decoded = decoded[len(prompt):].strip()
    return {
        "summary": _strip_confidence(decoded) or decoded.strip(),
        "confidence": _extract_confidence(decoded, default=0.88 if not use_4bit else 0.8),
        "provider": bundle.get("use_4bit") and InferenceProvider.LOCAL_4BIT.value or InferenceProvider.LOCAL_GPU.value,
        "token_count": len(decoded.split()),
    }


def _databricks_generate(kind: str, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    prompt, instruction = _build_prompt(kind, text, context)
    payload = {
        "messages": [
            {"role": "system", "content": instruction},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.0,
        "max_tokens": settings.llm_max_output_tokens,
    }
    url = f"{settings.databricks_host.rstrip('/')}/serving-endpoints/{settings.databricks_llm_endpoint}/invocations"
    headers = {"Authorization": f"Bearer {settings.databricks_token}", "Content-Type": "application/json"}
    response = httpx.post(url, headers=headers, json=payload, timeout=settings.llm_timeout_seconds)
    response.raise_for_status()
    data = response.json()
    text_out = ""
    if isinstance(data, dict):
        if isinstance(data.get("predictions"), list) and data["predictions"]:
            first = data["predictions"][0]
            if isinstance(first, dict):
                text_out = str(first.get("text") or first.get("content") or first.get("summary") or "")
            else:
                text_out = str(first)
        elif isinstance(data.get("choices"), list) and data["choices"]:
            first = data["choices"][0]
            if isinstance(first, dict):
                message = first.get("message") or {}
                text_out = str(message.get("content") or first.get("text") or "")
        elif "text" in data:
            text_out = str(data.get("text") or "")
    return {
        "summary": _strip_confidence(text_out) or text_out.strip(),
        "confidence": _extract_confidence(text_out, default=0.84),
        "provider": InferenceProvider.DATABRICKS.value,
        "token_count": len(text_out.split()),
    }


async def _invoke_provider(provider: InferenceProvider, kind: str, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    if provider is InferenceProvider.LOCAL_GPU:
        return await asyncio.to_thread(_local_generate, kind, text, context, False)
    if provider is InferenceProvider.LOCAL_4BIT:
        return await asyncio.to_thread(_local_generate, kind, text, context, True)
    if provider is InferenceProvider.DATABRICKS:
        return await asyncio.to_thread(_databricks_generate, kind, text, context)
    if provider is InferenceProvider.GEMINI:
        return await asyncio.to_thread(_gemini_generate, kind, text, context)
    return _extractive_fallback(kind, text, context)


def _gemini_generate(kind: str, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    provider = GeminiProvider()
    if kind == "mitigation":
        result = provider.generate_mitigation(text, context)
    elif kind == "executive_report":
        result = provider.generate_executive_report(text, context)
    else:
        result = provider.generate_summary(text, context)
    return {
        "summary": result.get("summary", ""),
        "confidence": float(result.get("confidence", 0.82)),
        "provider": InferenceProvider.GEMINI.value,
        "token_count": int(result.get("token_count") or len(str(result.get("summary", "")).split())),
    }


async def route_intelligence_async(kind: str, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    providers: list[InferenceProvider] = []
    if gpu_available():
        cuda_info = get_cuda_memory_info()
        if cuda_info and cuda_info.get("free_mb", 0) >= settings.mistral_min_free_vram_mb:
            providers.append(InferenceProvider.LOCAL_GPU)
        elif settings.allow_local_4bit_fallback:
            providers.append(InferenceProvider.LOCAL_4BIT)
    if settings.databricks_host and settings.databricks_token and settings.databricks_llm_endpoint:
        providers.append(InferenceProvider.DATABRICKS)
    if settings.gemini_api_key:
        providers.append(InferenceProvider.GEMINI)
    providers.append(InferenceProvider.EXTRACTIVE)

    last_error: Exception | None = None
    for index, provider in enumerate(providers):
        started = time.perf_counter()
        try:
            raw = await asyncio.wait_for(
                _invoke_provider(provider, kind, text, context),
                timeout=float(settings.llm_timeout_seconds),
            )
            latency_ms = (time.perf_counter() - started) * 1000.0
            result = {
                "summary": raw.get("summary", "").strip(),
                "confidence": float(raw.get("confidence", 0.0)),
                "provider": raw.get("provider", provider.value),
                "latency_ms": int(latency_ms),
                "token_count": int(raw.get("token_count") or len(str(raw.get("summary", "")).split())),
                "fallback_used": index > 0,
                "error": None,
            }
            record_inference_result(result["provider"], result["latency_ms"], success=True, fallback_used=index > 0)
            return result
        except Exception as exc:  # noqa: BLE001
            latency_ms = (time.perf_counter() - started) * 1000.0
            record_inference_result(provider.value, latency_ms, success=False, fallback_used=index > 0, error=str(exc))
            logger.warning("Provider %s failed for %s: %s", provider.value, kind, exc)
            last_error = exc

    fallback = _extractive_fallback(kind, text, context)
    fallback["error"] = str(last_error) if last_error else None
    return fallback


async def generate_summary(
    text: str,
    context: dict[str, Any] | None = None,
) -> tuple[str, float]:
    result = await route_intelligence_async("summary", text, context)
    return result["summary"], float(result["confidence"])


async def generate_mitigation(
    text: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return await route_intelligence_async("mitigation", text, context)


async def generate_executive_report(
    text: str,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return await route_intelligence_async("executive_report", text, context)