#!/usr/bin/env python3
"""Minimal OpenAI-compatible TTS server backed by local Piper (CPU, no keys).

Exposes POST /v1/audio/speech with the same shape OpenAI uses, so the video
pipeline's tts() works unchanged:

    TTS_BASE_URL=http://127.0.0.1:5050/v1
    TTS_MODEL=piper
    TTS_API_KEY=local

Run:  python piper_tts_server.py
"""
import io
import os
import subprocess
import wave
from pathlib import Path

from flask import Flask, Response, jsonify, request
from piper import PiperVoice

HERE = Path(__file__).resolve().parent
MODEL_PATH = os.getenv(
    "PIPER_MODEL", str(HERE / "tts_models" / "en_US-lessac-medium.onnx")
)

print(f"[piper-tts] loading voice: {MODEL_PATH}")
VOICE = PiperVoice.load(MODEL_PATH)
print("[piper-tts] voice loaded")

app = Flask(__name__)


def _synthesize_wav_bytes(text):
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        VOICE.synthesize_wav(text, wf)
    return buf.getvalue()


def _wav_to_mp3(wav_bytes):
    proc = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", "pipe:0", "-f", "mp3", "pipe:1"],
        input=wav_bytes, stdout=subprocess.PIPE, check=True,
    )
    return proc.stdout


@app.post("/v1/audio/speech")
def speech():
    data = request.get_json(force=True) or {}
    text = (data.get("input") or "").strip()
    if not text:
        return jsonify({"error": "no input text"}), 400
    fmt = (data.get("response_format") or "mp3").lower()
    wav_bytes = _synthesize_wav_bytes(text)
    if fmt == "wav":
        return Response(wav_bytes, mimetype="audio/wav")
    return Response(_wav_to_mp3(wav_bytes), mimetype="audio/mpeg")


@app.get("/v1/models")
def models():
    return jsonify({"data": [{"id": "piper", "object": "model"}]})


@app.get("/health")
def health():
    return jsonify({"status": "ok", "model": MODEL_PATH})


if __name__ == "__main__":
    port = int(os.getenv("PIPER_PORT", "5050"))
    app.run(host="127.0.0.1", port=port)
