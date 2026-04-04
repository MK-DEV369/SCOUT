from functools import lru_cache
import os

import torch
from transformers import AutoModelForCausalLM, AutoModelForSequenceClassification, AutoTokenizer

DISTILBERT_MODEL_ID = "distilbert-base-uncased"
MISTRAL_MODEL_ID = "mistralai/Mistral-7B-Instruct-v0.2"


def gpu_available() -> bool:
    return torch.cuda.is_available()


def get_runtime_device() -> str:
    return "cuda:0" if gpu_available() else "cpu"


@lru_cache(maxsize=1)
def get_distilbert_bundle() -> dict:
    tokenizer = AutoTokenizer.from_pretrained(DISTILBERT_MODEL_ID)
    model = AutoModelForSequenceClassification.from_pretrained(DISTILBERT_MODEL_ID)
    if gpu_available():
        model = model.to("cuda:0")
    return {
        "tokenizer": tokenizer,
        "model": model,
        "model_id": DISTILBERT_MODEL_ID,
        "device": get_runtime_device(),
    }


@lru_cache(maxsize=1)
def get_mistral_bundle() -> dict:
    tokenizer = AutoTokenizer.from_pretrained(MISTRAL_MODEL_ID)
    use_4bit = os.getenv("MISTRAL_USE_4BIT", "false").lower() in {"1", "true", "yes"}

    if gpu_available():
        model_kwargs = {
            "torch_dtype": torch.float16,
            "device_map": "cuda:0",
            "low_cpu_mem_usage": True,
        }
        if use_4bit:
            model_kwargs["load_in_4bit"] = True
        model = AutoModelForCausalLM.from_pretrained(MISTRAL_MODEL_ID, **model_kwargs)
    else:
        model = AutoModelForCausalLM.from_pretrained(
            MISTRAL_MODEL_ID,
            torch_dtype=torch.float32,
            device_map="cpu",
            low_cpu_mem_usage=True,
        )

    return {
        "tokenizer": tokenizer,
        "model": model,
        "model_id": MISTRAL_MODEL_ID,
        "device": get_runtime_device(),
        "use_4bit": use_4bit,
    }
