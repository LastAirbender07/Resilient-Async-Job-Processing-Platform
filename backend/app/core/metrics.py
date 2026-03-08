from prometheus_fastapi_instrumentator import Instrumentator


def instrument_app(app, app_name: str = "resilient-platform-backend") -> None:
    """Attach Prometheus instrumentation to a FastAPI app.

    Uses the minimal stable pattern to guarantee the backend starts correctly.
    """
    Instrumentator(
        should_ignore_untemplated=True,
        should_group_status_codes=False,
    ).instrument(app).expose(
        app,
        endpoint="/metrics",
        include_in_schema=False,
    )
