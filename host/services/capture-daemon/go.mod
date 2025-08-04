module github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon

go 1.20

require (
  github.com/Cdaprod/ThatDamToolbox/host/services/shared v0.0.0
  
  //github.com/streadway/amqp v1.0.0
  github.com/rabbitmq/amqp091-go v1.10.0
)

replace github.com/Cdaprod/ThatDamToolbox/host/services/shared => ../shared