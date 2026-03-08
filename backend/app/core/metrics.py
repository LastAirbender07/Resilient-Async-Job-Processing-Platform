from prometheus_fastapi_instrumentator import Instrumentator, metrics


def instrument_app(app, app_name: str = "resilient-platform-backend") -> None:
    """Attach Prometheus instrumentation to a FastAPI app.

    Exposes a /metrics endpoint and records metrics compatible with
    Grafana dashboard ID 16110.
    """
    instrumentator = Instrumentator(
        excluded_handlers=["/metrics", "/health"],
        should_group_status_codes=False,
        should_ignore_untemplated=True,
        should_respect_env_var=True,
        should_instrument_requests_inprogress=True,
        inprogress_name="fastapi_requests_inprogress",
        inprogress_labels=True,
    )

    # Add the info metric which provides the app_name label that dashboard 16110 uses
    instrumentator.add(
        metrics.info(
            name="fastapi_app_info",
            documentation="FastAPI application information.",
            labelnames=("app_name",),
            labelvalues=(app_name,),
        )
    )

    # Note: Modern versions of the instrumentator might not add app_name to EVERY metric
    # by default via the constructor. If the dashboard query sum(fastapi_requests_total{app_name="$app_name"})
    # is used, it often relies on either the info metric join or a constant label.
    
    instrumentator.instrument(app).expose(app, endpoint="/metrics")
