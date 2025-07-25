GO_SRC      := src/cmd/capture-daemon
BIN_NAME    := capture-daemon
BIN_PATH    := /usr/local/bin/$(BIN_NAME)
SERVICE_SRC := scripts/rules/camera-record.service
SERVICE_DST := /etc/systemd/system/camera-record.service

.PHONY: all build install install-bin install-service enable-service restart-service uninstall clean

all: install

build:
	go build -o $(BIN_NAME) $(GO_SRC)

install: build install-bin install-service enable-service restart-service

install-bin:
	install -m 755 $(BIN_NAME) $(BIN_PATH)

install-service:
	install -m 644 $(SERVICE_SRC) $(SERVICE_DST)

enable-service:
	systemctl daemon-reload
	systemctl enable camera-record.service

restart-service:
	systemctl restart camera-record.service

uninstall:
	-rm -f $(BIN_PATH)
	-rm -f $(SERVICE_DST)
	systemctl daemon-reload
	-systemctl disable camera-record.service
	-systemctl stop camera-record.service
	
status:
	systemctl status camera-record.service

logs:
	journalctl -u camera-record.service -f

clean:
	-rm -f $(BIN_NAME)
	
docker-up:
	docker compose up -d

docker-down:
	docker compose down