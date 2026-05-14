"""Small evaluation harness for the event classifier.
Usage:
    python -m app.training.evaluate_classifier --file path/to/labeled.jsonl

The labeled file should be newline-delimited JSON objects with keys: `text` and `label`.
If `scikit-learn` is not installed the script will print instructions.
"""
import argparse
import json
from pathlib import Path
from typing import Any

from app.nlp.event_classifier import classify_event


def _extract_label(prediction: Any) -> str:
    if isinstance(prediction, dict):
        label = prediction.get("primary_category")
        if label:
            return str(label)
        return "economic_stress"

    if isinstance(prediction, (list, tuple)) and prediction:
        return str(prediction[0])

    return "economic_stress"


def evaluate_from_file(path: Path) -> None:
    try:
        from sklearn.metrics import classification_report
    except Exception:
        print("scikit-learn is required for evaluation: pip install scikit-learn")
        return

    y_true = []
    y_pred = []

    with path.open("r", encoding="utf-8") as fh:
        for line in fh:
            item = json.loads(line)
            text = item.get("text")
            label = item.get("label")
            if not text or not label:
                continue
            prediction = classify_event(text)
            y_true.append(label)
            y_pred.append(_extract_label(prediction))

    print(classification_report(y_true, y_pred, digits=4))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True, help="Path to labeled JSONL file")
    args = parser.parse_args()
    p = Path(args.file)
    if not p.exists():
        print("File not found:", p)
    else:
        evaluate_from_file(p)
