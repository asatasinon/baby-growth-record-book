import httpx

from app.core.config import Settings, get_settings


def _validate_llm_settings(settings: Settings) -> None:
    if settings.llm_base_url and settings.llm_api_key:
        return
    raise RuntimeError("llm config missing (LLM_BASE_URL/LLM_API_KEY)")


def generate_text(prompt: str) -> tuple[str, int | None]:
    settings = get_settings()
    _validate_llm_settings(settings)
    url = settings.llm_base_url.rstrip("/") + "/chat/completions"
    body = {
        "model": settings.llm_model or "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": "你是婴儿成长记录助手。输出要准确、简洁。"},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {settings.llm_api_key}"}

    with httpx.Client(timeout=20.0) as client:
        response = client.post(url, json=body, headers=headers)
    response.raise_for_status()
    payload = response.json()

    answer = str(payload["choices"][0]["message"]["content"]).strip()
    usage = payload.get("usage") or {}
    total_tokens = usage.get("total_tokens")
    return answer, int(total_tokens) if isinstance(total_tokens, int) else None
