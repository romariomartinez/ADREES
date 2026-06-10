from pathlib import Path
import sys
from http.server import BaseHTTPRequestHandler

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import AppHandler


class handler(BaseHTTPRequestHandler):
    pass


for name, value in AppHandler.__dict__.items():
    if not name.startswith("__"):
        setattr(handler, name, value)
