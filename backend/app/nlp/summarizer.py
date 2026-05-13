from app.ml.router import generate_summary


def summarize_as_bullets(text: str, context: dict | None = None) -> tuple[str, float]:
    return generate_summary(text, context=context)
