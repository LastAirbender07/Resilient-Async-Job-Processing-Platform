# app/core/metrics.py
#
# WHY prometheus-fastapi-instrumentator instead of a custom middleware:
#
# The community-standard approach for FastAPI + Prometheus is the
# prometheus-fastapi-instrumentator library. It exposes metrics that match
# well-known public Grafana dashboards (e.g. ID 16110 "FastAPI Observability"):
#
#   fastapi_requests_total{app_name, method, path, status_code}
#   fastapi_requests_duration_seconds{app_name, method, path}
#   fastapi_requests_inprogress{app_name, method}
#   fastapi_app_info{app_name}
#
# The old hand-rolled PrometheusMiddleware exposed `http_requests_total`
# and `http_request_duration_seconds` — different names, no `app_name` label.
# Having `app_name` is important for multi-service Grafana dashboards that
# filter by application.
#
# Usage (in main.py):
#   from app.core.metrics import instrument_app
#   instrument_app(app, app_name="resilient-platform-backend")
from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app, app_name: str = "resilient-platform-backend") -> None:
    """Attach Prometheus instrumentation to a FastAPI app.

    Exposes a /metrics endpoint and records:
      - fastapi_requests_total          (counter, per method/path/status)
      - fastapi_requests_duration_seconds (histogram, per method/path)
      - fastapi_requests_inprogress     (gauge, per method)
      - fastapi_app_info                (gauge, app metadata)

    The app_name label is used by Grafana dashboard ID 16110
    ("FastAPI Observability") to filter metrics per service.
    """
    Instrumentator(
        app_name=app_name,
        excluded_handlers=["/metrics", "/health"],
    ).instrument(app).expose(app, endpoint="/metrics")
