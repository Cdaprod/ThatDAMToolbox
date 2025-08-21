#/setup.py
from pathlib import Path
from setuptools import find_packages, setup

ROOT = Path(__file__).parent
README = (ROOT / "README.md").read_text(encoding="utf-8")
REQUIREMENTS = (
    ROOT / "docker" / "video-api" / "requirements.txt"
).read_text().splitlines()

setup(
    name="video",
    version="0.1.0",
    description="That DAM Toolbox – Media Indexer + API Driven Service",
    long_description=README,
    long_description_content_type="text/markdown",
    author="David Cannan",
    url="https://github.com/Cdaprod/ThatDAMToolbox",
    packages=find_packages(exclude=("tests", "scripts", "docker")),
    python_requires=">=3.10",
    install_requires=[r for r in REQUIREMENTS if r and not r.startswith("#")],
    entry_points={
        "console_scripts": [
            "video=video.__main__:main",
        ]
    },
    include_package_data=True,
    classifiers=[
        "Programming Language :: Python :: 3 :: Only",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
