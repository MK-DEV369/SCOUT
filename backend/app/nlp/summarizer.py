async def summarize_as_bullets(text: str, context: dict | None = None) -> tuple[str, float]:
    from app.ml.router import generate_summary
    return await generate_summary(text, context=context)
