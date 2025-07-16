##############################################################################
# /Dockerfile
# 
#  🎥 Multi-arch container for the "video" Media-Bridge / DAM toolbox 🐳
#
# • Works on 64-bit x86 and ARM (incl. Raspberry Pi 5)
# • Uvicorn-with-Gunicorn FastAPI stack by default
# • Falls back to the stdlib HTTP server when FASTAPI=0 or FastAPI deps
#   are stripped at build-time
#
# Build examples
#   docker buildx build --platform linux/amd64,linux/arm64 -t cdaprod/video:0.1.0 .
#   docker run -p 8080:8080 cdaprod/video:0.1.0                # starts API
#   docker run cdaprod/video:0.1.0 scan --root /data           # CLI one-shot
##############################################################################

##############################################################################
# Stage 0: build our React/JSX → ESM bundle for dam-explorer
##############################################################################
FROM node:18-alpine AS frontend-build
WORKDIR /src

# install esbuild
RUN npm install --location=global esbuild

# copy just the bit we need to bundle
COPY video/web/static/components/dam-explorer.js ./static/components/

# bundle + strip out JSX so the browser can import it directly
# --- in the frontend-build stage ---
RUN esbuild ./src/dam-explorer.js \
    --bundle \
    --loader:.js=jsx \
    --outfile=dam-explorer.bundle.js \
    --format=esm \
    --target=es2022 \
    --minify
    
############################
# --- Stage 1: base layer --
############################
FROM python:3.11-slim-bookworm AS base
LABEL maintainer="cdaprod.dev" \
      org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.description="That DAM Toolbox - FastAPI / stdlib API + CLI + Modular Plugin System for the Media-Indexer toolbox" \
      org.opencontainers.image.version="0.1.0"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TERM=xterm-256color \
    SHELL=/bin/bash

# Minimal C tool-chain for any optional pure-C wheels; FFmpeg & libGL for preview
# Plus enhanced shell and development tools
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        build-essential \
        git curl wget ca-certificates \
        ffmpeg libgl1 libglib2.0-0 \
        bash bash-completion \
        neovim \
        htop \
        less \
        tree \
        ripgrep \
        fd-find \
        fzf \
        tmux \
        zsh \
        locales \
        bat \
        exa \
        jq \
        unzip \
        gnupg \
        software-properties-common \
        apt-transport-https \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set up locale
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

# Add a non-root user for better security
RUN useradd -ms /bin/zsh appuser

# Install Oh My Zsh and configure zsh for appuser
USER appuser
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# Install popular zsh plugins
RUN git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions && \
    git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting && \
    git clone https://github.com/zsh-users/zsh-completions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-completions

# Configure .zshrc with enhanced settings
RUN sed -i 's/ZSH_THEME="robbyrussell"/ZSH_THEME="agnoster"/' ~/.zshrc && \
    sed -i 's/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting zsh-completions docker docker-compose python pip fzf tmux)/' ~/.zshrc && \
    echo '' >> ~/.zshrc && \
    echo '# Enhanced zsh configuration' >> ~/.zshrc && \
    echo 'export HISTSIZE=10000' >> ~/.zshrc && \
    echo 'export HISTFILESIZE=20000' >> ~/.zshrc && \
    echo 'export SAVEHIST=10000' >> ~/.zshrc && \
    echo 'setopt HIST_IGNORE_DUPS' >> ~/.zshrc && \
    echo 'setopt HIST_IGNORE_ALL_DUPS' >> ~/.zshrc && \
    echo 'setopt HIST_FIND_NO_DUPS' >> ~/.zshrc && \
    echo 'setopt HIST_SAVE_NO_DUPS' >> ~/.zshrc && \
    echo 'setopt SHARE_HISTORY' >> ~/.zshrc && \
    echo 'setopt APPEND_HISTORY' >> ~/.zshrc && \
    echo 'setopt INC_APPEND_HISTORY' >> ~/.zshrc && \
    echo 'export EDITOR=nvim' >> ~/.zshrc && \
    echo 'export VISUAL=nvim' >> ~/.zshrc && \
    echo 'alias ll="ls -alF"' >> ~/.zshrc && \
    echo 'alias la="ls -A"' >> ~/.zshrc && \
    echo 'alias l="ls -CF"' >> ~/.zshrc && \
    echo 'alias vim=nvim' >> ~/.zshrc && \
    echo 'alias vi=nvim' >> ~/.zshrc && \
    echo 'alias cat=bat' >> ~/.zshrc && \
    echo 'alias find=fd' >> ~/.zshrc && \
    echo 'alias grep=rg' >> ~/.zshrc && \
    echo 'alias top=htop' >> ~/.zshrc && \
    echo 'alias cls=clear' >> ~/.zshrc && \
    echo 'alias ..="cd .."' >> ~/.zshrc && \
    echo 'alias ...="cd ../.."' >> ~/.zshrc && \
    echo 'alias ....="cd ../../.."' >> ~/.zshrc && \
    echo 'alias ~="cd ~"' >> ~/.zshrc && \
    echo 'alias reload="source ~/.zshrc"' >> ~/.zshrc && \
    echo '' >> ~/.zshrc && \
    echo '# FZF configuration' >> ~/.zshrc && \
    echo 'export FZF_DEFAULT_COMMAND="fd --type f --hidden --follow --exclude .git"' >> ~/.zshrc && \
    echo 'export FZF_CTRL_T_COMMAND="$FZF_DEFAULT_COMMAND"' >> ~/.zshrc && \
    echo 'export FZF_ALT_C_COMMAND="fd --type d --hidden --follow --exclude .git"' >> ~/.zshrc && \
    echo '' >> ~/.zshrc && \
    echo '# Auto-completion for zsh-completions' >> ~/.zshrc && \
    echo 'autoload -U compinit && compinit' >> ~/.zshrc

# Set up enhanced bash configuration as fallback
RUN echo '# Enhanced bash configuration' >> ~/.bashrc && \
    echo 'export HISTSIZE=10000' >> ~/.bashrc && \
    echo 'export HISTFILESIZE=20000' >> ~/.bashrc && \
    echo 'export HISTCONTROL=ignoredups:erasedups' >> ~/.bashrc && \
    echo 'shopt -s histappend' >> ~/.bashrc && \
    echo 'shopt -s checkwinsize' >> ~/.bashrc && \
    echo 'shopt -s cdspell' >> ~/.bashrc && \
    echo 'bind "set completion-ignore-case on"' >> ~/.bashrc && \
    echo 'bind "set show-all-if-ambiguous on"' >> ~/.bashrc && \
    echo 'export EDITOR=nvim' >> ~/.bashrc && \
    echo 'export VISUAL=nvim' >> ~/.bashrc && \
    echo 'alias ll="ls -alF"' >> ~/.bashrc && \
    echo 'alias la="ls -A"' >> ~/.bashrc && \
    echo 'alias l="ls -CF"' >> ~/.bashrc && \
    echo 'alias vim=nvim' >> ~/.bashrc && \
    echo 'alias vi=nvim' >> ~/.bashrc && \
    echo 'if [ -f /etc/bash_completion ]; then' >> ~/.bashrc && \
    echo '    . /etc/bash_completion' >> ~/.bashrc && \
    echo 'fi' >> ~/.bashrc

USER root

# Basic nvim configuration
RUN mkdir -p /home/appuser/.config/nvim && \
    echo 'set number' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set relativenumber' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set expandtab' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set shiftwidth=4' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set tabstop=4' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set softtabstop=4' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set autoindent' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set smartindent' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set hlsearch' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set incsearch' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set ignorecase' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set smartcase' >> /home/appuser/.config/nvim/init.vim && \
    echo 'set mouse=a' >> /home/appuser/.config/nvim/init.vim && \
    echo 'syntax on' >> /home/appuser/.config/nvim/init.vim && \
    echo 'colorscheme default' >> /home/appuser/.config/nvim/init.vim

# Set ownership of config files
RUN chown -R appuser:appuser /home/appuser/.config /home/appuser/.bashrc

USER appuser
WORKDIR /workspace

###############################
# --- Stage 2: pip install ----
###############################
FROM base AS builder
COPY --chown=appuser:appuser requirements.txt setup.py README.md /workspace/
COPY --chown=appuser:appuser video/ /workspace/video
RUN pip install --no-cache-dir --user -r /workspace/requirements.txt && \
    pip install --no-cache-dir --user -e /workspace
    
#######################################
# --- Stage 3: runtime / final image --
#######################################
FROM base AS runtime
# Copy only the virtualenv site-packages from builder
COPY --from=builder /home/appuser/.local /home/appuser/.local
ENV PATH=$PATH:/home/appuser/.local/bin

# Copy application code
COPY --chown=appuser:appuser video/ /workspace/video
COPY --chown=appuser:appuser setup.py /workspace/
COPY --chown=appuser:appuser run_video.py /workspace/

# overwrite the raw dam-explorer with the built bundle
COPY --from=frontend-build \
     /build/static/components/dam-explorer.bundle.js \
     /workspace/video/web/static/components/dam-explorer.bundle.j

# Auto-install all plugin requirements.txt (if any exist)
RUN set -e; \
    cd /workspace/video/modules; \
    find . -name "requirements.txt" | xargs cat | sort | uniq > /tmp/all-module-reqs.txt; \
    pip install --no-cache-dir --user -r /tmp/all-module-reqs.txt || true

EXPOSE 8080

# ── Runtime behaviour ───────────────────────────────────────────────────────
# By default we rely on the smart launcher in `video/__main__.py`:
#   • `docker run …`  → API server on :8080
#   • `docker run … stats` → CLI pass-through
ENTRYPOINT ["python", "-m", "video"]

# You can still override at run-time:
#   FASTAPI=0 docker run …        → forces stdlib HTTP server
#   python -m video serve --port 8888 … inside container for custom port
#
# Keep CMD empty so positional args go straight into ENTRYPOINT
CMD []