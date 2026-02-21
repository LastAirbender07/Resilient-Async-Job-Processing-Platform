import time
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from prometheus_client import Counter, Histogram

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"]
)

REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"]
)

class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        method = request.method
        endpoint = request.url.path
        
        # Don't track the /metrics endpoint itself to avoid noise
        if endpoint == "/metrics":
            return await call_next(request)

        start_time = time.time()
        # Ensure we catch exceptions too, though Starlette middleware catches some before here
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            raise e
        finally:
            process_time = time.time() - start_time
            REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(process_time)
            REQUEST_COUNT.labels(method=method, endpoint=endpoint, status_code=status_code).inc()

        return response
