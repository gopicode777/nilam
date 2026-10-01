import http.server, socketserver, webbrowser
PORT = 8000
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
with socketserver.TCPServer(("", PORT), H) as s:
    print(f"Serving on http://localhost:{PORT}  (Ctrl+C to stop)")
    webbrowser.open(f"http://localhost:{PORT}")
    s.serve_forever()
