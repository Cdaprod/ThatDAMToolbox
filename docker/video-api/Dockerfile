##############################################################################
# Dockerfile – multi-arch image for the "video" Media-Bridge / DAM toolbox 🐳
##############################################################################

########################################
# Stage 0 – Prepare the Explorer asset #
########################################
FROM node:18-alpine AS frontend-build
WORKDIR /build

# copy raw component (served as-is)
COPY video/web/static/components/dam-explorer.js ./dam-explorer.js

############################
# Stage 1 – Base OS image  #
############################
FROM python:3.11-slim-bookworm AS base
LABEL maintainer="cdaprod.dev" \
      org.opencontainers.image.version="0.1.0"

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TERM=xterm-256color \
    SHELL=/bin/bash

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      gosu tini \
      v4l-utils inxi strace lsof net-tools iputils-ping \
      build-essential git curl wget ca-certificates \
      ffmpeg libgl1 libglib2.0-0 \
      bash bash-completion zsh locales tmux \
      neovim htop less tree ripgrep fd-find fzf \
      bat exa jq unzip gnupg sqlite3 \
      software-properties-common apt-transport-https \
  && apt-get clean && rm -rf /var/lib/apt/lists/*
  
RUN echo "en_US.UTF-8 UTF-8" > /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8

###############################
# Stage 2 – Dev shell goodies #
###############################
FROM base AS devshell

# 1. non-root user
RUN useradd -ms /bin/zsh appuser
RUN usermod -aG video appuser
USER appuser
WORKDIR /home/appuser

# 2. Oh My Zsh (unattended)
RUN sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended

# 3. zsh plugins
RUN git clone https://github.com/zsh-users/zsh-autosuggestions      ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions && \
    git clone https://github.com/zsh-users/zsh-syntax-highlighting  ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting && \
    git clone https://github.com/zsh-users/zsh-completions          ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-completions

# 4. full .zshrc tweaks  ---------- (all your original lines kept verbatim)
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

# 5. bash fallback tweaks
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
    echo 'if [ -f /etc/bash_completion ]; then . /etc/bash_completion; fi' >> ~/.bashrc

USER root
# 6. minimal nvim config
RUN mkdir -p /home/appuser/.config/nvim && \
    echo 'set number relativenumber'             >  /home/appuser/.config/nvim/init.vim && \
    echo 'set expandtab tabstop=4 shiftwidth=4' >> /home/appuser/.config/nvim/init.vim && \
    echo 'syntax on'                            >> /home/appuser/.config/nvim/init.vim
RUN chown -R appuser:appuser /home/appuser

#############################################
# Stage 3 – Builder: create a venv owned by appuser
#############################################
FROM devshell AS builder

# 1) Make sure /thatdamtoolbox exists and is owned by appuser
USER root

RUN mkdir -p /thatdamtoolbox \
 && chown -R appuser:appuser /thatdamtoolbox \
 && for d in \
    /var/lib/thatdamtoolbox/db \
    /var/lib/thatdamtoolbox/tmp \
    /var/lib/thatdamtoolbox/media \
    /var/lib/thatdamtoolbox/_PROCESSED \
    /var/lib/thatdamtoolbox/previews \
    /var/lib/thatdamtoolbox/logs \
    /var/lib/thatdamtoolbox/_INCOMING ; do \
      mkdir -p "$d" && chown -R appuser:appuser "$d"; \
    done
    
# 2) Switch to appuser and work there
USER appuser
WORKDIR /thatdamtoolbox

# 3) Copy only what setup.py & requirements.txt need
COPY --chown=appuser:appuser docker/video-api/setup.py docker/video-api/requirements.txt README.md ./
COPY --chown=appuser:appuser video/ video/

# 4) Create the venv (under /thatdamtoolbox/venv) as appuser,
#    then install everything into it--no root required
RUN python3 -m venv venv \
 && venv/bin/pip install --upgrade pip \
 && venv/bin/pip install --no-cache-dir -r requirements.txt \
 && venv/bin/pip install --no-cache-dir -e .

# 5) (Optional) install any module‐specific extras
RUN set -e; \
    for req in video/modules/*/requirements.txt; do \
      if [ -f "$req" ]; then \
        echo "Installing extra deps for $(dirname $req)"; \
        venv/bin/pip install --no-cache-dir -r "$req"; \
      fi; \
    done

#############################################
# Stage 4 – Runtime: reuse that venv
#############################################
FROM builder AS runtime
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - video-api" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG

# Copy over your code + venv, all already owned by appuser
COPY --from=builder --chown=appuser:appuser /thatdamtoolbox /thatdamtoolbox

# Make sure we’re still non-root when we start
USER appuser
WORKDIR /

# Prepend our venv to PATH so "python -m video" picks up all deps
ENV PATH="/thatdamtoolbox/venv/bin:${PATH}"

# Bring in your React component in exactly the same place
COPY --from=frontend-build \
     /build/dam-explorer.js \
     /thatdamtoolbox/video/web/static/components/

# 5) Runtime‐only ENV overrides
ENV \
    XDG_CACHE_HOME=/var/lib/thatdamtoolbox/cache \
    VIDEO_DATA_DIR=/var/lib/thatdamtoolbox \
    VIDEO_DB_PATH=/var/lib/thatdamtoolbox/db/live.sqlite3 \
    VIDEO_MEDIA_ROOT=/var/lib/thatdamtoolbox/media \
    VIDEO_PROCESSED_DIR=/var/lib/thatdamtoolbox/_PROCESSED \
    VIDEO_PREVIEW_ROOT=/var/lib/thatdamtoolbox/previews \
    VIDEO_LOG_DIR=/var/lib/thatdamtoolbox/logs \
    VIDEO_TMP_DIR=/var/lib/thatdamtoolbox/tmp \
    VIDEO_INCOMING_DIR=/var/lib/thatdamtoolbox/_INCOMING

COPY --chown=appuser:appuser docker/video-api/entrypoint.sh /entrypoint.sh
RUN chmod 0555 /entrypoint.sh

EXPOSE 8080

# ── Runtime behaviour ───────────────────────────────────────────────────────
# By default we rely on the smart launcher in `video/__main__.py`:
#   • `docker run …`  → API server on :8080
#   • `docker run … stats` → CLI pass-through
# ENTRYPOINT ["python", "-m", "video"]

# You can still override at run-time:
#   FASTAPI=0 docker run …        → forces stdlib HTTP server
#   python -m video serve --port 8888 … inside container for custom port
#
# Keep CMD empty so positional args go straight into ENTRYPOINT
# CMD []

# USER appuser if no need to chown in entrypoint–which steps down to appuser from root anyways
USER root
ENTRYPOINT ["tini","--","/entrypoint.sh"]
CMD ["python", "-m", "video"]
