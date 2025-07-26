module github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon

go 1.20

require (
    github.com/Cdaprod/ThatDamToolbox/host/services/shared latest
    // add other dependencies here as you need them (e.g. github.com/sirupsen/logrus v1.9.0)
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared