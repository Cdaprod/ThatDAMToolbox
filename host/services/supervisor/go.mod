module github.com/Cdaprod/ThatDamToolbox/host/services/supervisor

go 1.23.0

toolchain go1.24.3

require (
        github.com/Cdaprod/ThatDamToolbox/host/services/shared v0.0.0-00010101000000-000000000000
        github.com/MicahParks/keyfunc v1.5.2
        github.com/golang-jwt/jwt/v4 v4.4.2
        github.com/Cdaprod/ThatDamToolbox/host/shared v0.0.0-00010101000000-000000000000
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared
replace github.com/Cdaprod/ThatDamToolbox/host/shared => ../../shared
