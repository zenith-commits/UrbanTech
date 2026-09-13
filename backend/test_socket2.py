import socket
import threading
import time

def server():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(('127.0.0.1', 8001))
    s.listen(5)
    print('Test server listening on 8001...')
    conn, addr = s.accept()
    print('Connection from', addr)
    data = conn.recv(1024)
    print('Received:', data)
    conn.send(b'HTTP/1.1 200 OK\r\n\r\n{"status": "ok"}')
    conn.close()

t = threading.Thread(target=server, daemon=True)
t.start()
time.sleep(0.5)

try:
    c = socket.create_connection(('127.0.0.1', 8001), timeout=5)
    print('Client connected to 8001!')
    c.send(b'GET /health HTTP/1.1\r\nHost: localhost\r\n\r\n')
    print(c.recv(1024).decode())
except Exception as e:
    print('Client error:', e)