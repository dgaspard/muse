# Storage (local-only)

This folder is used by local Docker Compose services to persist runtime data
(e.g., Postgres data files, MinIO buckets, Redis data). Do NOT commit files
under `storage/` to version control — these are runtime artifacts:

- `/storage/postgres` contains Postgres cluster data files (binary and large).
- `/storage/minio` contains MinIO object data and internal metadata.

Recommended workflow:

- Keep `storage/` in your local working tree only.
- Use Docker volumes or bind mounts for persistent local state when needed.
- If you accidentally commit runtime files, remove them from the index with:

  ```bash
  git rm -r --cached storage
  git commit -m "chore: stop tracking runtime storage files"
  ```

If you need persistent shared state for CI or team environments, use proper
hosted services or external volumes; do not commit binary DB files into Git.
