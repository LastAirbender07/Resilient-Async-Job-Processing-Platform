Apply Alembic Migrations locally:


```
Jayaraj@GR2F96R7YN backend % docker compose ps

NAME                 IMAGE                                                               COMMAND                  SERVICE            CREATED              STATUS                        PORTS
resilient-backend    jayaraj0781/resilient-async-job-processing-platform-backend:1.0.0   "/app/entrypoint.sh …"   backend            About a minute ago   Up About a minute             0.0.0.0:5001->5001/tcp, [::]:5001->5001/tcp
resilient-postgres   postgres:16-alpine                                                  "docker-entrypoint.s…"   postgres-service   About a minute ago   Up About a minute (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp
Jayaraj@GR2F96R7YN backend % docker compose exec backend bash

root@72685eec867b:/app# alembic current
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
332b6465002f (head)
root@72685eec867b:/app# alembic upgrade head
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
root@72685eec867b:/app# alembic revision --autogenerate -m "add job constraints and indexes"
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.autogenerate.compare.constraints] Detected added index 'ix_jobs_status_created_at' on '('status', 'created_at')'
INFO  [alembic.autogenerate.compare.constraints] Detected added index 'ix_jobs_user_id_created_at' on '('user_id', 'created_at')'
  Generating /app/alembic/versions/c83d02a2515c_add_job_constraints_and_indexes.py ...  done
root@72685eec867b:/app# alembic upgrade head
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
INFO  [alembic.runtime.migration] Running upgrade 332b6465002f -> c83d02a2515c, add job constraints and indexes
root@72685eec867b:/app# alembic current
INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
INFO  [alembic.runtime.migration] Will assume transactional DDL.
c83d02a2515c (head)
root@72685eec867b:/app# 

```

Next commit the new migration file created in the `alembic/versions` folder.