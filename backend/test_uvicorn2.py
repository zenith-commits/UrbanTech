import asyncio
from fastapi import FastAPI
import uvicorn
import httpx

app = FastAPI()

@app.get('/health')
def health():
    return {'status': 'ok'}

config = uvicorn.Config(app, host='127.0.0.1', port=8000, log_level='debug', loop='asyncio')
server = uvicorn.Server(config)

async def test():
    # Run server in background
    server_task = asyncio.create_task(server.serve())
    
    # Wait a bit for server to start
    await asyncio.sleep(2)
    
    # Test from same process using httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get('http://127.0.0.1:8000/health', timeout=5.0)
            print('Response:', response.json())
    except Exception as e:
        print('Error:', e)
    
    server_task.cancel()
    try:
        await server_task
    except asyncio.CancelledError:
        pass

asyncio.run(test())