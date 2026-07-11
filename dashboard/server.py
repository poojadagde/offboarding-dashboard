import json
import os
import re
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOGS_DIR = ROOT / "offboarding_data" / "Logs"
MANUAL_DIR = ROOT / "offboarding_data" / "Manual Off-Boardings"
HISTORY_JSON = ROOT / "offboarding_data" / "offboarding-history.json"


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/offboarding-logs":
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            payload = self.load_records()
            self.wfile.write(json.dumps(payload).encode("utf-8"))
            return

        if self.path == "/api/offboard-user":
            self.send_response(HTTPStatus.METHOD_NOT_ALLOWED)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Use POST to submit an offboarding request."}).encode("utf-8"))
            return

        if self.path in {"/", "/index.html"}:
            index_path = ROOT / "index.html"
            content = index_path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        file_path = ROOT / self.path.lstrip("/")
        if file_path.exists() and file_path.is_file():
            content = file_path.read_bytes()
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", self.content_type_for(file_path))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(content)
            return

        self.send_response(HTTPStatus.NOT_FOUND)
        self.end_headers()

    def content_type_for(self, path: Path) -> str:
        if path.suffix.lower() == ".css":
            return "text/css; charset=utf-8"
        if path.suffix.lower() == ".js":
            return "application/javascript; charset=utf-8"
        if path.suffix.lower() == ".json":
            return "application/json; charset=utf-8"
        return "application/octet-stream"

    def do_POST(self):
        if self.path != "/api/offboard-user":
            self.send_response(HTTPStatus.NOT_FOUND)
            self.end_headers()
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8") if content_length else "{}"
        payload = json.loads(body) if body else {}

        username = (payload.get("username") or "").strip()
        if not username:
            self.send_response(HTTPStatus.BAD_REQUEST)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Username is required."}).encode("utf-8"))
            return

        LOGS_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%d-%b-%Y")
        log_path = LOGS_DIR / f"Offboard_{username}_{timestamp}.log"
        log_path.write_text(
            f"Username: {username}\nManager: {payload.get('managerName', '').strip()}\n"
            f"Expiration confirmation: {payload.get('expirationConfirmation', '').strip()}\n"
            f"Disable confirmation: {payload.get('disableConfirmation', '').strip()}\n"
            f"Script executed by: {os.getenv('USERNAME', 'dashboard')} on {datetime.now().strftime('%d-%b-%Y %H:%M:%S')}\n",
            encoding="utf-8"
        )

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"message": f"Offboarding request submitted for {username}."}).encode("utf-8"))

    def load_records(self):
        records = []

        if HISTORY_JSON.exists():
            try:
                payload = json.loads(HISTORY_JSON.read_text(encoding="utf-8"))
                if isinstance(payload, list):
                    return payload
            except Exception:
                pass

        if not LOGS_DIR.exists():
            return []

        for path in sorted(LOGS_DIR.iterdir(), key=lambda item: item.name.lower()):
            if not path.is_file() or path.suffix.lower() != ".log":
                continue

            name = path.name
            employee_name = self.extract_employee_name(name)
            date_time = self.extract_date_time(name)
            offboarded_by = self.extract_offboarded_by(path)

            if employee_name or date_time or offboarded_by:
                records.append({
                    "employeeName": employee_name,
                    "dateTime": date_time,
                    "offboardedBy": offboarded_by,
                })

        if MANUAL_DIR.exists():
            for path in sorted(MANUAL_DIR.iterdir(), key=lambda item: item.name.lower()):
                if not path.is_file():
                    continue
                records.append({
                    "employeeName": path.stem,
                    "dateTime": datetime.fromtimestamp(path.stat().st_mtime).strftime("%d-%b-%Y"),
                    "offboardedBy": "Manual"
                })

        return records

    def extract_employee_name(self, name: str) -> str:
        stem = Path(name).stem
        match = re.match(r"^(?:Offboard_|TERM_)?\s*(.*?)\s*_(\d{1,2}-[A-Za-z]{3}-\d{4})$", stem, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return ""

    def extract_date_time(self, name: str) -> str:
        stem = Path(name).stem
        match = re.search(r"(\d{1,2}-[A-Za-z]{3}-\d{4})", stem)
        if match:
            return match.group(1)
        return ""

    def extract_offboarded_by(self, path: Path) -> str:
        try:
            content = path.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            return "Unknown"

        matches = re.findall(r"Script executed by:\s*(.+?)\s+on\s+", content)
        if matches:
            return matches[-1].strip()
        return "Unknown"


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8001), Handler)
    print("Serving dashboard on http://127.0.0.1:8001")
    server.serve_forever()
