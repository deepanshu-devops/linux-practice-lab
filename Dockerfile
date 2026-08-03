FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV LAB_ROOT=/lab_root
ENV PATH=/opt/venv/bin:$PATH
ENV LANG=en_US.UTF-8

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash coreutils findutils grep sed gawk \
    procps tree less file \
    curl wget ca-certificates sudo iputils-ping locales \
    && rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
    && sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

RUN useradd -m -s /bin/bash deeplab \
    && echo "deeplab ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/deeplab \
    && chmod 0440 /etc/sudoers.d/deeplab

WORKDIR /app

COPY requirements.txt .
RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY app.py index.html ./
COPY static/ ./static/
COPY lab_root/ /lab_root/
RUN chown -R deeplab:deeplab /app /lab_root

EXPOSE 5000

CMD ["/opt/venv/bin/python", "app.py"]
