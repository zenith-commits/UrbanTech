import asyncio
from fastapi import FastAPI
import hypercorn.asyncio
from hypercorn.config import Config
import socket

app = FastAPI()

@app.get('/health')
def health():
    return {'status': 'ok'}

config = Config()
config.bind = ['127.0.0.1:8000']

async def test():
    # Run server in background
    server_task = asyncio.create_task(hypercorn.asyncio.serve(app, config))
    
    # Wait a bit for server to start
    await asyncio.sleep(2)
    
    # Test from same process
    try:
        s = socket.create_connection(('127.0.0.1', 8000), timeout=5)
        print('Connected from same process!')
        s.send(b'GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n')
        response = b''
        while True:
            data = s.recv(1024)
            if not data:
                break
            response += data
        print('Response:', response.decode())
    except Exception as e:
        print('Error:', e)
    finally:
        s.close()
    
    server_task.cancel()
    try:
        await server_task
    except asyncio.CancelledError:
        pass

asyncio.run(test())