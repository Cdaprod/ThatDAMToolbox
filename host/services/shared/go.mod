module github.com/Cdaprod/ThatDamToolbox/host/services/shared

go 1.23.0

toolchain go1.24.3

require (
	github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe v0.0.0
	github.com/charmbracelet/log v0.4.2
	github.com/google/uuid v1.5.0
	github.com/muesli/termenv v0.16.0
	github.com/quic-go/quic-go v0.40.0
	github.com/rabbitmq/amqp091-go v1.9.0
	golang.org/x/term v0.34.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe => ./hostcap/v4l2probe

require (
	github.com/aymanbagabas/go-osc52/v2 v2.0.1 // indirect
	github.com/charmbracelet/colorprofile v0.2.3-0.20250311203215-f60798e515dc // indirect
	github.com/charmbracelet/lipgloss v1.1.0 // indirect
	github.com/charmbracelet/x/ansi v0.8.0 // indirect
	github.com/charmbracelet/x/cellbuf v0.0.13-0.20250311204145-2c3ea96c31dd // indirect
	github.com/charmbracelet/x/term v0.2.1 // indirect
	github.com/go-logfmt/logfmt v0.6.0 // indirect
	github.com/go-task/slim-sprig v0.0.0-20230315185526-52ccab3ef572 // indirect
	github.com/google/pprof v0.0.0-20210407192527-94a9f03dee38 // indirect
	github.com/lucasb-eyer/go-colorful v1.2.0 // indirect
	github.com/mattn/go-isatty v0.0.20 // indirect
	github.com/mattn/go-runewidth v0.0.16 // indirect
	github.com/onsi/ginkgo/v2 v2.9.5 // indirect
	github.com/quic-go/qtls-go1-20 v0.4.1 // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/xo/terminfo v0.0.0-20220910002029-abceb7e1c41e // indirect
	go.uber.org/mock v0.3.0 // indirect
	golang.org/x/crypto v0.14.0 // indirect
	golang.org/x/exp v0.0.0-20231006140011-7918f672742d // indirect
	golang.org/x/mod v0.13.0 // indirect
	golang.org/x/net v0.16.0 // indirect
	golang.org/x/sys v0.35.0 // indirect
	golang.org/x/tools v0.14.0 // indirect
)
