import http.server
import socketserver
import webbrowser
import os
import sys

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

def run():
    os.chdir(DIRECTORY)
    server_address = ("", PORT)
    try:
        with socketserver.TCPServer(server_address, Handler) as httpd:
            url = f"http://localhost:{PORT}"
            print("=" * 70)
            print(" ❄️  Smart Cooling Vest 3D Digital Twin Server")
            print(f" 🌐  Server Running at: {url}")
            print(" 🚀  Opening browser automatically...")
            print(" 🛑  Press Ctrl+C to stop the server")
            print("=" * 70)
            webbrowser.open(url)
            httpd.serve_forever()
    except OSError as e:
        if e.errno == 98 or e.errno == 10048:
            alt_port = 8081
            print(f"Port {PORT} busy, trying {alt_port}...")
            with socketserver.TCPServer(("", alt_port), Handler) as httpd:
                url = f"http://localhost:{alt_port}"
                print(f"🌐 Server Running at: {url}")
                webbrowser.open(url)
                httpd.serve_forever()
        else:
            raise e

if __name__ == "__main__":
    run()
