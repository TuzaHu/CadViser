#!/usr/bin/env python3
"""
Simple HTTP server for testing the Interactive Assembly Viewer
Run this script to serve the assembly viewer locally
"""

import http.server
import socketserver
import os
import sys
import argparse

# Parse command-line arguments for port
parser = argparse.ArgumentParser(description="Interactive Assembly Viewer Server")
parser.add_argument('--port', type=int, default=8080, help="Port to run the server on")
args = parser.parse_args()

# Change to the directory containing this script
os.chdir(os.path.dirname(os.path.abspath(__file__)))

PORT = args.port

# Custom MIME types for OBJ files
mimetypes = {
    '.obj': 'text/plain',
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css'
}

class CustomHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Add CORS headers for local development
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

    def log_message(self, format, *args):
        print(f"[{self.log_date_time_string()}] {format % args}")

    def guess_type(self, path):
        # Override MIME type for specific file extensions
        ext = os.path.splitext(path)[1].lower()
        return mimetypes.get(ext, super().guess_type(path))

if __name__ == "__main__":
    print(f"🚀 Starting Interactive Assembly Viewer Server...")
    print(f"📁 Serving directory: {os.getcwd()}")
    print(f"🌐 Server running at: http://localhost:{PORT}")
    print(f"🔧 Assembly Viewer: http://localhost:{PORT}/assembly-viewer.html")
    print(f"📦 OBJ File: http://localhost:{PORT}/PipeAssembly.obj")
    print(f"\nPress Ctrl+C to stop the server")
    print("-" * 50)
    
    try:
        with socketserver.TCPServer(("", PORT), CustomHTTPRequestHandler) as httpd:
            httpd.serve_forever()
    except KeyboardInterrupt:
        print(f"\n🛑 Server stopped by user")
    except OSError as e:
        if e.errno == 98:  # Address already in use
            print(f"❌ Port {PORT} is already in use. Try a different port using --port <number>.")
            sys.exit(1)
        else:
            raise