import uvicorn
from .config import HOST, PORT

if __name__ == "__main__":
    uvicorn.run("moonshots.app:app", host=HOST, port=PORT, proxy_headers=True,
                forwarded_allow_ips="127.0.0.1", access_log=False, workers=1)
