// /host/services/camera-proxy/go.mod
module github.com/Cdaprod/ThatDamToolbox/host/services/camera-proxy

go 1.22

require (
        github.com/gorilla/websocket v1.5.0
        github.com/pion/webrtc/v3 v3.2.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared
