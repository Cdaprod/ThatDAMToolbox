# discovery/entrypoint-snippet.sh
#
# Sources discovery leader information if present and exports
# UPSTREAM_HOST and UPSTREAM_PORT for consumers.
#
# Example:
#   . /opt/shared/entrypoint-snippet.sh

if [ -f "${LEADER_FILE:-/run/discovery/leader.env}" ]; then
  # shellcheck disable=SC1090
  . "${LEADER_FILE:-/run/discovery/leader.env}"
  export UPSTREAM_HOST UPSTREAM_PORT
fi

