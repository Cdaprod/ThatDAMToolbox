/docker/compose/*/**

Location Purpose:
- Ran via "include:" entry in root /docker-compose.yaml.
- Modular and Idempotent Service Docker Compose Files.
- Subdirectories are canary type compositions (canary, continuous integration, development, production, etc)
- Contexts point to /docker/<service subdir>/*
- Root /docker-compose.yaml is the central manner of running and deploying development, includes additonal attributes such: networks, volumes, etc...
- Modular compose files must have: any common anchors, labels, follow naming conventions (docker-compose.<service>.yaml).