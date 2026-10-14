#!/usr/bin/env python3
"""
Lokaler Vosk-Server für die Diagnose-Seite („an der Stelle“-Zähler).

Die Webseite schickt Mikrofon-Audio (16 kHz, 16 Bit, mono) per WebSocket hierher.
Zwei Vosk-Erkenner laufen parallel auf demselben Audio:

  kws  – Grammatik-Modus: kennt nur die vorgegebenen Phrasen (z. B. „an der stelle“)
         und „[unk]“ für alles andere. Sucht also gezielt nach dem Schlüsselwort.
  free – freie Erkennung (optional), zum Vergleich mit Chrome.

Alles läuft offline auf diesem Rechner; nichts verlässt den Mac.

Start:   ./vosk/start.sh            (legt beim ersten Mal eine Python-Umgebung an)
Optionen: --port 2700  --model klein|gross|<Pfad>  --host 127.0.0.1

Protokoll (JSON-Textnachrichten, Audio als Binärnachrichten):
  Browser -> Server  {"type":"config","sampleRate":16000,"grammar":["an der stelle","[unk]"],"free":true}
                     danach Binär: Int16 little-endian PCM
                     {"type":"reset"}  – Erkenner zurücksetzen
  Server -> Browser  {"type":"hello","model":...}
                     {"type":"partial","rec":"kws"|"free","text":...}
                     {"type":"final","rec":"kws"|"free","text":...,"words":[{"word","conf","start","end"}]}
                     {"type":"error","message":...}
"""
import argparse
import asyncio
import json
import sys

try:
    import websockets
    from vosk import KaldiRecognizer, Model, SetLogLevel
except ImportError as e:  # pragma: no cover
    sys.exit("Fehlende Pakete (%s). Bitte über ./vosk/start.sh starten." % e)

MODELS = {
    "klein": "vosk-model-small-de-0.15",   # ~45 MB, schnell
    "gross": "vosk-model-de-0.21",         # ~1,9 GB, deutlich genauer, braucht mehr RAM
}
DEFAULT_GRAMMAR = ["an der stelle", "an dieser stelle", "[unk]"]


def load_model(which):
    SetLogLevel(-1)
    name = MODELS.get(which)
    print("Lade Vosk-Modell %s … (beim ersten Mal wird es heruntergeladen)" % (name or which), flush=True)
    model = Model(model_name=name) if name else Model(which)
    print("Modell geladen.", flush=True)
    return model, (name or which)


class Session:
    def __init__(self, model):
        self.model = model
        self.rate = 16000
        self.grammar = DEFAULT_GRAMMAR
        self.free_on = True
        self.kws = None
        self.free = None
        self.last_partial = {}

    def configure(self, cfg):
        self.rate = int(cfg.get("sampleRate", self.rate))
        g = cfg.get("grammar")
        if isinstance(g, list) and g:
            self.grammar = [str(x).strip().lower() for x in g if str(x).strip()]
            if "[unk]" not in self.grammar:
                self.grammar.append("[unk]")
        self.free_on = bool(cfg.get("free", self.free_on))
        self.reset()

    def reset(self):
        self.kws = KaldiRecognizer(self.model, self.rate, json.dumps(self.grammar, ensure_ascii=False))
        self.kws.SetWords(True)
        self.free = None
        if self.free_on:
            self.free = KaldiRecognizer(self.model, self.rate)
            self.free.SetWords(True)
        self.last_partial = {}

    def feed(self, data):
        """Audio verarbeiten (läuft in einem Hilfs-Thread) und Nachrichten zurückgeben."""
        out = []
        for name, rec in (("kws", self.kws), ("free", self.free)):
            if rec is None:
                continue
            if rec.AcceptWaveform(data):
                res = json.loads(rec.Result())
                text = res.get("text", "")
                if text:
                    out.append({"type": "final", "rec": name, "text": text, "words": res.get("result", [])})
                self.last_partial[name] = ""
            else:
                text = json.loads(rec.PartialResult()).get("partial", "")
                if text != self.last_partial.get(name):
                    self.last_partial[name] = text
                    out.append({"type": "partial", "rec": name, "text": text})
        return out


async def handler(ws, path=None, model=None, model_name=""):
    sess = Session(model)
    sess.reset()
    peer = getattr(ws, "remote_address", "?")
    print("Verbunden: %s" % (peer,), flush=True)
    await ws.send(json.dumps({"type": "hello", "model": model_name, "grammar": sess.grammar}))
    loop = asyncio.get_running_loop()
    try:
        async for msg in ws:
            if isinstance(msg, (bytes, bytearray)):
                for m in await loop.run_in_executor(None, sess.feed, bytes(msg)):
                    await ws.send(json.dumps(m, ensure_ascii=False))
                continue
            try:
                cfg = json.loads(msg)
            except ValueError:
                continue
            if cfg.get("type") == "config":
                try:
                    sess.configure(cfg)
                    await ws.send(json.dumps({"type": "hello", "model": model_name, "grammar": sess.grammar}))
                except Exception as e:  # z. B. Wort nicht im Wortschatz des Modells
                    await ws.send(json.dumps({"type": "error", "message": "Konfiguration: %s" % e}))
            elif cfg.get("type") == "reset":
                sess.reset()
    except websockets.ConnectionClosed:
        pass
    finally:
        print("Getrennt: %s" % (peer,), flush=True)


async def main():
    ap = argparse.ArgumentParser(description="Lokaler Vosk-Server für die Diagnose-Seite")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=2700)
    ap.add_argument("--model", default="klein", help="klein | gross | Pfad zu einem entpackten Vosk-Modell")
    args = ap.parse_args()

    model, name = load_model(args.model)

    async def h(ws, path=None):
        await handler(ws, path, model=model, model_name=name)

    try:
        server = await websockets.serve(h, args.host, args.port, max_size=2 ** 22)
    except OSError as e:
        sys.exit("Port %d ist schon belegt (%s).\nLäuft der Vosk-Server schon in einem anderen Terminal? "
                 "Sonst mit --port 2701 starten und die Seite mit diagnose.html?vosk=ws://127.0.0.1:2701 öffnen." % (args.port, e.strerror))
    async with server:
        print("Vosk-Server läuft auf ws://%s:%d – jetzt die Diagnose-Seite öffnen. (Beenden: Strg+C)" % (args.host, args.port), flush=True)
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nBeendet.")
