module github.com/Cdaprod/ThatDamToolbox/host/services/tenancy

go 1.23.0

toolchain go1.24.3

require (
	github.com/Cdaprod/ThatDamToolbox/host/shared v0.0.0
	github.com/google/uuid v1.6.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/shared => ../../shared
