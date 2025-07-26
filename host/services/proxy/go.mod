module github.com/Cdaprod/ThatDamToolbox/host/services/proxy

go 1.23

require (
    github.com/Cdaprod/ThatDamToolbox/host/services/shared v0.0.0
    github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway v0.0.0
    github.com/gorilla/websocket v1.5.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared
replace github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway => ../api-gateway