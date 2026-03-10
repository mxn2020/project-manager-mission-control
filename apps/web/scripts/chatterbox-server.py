#!/usr/bin/env python3
"""
Chatterbox TTS Local Server
═══════════════════════════
Wraps Chatterbox TTS as a simple HTTP API for Mission Control.

Setup:
    pip install chatterbox-tts flask

Usage:
    python chatterbox-server.py [--port 8100] [--device cuda]

Endpoints:
    POST /tts          — Synthesize speech from text
    GET  /health       — Health check
    GET  /voices       — List available models
"""

import argparse
import io
import json
import os
import sys
import traceback

try:
    from flask import Flask, request, jsonify, send_file
except ImportError:
    print("Flask not installed. Run: pip install flask")
    sys.exit(1)

app = Flask(__name__)

# ─── Global Model Cache ──────────────────────────────────────────────────

models = {}
device = "cuda"


def get_model(model_name: str):
    """Lazy-load models on first use."""
    if model_name in models:
        return models[model_name]

    try:
        if model_name == "chatterbox-turbo":
            from chatterbox.tts_turbo import ChatterboxTurboTTS
            m = ChatterboxTurboTTS.from_pretrained(device=device)
        elif model_name == "chatterbox-multilingual":
            from chatterbox.mtl_tts import ChatterboxMultilingualTTS
            m = ChatterboxMultilingualTTS.from_pretrained(device=device)
        else:  # default "chatterbox"
            from chatterbox.tts import ChatterboxTTS
            m = ChatterboxTTS.from_pretrained(device=device)

        models[model_name] = m
        print(f"✅ Loaded model: {model_name}")
        return m
    except Exception as e:
        print(f"❌ Failed to load {model_name}: {e}")
        raise


# ─── Endpoints ────────────────────────────────────────────────────────────

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "device": device,
        "loaded_models": list(models.keys()),
    })


@app.route("/voices", methods=["GET"])
def voices():
    return jsonify({
        "models": [
            {
                "name": "chatterbox",
                "displayName": "Chatterbox (English)",
                "languages": ["en"],
                "supportsVoiceCloning": True,
            },
            {
                "name": "chatterbox-turbo",
                "displayName": "Chatterbox Turbo (English, fast)",
                "languages": ["en"],
                "supportsVoiceCloning": True,
                "supportsParalinguisticTags": True,
            },
            {
                "name": "chatterbox-multilingual",
                "displayName": "Chatterbox Multilingual (23 languages)",
                "languages": [
                    "ar", "da", "de", "el", "en", "es", "fi", "fr",
                    "he", "hi", "it", "ja", "ko", "ms", "nl", "no",
                    "pl", "pt", "ru", "sv", "sw", "tr", "zh",
                ],
                "supportsVoiceCloning": True,
            },
        ]
    })


@app.route("/tts", methods=["POST"])
def tts():
    try:
        data = request.json or {}
        text = data.get("text", "")
        model_name = data.get("model", "chatterbox")
        language = data.get("language", "en")
        ref_audio_b64 = data.get("reference_audio")

        if not text:
            return jsonify({"error": "No text provided"}), 400

        model = get_model(model_name)

        # Handle reference audio for voice cloning
        ref_path = None
        if ref_audio_b64:
            import base64
            import tempfile
            audio_bytes = base64.b64decode(ref_audio_b64)
            tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
            tmp.write(audio_bytes)
            tmp.close()
            ref_path = tmp.name

        # Generate audio
        import torchaudio as ta

        kwargs = {}
        if ref_path:
            kwargs["audio_prompt_path"] = ref_path

        if model_name == "chatterbox-multilingual" and language != "en":
            kwargs["language_id"] = language

        wav = model.generate(text, **kwargs)

        # Clean up temp file
        if ref_path:
            os.unlink(ref_path)

        # Convert to WAV bytes
        buf = io.BytesIO()
        ta.save(buf, wav, model.sr, format="wav")
        buf.seek(0)

        return send_file(
            buf,
            mimetype="audio/wav",
            as_attachment=False,
            download_name="speech.wav",
        )

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


# ─── Main ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chatterbox TTS Server")
    parser.add_argument("--port", type=int, default=8100, help="Port (default: 8100)")
    parser.add_argument("--device", default="cuda", help="Device: cuda or cpu (default: cuda)")
    parser.add_argument("--host", default="0.0.0.0", help="Host (default: 0.0.0.0)")
    args = parser.parse_args()

    device = args.device
    print(f"🎤 Chatterbox TTS Server starting on {args.host}:{args.port} (device: {device})")
    print(f"   Models will be loaded on first request.")
    print(f"   Health: http://localhost:{args.port}/health")
    print(f"   Voices: http://localhost:{args.port}/voices")

    app.run(host=args.host, port=args.port, debug=False)
