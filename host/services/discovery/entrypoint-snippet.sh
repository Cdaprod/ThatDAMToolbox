# Source leader env if discovery is running (same volume or host path)
/path/to/your/app/entrypoint.sh
if [ -f "${LEADER_FILE:-/run/discovery/leader.env}" ]; then
  . "${LEADER_FILE:-/run/discovery/leader.env}"
  export UPSTREAM_HOST UPSTREAM_PORT
fi

# If we’re the server role, bind to SERVICE_PORT; otherwise point to UPSTREAM_*