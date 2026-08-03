import os
import re
import shlex
import pty
import select
import fcntl
import signal
import struct
import termios
import time
import threading
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_socketio import SocketIO, emit

app = Flask(__name__)
app.config["SECRET_KEY"] = "linuxlab-terminal"
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

LAB_ROOT = os.environ.get("LAB_ROOT", os.path.join(os.path.dirname(os.path.abspath(__file__)), "lab_root"))
LAB_USER = os.environ.get("LAB_USER", "deeplab")
LAB_HOME = os.path.join("/home", LAB_USER)

_ANSI_ESC = re.compile(r'\x1b\[[0-9;]*[a-zA-Z]|\x1b\][0-9;]*[^\x1b]*\x1b\\|\x1b\[[?][0-9;]+[hl]')
_PROMPT_RE = re.compile(r'^[a-zA-Z_][\w.-]*@[\w.-]+:.+[#\$]\s*$')

_sessions: dict[str, dict] = {}
_session_lock = threading.Lock()

EXERCISES = [
    {
        "id": 1,
        "title": "List the lab files",
        "description": "Use `ls` to view the files available in the lab directory.",
        "hint": "Try: ls"
    },
    {
        "id": 2,
        "title": "Read the note",
        "description": "Display the contents of `notes.txt`.",
        "hint": "Try: cat notes.txt"
    },
    {
        "id": 3,
        "title": "Create a new file",
        "description": "Create a file called `answer.txt` and verify it exists.",
        "hint": "Try: touch answer.txt && ls"
    }
]

ALLOWED_COMMANDS = {
    "ls", "cd", "pwd", "tree", "pushd", "popd", "dirs",
    "cat", "touch", "mkdir", "rmdir", "rm", "cp", "mv", "ln", "readlink",
    "stat", "file", "which", "whereis", "find", "locate", "updatedb",
    "less", "more", "head", "tail", "wc", "tee", "tac", "rev", "sort", "uniq",
    "comm", "diff", "patch", "join", "paste",
    "sed", "awk", "grep", "egrep", "fgrep", "cut", "tr", "expand",
    "unexpand", "fmt", "fold", "nl", "od", "hexdump", "xxd",
    "tar", "gzip", "gunzip", "bzip2", "bunzip2", "xz", "unxz",
    "zip", "unzip", "7z", "rar", "unrar", "zcat", "bzcat", "xzcat",
    "uname", "whoami", "id", "groups", "hostname", "domainname",
    "date", "timedatectl", "uptime", "last", "lastlog", "who", "w",
    "ps", "top", "htop", "pgrep", "pidof", "pstree",
    "df", "du", "free", "mount", "umount", "lsblk", "blkid",
    "fsck", "mkfs", "fdisk", "parted", "cfdisk", "sfdisk",
    "tune2fs", "dumpe2fs", "badblocks", "dd", "sync",
    "fg", "bg", "jobs", "kill", "killall", "pkill", "nice", "renice",
    "nohup", "timeout", "wait", "time", "at", "batch", "cron",
    "sudo", "su", "useradd", "userdel", "usermod", "passwd",
    "groupadd", "groupdel", "groupmod", "visudo", "sudoedit",
    "ping", "traceroute", "tracepath", "mtr", "netstat", "ss",
    "ifconfig", "ip", "arp", "dig", "nslookup", "nc", "netcat",
    "telnet", "ssh", "scp", "sftp", "rsync", "wget", "curl",
    "ftp", "lftp", "socat", "nmap", "ngrep", "tcpdump",
    "systemctl", "service", "initctl", "chkconfig", "update-rc.d",
    "journalctl", "dmesg", "sysctl", "modprobe", "lsmod", "rmmod",
    "insmod", "depmod", "lspci", "lsusb", "udevadm",
    "chmod", "chown", "chgrp", "umask", "setfacl", "getfacl",
    "semanage", "getenforce", "setenforce", "restorecon",
    "bash", "sh", "zsh", "ksh", "csh", "tcsh", "type", "command",
    "alias", "unalias", "set", "unset", "export", "env", "printenv",
    "apt", "apt-get", "apt-cache", "dpkg", "yum", "dnf", "rpm",
    "pacman", "emerge", "zypper", "apk", "pip", "pip3", "npm", "gem",
    "git", "svn", "hg", "bzr", "cvs",
    "gcc", "g++", "cc", "make", "cmake", "autoconf", "automake",
    "libtool", "pkg-config", "gdb", "valgrind", "strip",
    "python", "python3", "perl", "ruby", "php", "node", "java",
    "javac", "scala", "go", "rust", "rustc", "cargo",
    "echo", "printf", "tput", "clear", "reset", "banner", "figlet", "jq",
    "strace", "ltrace", "ldd", "nm", "readelf", "objdump", "strings",
    "addr2line", "c++filt", "gprof", "oprofile",
    "iotop", "latencytop", "powertop", "turbostat",
    "perf", "ftrace", "blktrace", "trace-cmd",
    "cal", "bc", "expr", "seq", "yes", "true", "false", "sleep",
    "wait", "exit", "logout", "screen", "tmux", "byobu",
    "lsof", "fuser", "pmap", "sar", "iostat", "vmstat", "mpstat",
    "ifstat", "ethtool", "mii-tool", "route", "iptables", "ip6tables",
    "ebtables", "firewall-cmd", "ufw", "fail2ban",
    "auditctl", "ausearch", "aureport",
    "openssl", "keytool", "certbot", "acme.sh", "gpg",
    "ssh-keygen", "ssh-copy-id", "ssh-agent", "ssh-add",
    "script", "scriptreplay", "expect", "parallel", "xargs", "entr",
    "watch", "inotifywait", "when-changed", "lsyncd", "incrond",
    "systemd-run", "disown",
    "vim", "vi", "nano", "emacs", "gedit", "kate", "code",
    "ed", "pico", "jed", "joe", "mcedit", "medit",
    "man", "info", "apropos", "whatis", "basename", "dirname",
    "realpath", "capsh", "getpcaps", "setcap", "getcap",
    "ldconfig", "ldapsearch", "ldapmodify", "ldapadd", "ldapdelete",
    "getent", "nscd", "ulimit", "syslog", "rsyslog", "syslog-ng",
    "auditd", "pam_limits", "fstab", "inittab", "crontab",
    "docker", "podman", "buildah", "skopeo", "kubectl", "helm",
    "logrotate", "lvcreate", "pvcreate", "vgcreate",
    "cloud-init", "systemd-analyze", "yq", "chage",
    "mdadm", "exportfs", "showmount", "quota", "edquota",
    "smbclient", "testparm",
    "aws",
}

COMMAND_TO_PACKAGE = {
    "ls": "coreutils", "cat": "coreutils", "cp": "coreutils", "mv": "coreutils",
    "rm": "coreutils", "mkdir": "coreutils", "rmdir": "coreutils", "touch": "coreutils",
    "chmod": "coreutils", "chown": "coreutils", "chgrp": "coreutils",
    "ps": "coreutils", "df": "coreutils", "du": "coreutils", "free": "coreutils",
    "date": "coreutils", "uname": "coreutils", "whoami": "coreutils",
    "id": "coreutils", "groups": "coreutils", "hostname": "coreutils",
    "echo": "coreutils", "printf": "coreutils", "sleep": "coreutils",
    "kill": "coreutils", "nice": "coreutils", "nohup": "coreutils",
    "timeout": "coreutils", "head": "coreutils", "tail": "coreutils",
    "wc": "coreutils", "sort": "coreutils", "uniq": "coreutils",
    "cut": "coreutils", "tr": "coreutils", "tee": "coreutils",
    "find": "findutils", "xargs": "findutils", "locate": "mlocate",
    "grep": "grep", "egrep": "grep", "fgrep": "grep",
    "sed": "sed", "awk": "gawk", "diff": "diffutils", "patch": "patch",
    "tree": "tree", "less": "less", "more": "more", "file": "file",
    "tar": "tar", "gzip": "gzip", "bzip2": "bzip2", "xz": "xz-utils",
    "zip": "zip", "unzip": "unzip", "7z": "p7zip-full",
    "htop": "htop", "top": "procps", "pgrep": "procps", "pidof": "procps",
    "lsof": "lsof", "fuser": "psmisc", "dmesg": "util-linux",
    "lsblk": "util-linux", "blkid": "util-linux", "fdisk": "fdisk",
    "parted": "parted", "mount": "util-linux", "umount": "util-linux",
    "ping": "iputils-ping", "traceroute": "traceroute", "mtr": "mtr-tiny",
    "ifconfig": "net-tools", "ip": "iproute2", "ss": "iproute2",
    "arp": "net-tools", "netstat": "net-tools", "dig": "dnsutils",
    "nslookup": "dnsutils", "nc": "netcat-openbsd", "telnet": "telnet",
    "ssh": "openssh-client", "scp": "openssh-client", "rsync": "rsync",
    "wget": "wget", "curl": "curl", "nmap": "nmap", "tcpdump": "tcpdump",
    "vim": "vim", "nano": "nano", "gcc": "gcc", "g++": "g++",
    "make": "make", "cmake": "cmake", "gdb": "gdb", "valgrind": "valgrind",
    "strace": "strace", "python3": "python3", "perl": "perl",
    "bc": "bc", "figlet": "figlet", "jq": "jq",
    "screen": "screen", "tmux": "tmux", "man": "man-db",
    "openssl": "openssl", "git": "git", "apt": "apt", "dpkg": "dpkg",
    "systemctl": "systemd", "journalctl": "systemd",
    "iptables": "iptables", "lspci": "pciutils", "lsusb": "usbutils",
    "cal": "util-linux", "ncal": "util-linux",
    "nm": "binutils", "readelf": "binutils", "objdump": "binutils",
    "strings": "binutils", "addr2line": "binutils", "c++filt": "binutils",
    "gprof": "binutils", "ldd": "libc6", "ltrace": "ltrace",
    "chage": "passwd", "quota": "quota", "edquota": "quota",
    "exportfs": "nfs-kernel-server", "showmount": "nfs-common",
    "smbclient": "smbclient", "testparm": "samba-common-bin",
    "aws": "awscli", "cloud-init": "cloud-init",
    "mdadm": "mdadm", "blktrace": "blktrace", "trace-cmd": "trace-cmd",
    "iotop": "iotop", "powertop": "powertop",
    "perf": "linux-tools-common", "systemd-analyze": "systemd",
}


def _clean_pty_output(raw: str, cmd: str = "") -> str:
    cleaned = _ANSI_ESC.sub('', raw)
    lines = cleaned.split('\n')
    result = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if stripped in ('#', '$') or stripped.startswith('bash-') or stripped.startswith('sh-'):
            continue
        if _PROMPT_RE.match(stripped):
            continue
        if cmd and stripped == cmd:
            continue
        result.append(stripped)
    return '\n'.join(result)


def _get_session(ip: str) -> dict:
    os.makedirs(LAB_HOME, exist_ok=True)
    with _session_lock:
        if ip not in _sessions:
            pid, fd = pty.fork()
            if pid == 0:
                os.chdir(LAB_ROOT)
                env = {
                    "TERM": "dumb",
                    "PATH": "/opt/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
                    "HOME": LAB_HOME,
                    "LANG": "en_US.UTF-8",
                    "LC_ALL": "en_US.UTF-8",
                    "SHELL": "/bin/bash",
                    "BASH_SILENCE_DEPRECATION_WARNING": "1",
                    "PS1": "\\u@\\h:\\w\\$ ",
                    "USER": LAB_USER,
                    "LOGNAME": LAB_USER,
                    "HOSTNAME": "linuxlab",
                }
                os.execve("/bin/bash", ["/bin/bash", "--norc", "--noediting"], env)
            fcntl.fcntl(fd, fcntl.F_SETFL, fcntl.fcntl(fd, fcntl.F_GETFL) | os.O_NONBLOCK)
            time.sleep(0.3)
            try:
                while True:
                    r, _, _ = select.select([fd], [], [], 0.05)
                    if r:
                        os.read(fd, 4096)
                    else:
                        break
            except (BlockingIOError, OSError):
                pass
            _sessions[ip] = {"fd": fd, "pid": pid}
        return _sessions[ip]


def _run_in_session(session: dict, command: str, timeout: float = 10) -> str:
    fd = session["fd"]
    os.write(fd, (command + "\n").encode())
    deadline = time.time() + timeout
    out_chunks = []
    empty_reads = 0
    while time.time() < deadline:
        r, _, _ = select.select([fd], [], [], 0.2)
        if r:
            try:
                data = os.read(fd, 4096)
                if not data:
                    break
                out_chunks.append(data)
                empty_reads = 0
            except BlockingIOError:
                pass
        else:
            empty_reads += 1
            if empty_reads >= 3:
                break
    raw = b"".join(out_chunks).decode("utf-8", errors="replace")
    return _clean_pty_output(raw, command)


def extract_commands(command_text):
    if not command_text or not command_text.strip():
        return []
    parts = re.split(r'\s*(?:\|\||\||&&|;)\s*', command_text.strip())
    commands = []
    for part in parts:
        part = part.strip()
        if not part:
            continue
        try:
            tokens = shlex.split(part)
        except ValueError:
            continue
        if tokens:
            commands.append(tokens[0])
    return commands


def is_command_allowed(command_text: str) -> bool:
    commands = extract_commands(command_text)
    if not commands:
        return False
    if not all(cmd in ALLOWED_COMMANDS for cmd in commands):
        return False
    lower = command_text.lower().strip()
    dangerous = [
        'rm -rf /', 'rm -rf /*', 'rm -fr /', 'rm -fr /*',
        'mkfs', 'dd if=', 'dd of=/dev',
        '> /dev/', '>> /dev/',
    ]
    for pat in dangerous:
        if pat in lower:
            return False
    return True


def create_lab_files():
    os.makedirs(LAB_ROOT, exist_ok=True)
    sample_files = {
        "notes.txt": "Welcome to the Linux practice lab!\nUse safe commands to explore this directory.\n",
        "README_TASKS.txt": "Task 1: List the files in this directory.\nTask 2: Read notes.txt.\nTask 3: Create answer.txt.\n",
        "inventory.txt": "server.conf\nuser.log\nreadme.md\n",
    }
    for name, content in sample_files.items():
        path = os.path.join(LAB_ROOT, name)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                f.write(content)


create_lab_files()


@app.route("/")
def index():
    return send_file("index.html")


@app.route("/static/<path:filename>")
def serve_static(filename):
    return send_from_directory("static", filename)


@app.route("/execute", methods=["POST"])
def execute_command():
    data = request.get_json(force=True)
    command = data.get("command", "").strip()
    if not command:
        return jsonify({"output": "Error: Command is required."}), 400

    client_ip = request.remote_addr or "127.0.0.1"

    if not is_command_allowed(command):
        return jsonify({"output": "Error: This command is not allowed in the practice lab."}), 403

    session = _get_session(client_ip)
    output = _run_in_session(session, command)

    if "command not found" in output.lower():
        cmd_name = command.split()[0]
        package_name = COMMAND_TO_PACKAGE.get(cmd_name, cmd_name)
        return jsonify({"output": f"Command '{cmd_name}' not found. Run: sudo apt install -y {package_name}"})

    return jsonify({"output": output if output else ""})


@app.route("/exercises", methods=["GET"])
def exercises():
    return jsonify(EXERCISES)


@app.route("/lab-files", methods=["GET"])
def list_lab_files():
    files = sorted(os.listdir(LAB_ROOT)) if os.path.isdir(LAB_ROOT) else []
    return jsonify(files)


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


_pty_sessions: dict[str, dict] = {}
_pty_lock = threading.Lock()


def _spawn_pty(sid: str, cols: int = 80, rows: int = 24):
    os.makedirs(LAB_HOME, exist_ok=True)

    pid, fd = pty.fork()
    if pid == 0:
        os.chdir(LAB_ROOT)
        env = {
            "TERM": "xterm-256color",
            "PATH": "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
            "HOME": LAB_HOME,
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "SHELL": "/bin/bash",
            "BASH_SILENCE_DEPRECATION_WARNING": "1",
            "PS1": "\\[\\033[1;32m\\]\\u@linuxlab\\[\\033[0m\\]:\\[\\033[1;34m\\]\\w\\[\\033[0m\\]\\$ ",
            "USER": LAB_USER,
            "LOGNAME": LAB_USER,
            "HOSTNAME": "linuxlab",
        }
        os.execve("/bin/bash", ["/bin/bash", "--norc"], env)

    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    fcntl.fcntl(fd, fcntl.F_SETFL, fcntl.F_GETFL | os.O_NONBLOCK)

    with _pty_lock:
        _pty_sessions[sid] = {"fd": fd, "pid": pid, "alive": True}

    def reader():
        while True:
            with _pty_lock:
                s = _pty_sessions.get(sid)
                if not s or not s["alive"]:
                    break
            try:
                r, _, _ = select.select([fd], [], [], 0.05)
                if r:
                    data = os.read(fd, 65536)
                    if not data:
                        break
                    socketio.emit("terminal:output", {"data": data.decode("utf-8", errors="replace")}, room=sid)
            except (BlockingIOError, OSError, ValueError):
                break
        with _pty_lock:
            if sid in _pty_sessions:
                _pty_sessions[sid]["alive"] = False

    t = threading.Thread(target=reader, daemon=True)
    t.start()


@socketio.on("connect")
def on_connect():
    sid = request.sid
    _spawn_pty(sid)


@socketio.on("terminal:input")
def on_input(data):
    sid = request.sid
    with _pty_lock:
        s = _pty_sessions.get(sid)
    if s and s["alive"]:
        try:
            os.write(s["fd"], data["data"].encode("utf-8"))
        except (OSError, BrokenPipeError):
            pass


@socketio.on("terminal:resize")
def on_resize(data):
    sid = request.sid
    cols = data.get("cols", 80)
    rows = data.get("rows", 24)
    with _pty_lock:
        s = _pty_sessions.get(sid)
    if s and s["alive"]:
        try:
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(s["fd"], termios.TIOCSWINSZ, winsize)
        except (OSError, ValueError):
            pass


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    with _pty_lock:
        s = _pty_sessions.pop(sid, None)
    if s:
        s["alive"] = False
        try:
            os.kill(s["pid"], signal.SIGHUP)
        except (OSError, ProcessLookupError):
            pass
        try:
            os.close(s["fd"])
        except OSError:
            pass


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True)
