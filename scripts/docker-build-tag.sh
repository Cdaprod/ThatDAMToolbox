# /scripts/docker-testing-with-commands.sh

# build for the local architecture
docker build -t cdaprod/video:dev .

# build multi-arch with Buildx (push to registry optional)
docker buildx build --platform linux/amd64,linux/arm64 \
    -t cdaprod/video:0.1.0 --push .

# run API server (port 8080)
docker run -p 8080:8080 cdaprod/video:dev                 

# run CLI scan inside
docker run --rm -v $PWD/media:/data cdaprod/video:dev scan --root /data