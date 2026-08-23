import json
import sqlite3
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "scores.sqlite3"


def initialize_database():
    with sqlite3.connect(DATABASE) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player TEXT NOT NULL UNIQUE,
                score INTEGER NOT NULL CHECK (score >= 0),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )


class ScoreHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        if self.path == "/scores":
            with sqlite3.connect(DATABASE) as connection:
                connection.row_factory = sqlite3.Row
                rows = connection.execute(
                    "SELECT player, score, created_at FROM scores "
                    "ORDER BY score DESC, created_at ASC LIMIT 10"
                ).fetchall()
            self.send_json(200, {"scores": [dict(row) for row in rows]})
            return

        super().do_GET()

    def do_POST(self):
        if self.path != "/score":
            self.send_json(404, {"error": "Not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(content_length))
            player = str(payload.get("player", "Player")).strip()[:32] or "Player"
            score = int(payload["score"])
            if score < 0:
                raise ValueError("Score must be non-negative")
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Expected a non-negative integer score"})
            return

        with sqlite3.connect(DATABASE) as connection:
            cursor = connection.execute(
                "INSERT INTO scores (player, score) VALUES (?, ?) "
                "ON CONFLICT(player) DO UPDATE SET score = excluded.score, "
                "created_at = CURRENT_TIMESTAMP",
                (player, score),
            )
            connection.commit()
            score_id = cursor.lastrowid

        self.send_json(201, {"id": score_id, "player": player, "score": score})


if __name__ == "__main__":
    initialize_database()
    server = ThreadingHTTPServer(("127.0.0.1", 8000), ScoreHandler)
    print("Score server running at http://127.0.0.1:8000")
    server.serve_forever()
