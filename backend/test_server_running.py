import asyncio
import httpx
import uvicorn
from app.main import app

async def test():
    config = uvicorn.Config(app, host='127.0.0.1', port=8000, log_level='info', loop='asyncio', lifespan='on')
    server = uvicorn.Server(config)
    server_task = asyncio.create_task(server.serve())
    
    await asyncio.sleep(2)
    
    try:
        async with httpx.AsyncClient() as client:
            # Test health
            r = await client.get('http://127.0.0.1:8000/health', timeout=5.0)
            print('Health:', r.json())
            
            # Test docs
            r = await client.get('http://127.0.0.1:8000/docs', timeout=5.0)
            print('Docs status:', r.status_code)
            print('Swagger UI present:', 'swagger' in r.text.lower())
            
            # Test openapi.json
            r = await client.get('http://127.0.0.1:8000/openapi.json', timeout=5.0)
            print('OpenAPI status:', r.status_code)
            print('API Title:', r.json().get('info', {}).get('title'))
            
    except Exception as e:
        print('Error:', e)
    finally:
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass

asyncio.run(test())