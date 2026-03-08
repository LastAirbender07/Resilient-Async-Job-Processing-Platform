from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app, app_name: str = "resilient-platform-backend") -> None:
    """Attach Prometheus instrumentation to a FastAPI app.

    Exposes a /metrics endpoint and records metrics compatible with
    Grafana dashboard ID 16110.
    """
    # Use the constructor pattern from the documentation.
    # custom_labels adds our app_name to EVERY metric generated.
    instrumentator = Instrumentator(
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        inprogress_name="requests_inprogress",
        inprogress_labels=True,
        custom_labels={"app_name": app_name}
    )

    # Use 'fastapi' as namespace to get close to the dashboard's expected names.
    # This produces: fastapi_http_requests_total, etc.
    instrumentator.instrument(app, metric_namespace="fastapi").expose(app, endpoint="/metrics")
