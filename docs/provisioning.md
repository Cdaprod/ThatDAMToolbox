# Provisioning Quickstart

Bring a node online in three steps: create a claim, run the bootstrap one-liner, and verify the camera-proxy.

## 1. Create a claim

```bash
curl -X POST http://SUPERVISOR:8070/v1/leader/claim \
  -d '{"node_id":"edge1","url":"http://edge1:8070"}'
```

## 2. Bootstrap the node

```bash
RUNNER_EXECUTOR=docker SUPERVISOR_URL=http://SUPERVISOR:8070 \
  bash <(curl -fsSL https://raw.githubusercontent.com/Cdaprod/ThatDAMToolbox/main/scripts/install-runner.sh)
```

This installs the runner and applies the plan. When the plan includes the camera-proxy service, it will start automatically.

## 3. View the feed

Built-in viewer served by camera-proxy:

```bash
curl -I http://<node>:8000/viewer/
# or open http://<node>:8000/viewer/ in your browser
```

Camera Monitor in the web app:

```bash
# open in your browser
http://localhost:3000/dashboard/camera-monitor
```

Once these URLs respond, the camera-proxy is ready.
