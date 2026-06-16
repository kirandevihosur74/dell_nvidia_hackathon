# llm_router.py
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

# --- 1.  Two physical clients ----------------------------------------------
remote_client = OpenAI(                                   # real OpenAI
    api_key=os.getenv("OPENAI_API_KEY")
)

ollama_client = OpenAI(                                   # your Ollama server (GB10)
    base_url=os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434/v1"),
    api_key=os.getenv("OLLAMA_API_KEY", "ollama"),
)

openrouter_client = OpenAI(                               # OpenRouter (hosted Nemotron, etc.)
    base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
    api_key=os.getenv("OPENROUTER_API_KEY", ""),
    default_headers={                                     # OpenRouter attribution headers
        "HTTP-Referer": os.getenv("OPENROUTER_REFERER",
                                  "https://github.com/kirandevihosur74/dell_nvidia_hackathon"),
        "X-Title": os.getenv("OPENROUTER_TITLE", "OpenBell"),
    },
)

# Named providers so callers can pick a physical backend by string.
PROVIDERS = {
    "openai": remote_client,
    "local": ollama_client,        # GB10 / local Ollama
    "ollama": ollama_client,
    "gb10": ollama_client,
    "nemotron": ollama_client,
    "openrouter": openrouter_client,
}

def get_client(provider):
    """Return the OpenAI-compatible client for a provider name (default OpenAI)."""
    return PROVIDERS.get((provider or "").strip().lower(), remote_client)

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

