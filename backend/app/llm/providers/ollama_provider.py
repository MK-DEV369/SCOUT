from __future__ import annotations

import re
from typing import Any
import logging
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


def _extract_confidence(text: str) -> float:
    match = re.search(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", text)
    if match:
        return float(match.group(1))
    return 0.85


def _strip_confidence(text: str) -> str:
    return re.sub(r"(?im)^confidence\s*[:=]\s*(0(?:\.\d+)?|1(?:\.0+)?)\s*$", "", text).strip()


class OllamaProvider:
    def __init__(self) -> None:
        self.base_url = "http://localhost:11434"
        self.timeout = float(settings.llm_timeout_seconds)
        self.model = self._select_model()

    def _select_model(self) -> str:
        # Check installed models on local Ollama
        try:
            with httpx.Client(timeout=3.0) as client:
                response = client.get(f"{self.base_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    names = [m.get("name") for m in models if m.get("name")]
                    # Prefer phi3:mini or phi3 first, then llama3.2, llama, or anything not embed
                    for name in ["phi3:mini", "phi3", "llama3.2:3b", "llama3.2", "llama3"]:
                        matched = next((n for n in names if n.startswith(name) or name.startswith(n)), None)
                        if matched:
                            return matched
                    # Fallback to the first model that isn't an embedding model
                    non_embed = [n for n in names if "embed" not in n.lower()]
                    if non_embed:
                        return non_embed[0]
                    if names:
                        return names[0]
        except Exception as e:
            logger.warning("Failed to query Ollama models: %s", e)
        return "phi3:mini"

    def _post(self, prompt: str, system_instruction: str) -> dict[str, Any]:
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_instruction,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "num_predict": settings.llm_max_output_tokens
            }
        }
        with httpx.Client(timeout=self.timeout) as client:
            response = client.post(url, json=payload)
            response.raise_for_status()
            return response.json()

    def _generate(self, task: str, prompt: str, system_instruction: str) -> dict[str, Any]:
        try:
            payload = self._post(prompt, system_instruction)
            text = _strip_confidence(payload.get("response", ""))
            return {
                "summary": text or task,
                "confidence": _extract_confidence(text),
                "provider": f"ollama/{self.model}",
                "token_count": len(text.split()),
                "raw_text": text,
            }
        except Exception as e:
            logger.error("Ollama LLM generation failed: %s", e)
            raise RuntimeError(f"Ollama generation failed: {str(e)}") from e

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
        ctx = context or {}
        summarization_type = ctx.get("summarization_type", "Executive Brief")
        export_length = ctx.get("export_length", "1 Page (Executive Summary)")
        prompt = (
            f"Write a {summarization_type} report for the organization.\n"
            f"The report format/length should target: {export_length}.\n"
            "Explain why this disruption matters, what is exposed, and what leadership should do next.\n\n"
            f"Context: {ctx}\n\n"
            f"Text:\n{text[:2200]}\n\n"
            "Return a confidence line on its own line: Confidence: 0.00"
        )
        instruction = "You are writing for executive decision-makers. Be crisp, causal, and action-oriented."
        return self._generate("executive report", prompt, instruction)
