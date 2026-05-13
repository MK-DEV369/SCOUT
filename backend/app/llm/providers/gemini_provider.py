from __future__ import annotations

import re
from typing import Any

import httpx

from app.core.config import settings


def _extract_text(payload: dict[str, Any]) -> str:
    candidates = payload.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    text = " ".join(str(part.get("text", "")) for part in parts if isinstance(part, dict))
    return text.strip()


def _extract_confidence(text: str) -> float:
    match = re.search(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", text)
    if match:
        return float(match.group(1))
    return 0.82


def _strip_confidence(text: str) -> str:
    return re.sub(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", "", text).strip()


class GeminiProvider:
    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise RuntimeError("Gemini API key is not configured")
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model
        self.timeout = float(settings.llm_timeout_seconds)

    def _post(self, prompt: str, system_instruction: str) -> dict[str, Any]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": settings.llm_max_output_tokens,
            },
        }
        if system_instruction:
            payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, params={"key": self.api_key}, json=payload)
            response.raise_for_status()
            return response.json()

    def _generate(self, task: str, prompt: str, system_instruction: str) -> dict[str, Any]:
        payload = self._post(prompt, system_instruction)
        text = _strip_confidence(_extract_text(payload))
        token_count = None
        usage = payload.get("usageMetadata") or {}
        if isinstance(usage, dict):
            token_count = usage.get("totalTokenCount") or usage.get("promptTokenCount")
        return {
            "summary": text or task,
            "confidence": _extract_confidence(text),
            "provider": "gemini",
            "token_count": int(token_count) if token_count is not None else len(text.split()),
            "raw_text": text,
        }

    def generate_summary(self, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        prompt = (
            "Summarize the disruption in 3 concise bullets. Focus on location, delay, and supply chain impact.\n\n"
            f"Context: {context or {}}\n\n"
            f"Text:\n{text[:2200]}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are a supply-chain intelligence analyst. Keep the answer operational and concise."
        return self._generate("summary", prompt, instruction)

    def generate_mitigation(self, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        prompt = (
            "Generate 3 mitigation actions for the disruption below. Make the actions operational and specific.\n\n"
            f"Context: {context or {}}\n\n"
            f"Text:\n{text[:2200]}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are a mitigation planner for supply-chain operations."
        return self._generate("mitigation", prompt, instruction)

    def generate_executive_report(self, text: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
        prompt = (
            "Write a short executive brief explaining why this disruption matters, what is exposed, and what leadership should do next.\n\n"
            f"Context: {context or {}}\n\n"
            f"Text:\n{text[:2200]}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are writing for executive decision-makers. Be crisp, causal, and action-oriented."
        return self._generate("executive report", prompt, instruction)