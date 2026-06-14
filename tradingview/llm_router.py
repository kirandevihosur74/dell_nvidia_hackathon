# llm_router.py
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# --- 1.  Two physical clients ----------------------------------------------
remote_client = OpenAI(                                   # real OpenAI
    api_key=os.getenv("OPENAI_API_KEY")
)

ollama_client = OpenAI(                                   # your Ollama server
    base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
    api_key=os.getenv("OLLAMA_API_KEY", "ollama"),
)

DEFAULT_MODEL = 'gpt-4o'        # or keep gpt‑4o

# --- 2.  Decide which client to use for each request ------------------------
LOCAL_MODELS = {
    m.strip(): ollama_client
    for m in os.getenv("LOCAL_MODELS", "").split(",") if m.strip()
}

def chat_completion(*, model: str | None, messages: list, stream=False, **kwargs):
    if model is None:
        model = DEFAULT_MODEL

    client = LOCAL_MODELS.get(model, remote_client)

    if stream:
        return client.chat.completions.create(
            model=model,
            messages=messages,
            stream=True,
            **kwargs
        )
    else:
        return client.chat.completions.create(
            model=model,
            messages=messages,
            **kwargs
        )

