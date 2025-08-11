module github.com/Cdaprod/ThatDamToolbox/host/services/shared

go 1.23

toolchain go1.24.3

require (
	github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe v0.0.0
	github.com/google/uuid v1.5.0
	github.com/quic-go/quic-go v0.40.0
	github.com/rabbitmq/amqp091-go v1.9.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe => ./hostcap/v4l2probe

require (
	github.com/go-task/slim-sprig v0.0.0-20230315185526-52ccab3ef572 // indirect
	github.com/google/pprof v0.0.0-20210407192527-94a9f03dee38 // indirect
	github.com/onsi/ginkgo/v2 v2.9.5 // indirect
	github.com/quic-go/qtls-go1-20 v0.4.1 // indirect
	go.uber.org/mock v0.3.0 // indirect
	golang.org/x/crypto v0.4.0 // indirect
	golang.org/x/exp v0.0.0-20221205204356-47842c84f3db // indirect
	golang.org/x/mod v0.11.0 // indirect
	golang.org/x/net v0.10.0 // indirect
	golang.org/x/sys v0.8.0 // indirect
	golang.org/x/tools v0.9.1 // indirect
)
