from pathlib import Path


def test_entrypoint_basic():
    content = Path('docker/minio/entrypoint.sh').read_text()
    assert 'minio server /data --console-address :9001' in content
    assert 'mc alias set' in content
    assert 'mc mb' in content
    assert 'wget' not in content
    assert 'curl' not in content
    assert 'su ' not in content
    assert 'chown' not in content


def test_minio_volume_mount():
    compose = Path('docker/compose/docker-compose.minio.yaml').read_text()
    assert './docker/minio/data:/data' in compose
    assert '/var/lib/thatdamtoolbox' not in compose
    assert 'mc alias set hc' in compose
    assert 'curl' not in compose


def test_minio_dockerfile_no_su_exec():
    dockerfile = Path('docker/minio/Dockerfile').read_text()
    assert 'su-exec' not in dockerfile
    assert 'curl' not in dockerfile

