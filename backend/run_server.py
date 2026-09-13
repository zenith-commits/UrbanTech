import asyncio
import uvicorn
from app.main import app

async def main():
    config = uvicorn.Config(app, host='127.0.0.1', port=8000, log_level='info', loop='asyncio', lifespan='on')
    server = uvicorn.Server(config)
    await server.serve()

if __name__ == "__main__":
    asyncio.run(main())