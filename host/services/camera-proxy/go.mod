// /host/services/camera-proxy/go.mod
module github.com/Cdaprod/ThatDamToolbox/host/services/camera-proxy

go 1.23.0

toolchain go1.24.3

require (
	github.com/Cdaprod/ThatDamToolbox/host/services/shared v0.0.0-00010101000000-000000000000
	github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe v0.0.0
	github.com/gorilla/websocket v1.5.0
	github.com/pion/webrtc/v3 v3.2.0
	github.com/prometheus/client_golang v1.23.0
)

require (
	github.com/aymanbagabas/go-osc52/v2 v2.0.1 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc // indirect
	github.com/charmbracelet/lipgloss v1.1.0 // indirect
	github.com/charmbracelet/log v0.4.2 // indirect
	github.com/charmbracelet/x/ansi v0.8.0 // indirect
	github.com/charmbracelet/x/cellbuf v0.0.13-0.20250311204145-2c3ea96c31dd // indirect
	github.com/charmbracelet/x/term v0.2.1 // indirect
	github.com/go-logfmt/logfmt v0.6.0 // indirect
	github.com/google/uuid v1.5.0 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/lucasb-eyer/go-colorful v1.2.0 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.16 // indirect
	github.com/muesli/termenv v0.16.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/pion/datachannel v1.5.5 // indirect
	github.com/pion/dtls/v2 v2.2.6 // indirect
	github.com/pion/ice/v2 v2.3.2 // indirect
	github.com/pion/interceptor v0.1.16 // indirect
	github.com/pion/logging v0.2.2 // indirect
	github.com/pion/mdns v0.0.7 // indirect
	github.com/pion/randutil v0.1.0 // indirect
	github.com/pion/rtcp v1.2.10 // indirect
	github.com/pion/rtp v1.7.13 // indirect
	github.com/pion/sctp v1.8.6 // indirect
	github.com/pion/sdp/v3 v3.0.6 // indirect
	github.com/pion/srtp/v2 v2.0.12 // indirect
	github.com/pion/stun v0.4.0 // indirect
	github.com/pion/transport/v2 v2.2.0 // indirect
	github.com/pion/turn/v2 v2.1.0 // indirect
	github.com/pion/udp/v2 v2.0.1 // indirect
	github.com/prometheus/client_model v0.6.2 // indirect
	github.com/prometheus/common v0.65.0 // indirect
	github.com/prometheus/procfs v0.16.1 // indirect
	github.com/rabbitmq/amqp091-go v1.9.0 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e // indirect
	golang.org/x/crypto v0.38.0 // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/net v0.40.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
	golang.org/x/term v0.34.0 // indirect
	google.golang.org/protobuf v1.36.6 // indirect
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe => ../shared/hostcap/v4l2probe
