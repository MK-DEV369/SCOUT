from functools import lru_cache
import re

import torch
from transformers import pipeline

from app.core.config import settings


@lru_cache(maxsize=1)
def get_summarizer():
    device = 0 if torch.cuda.is_available() else -1
    return pipeline(
        task="text-generation",
        model=settings.summarizer_model,
        max_new_tokens=110,
        do_sample=False,
        device=device,
    )


def summarize_as_bullets(text: str) -> str:
    if not settings.use_llm_summarizer:
        chunks = [c.strip() for c in re.split(r"[.!?]\s+", text) if c.strip()]
        bullets = chunks[:3] if chunks else [text[:200].strip()]
        return "\n".join(f"- {item[:180]}" for item in bullets)

    prompt = (
        "Summarize the disruption news into 3 short bullet points with operational impact. "
        "Focus on location, delay duration, and supply chain impact.\n\n"
        f"Article:\n{text[:2200]}\n\n"
        "Answer format:\n"
        "- ...\n- ...\n- ..."
    )
    result = get_summarizer()(prompt)[0]["generated_text"]
    # Keep only the generated part after prompt when model echoes input.
    if result.startswith(prompt):
        result = result[len(prompt):].strip()
    return result.strip()
