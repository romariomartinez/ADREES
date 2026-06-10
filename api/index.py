from http.server import BaseHTTPRequestHandler
from pathlib import Path
import json
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

try:
    from app import AppHandler
    IMPORT_ERROR = None
except BaseException as exc:
    AppHandler = None
    IMPORT_ERROR = exc


def safe_text(exc):
    text = str(exc) or exc.__class__.__name__
    return re.sub(r"(postgres(?:ql)?://[^:\s]+:)[^@\s]+@", r"\1***@", text)


class handler(BaseHTTPRequestHandler):
    def send_import_error(self):
        payload = {
            "ok": False,
            "errors": [
                {
                    "message": "La funcion de Vercel no pudo cargar el backend.",
                    "detail": f"{IMPORT_ERROR.__class__.__name__}: {safe_text(IMPORT_ERROR)}",
                }
            ],
        }
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(500)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        self.send_import_error()

    def do_POST(self):
        self.send_import_error()

    def do_DELETE(self):
        self.send_import_error()


if AppHandler is not None:
    for name, value in AppHandler.__dict__.items():
        if name.startswith("__") or name == "handle_one_request":
            continue
        setattr(handler, name, value)

app = handler
application = handler
