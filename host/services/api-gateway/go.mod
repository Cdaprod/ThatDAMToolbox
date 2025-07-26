module github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway

go 1.20

require (
    github.com/Cdaprod/ThatDamToolbox/host/services/shared latest
    github.com/gorilla/websocket v1.5.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared