// ============================================================
// CATEGORIES_EXTRA — additional enterprise/production commands
// merged into each existing category at runtime (see index.html)
// ============================================================

const CATEGORIES_EXTRA = {
    navigation: [{
        name: "realpath",
        level: 1,
        meaning: "Resolves a path to its fully qualified absolute path, following every symlink.",
        memory: "REALPATH = the 'true' path. Where the file really lives after the shortcut (symlink) chain is unwound.",
        syntax: "realpath [OPTION]... FILE...",
        options: [{
            flag: "-m, --canonicalize-missing",
            desc: "Resolve even if the file does not exist yet (useful for paths about to be created)."
        }, {
            flag: "-s, --strip, --no-symlinks",
            desc: "Do not expand symlinks; just print the absolute normalized path."
        }, {
            flag: "-e, --canonicalize-existing",
            desc: "All path components must exist, otherwise an error is returned."
        }, {
            flag: "--relative-to=DIR",
            desc: "Print the path relative to the given directory."
        }],
        examples: [{
            cmd: "realpath /etc/alternatives/python3",
            desc: "Show where the python3 alternative actually points"
        }, {
            cmd: "realpath -m /tmp/new-project/config.toml",
            desc: "Resolve a path before the files exist (e.g. in a provisioning script)"
        }, {
            cmd: "realpath --relative-to=/home/user/app config/default.yaml",
            desc: "Compute a relative path for use inside a config file"
        }],
        lab: {
            objective: "Understand symlink resolution in deployment paths.",
            steps: ["mkdir -p /tmp/real_dir", "ln -s /tmp/real_dir /tmp/link_dir",
                "realpath /tmp/link_dir    # prints /tmp/real_dir", "cd /tmp/link_dir && realpath ."
            ],
            verify: "realpath always prints the physical absolute location, never a relative one.",
            cleanup: "rm -rf /tmp/real_dir /tmp/link_dir"
        },
        production: "Used at the top of enterprise deploy scripts to convert relative arguments into stable absolute paths — config files, secrets, and artifacts are then always located relative to a resolved root regardless of cwd.",
        troubleshooting: "When a service 'cannot find file X' even though ls shows it, run realpath on the symlinked config path — the target is usually missing or on another mount than expected.",
        interview: ["Difference between realpath and readlink -f?",
            "How would you make a container entrypoint robust to being started from any working directory?",
            "What does canonicalize-missing do and when would a provisioning script need it?"
        ],
        bestPractices: ["Anchor every path in cron jobs and systemd ExecStart with $(realpath ...) to eliminate cwd-dependence."],
        mistakes: ["Passing relative paths from cron (whose cwd is $HOME) into scripts that assume a different base directory."],
        alternatives: ["readlink -f (equivalent resolution, BSD/GNU differences exist)", "$PWD (current dir only, no resolution)"],
        summary: "realpath converts any path — symlinked or relative — into the canonical absolute path your scripts can trust."
    }, {
        name: "dirname",
        level: 1,
        meaning: "Prints the directory portion of a path (everything before the last component).",
        memory: "DIRNAME = 'directory NAME'. The folder part of a file path. Opposite of basename.",
        syntax: "dirname PATH",
        options: [{
            flag: "-z, --zero",
            desc: "Separate output with NUL instead of newline (safe for weird filenames)."
        }],
        examples: [{
            cmd: "dirname /etc/nginx/nginx.conf",
            desc: "Prints /etc/nginx"
        }, {
            cmd: "dirname /usr/local/bin/myapp",
            desc: "Prints /usr/local/bin"
        }],
        lab: {
            objective: "Use dirname to locate files relative to a script.",
            steps: ["echo '#!/bin/bash' > /tmp/show_dir.sh", "echo 'echo \\\"Config: \\\"\\$(dirname \\\"\\$0\\\")/config.yaml' >> /tmp/show_dir.sh",
                "chmod +x /tmp/show_dir.sh", "bash /tmp/show_dir.sh"
            ],
            verify: "The script reports the directory that contains it, regardless of where it is invoked from.",
            cleanup: "rm -f /tmp/show_dir.sh"
        },
        production: "Composed with $0 to make scripts self-locating: DIR=$(cd \"$(dirname \"$0\")\" && pwd) is the canonical idiom for enterprise init scripts and cron jobs.",
        troubleshooting: "When systemd unit files break after a move, the ExecStart path must be rebuilt with dirname-style absolute paths — hardcoded relative paths are the usual culprit.",
        interview: ["What is the standard idiom to get a bash script's own directory?",
            "Why does dirname alone not give an absolute path?",
            "What does dirname return for a bare filename like app.log?"
        ],
        bestPractices: ["Combine dirname with cd and pwd to always derive an absolute script directory."],
        mistakes: ["Forgetting that dirname does not resolve symlinks or produce absolute output on its own."],
        alternatives: ["${var%/*} (bash parameter expansion, no fork)", "$(cd \"$(dirname \"$0\")\" && pwd) (absolute + resolved)"],
        summary: "dirname extracts the directory part of a path — the bedrock of self-locating shell scripts."
    }, {
        name: "basename",
        level: 1,
        meaning: "Prints the last component (file name) of a path, optionally stripping a suffix.",
        memory: "BASENAME = the 'base NAME'. The file part at the end of a path. Opposite of dirname.",
        syntax: "basename PATH [SUFFIX]",
        options: [{
            flag: "-s, --suffix=SUFFIX",
            desc: "Strip a trailing suffix from the result (e.g. .conf)."
        }, {
            flag: "-z, --zero",
            desc: "Separate output with NUL instead of newline."
        }],
        examples: [{
            cmd: "basename /etc/nginx/nginx.conf",
            desc: "Prints nginx.conf"
        }, {
            cmd: "basename /var/log/app.log .log",
            desc: "Prints app"
        }],
        lab: {
            objective: "Extract safe names from full paths in automation.",
            steps: ["basename /var/log/nginx/access.log", "basename /var/log/nginx/access.log .log",
                "for f in /etc/*.conf; do echo \"\\$(basename \"\\$f\")\"; done"
            ],
            verify: "Each iteration prints only the file name, never the full path.",
            cleanup: "none needed"
        },
        production: "Enterprise log shippers and backup scripts use basename to derive metric/task names from file paths — e.g. tagging metrics with the log file name instead of the full path.",
        troubleshooting: "If a cleanup job accidentally deletes directories, check whether basename was applied before rm — using the full path (or an empty basename for root paths) is a common foot-gun.",
        interview: ["What is the difference between basename and dirname?",
            "How do you strip a double extension like .tar.gz?",
            "Why is basename important when writing idempotent deploy tasks?"
        ],
        bestPractices: ["Quote arguments (basename \"$file\") so names with spaces survive."],
        mistakes: ["Calling basename on an argument that is already a bare name and then concatenating paths — path depth assumptions break."],
        alternatives: ["${path##*/} (bash parameter expansion, no fork)", "realpath + sed (overkill but explicit)"],
        summary: "basename gives you just the file name from any path — the standard way to name tasks, tags, and temp files in automation."
    }],
    filemgmt: [{
        name: "stat",
        level: 2,
        meaning: "Displays detailed metadata (permissions, size, timestamps, inode) about a file or filesystem.",
        memory: "STAT = stats. Like the file properties dialog: mode, owner, size, birth time, inode number.",
        syntax: "stat [OPTION]... FILE",
        options: [{
            flag: "-c, --format=FORMAT",
            desc: "Custom output format, e.g. %n %s %U. Perfect for scripts."
        }, {
            flag: "-f, --file-system",
            desc: "Show filesystem (not file) status — mount, block count, free space."
        }, {
            flag: "-t, --terse",
            desc: "One-line machine-readable output."
        }],
        examples: [{
            cmd: "stat /etc/hosts",
            desc: "Full metadata for /etc/hosts"
        }, {
            cmd: "stat -c '%U %s %y' /var/log/nginx/access.log",
            desc: "Owner, size, and last-modified time in one line"
        }, {
            cmd: "stat -f /var/lib/docker",
            desc: "Filesystem-level info for the docker storage mount"
        }],
        lab: {
            objective: "Read filesystem metadata like a systems engineer.",
            steps: ["touch /tmp/stat_test.txt", "stat /tmp/stat_test.txt",
                "stat -c '%n is %s bytes owned by %U' /tmp/stat_test.txt", "stat -f /"
            ],
            verify: "Output shows at minimum size, owner, inode, and modify time.",
            cleanup: "rm -f /tmp/stat_test.txt"
        },
        production: "Incident triage relies on stat -c to compare mtimes of configs and logs, detect files unexpectedly changed (inode/ctime anomalies), and check that a mounted volume really is the expected filesystem.",
        troubleshooting: "When a file is replaced but 'looks the same', stat the inode before and after — a new inode proves it was re-created, not edited.",
        interview: ["Explain the difference between mtime, ctime, and atime.",
            "How would you detect that a config file was recently modified by an attacker?",
            "What does %a in stat -c return and why is it useful?"
        ],
        bestPractices: ["Use stat -c with explicit formats in scripts instead of parsing verbose human output."],
        mistakes: ["Treating stat's full text output as stable across coreutils versions — always use -c."],
        alternatives: ["ls -la (quick view, less detail)", "inotifywait (watching for changes rather than snapshotting)"],
        summary: "stat exposes the filesystem's ground truth about a file — size, ownership, timestamps, and inode — the facts behind every 'was this changed?' question."
    }, {
        name: "ln",
        level: 2,
        meaning: "Creates hard or symbolic links between files.",
        memory: "LN = LiNk. A shortcut (symbolic) or a second name for the same data (hard link).",
        syntax: "ln [OPTION]... TARGET LINK_NAME",
        options: [{
            flag: "-s, --symbolic",
            desc: "Create a symbolic link (default is a hard link)."
        }, {
            flag: "-f, --force",
            desc: "Remove existing destination files before linking."
        }, {
            flag: "-n, --no-dereference",
            desc: "Treat a symlink destination as a normal file, not a directory."
        }, {
            flag: "-r, --relative",
            desc: "Create a relative symlink (works with -s)."
        }],
        examples: [{
            cmd: "ln -s /opt/app/config.yaml /etc/app-config.yaml",
            desc: "Symlink a config into /etc without duplicating it"
        }, {
            cmd: "ln file1 file2",
            desc: "Create a hard link: file1 and file2 share the same inode"
        }, {
            cmd: "ln -sf /opt/app/current /var/www/site",
            desc: "Force-repoint a symlink for zero-downtime deploys"
        }],
        lab: {
            objective: "Understand hard vs symbolic links.",
            steps: ["echo hello > /tmp/orig.txt", "ln /tmp/orig.txt /tmp/hard.txt",
                "ln -s /tmp/orig.txt /tmp/sym.txt", "ls -li /tmp/orig.txt /tmp/hard.txt /tmp/sym.txt",
                "rm /tmp/orig.txt && cat /tmp/hard.txt   # still works", "cat /tmp/sym.txt       # broken now"
            ],
            verify: "The hard link survives deletion of the original; the symlink breaks.",
            cleanup: "rm -f /tmp/hard.txt /tmp/sym.txt"
        },
        production: "Enterprise release engineering uses ln -sfn to switch a 'current' symlink atomically between versioned directories, giving zero-downtime rollbacks without touching running processes.",
        troubleshooting: "A symlinked binary 'suddenly not found' after a release — the symlink target was overwritten or the versioned directory pruned; readlink and ls -l reveal the target.",
        interview: ["What is the difference between a hard link and a symbolic link?",
            "Why can't you hard-link a directory or a file on another filesystem?",
            "How does ln -s make atomic deploys possible?"
        ],
        bestPractices: ["Use ln -sfn (not plain -s) in release scripts so the link is atomically replaced."],
        mistakes: ["Creating hard links across filesystems (fails) or symlinking with a relative target that breaks when cwd changes."],
        alternatives: ["cp (copy instead of link — independent data)", "mount --bind (directory-level aliasing)"],
        summary: "ln creates links — symlinks for versioned switch-overs and hard links for same-filesystem aliases."
    }, {
        name: "readlink",
        level: 2,
        meaning: "Prints the target that a symbolic link points to.",
        memory: "READLINK = READ the LINK. Ask the symlink 'what do you point at?'.",
        syntax: "readlink [OPTION]... FILE",
        options: [{
            flag: "-f, --canonicalize",
            desc: "Resolve the entire chain of symlinks to the final real path."
        }, {
            flag: "-e, --canonicalize-existing",
            desc: "Like -f but fails if the final file does not exist."
        }, {
            flag: "-n, --no-newline",
            desc: "Do not print a trailing newline."
        }],
        examples: [{
            cmd: "readlink /etc/localtime",
            desc: "Show which timezone zoneinfo file is active"
        }, {
            cmd: "readlink -f /proc/self/exe",
            desc: "Get the real path of the current executable"
        }],
        lab: {
            objective: "Inspect symlink chains safely.",
            steps: ["ln -sf /etc/hostname /tmp/mylink", "readlink /tmp/mylink",
                "ln -sf /tmp/mylink /tmp/chain", "readlink -f /tmp/chain"
            ],
            verify: "readlink -f resolves the whole chain to the real file.",
            cleanup: "rm -f /tmp/mylink /tmp/chain"
        },
        production: "Audit scripts check readlink -f /proc/<pid>/exe to confirm exactly which binary a running process is using — the definitive way to detect a restarted process running a new release.",
        troubleshooting: "When two services seem to edit the same file, readlink each of their symlinked paths — they likely point at different real files behind the scenes.",
        interview: ["Difference between readlink and readlink -f?",
            "How would you confirm which version of a binary a running process is executing?",
            "What does /proc/<pid>/exe give you?"
        ],
        bestPractices: ["Always use readlink -f for canonical resolution; plain readlink only prints one hop."],
        mistakes: ["Assuming a symlink target is absolute when it may be relative to the link's directory."],
        alternatives: ["realpath (canonicalize a path, not just a link)", "ls -l (shows the target inline)"],
        summary: "readlink reveals where symlinks actually point — essential for verifying deployments and auditing processes."
    }],
    viewing: [{
        name: "tac",
        level: 1,
        meaning: "Concatenates files in reverse line order (last line first).",
        memory: "TAC = CAT spelled backwards. cat in reverse — lines come out newest-last-first.",
        syntax: "tac [OPTION]... [FILE]...",
        options: [{
            flag: "-s, --separator=SEP",
            desc: "Use a custom record separator instead of newline."
        }, {
            flag: "-b, --before",
            desc: "Place the separator before the record instead of after."
        }],
        examples: [{
            cmd: "tac app.log",
            desc: "Print a log file newest line first for quick tail-style review"
        }, {
            cmd: "tail -n 100 app.log | tac",
            desc: "Reverse the last 100 lines to see them chronologically backwards"
        }],
        lab: {
            objective: "Reverse-order file reading for log analysis.",
            steps: ["printf 'one\\ntwo\\nthree\\n' > /tmp/rev.txt", "cat /tmp/rev.txt", "tac /tmp/rev.txt"
            ],
            verify: "tac prints three, two, one.",
            cleanup: "rm -f /tmp/rev.txt"
        },
        production: "In incident response, tac a log to read the newest events first without the memory cost of 'wc -l' scanning — especially on multi-GB application logs.",
        troubleshooting: "When the standard tail -f pattern is needed in reverse for a specific line count, tac with head -n is a reliable alternative that avoids reading the whole file into memory.",
        interview: ["How is tac different from tail -r on other systems?",
            "What is a practical scenario where tac beats tail?",
            "What separator does tac use by default and when would you change it?"
        ],
        bestPractices: ["Pair tac with grep to find the most recent matching log lines first."],
        mistakes: ["Using tac on binary files where a byte-level reverse is meaningless."],
        alternatives: ["tail -r (BSD)", "awk 'END{for(i=NR;i>0;i--) print a[i]}' (slow, avoid)"],
        summary: "tac prints files in reverse line order — the fastest way to read log files newest-first."
    }, {
        name: "xxd",
        level: 2,
        meaning: "Creates a hex dump of a file or binary, or reverses a hex dump back to binary.",
        memory: "XXD = HEX DUMP. Two x's for hex — it turns bytes into hexadecimal.",
        syntax: "xxd [OPTION]... [FILE]",
        options: [{
            flag: "-c, --cols=COLS",
            desc: "Bytes per output line (default 16)."
        }, {
            flag: "-l, --len=N",
            desc: "Stop after N bytes."
        }, {
            flag: "-r, --revert",
            desc: "Reverse: convert a hex dump back into the original binary."
        }, {
            flag: "-p, --plain",
            desc: "Plain hexdump without line numbers or ASCII column."
        }, {
            flag: "-i, --include",
            desc: "Output a C include array (embed binaries in code)."
        }],
        examples: [{
            cmd: "xxd /bin/ls | head",
            desc: "Hex dump the first bytes of the ls binary"
        }, {
            cmd: "xxd -l 64 secrets.txt",
            desc: "Inspect only the first 64 bytes"
        }, {
            cmd: "echo 'ABCD' | xxd -p",
            desc: "Plain hex: 41424344"
        }],
        lab: {
            objective: "Inspect and reconstruct binary data.",
            steps: ["printf '\\x48\\x65\\x6c\\x6c\\x6f' > /tmp/hi.bin", "xxd /tmp/hi.bin",
                "xxd /tmp/hi.bin > /tmp/hi.hex", "xxd -r /tmp/hi.hex > /tmp/hi2.bin", "cat /tmp/hi2.bin"
            ],
            verify: "The reconstructed file prints Hello and matches the original bytes.",
            cleanup: "rm -f /tmp/hi.bin /tmp/hi.hex /tmp/hi2.bin"
        },
        production: "Binary protocol debugging and malware forensics use xxd to inspect packet payloads and file magic bytes (first 4 bytes identify PNG/ELF/ZIP) when strings alone are not enough.",
        troubleshooting: "When a downloaded file is 'corrupted', xxd the first bytes against the expected magic number to see if the download is HTML error text or a real binary.",
        interview: ["What are file magic bytes and how do you inspect them?",
            "How does xxd -r reconstruct a file from a hex dump?",
            "When would you use xxd -i in an embedded project?"
        ],
        bestPractices: ["Check the first bytes of unknown files with xxd -l 16 to identify file type before executing or mounting."],
        mistakes: ["Reverting a dump that lost the ASCII/offset columns without using plain mode."],
        alternatives: ["od -A x -t x1z (octal/hex dump, POSIX)", "hexdump -C (BSD-style hex dump)"],
        summary: "xxd turns bytes into readable hex (and back) — the forensic standard for inspecting unknown binary content."
    }],
    permissions: [{
        name: "setfacl",
        level: 3,
        meaning: "Sets access control list (ACL) entries on a file or directory, granting permissions beyond the classic ugo/rwx model.",
        memory: "SET FACL = SET the File Access Control List. Fine-grained 'who may do what' beyond chmod's three buckets.",
        syntax: "setfacl [-m|-x] ENTRY FILE",
        options: [{
            flag: "-m, --modify",
            desc: "Add or modify an entry, e.g. u:alice:rw or m::r-x."
        }, {
            flag: "-x, --remove",
            desc: "Remove a specific entry."
        }, {
            flag: "-b, --remove-all",
            desc: "Remove all extended ACL entries."
        }, {
            flag: "-R, --recursive",
            desc: "Apply to files and directories recursively."
        }, {
            flag: "-d, --default",
            desc: "Set a default ACL inherited by files created in the directory."
        }, {
            flag: "-k, --remove-default",
            desc: "Remove the default ACL."
        }],
        examples: [{
            cmd: "setfacl -m u:jenkins:rwx /var/lib/deploy",
            desc: "Give the jenkins user rwx without touching group ownership"
        }, {
            cmd: "setfacl -m g:devteam:r-x -R /srv/shared",
            desc: "Grant a group read/execute recursively"
        }, {
            cmd: "setfacl -m d:u:backup:rwx /srv/shared",
            desc: "Default ACL so new files inherit backup access"
        }, {
            cmd: "setfacl -b /srv/shared",
            desc: "Strip all extended ACLs, back to pure chmod semantics"
        }],
        lab: {
            objective: "Delegate access to a shared directory with ACLs.",
            steps: ["mkdir -p /tmp/acl_share", "useradd -M testuser1 2>/dev/null || true",
                "setfacl -m u:testuser1:rwx /tmp/acl_share", "getfacl /tmp/acl_share",
                "setfacl -b /tmp/acl_share"
            ],
            verify: "getfacl shows an ACL entry naming testuser1 with rwx.",
            cleanup: "rm -rf /tmp/acl_share"
        },
        production: "Enterprise shared storage (NFS/CIFS-backed project dirs) uses setfacl to grant per-person or per-team rights to shared folders while keeping group ownership stable — the standard solution when chmod's three buckets are not enough.",
        troubleshooting: "When an app 'can write' for one user but not another despite identical group, run getfacl — an overriding ACL entry is the likely cause.",
        interview: ["How do ACL entries coexist with classic chmod permissions?",
            "What does the mask entry do in a POSIX ACL?",
            "Why must the filesystem be mounted with acl support for this to work?"
        ],
        bestPractices: ["Use -d default ACLs for shared directories so new files inherit the intended access."],
        mistakes: ["Forgetting that chmod on the group now only adjusts the ACL mask — a common source of confusion."],
        alternatives: ["chmod/chown (simpler, three buckets)", "getfacl (read side of the same mechanism)"],
        summary: "setfacl extends beyond chmod to grant precise per-user or per-group access on shared enterprise files."
    }, {
        name: "getfacl",
        level: 2,
        meaning: "Displays the access control list (ACL) entries of a file or directory.",
        memory: "GET FACL = GET the File Access Control List. The read side of setfacl — see exactly who has what.",
        syntax: "getfacl [OPTION]... FILE",
        options: [{
            flag: "-p, --absolute-names",
            desc: "Do not strip leading slashes from path names."
        }, {
            flag: "-R, --recursive",
            desc: "List ACLs of files recursively."
        }, {
            flag: "-c, --omit-header",
            desc: "Print only the ACL entries without the file header."
        }],
        examples: [{
            cmd: "getfacl /srv/shared",
            desc: "Show all ACL entries for the shared directory"
        }, {
            cmd: "getfacl -R /srv/shared | head -40",
            desc: "Audit ACLs across the whole tree"
        }],
        lab: {
            objective: "Audit who really has access to a file.",
            steps: ["touch /tmp/acl_view.txt", "getfacl /tmp/acl_view.txt",
                "setfacl -m u:testuser1:r-- /tmp/acl_view.txt", "getfacl /tmp/acl_view.txt"
            ],
            verify: "The second getfacl shows the testuser1 entry added by setfacl.",
            cleanup: "rm -f /tmp/acl_view.txt"
        },
        production: "Compliance audits generate getfacl -R output to prove exactly which users can read sensitive directories — the auditable record of access control on enterprise storage.",
        troubleshooting: "An app reporting permission denied despite 'rwx' showing in ls — getfacl exposes the ACL mask that ls hides, revealing the real effective permission.",
        interview: ["What is the effective permission when an ACL mask is present?",
            "How do you spot that a file has extended ACLs from ls alone?",
            "What does the comment # effective: at the end of an entry mean?"
        ],
        bestPractices: ["Run getfacl before setfacl -b to record the current state you are about to change."],
        mistakes: ["Reading the mask entry as a group permission — it caps all named/group entries."],
        alternatives: ["ls -l (shows a + marker when ACLs exist)", "setfacl (write side of the same mechanism)"],
        summary: "getfacl shows the complete access picture of a file — the audit tool for ACL-protected shared storage."
    }],
    process: [{
        name: "pgrep",
        level: 2,
        meaning: "Looks up processes by name or attributes and prints their PIDs.",
        memory: "PGREP = Process GREP. grep for process IDs instead of text.",
        syntax: "pgrep [OPTION]... PATTERN",
        options: [{
            flag: "-f",
            desc: "Match against the full command line, not just the executable name."
        }, {
            flag: "-u, --euid=USER",
            desc: "Only match processes owned by the given user."
        }, {
            flag: "-a, --list-name",
            desc: "Print PID together with the process name."
        }, {
            flag: "-x, --exact",
            desc: "Require an exact name match (no substring)."
        }, {
            flag: "-n / -o",
            desc: "Newest or oldest matching process only."
        }],
        examples: [{
            cmd: "pgrep -u www-data nginx",
            desc: "PIDs of nginx workers owned by www-data"
        }, {
            cmd: "pgrep -af 'java -jar app.jar'",
            desc: "Full command line match for a specific Java app"
        }, {
            cmd: "pgrep -x sshd",
            desc: "Exact-name match only, avoiding false hits on child processes"
        }],
        lab: {
            objective: "Find processes precisely before acting on them.",
            steps: ["sleep 300 &", "sleep 300 &", "pgrep sleep",
                "pgrep -af sleep", "pkill sleep"
            ],
            verify: "pgrep lists the two sleep PIDs; pkill then removes them.",
            cleanup: "pkill sleep 2>/dev/null || true"
        },
        production: "Orchestration scripts use pgrep -f with full command lines to locate app instances before restart or cleanup, and to guard idempotent launchers so duplicate daemons never start.",
        troubleshooting: "When a service restarts itself repeatedly, pgrep -af shows every matching command — revealing a wrapper script or supervisor spawning the real binary.",
        interview: ["Difference between pgrep and pgrep -f?",
            "Why use -x for exact matching?",
            "How does pgrep help avoid killing the wrong process?"
        ],
        bestPractices: ["Always review pgrep -af output before pkill — one pattern typo can kill unrelated processes."],
        mistakes: ["Matching a substring like 'python' which also matches the monitoring agent watching it."],
        alternatives: ["pidof (exact program name only)", "ps aux | grep (classic, less precise)"],
        summary: "pgrep finds process IDs by name or full command line — the precise first step before any kill."
    }, {
        name: "timeout",
        level: 2,
        meaning: "Runs a command with a time limit and kills it if it exceeds the limit.",
        memory: "TIMEOUT = a watchdog. If the command outlives the timer, timeout pulls the trigger.",
        syntax: "timeout [OPTION] DURATION COMMAND [ARG]...",
        options: [{
            flag: "-s, --signal=SIG",
            desc: "Signal to send when the limit is hit (default TERM)."
        }, {
            flag: "-k, --kill-after=DUR",
            desc: "After the first signal, send KILL if the process is still alive."
        }, {
            flag: "--preserve-status",
            desc: "Return the command's exit status even when it times out."
        }],
        examples: [{
            cmd: "timeout 5 curl -s http://slow-api.example.com",
            desc: "Give a slow HTTP call 5 seconds max"
        }, {
            cmd: "timeout -k 2 10s my-slow-script.sh",
            desc: "TERM after 10s, KILL 2s later if still alive"
        }, {
            cmd: "timeout 30 apt-get update",
            desc: "Bound an apt update in CI so it never hangs a pipeline"
        }],
        lab: {
            objective: "Protect automation against hung commands.",
            steps: ["timeout 2 sleep 10; echo \"exit: \\$?\"",
                "timeout -k 1 3 ping -i 1 8.8.8.8 || echo 'bounded'"
            ],
            verify: "The first command returns quickly with exit code 124 (timed out).",
            cleanup: "none needed"
        },
        production: "CI pipelines and cron jobs wrap every external call in timeout so a hung NFS mount or dead API never stalls the release train — 124 is treated as a distinct 'timed out' failure code.",
        troubleshooting: "A job that 'never finishes' is usually waiting on a network read; wrapping it in timeout -k 2 30s turns a silent hang into a fast, diagnosable timeout.",
        interview: ["What exit code does timeout return when it kills the command?",
            "Why combine --kill-after with the primary timeout?",
            "How does --preserve-status change automation behavior?"
        ],
        bestPractices: ["Always add timeout around network-dependent commands in unattended scripts."],
        mistakes: ["Wrapping daemons that are supposed to run forever in timeout — it will kill them."],
        alternatives: ["systemd TimeoutStartSec/TimeoutStopSec (for services)", "gtimeout (macOS)"],
        summary: "timeout enforces a wall-clock limit on any command — the standard guard against hung operations in production automation."
    }, {
        name: "watch",
        level: 1,
        meaning: "Re-runs a command every few seconds and shows its output, highlighting changes.",
        memory: "WATCH = keep an eye on it. A live dashboard for any command's output.",
        syntax: "watch [OPTION]... COMMAND",
        options: [{
            flag: "-n, --interval=SECS",
            desc: "Seconds between runs (default 2)."
        }, {
            flag: "-d, --differences",
            desc: "Highlight what changed between refreshes."
        }, {
            flag: "-t, --no-title",
            desc: "Hide the interval/title header."
        }],
        examples: [{
            cmd: "watch -n 1 free -h",
            desc: "Live memory dashboard"
        }, {
            cmd: "watch -d ss -s",
            desc: "Watch TCP socket counts and see changes highlighted"
        }, {
            cmd: "watch -n 5 'ls -l /tmp/out'",
            desc: "Poll for a file to appear in a temp dir"
        }],
        lab: {
            objective: "Monitor changing system state.",
            steps: ["watch -n 1 df -h /tmp", "watch -d 'ps -e --no-headers | wc -l'"
            ],
            verify: "Output refreshes every second with the header showing the interval.",
            cleanup: "Press Ctrl-C to exit watch."
        },
        production: "On-call engineers watch -d log tail lines or connection counts during a rollout to visually confirm a metric is moving (or stuck) without building a dashboard.",
        troubleshooting: "When a deployment appears frozen, watch -d 'ps -e | grep -c app' reveals whether workers are being recreated or actually stopped.",
        interview: ["How does -d help during a rollout?",
            "What is the default interval and how do you change it?",
            "Why is watch better than a manual while loop for monitoring?"
        ],
        bestPractices: ["Use -d so intermittent changes are visible across refreshes."],
        mistakes: ["Watching with very short -n 0.1 intervals that spike CPU on large ps/grep outputs."],
        alternatives: ["top/htop (built-in refresh loops)", "tmux + tail -f (log-specific follow)"],
        summary: "watch repeatedly runs a command and highlights changes — a zero-dependency live monitoring loop."
    }, {
        name: "pstree",
        level: 1,
        meaning: "Shows running processes as a tree, revealing parent/child relationships.",
        memory: "PSTREE = Process TREE. Processes are a family — pstree draws the family tree.",
        syntax: "pstree [OPTION]... [PID|USER]",
        options: [{
            flag: "-p, --show-pids",
            desc: "Show PIDs next to each process."
        }, {
            flag: "-a, --arguments",
            desc: "Show full command-line arguments."
        }, {
            flag: "-u, --uid-changes",
            desc: "Mark processes whose user id differs from the parent."
        }],
        examples: [{
            cmd: "pstree -p",
            desc: "Full process tree with PIDs"
        }, {
            cmd: "pstree -ap | head -30",
            desc: "Tree with arguments, top of the tree"
        }, {
            cmd: "pstree -p 1234",
            desc: "Show the subtree rooted at PID 1234"
        }],
        lab: {
            objective: "Trace process ancestry.",
            steps: ["sleep 300 &", "pgrep -n sleep", "pstree -p \\$(pgrep -n sleep)", "pstree -ap | head -20"
            ],
            verify: "The sleep process is shown as a child of the shell.",
            cleanup: "pkill sleep 2>/dev/null || true"
        },
        production: "When a service spawns zombie or orphaned children, pstree shows the lineage instantly — revealing that the app forks worker processes that should be reaped or supervised differently.",
        troubleshooting: "An orphaned process still holding a port — pstree -p reveals it was reparented to init, meaning its original supervisor died.",
        interview: ["How is a zombie process represented in pstree?",
            "Why does pstree reveal daemon vs foreground processes at a glance?",
            "What does a process reparented to PID 1 tell you?"
        ],
        bestPractices: ["Use pstree -ap to combine ancestry with exact command lines when investigating runaway forks."],
        mistakes: ["Assuming ps alone shows parentage — it needs PPID column parsing; pstree does it visually."],
        alternatives: ["ps -ef --forest (text tree)", "htop (interactive tree view, F5)"],
        summary: "pstree renders the process family tree — the fastest way to understand what spawned what on a busy server."
    }],
    textproc: [{
        name: "xargs",
        level: 3,
        meaning: "Builds and executes commands from standard input, turning lines of input into command arguments.",
        memory: "XARGS = eXtended ARGumentS. The 'for each line, run this' workhorse that turns a list into a command.",
        syntax: "command | xargs [OPTION]... COMMAND",
        options: [{
            flag: "-n, --max-args=N",
            desc: "Use at most N arguments per command invocation."
        }, {
            flag: "-P, --max-procs=N",
            desc: "Run up to N commands in parallel."
        }, {
            flag: "-I REPLSTR",
            desc: "Replace occurrences of REPLSTR in the command with each input line."
        }, {
            flag: "-0, --null",
            desc: "Input items are NUL-separated (safe for filenames with spaces)."
        }, {
            flag: "-r, --no-run-if-empty",
            desc: "Do nothing if input is empty."
        }],
        examples: [{
            cmd: "find /var/log -name '*.log' -mtime +30 | xargs gzip",
            desc: "Compress old log files"
        }, {
            cmd: "cat hosts.txt | xargs -P 5 -n 1 ping -c 1",
            desc: "Ping 5 hosts in parallel"
        }, {
            cmd: "find . -type f -print0 | xargs -0 grep -l 'TODO'",
            desc: "Safe grep across files whose names may contain spaces"
        }, {
            cmd: "seq 1 1000 | xargs -n 100 -P 8 curl -s -o /dev/null http://api.local/item/{}",
            desc: "Fan out 1000 HTTP checks across 8 parallel workers"
        }],
        lab: {
            objective: "Pipe a list into a command safely and in parallel.",
            steps: ["mkdir -p /tmp/xa && touch /tmp/xa/a.txt /tmp/xa/b.txt /tmp/xa/c.txt",
                "ls /tmp/xa | xargs -n 1 echo found:", "find /tmp/xa -print0 | xargs -0 rm", "ls /tmp/xa"
            ],
            verify: "All three files are deleted via xargs.",
            cleanup: "rm -rf /tmp/xa"
        },
        production: "Enterprise operations batch hundreds of tasks with xargs -P — parallel restarts, mass key distribution, multi-host health pings — where the parallelism is limited by -P and argument chunking by -n.",
        troubleshooting: "When xargs truncates or skips filenames with spaces, the cause is word-splitting — switch the pipeline to -print0 | xargs -0.",
        interview: ["Why is xargs -0 important for real-world filenames?",
            "What is the difference between -n and -I?",
            "How does -P provide parallelism that a plain pipe cannot?"
        ],
        bestPractices: ["Pair xargs with -0 whenever input comes from find — spaces and newlines in names are a fact of life."],
        mistakes: ["Using default word-splitting on untrusted filenames; running destructive commands without a dry run."],
        alternatives: ["find -exec {} + (built-in batch)", "GNU parallel (richer parallel job control)"],
        summary: "xargs converts streamed lines into command arguments and adds bounded parallelism — the batch engine of the shell."
    }, {
        name: "tee",
        level: 1,
        meaning: "Reads standard input and writes it both to standard output and to one or more files.",
        memory: "TEE = a T-pipe: one stream in, two streams out — like a plumbing T-junction.",
        syntax: "command | tee [OPTION]... FILE",
        options: [{
            flag: "-a, --append",
            desc: "Append to the file instead of overwriting."
        }, {
            flag: "-i, --ignore-interrupts",
            desc: "Ignore interrupt signals."
        }],
        examples: [{
            cmd: "curl -s http://example.com/api/data | tee /tmp/response.json | jq .",
            desc: "Save a response while also viewing it parsed"
        }, {
            cmd: "docker build -t app . 2>&1 | tee build.log",
            desc: "See build output live AND keep a log"
        }, {
            cmd: "sudo tee /etc/app/config.yaml > /dev/null <<< '\\$CONTENT'",
            desc: "Write content into a root-owned file from a script variable"
        }],
        lab: {
            objective: "Mirror command output to a file while watching it.",
            steps: ["seq 1 5 | tee /tmp/tee_out.txt", "cat /tmp/tee_out.txt"
            ],
            verify: "Numbers appear on screen and are saved to /tmp/tee_out.txt.",
            cleanup: "rm -f /tmp/tee_out.txt"
        },
        production: "Deployment pipelines use tee to capture every provisioning step to a log while keeping the output visible to the operator — the audit trail for 'what exactly ran'.",
        troubleshooting: "When an installer fails but the terminal scrolled, the tee log is the recovery path — grep the captured output for the first error instead of rerunning.",
        interview: ["What is the difference between tee and redirection alone?",
            "Why is sudo tee used to write root-owned files?",
            "How does tee -a preserve prior logs?"
        ],
        bestPractices: ["Log every non-interactive provision step with tee -a so root causes are replayable."],
        mistakes: ["Using plain tee (not -a) on logs you meant to append to — silently truncating history."],
        alternatives: ["script (full session recorder)", "2>&1 | tee (capture stderr too)"],
        summary: "tee duplicates a stream — output stays visible while a permanent copy lands in a file."
    }, {
        name: "diff",
        level: 2,
        meaning: "Compares two files or directories line by line and reports the differences.",
        memory: "DIFF = difference. Show me what changed between A and B.",
        syntax: "diff [OPTION]... FILE1 FILE2",
        options: [{
            flag: "-u",
            desc: "Unified format — the standard for patches and code review."
        }, {
            flag: "-r, --recursive",
            desc: "Compare directories recursively."
        }, {
            flag: "-q, --brief",
            desc: "Only report that files differ, not how."
        }, {
            flag: "-w, --ignore-all-space",
            desc: "Ignore whitespace differences."
        }],
        examples: [{
            cmd: "diff -u nginx.conf.bak nginx.conf",
            desc: "See what changed after a manual config edit"
        }, {
            cmd: "diff -rq /etc/nginx /srv/config-backup",
            desc: "Quickly find which config files differ from backup"
        }],
        lab: {
            objective: "Compare configurations before and after a change.",
            steps: ["cp /etc/hostname /tmp/h1", "echo extra >> /tmp/h1",
                "diff -u /etc/hostname /tmp/h1"
            ],
            verify: "diff shows a +extra line in unified format.",
            cleanup: "rm -f /tmp/h1"
        },
        production: "Configuration drift detection diffs live configs against a git checkout or backup; a non-empty diff is the alarm. CI also uses diff to enforce that generated configs are committed.",
        troubleshooting: "When an app 'behaves differently' after a config restore, diff -w the restored file against the known-good copy to find hidden whitespace or trailing characters.",
        interview: ["What is unified diff format and why is it standard?",
            "How would you detect configuration drift across servers?",
            "What does -q give you that -u does not?"
        ],
        bestPractices: ["Save config backups with timestamps and diff -u them after every change window."],
        mistakes: ["Diffing files with CRLF vs LF line endings — every line shows as changed."],
        alternatives: ["cmp (byte-level, exit status only)", "git diff (versioned diffs with context)"],
        summary: "diff pinpoints exactly what changed between two files — the eyes of configuration and code review."
    }],
    disk: [{
        name: "blkid",
        level: 2,
        meaning: "Shows the attributes of block devices: filesystem type, UUID, and LABEL.",
        memory: "BLKID = BLock device ID. It fingerprints storage — type, UUID, label — so you can refer to disks reliably.",
        syntax: "blkid [OPTION]... [DEVICE]",
        options: [{
            flag: "-s, --match-token=TOKEN",
            desc: "Show only specific fields, e.g. -s UUID."
        }, {
            flag: "-o, --output-format=FMT",
            desc: "Output format: full, value, device, udev, export."
        }, {
            flag: "-p, --probe",
            desc: "Probe the device directly, ignoring cache."
        }],
        examples: [{
            cmd: "blkid",
            desc: "List all known block devices with UUIDs and types"
        }, {
            cmd: "blkid -s UUID /dev/sdb1",
            desc: "Just the UUID of /dev/sdb1"
        }, {
            cmd: "blkid -o value -s LABEL /dev/sda1",
            desc: "Print only the label value for scripts"
        }],
        lab: {
            objective: "Identify disks by UUID instead of device name.",
            steps: ["blkid", "lsblk -f"
            ],
            verify: "Every formatted device shows a UUID and filesystem type.",
            cleanup: "none needed (read-only command)"
        },
        production: "fstab entries in every production server reference devices by UUID= (captured with blkid) because kernel device names like /dev/sda can shuffle between boots and cloud restarts.",
        troubleshooting: "When a server fails to boot with 'UUID=xxx does not exist', run blkid from rescue media and reconcile the fstab UUID with the actual device.",
        interview: ["Why is mounting by UUID preferred over /dev/sdX in production?",
            "What is the difference between UUID and LABEL?",
            "Why might blkid and lsblk -f disagree on a filesystem?"
        ],
        bestPractices: ["Always add new mounts to fstab by blkid UUID, never by device name."],
        mistakes: ["Hardcoding /dev/sdb in scripts — device letters are not stable across reboots."],
        alternatives: ["lsblk -f (human-friendly tree)", "findmnt (resolve which device backs a mount)"],
        summary: "blkid fingerprints block devices with UUIDs and types — the source of truth for reliable fstab entries."
    }, {
        name: "fsck",
        level: 3,
        meaning: "Checks and repairs a filesystem's internal consistency.",
        memory: "FS CK = FileSystem ChecK. The doctor that examines the filesystem for structural damage.",
        syntax: "fsck [OPTION]... DEVICE",
        options: [{
            flag: "-y",
            desc: "Assume 'yes' to all repair prompts (non-interactive repair)."
        }, {
            flag: "-n",
            desc: "Assume 'no' — dry-run: report problems without fixing."
        }, {
            flag: "-f",
            desc: "Force a full check even if the filesystem looks clean."
        }, {
            flag: "-C, --progress",
            desc: "Show a progress bar (works with some filesystems)."
        }],
        examples: [{
            cmd: "fsck -n /dev/sdb1",
            desc: "Dry-run check: report problems, fix nothing"
        }, {
            cmd: "fsck -y /dev/sdb1",
            desc: "Repair non-interactively (device must be unmounted)"
        }, {
            cmd: "fsck -f /dev/sda1",
            desc: "Force a check of an apparently clean filesystem"
        }],
        lab: {
            objective: "Safe filesystem checking workflow.",
            steps: ["fsck -n / 2>/dev/null || echo 'root must be checked in rescue mode'",
                "tune2fs -l /dev/sda1 2>/dev/null | grep -i 'state\\|mount' || true"
            ],
            verify: "A non-interactive check runs without modifying anything.",
            cleanup: "none needed"
        },
        production: "Boot-time checks in /etc/fstab pass=N invoke fsck automatically; operators run fsck -n first on any suspect volume, then repair with -y only after verifying the filesystem is unmounted.",
        troubleshooting: "An instance stuck in 'filesystem check' at boot usually means fsck found real corruption — run it from a live/rescue image, never on a mounted production filesystem.",
        interview: ["Why must fsck never run on a mounted filesystem?",
            "What is the difference between -n and -y?",
            "How does the pass= field in fstab schedule checks?"
        ],
        bestPractices: ["Always fsck -n first to assess damage before committing to -y repairs."],
        mistakes: ["Running fsck on a mounted volume — it can corrupt the metadata it is trying to fix."],
        alternatives: ["tune2fs -c/-i (scheduled checks)", "xfs_repair (XFS-specific, same role)"],
        summary: "fsck validates and repairs filesystem structure — the last-resort recovery tool for damaged volumes."
    }, {
        name: "dd",
        level: 3,
        meaning: "Copies and converts data at the block level — the low-level workhorse for imaging and cloning.",
        memory: "DD = Data Duplicator. It streams raw bytes with surgical precision; with great power comes great responsibility.",
        syntax: "dd if=INPUT of=OUTPUT [OPTION]...",
        options: [{
            flag: "if=FILE",
            desc: "Input file (default stdin)."
        }, {
            flag: "of=FILE",
            desc: "Output file (default stdout)."
        }, {
            flag: "bs=N",
            desc: "Read and write N bytes at a time (block size)."
        }, {
            flag: "count=N",
            desc: "Copy only N blocks."
        }, {
            flag: "status=progress",
            desc: "Show a live transfer progress report."
        }, {
            flag: "conv=sync,noerror",
            desc: "Keep blocks aligned and continue past read errors."
        }],
        examples: [{
            cmd: "dd if=/dev/zero of=/tmp/test.img bs=1M count=100 status=progress",
            desc: "Create a 100MB zero-filled image"
        }, {
            cmd: "dd if=/dev/sda of=/dev/sdb bs=4M conv=sync,noerror status=progress",
            desc: "Clone an entire disk (block-level)"
        }, {
            cmd: "dd if=/dev/urandom of=/tmp/random.bin bs=1024 count=64",
            desc: "Generate 64KB of random data"
        }],
        lab: {
            objective: "Create and verify a block image safely.",
            steps: ["dd if=/dev/zero of=/tmp/disk.img bs=1M count=32 status=progress",
                "mkfs.ext4 /tmp/disk.img", "mkdir -p /tmp/mnt_img", "mount -o loop /tmp/disk.img /tmp/mnt_img",
                "umount /tmp/mnt_img"
            ],
            verify: "The loop-mounted image behaves like a real disk.",
            cleanup: "rm -rf /tmp/disk.img /tmp/mnt_img"
        },
        production: "Disaster-recovery runbooks use dd with conv=sync,noerror and bs=4M to clone failing disks sector-by-sector, and status=progress for long migrations; it is also how swap files and test images are made.",
        troubleshooting: "A disk with bad sectors 'cannot be read' — dd with conv=sync,noerror skips damaged blocks and still produces a mostly-complete image for forensic recovery.",
        interview: ["What does conv=sync,noerror do and why is it used for recovery?",
            "Why is dd destructive and why must of= be triple-checked?",
            "What is the purpose of bs and count?"
        ],
        bestPractices: ["Triple-check the of= target — one wrong letter destroys an entire disk. Prefer status=progress for long copies."],
        mistakes: ["Writing to the wrong of= device, or using small bs values that make imaging painfully slow."],
        alternatives: ["cp (file-level, safe)", "ddrescue (proper tool for failing disks)"],
        summary: "dd copies raw blocks with exact control — the precision tool for imaging, cloning, and low-level disk surgery."
    }, {
        name: "sync",
        level: 1,
        meaning: "Flushes filesystem buffers from memory to stable disk.",
        memory: "SYNC = make it SYNC. The kernel queues writes in memory for speed; sync forces them onto disk now.",
        syntax: "sync [OPTION]... [FILE]",
        options: [{
            flag: "-f, --file-system",
            desc: "Sync the filesystems containing the named files."
        }, {
            flag: "-d, --data",
            desc: "Sync only file data, not full metadata."
        }],
        examples: [{
            cmd: "sync",
            desc: "Flush all pending writes to disk"
        }, {
            cmd: "sync -f /var/lib/postgresql",
            desc: "Flush a specific filesystem before taking a snapshot"
        }],
        lab: {
            objective: "Understand when writes actually reach disk.",
            steps: ["echo data > /tmp/sync_test.txt", "sync -f /tmp",
                "dd if=/dev/zero of=/tmp/bigfile bs=1M count=10 status=none", "sync"
            ],
            verify: "sync completes cleanly and the file survives.",
            cleanup: "rm -f /tmp/sync_test.txt /tmp/bigfile"
        },
        production: "Before snapshotting a VM or pulling a physical drive, operators run sync so no pending writes are left in page cache — otherwise the snapshot can miss recent data.",
        troubleshooting: "Data 'lost' after a hard power-off — the writes were in cache; enterprises add sync to graceful-shutdown sequences and rely on journaled filesystems to recover the rest.",
        interview: ["Why do writes appear to complete before they hit disk?",
            "When should you run sync before taking a backup snapshot?",
            "What is the difference between sync and sync -f?"
        ],
        bestPractices: ["Run sync before unmounting removable media, snapshotting volumes, or shutting down cleanly."],
        mistakes: ["Assuming fsync in apps covers every file — the kernel still needs a sync for many paths."],
        alternatives: ["fsync via tools (per-file)", "shutdown (runs sync internally)"],
        summary: "sync pushes buffered writes to disk — the insurance policy before snapshots, unmounts, and shutdowns."
    }],
    networking: [{
        name: "ssh",
        level: 2,
        meaning: "Connects to a remote host securely over the SSH protocol and runs commands or opens a shell.",
        memory: "SSH = Secure SHell. The encrypted tunnel to any server — the remote-access default in every enterprise.",
        syntax: "ssh [OPTION]... [USER@]HOST [COMMAND]",
        options: [{
            flag: "-p PORT",
            desc: "Connect to a non-standard port."
        }, {
            flag: "-i KEYFILE",
            desc: "Use a specific private key instead of the default."
        }, {
            flag: "-o OPTION=VAL",
            desc: "Set an ssh_config option on the fly, e.g. -o StrictHostKeyChecking=no."
        }, {
            flag: "-t",
            desc: "Force pseudo-terminal allocation (needed for interactive commands via ssh)."
        }, {
            flag: "-J [USER@]JUMPHOST",
            desc: "Proxy through a jump host."
        }],
        examples: [{
            cmd: "ssh deploy@10.0.0.12",
            desc: "Open a shell on the target host"
        }, {
            cmd: "ssh app@10.0.0.12 'systemctl restart nginx'",
            desc: "Run one remote command non-interactively"
        }, {
            cmd: "ssh -J bastion.prod.example.com app@10.0.0.12",
            desc: "Reach a private subnet through a bastion/jump host"
        }],
        lab: {
            objective: "Run remote commands and inspect key-based auth.",
            steps: ["ssh localhost 'hostname' 2>/dev/null || echo 'no ssh server'",
                "ssh-keygen -t ed25519 -f /tmp/testkey -N '' -q", "cat /tmp/testkey.pub"
            ],
            verify: "A key pair is generated and the public key prints correctly.",
            cleanup: "rm -f /tmp/testkey /tmp/testkey.pub"
        },
        production: "Every server task — deploys, log pulls, config changes — runs through ssh with key-based auth and restricted users; bastions and -J jump hosts gate access to private networks.",
        troubleshooting: "An 'Operation timed out' to a private host usually means no jump host route; a Permission denied with valid keys means ~/.ssh/authorized_keys or file permissions (700/600) are wrong on the target.",
        interview: ["Why is key-based auth preferred over passwords in production?",
            "What permissions must ~/.ssh and authorized_keys have and why?",
            "How do you run a command on many servers without password prompts?"
        ],
        bestPractices: ["Use ed25519 keys, restrict with forced-commands in authorized_keys, and never allow root login with passwords."],
        mistakes: ["Setting loose permissions on ~/.ssh (777/644) which makes ssh refuse to use the keys."],
        alternatives: ["sshpass (scripted password auth — avoid in production)", "mosh (roaming, high-latency sessions)"],
        summary: "ssh is the encrypted gateway to remote hosts — the backbone of every secure remote operation."
    }, {
        name: "nc",
        level: 2,
        meaning: "Reads and writes data across TCP or UDP connections — the swiss-army 'netcat' for network plumbing.",
        memory: "NC = NetCat. A cat for the network: pump data in, listen for data, test ports.",
        syntax: "nc [OPTION]... HOST PORT",
        options: [{
            flag: "-l, --listen",
            desc: "Listen for an incoming connection instead of dialing out."
        }, {
            flag: "-p PORT",
            desc: "Specify the local source port."
        }, {
            flag: "-z",
            desc: "Zero-I/O mode: just test if the port is open."
        }, {
            flag: "-v, --verbose",
            desc: "Verbose output — essential for port checks."
        }, {
            flag: "-u, --udp",
            desc: "Use UDP instead of TCP."
        }, {
            flag: "-w SECS",
            desc: "Timeout after the given seconds."
        }],
        examples: [{
            cmd: "nc -zv -w 3 db.internal 5432",
            desc: "Test whether the database port is reachable"
        }, {
            cmd: "echo 'hello' | nc -l -p 9999",
            desc: "Serve a one-shot response on port 9999"
        }, {
            cmd: "nc -u -zv -w 2 10.0.0.5 514",
            desc: "Check UDP syslog port reachability"
        }],
        lab: {
            objective: "Validate firewall and service reachability.",
            steps: ["python3 -m http.server 0 >/dev/null 2>&1 & P=\\$!; sleep 1",
                "nc -zv -w 2 127.0.0.1 8000 || nc -zv -w 2 127.0.0.1 8080 || echo 'no local http server'",
                "kill \\$P 2>/dev/null || true"
            ],
            verify: "The port check reports open or a clear connection refused.",
            cleanup: "pkill -f 'http.server' 2>/dev/null || true"
        },
        production: "On-call engineers use nc -zv -w to prove which hop is broken: DB port unreachable from app host means a firewall/security-group issue, not an app issue. It also shuttles data for quick transfers or replication bootstrap.",
        troubleshooting: "Application timeouts with no app error — nc -zv each network leg to isolate exactly which port is filtered by a firewall rule.",
        interview: ["Why is nc -zv the first tool for port reachability?",
            "How does nc differ from telnet for port testing?",
            "What is a practical use of nc -l for debugging?"
        ],
        bestPractices: ["Always combine -z, -v, and -w in scripts so checks never hang on a filtered port."],
        mistakes: ["Using nc without -w so a filtered port hangs the whole script forever."],
        alternatives: ["telnet HOST PORT (legacy port test)", "ncat (feature-richer netcat from nmap project)"],
        summary: "nc speaks raw TCP/UDP — the fastest way to test ports, check connectivity legs, and shuttle data."
    }, {
        name: "tcpdump",
        level: 3,
        meaning: "Captures and analyzes network packets in real time on a network interface.",
        memory: "TCPDUMP = TCP packet Dump. A wiretap on the interface — every packet, decipherable.",
        syntax: "tcpdump [OPTION]... [EXPRESSION]",
        options: [{
            flag: "-i INTERFACE",
            desc: "Interface to capture on (use -i any for all)."
        }, {
            flag: "-n",
            desc: "Do not resolve hostnames."
        }, {
            flag: "-nn",
            desc: "Do not resolve hostnames or ports — faster, cleaner output."
        }, {
            flag: "-c COUNT",
            desc: "Stop after capturing COUNT packets."
        }, {
            flag: "-s 0",
            desc: "Capture full packets (no truncation)."
        }, {
            flag: "-w FILE",
            desc: "Write raw packets to a pcap file for later analysis."
        }, {
            flag: "-A",
            desc: "Print packet payload in ASCII (read application data)."
        }],
        examples: [{
            cmd: "tcpdump -i any -nn port 443",
            desc: "Watch all TLS traffic on port 443 without DNS lookups"
        }, {
            cmd: "tcpdump -i eth0 -nn -c 20 tcp and host 10.0.0.5",
            desc: "Capture 20 TCP packets to a specific host"
        }, {
            cmd: "sudo tcpdump -i eth0 -s 0 -w /tmp/capture.pcap 'port 443'",
            desc: "Save full packets to a pcap for analysis in Wireshark"
        }],
        lab: {
            objective: "Capture and read live traffic.",
            steps: ["tcpdump -i any -nn -c 10 -s 0 'udp port 53' > /tmp/dump.txt 2>&1 & D=\\$!; sleep 1",
                "host example.com", "wait \\$D 2>/dev/null; head -5 /tmp/dump.txt"
            ],
            verify: "DNS query packets appear in the capture output.",
            cleanup: "rm -f /tmp/dump.txt"
        },
        production: "When a service talks to an unreachable backend, tcpdump pinpoints whether packets leave the host, whether SYN-ACKs return, and where RSTs come from — separating firewall, routing, and application causes in seconds.",
        troubleshooting: "A 'Connection refused' versus a hang — tcpdump shows a RST (refused, service down) versus silent drop (firewall filtering), instantly directing the fix.",
        interview: ["Why use -nn instead of default resolution in production captures?",
            "What does a RST packet tell you versus no response at all?",
            "Why save captures with -w instead of only reading live?"
        ],
        bestPractices: ["Always use -nn and targeted port/host expressions to keep capture volume small and output readable."],
        mistakes: ["Capturing on the wrong interface or without -s 0 so truncation hides the payload."],
        alternatives: ["ss/netstat (connection state, not packets)", "Wireshark (GUI analysis of pcap files)"],
        summary: "tcpdump puts a wiretap on your interfaces — definitive evidence for network-level troubleshooting."
    }, {
        name: "nmap",
        level: 3,
        meaning: "Scans hosts and ports to discover services, versions, and operating systems on a network.",
        memory: "NMAP = Network MAP. It maps what's listening where — the reconnaissance standard for security teams.",
        syntax: "nmap [SCAN TYPE] [OPTION]... TARGET",
        options: [{
            flag: "-sS",
            desc: "TCP SYN stealth scan (default for root)."
        }, {
            flag: "-p PORTS",
            desc: "Specific ports, e.g. -p 22,80,443 or -p- for all 65535."
        }, {
            flag: "-sV",
            desc: "Probe service versions."
        }, {
            flag: "-O",
            desc: "Operating system fingerprinting."
        }, {
            flag: "-oN/-oG FILE",
            desc: "Save output in normal or grepable format."
        }],
        examples: [{
            cmd: "nmap -sS -p 22,80,443 10.0.0.12",
            desc: "Fast scan of common service ports on one host"
        }, {
            cmd: "nmap -sV -p- 10.0.0.0/24",
            desc: "Full port scan with version detection across a subnet"
        }, {
            cmd: "nmap -sn 10.0.0.0/24",
            desc: "Ping-sweep only: which hosts are alive"
        }],
        lab: {
            objective: "Safely inventory local services.",
            steps: ["nmap -sn 127.0.0.1", "nmap -sS -p 1-1024 127.0.0.1 || true"
            ],
            verify: "An inventory of listening services on localhost is produced.",
            cleanup: "none needed"
        },
        production: "Security teams and network admins run scheduled nmap inventory scans to detect unauthorized services and validate that firewalls only expose intended ports; CI pipelines use it to confirm an app listens on the configured port.",
        troubleshooting: "A service 'not reachable' from outside — nmap from an external host distinguishes filtered (firewall) from closed (nothing listening), localizing the fault.",
        interview: ["What is the difference between filtered, closed, and open scan results?",
            "Why must you only scan systems you own or are authorized to test?",
            "What does -sV add over a plain port scan?"
        ],
        bestPractices: ["Scan only authorized targets and start with -sn then targeted -p to avoid noisy full scans."],
        mistakes: ["Running full -sV -O scans against production without authorization — this is intrusive and often blocked or logged."],
        alternatives: ["nc -zv (single-port checks)", "masscan (very high-speed subnet scanning)"],
        summary: "nmap maps open ports and services across hosts — the security standard for network inventory and firewall validation."
    }],
    systemd: [{
        name: "service",
        level: 2,
        meaning: "Runs a System V init script — the compatibility wrapper for managing services on older or mixed init systems.",
        memory: "SERVICE = the old-school way. It just runs /etc/init.d/NAME with a verb — still used on SysV-era distros.",
        syntax: "service SERVICE_NAME [start|stop|restart|status]",
        options: [{
            flag: "start",
            desc: "Start the service."
        }, {
            flag: "stop",
            desc: "Stop the service."
        }, {
            flag: "restart",
            desc: "Stop then start the service."
        }, {
            flag: "status",
            desc: "Report whether the service is running."
        }, {
            flag: "--status-all",
            desc: "List the status of every init script."
        }],
        examples: [{
            cmd: "service nginx status",
            desc: "Check if nginx is running"
        }, {
            cmd: "service mysql restart",
            desc: "Restart MySQL through its init script"
        }],
        lab: {
            objective: "Manage a service through the init wrapper.",
            steps: ["service --status-all 2>/dev/null | head -10",
                "service cron status || echo 'cron status unavailable'"
            ],
            verify: "Service statuses are reported without errors.",
            cleanup: "none needed"
        },
        production: "Legacy runbooks and older RHEL/Debian images still use service, and some vendors ship only init scripts; knowing it keeps compatibility scripts working on mixed fleets.",
        troubleshooting: "When service restart 'works' but systemctl shows a failed unit, the init script and unit file are managing the same binary differently — reconcile them or standardize on one.",
        interview: ["How does service relate to systemctl on modern distros?",
            "What does service --status-all do?",
            "Why do some vendor installers still use init scripts?"
        ],
        bestPractices: ["Prefer systemctl on modern distros; keep service only for compatibility scripts."],
        mistakes: ["Relying on service on distros where the init script was never installed — status shows nothing."],
        alternatives: ["systemctl (systemd-native management)", "initctl (Upstart-era distros)"],
        summary: "service drives classic init scripts — the compatibility command for managing services across init generations."
    }],
    users: [{
        name: "groups",
        level: 1,
        meaning: "Prints the groups a user belongs to.",
        memory: "GROUPS = the teams you belong to. One quick word and you see every group membership.",
        syntax: "groups [USERNAME]",
        options: [{
            flag: "(none)",
            desc: "With no argument, shows groups for the current user."
        }],
        examples: [{
            cmd: "groups",
            desc: "Groups of the current user"
        }, {
            cmd: "groups jenkins",
            desc: "Groups the jenkins account belongs to"
        }],
        lab: {
            objective: "Verify group membership changes.",
            steps: ["groups", "id -Gn"
            ],
            verify: "Both commands list the same set of groups.",
            cleanup: "none needed"
        },
        production: "Before granting access, engineers confirm an account's groups — a service account missing the docker group explains 'permission denied' on the socket instantly.",
        troubleshooting: "A user 'just added to a group' still denied — check groups: new membership only applies to new login sessions, not existing ones.",
        interview: ["Why might groups not show a group the user was just added to?",
            "What is the difference between primary and supplementary groups?",
            "How does id -Gn relate to groups?"
        ],
        bestPractices: ["Use id -Gn for scriptable output; groups for quick human checks."],
        mistakes: ["Forgetting that running processes keep the group set from login time."],
        alternatives: ["id -Gn (canonical, script-friendly)", "grep /etc/group (raw source data)"],
        summary: "groups shows every group an account belongs to — the first check when access is mysteriously denied."
    }, {
        name: "getent",
        level: 2,
        meaning: "Queries the Name Service Switch (NSS) databases — users, groups, hosts, and more — across all configured sources.",
        memory: "GETENT = GET ENTr(ies). The one command that sees beyond /etc/passwd into LDAP, NIS, and DNS-backed identity.",
        syntax: "getent DATABASE KEY",
        options: [{
            flag: "passwd",
            desc: "Query user accounts."
        }, {
            flag: "group",
            desc: "Query group accounts."
        }, {
            flag: "hosts",
            desc: "Query hostname resolution (like a host-aware lookup)."
        }, {
            flag: "services",
            desc: "Query port/service mappings."
        }],
        examples: [{
            cmd: "getent passwd svc-app",
            desc: "Resolve an account through NSS (local + LDAP)"
        }, {
            cmd: "getent hosts db.internal",
            desc: "Resolve a host the way the system really does"
        }, {
            cmd: "getent group devteam",
            desc: "List members of a group, including LDAP-sourced groups"
        }],
        lab: {
            objective: "Query identity sources the NSS way.",
            steps: ["getent passwd root", "getent hosts localhost", "getent group root"
            ],
            verify: "root user, localhost, and root group all resolve.",
            cleanup: "none needed"
        },
        production: "In LDAP/AD-integrated fleets, getent is the canonical check for whether an account or group resolves — it queries the exact same NSS stack the apps use, so it reveals LDAP vs local discrepancies.",
        troubleshooting: "An app can't find a user but /etc/passwd looks right — getent passwd USER reveals the account lives in LDAP (nsswitch.conf order) or is missing from the directory entirely.",
        interview: ["What does getent passwd USER tell you that grep /etc/passwd cannot?",
            "How does the nsswitch.conf order affect getent results?",
            "Why is getent the right way to test DNS for an application?"
        ],
        bestPractices: ["Debug identity and DNS with getent rather than reading files directly — it reflects the real NSS resolution path."],
        mistakes: ["Editing /etc/passwd directly when the authoritative source is LDAP — getent shows where the truth lives."],
        alternatives: ["id (user metadata shortcut)", "getent hosts vs dig (DNS path differences)"],
        summary: "getent queries the real NSS resolution stack — the definitive check for identity and name resolution in directory-integrated enterprises."
    }, {
        name: "who",
        level: 1,
        meaning: "Shows who is currently logged into the system and how.",
        memory: "WHO = who is here. A snapshot of active logins, terminals, and origins.",
        syntax: "who [OPTION]... [FILE]",
        options: [{
            flag: "-a, --all",
            desc: "Show everything: logins, runlevel, process entries."
        }, {
            flag: "-b, --boot",
            desc: "Show the last system boot time."
        }, {
            flag: "-q, --count",
            desc: "Only show user names and a total count."
        }],
        examples: [{
            cmd: "who",
            desc: "List current logins with terminal and origin"
        }, {
            cmd: "who -b",
            desc: "Last boot time"
        }, {
            cmd: "who -q",
            desc: "Just the user list and count"
        }],
        lab: {
            objective: "Audit active sessions.",
            steps: ["who", "who -b"
            ],
            verify: "Current sessions and boot time are reported.",
            cleanup: "none needed"
        },
        production: "During an incident, who reveals unknown sessions on a box — unexpected logins from foreign IPs are an immediate compromise indicator alongside who -b for the last clean boot time.",
        troubleshooting: "Auditors cross-reference who output with last to distinguish live sessions from historical logins.",
        interview: ["What security signal does who give during incident response?",
            "What does the source IP column reveal?",
            "How is who different from w?"
        ],
        bestPractices: ["Check who during any suspected intrusion to spot foreign sessions immediately."],
        mistakes: ["Confusing who (active logins) with last (historical login log)."],
        alternatives: ["w (adds uptime and per-user activity)", "last (historical logins from wtmp)"],
        summary: "who snapshots active logins — the first glance at who is on the box right now."
    }, {
        name: "last",
        level: 1,
        meaning: "Shows a history of user logins and sessions from the wtmp log.",
        memory: "LAST = the LAST logins. A permanent record of who signed in and when, from wtmp.",
        syntax: "last [OPTION]... [USER]",
        options: [{
            flag: "-n, --limit=N",
            desc: "Show only the N most recent entries."
        }, {
            flag: "-i, --ip",
            desc: "Display IP addresses instead of hostnames."
        }, {
            flag: "-x, --system",
            desc: "Include system events like shutdowns and reboots."
        }],
        examples: [{
            cmd: "last -n 20",
            desc: "The 20 most recent logins"
        }, {
            cmd: "last -i -n 10 root",
            desc: "Recent root logins with raw IPs"
        }, {
            cmd: "last -x shutdown",
            desc: "History of shutdown events"
        }],
        lab: {
            objective: "Review login history.",
            steps: ["last -n 10", "last -x -n 5 reboot"
            ],
            verify: "Recent logins and the last reboot appear.",
            cleanup: "none needed"
        },
        production: "Auditors use last -i to trace who accessed a server and from which IPs — the primary artifact for access reviews and post-incident forensic timelines.",
        troubleshooting: "When an account is 'compromised', last reveals the login times and source IPs that define the incident scope before anything else.",
        interview: ["What data source backs the last command?",
            "What does 'still logged in' mean in last output?",
            "Why is last -i preferred over hostname resolution in audits?"
        ],
        bestPractices: ["Regularly review last -x to catch reboots and shutdowns that were not scheduled."],
        mistakes: ["Trusting last on systems where wtmp was cleared — an empty file is itself a red flag."],
        alternatives: ["who (live sessions)", "lastb (failed login attempts from btmp)"],
        summary: "last reads the wtmp login ledger — the historical record of who accessed the system."
    }],
    packages: [{
        name: "apt-get",
        level: 2,
        meaning: "The classic front-end for installing, updating, and removing Debian/Ubuntu packages.",
        memory: "APT-GET = the package GO-Getter. Downloads and installs software from repositories, resolving dependencies.",
        syntax: "apt-get [ACTION] [PACKAGE...]",
        options: [{
            flag: "update",
            desc: "Refresh package indexes from configured repos."
        }, {
            flag: "upgrade",
            desc: "Upgrade all upgradable packages."
        }, {
            flag: "install PKG",
            desc: "Install a package (or several)."
        }, {
            flag: "remove PKG",
            desc: "Uninstall a package."
        }, {
            flag: "autoremove",
            desc: "Remove packages installed only as dependencies and no longer needed."
        }, {
            flag: "-y",
            desc: "Assume 'yes' — non-interactive (essential for scripts)."
        }],
        examples: [{
            cmd: "apt-get update && apt-get install -y nginx",
            desc: "Refresh indexes then install nginx non-interactively"
        }, {
            cmd: "apt-get upgrade -y",
            desc: "Apply all pending security upgrades"
        }, {
            cmd: "apt-get remove --purge apache2",
            desc: "Remove a package and its config files"
        }],
        lab: {
            objective: "Non-interactive package operations.",
            steps: ["apt-get update", "apt-get install -y htop 2>/dev/null || echo 'no root or offline'",
                "dpkg -l htop 2>/dev/null | tail -1 || true"
            ],
            verify: "Installation completes without prompting (with -y).",
            cleanup: "apt-get remove -y htop 2>/dev/null || true"
        },
        production: "Bootstrap scripts pin apt-get update && apt-get install -y for reproducible images and rely on unattended-upgrades (driven by apt) for security patches on Ubuntu fleets.",
        troubleshooting: "A 'Unable to locate package' after install failure — the local index is stale; run apt-get update first to refresh the package lists.",
        interview: ["Why must apt-get update run before install?",
            "What is the difference between apt-get and apt?",
            "How does --purge differ from plain remove?"
        ],
        bestPractices: ["Always use -y in automation and pin versions (apt-get install pkg=1.2.3) for reproducibility."],
        mistakes: ["Running upgrade without first testing on a staging image — registry drift breaks production."],
        alternatives: ["apt (friendlier, same backend)", "aptitude (interactive resolver)"],
        summary: "apt-get installs and updates Debian-family packages non-interactively — the foundation of apt-based provisioning."
    }, {
        name: "apt-cache",
        level: 2,
        meaning: "Queries the local Debian/Ubuntu package metadata — searching, showing, and inspecting available packages.",
        memory: "APT-CACHE = browse the apt CACHE. Before installing, ask the cache what exists, what version, and what it depends on.",
        syntax: "apt-cache ACTION PACKAGE",
        options: [{
            flag: "search PATTERN",
            desc: "Search package names and descriptions."
        }, {
            flag: "show PKG",
            desc: "Display detailed metadata for a package."
        }, {
            flag: "policy PKG",
            desc: "Show which versions are available and their priority."
        }, {
            flag: "depends PKG",
            desc: "List a package's dependencies."
        }],
        examples: [{
            cmd: "apt-cache search redis",
            desc: "Find packages matching redis"
        }, {
            cmd: "apt-cache policy nginx",
            desc: "See installed vs candidate versions of nginx"
        }, {
            cmd: "apt-cache show openssl | grep -E 'Version|Depends'",
            desc: "Inspect metadata for openssl"
        }],
        lab: {
            objective: "Inspect packages before installing.",
            steps: ["apt-cache search curl | head -5", "apt-cache policy curl"
            ],
            verify: "Search results and version policy print cleanly.",
            cleanup: "none needed"
        },
        production: "Before upgrading a critical package, engineers run apt-cache policy to see candidate versions and apt-cache depends to check for breaking dependency changes.",
        troubleshooting: "When an upgrade would pull unexpected dependencies, apt-cache depends reveals them in advance — letting you block versions before they reach the fleet.",
        interview: ["What is the difference between apt-cache show and policy?",
            "How do you find a package when you don't know its exact name?",
            "Why inspect dependencies before a production upgrade?"
        ],
        bestPractices: ["Check apt-cache policy before any version-sensitive upgrade."],
        mistakes: ["Assuming apt-get install always installs the latest — candidate version depends on your distro's repos."],
        alternatives: ["dpkg -l (installed packages)", "apt search/show (modern apt shortcut)"],
        summary: "apt-cache inspects package metadata before you commit — search, versions, and dependencies at a glance."
    }, {
        name: "yum",
        level: 2,
        meaning: "The classic Red Hat family package manager — installs, updates, and removes RPM packages with dependency resolution.",
        memory: "YUM = Yellowdog Updater Modified. The RPM dependency-resolver that runs RHEL/CentOS 7-era servers.",
        syntax: "yum [ACTION] [PACKAGE...]",
        options: [{
            flag: "install PKG",
            desc: "Install a package."
        }, {
            flag: "update",
            desc: "Upgrade all or specific packages."
        }, {
            flag: "remove PKG",
            desc: "Remove a package."
        }, {
            flag: "list installed",
            desc: "List installed packages."
        }, {
            flag: "repolist",
            desc: "Show configured repositories."
        }, {
            flag: "-y",
            desc: "Assume 'yes' — non-interactive."
        }],
        examples: [{
            cmd: "yum install -y nginx",
            desc: "Install nginx on a RHEL/CentOS 7 host"
        }, {
            cmd: "yum update -y",
            desc: "Apply security and bugfix updates"
        }, {
            cmd: "yum repolist",
            desc: "Verify which repositories are enabled"
        }],
        lab: {
            objective: "Inspect repos and installed packages.",
            steps: ["yum repolist 2>/dev/null | head -10", "yum list installed 2>/dev/null | head -5 || echo 'not a yum system'"
            ],
            verify: "Repositories and installed packages are listed (on yum-based distros).",
            cleanup: "none needed"
        },
        production: "Legacy RHEL/CentOS 7 fleets are still provisioned with yum; runbooks use yum install -y with pinned versions and yum clean all before repo changes to avoid stale metadata.",
        troubleshooting: "A 'No package matching' error on CentOS 7 usually means a missing repo or EPEL not enabled — yum repolist and yum search confirm the gap.",
        interview: ["How does yum resolve dependencies for RPM packages?",
            "What is the role of EPEL in yum environments?",
            "Why would you run yum clean all?"
        ],
        bestPractices: ["Pin versions and use -y only after verifying the package list on a staging node."],
        mistakes: ["Running yum update on production without a rollback plan — enable snapshots or use a staging repo."],
        alternatives: ["dnf (modern successor on RHEL 8+)", "rpm (direct, no dependency resolution)"],
        summary: "yum manages RPM packages with dependency resolution — the package manager for the RHEL-family mainframe of the cloud."
    }, {
        name: "dnf",
        level: 2,
        meaning: "The modern Red Hat family package manager (RHEL 8+, Fedora) — dnf is the next generation of yum.",
        memory: "DNF = Dandified YUM. yum, rebuilt with a better solver — same job, faster and cleaner dependency resolution.",
        syntax: "dnf [ACTION] [PACKAGE...]",
        options: [{
            flag: "install PKG",
            desc: "Install a package."
        }, {
            flag: "upgrade",
            desc: "Upgrade packages."
        }, {
            flag: "remove PKG",
            desc: "Remove a package."
        }, {
            flag: "history",
            desc: "Show a transaction history with undo capability."
        }, {
            flag: "group install 'GROUP'",
            desc: "Install an entire package group (e.g. development tools)."
        }],
        examples: [{
            cmd: "dnf install -y git vim",
            desc: "Install git and vim on RHEL 9"
        }, {
            cmd: "dnf group install -y 'Development Tools'",
            desc: "Install the full build toolchain"
        }, {
            cmd: "dnf history",
            desc: "Review past transactions (with rollback support)"
        }],
        lab: {
            objective: "Modern RHEL-family package management.",
            steps: ["dnf --version 2>/dev/null | head -1 || echo 'dnf not installed'",
                "dnf list installed 2>/dev/null | head -5 || true"
            ],
            verify: "dnf reports its version and lists packages where available.",
            cleanup: "none needed"
        },
        production: "RHEL 8/9 and Fedora images use dnf in their Dockerfiles and kickstart; dnf history gives auditors a rollback-capable transaction log that yum lacked.",
        troubleshooting: "When a module version is wrong, dnf module list shows available streams — the modern way to pin versions like nodejs:18 or postgresql:15.",
        interview: ["What are the main improvements of dnf over yum?",
            "How does dnf history support rollback?",
            "What are dnf modules and streams used for?"
        ],
        bestPractices: ["Use dnf module streams to pin application versions (e.g. dnf module enable nodejs:18)."],
        mistakes: ["Using yum syntax on RHEL 9 — some commands differ; dnf is the canonical tool."],
        alternatives: ["yum (RHEL 7 legacy)", "rpm (low-level, no resolver)"],
        summary: "dnf is the modern RPM package manager with better dependency solving — standard on current RHEL-family systems."
    }],
    cron: [{
        name: "systemd-run",
        level: 3,
        meaning: "Creates transient systemd units on the fly — running commands as one-shot tasks, background jobs, or scheduled timers without writing unit files.",
        memory: "SYSTEMD-RUN = run something the systemd way. Launch a task, and systemd supervises it — with full logging and scheduling.",
        syntax: "systemd-run [OPTION]... COMMAND",
        options: [{
            flag: "--on-calendar=SPEC",
            desc: "Schedule a recurring timer using calendar syntax (like cron)."
        }, {
            flag: "--on-active=DURATION",
            desc: "Run once after a delay."
        }, {
            flag: "--unit=NAME",
            desc: "Give the transient unit a recognizable name."
        }, {
            flag: "--property=KEY=VALUE",
            desc: "Set unit properties, e.g. MemoryMax=500M."
        }, {
            flag: "--user",
            desc: "Run in the user manager instead of the system manager."
        }],
        examples: [{
            cmd: "systemd-run --on-calendar='daily' --unit=nightly-backup /usr/local/bin/backup.sh",
            desc: "Schedule a daily recurring task without a unit file"
        }, {
            cmd: "systemd-run --unit=bigcopy --property=MemoryMax=1G rsync -a /data /backup",
            desc: "Run a resource-limited one-shot task"
        }, {
            cmd: "systemd-run --on-active=5 --unit=delayed-check /usr/local/bin/check.sh",
            desc: "Run once five seconds from now"
        }],
        lab: {
            objective: "Schedule and inspect transient units.",
            steps: ["systemd-run --on-active=1 --unit=lab-echo /bin/sh -c 'echo hi > /tmp/sysd_run.txt' 2>/dev/null || echo 'needs systemd/user root'",
                "sleep 2", "cat /tmp/sysd_run.txt 2>/dev/null || true"
            ],
            verify: "The transient task runs and writes its output.",
            cleanup: "rm -f /tmp/sysd_run.txt; systemctl reset-failed lab-echo 2>/dev/null || true"
        },
        production: "Teams schedule maintenance and on-call jobs as systemd-run --on-calendar timers because they get journald logging, dependency ordering, and resource limits — modern replacements for cron entries in fleet configs.",
        troubleshooting: "When a timer job fails silently, systemctl status <unit> and journalctl -u <unit> expose the exit code and logs — better than cron's empty mailboxes.",
        interview: ["How does systemd-run --on-calendar differ from a crontab entry?",
            "Why would you prefer systemd-run for a one-off background task?",
            "How do you inspect a transient unit's logs?"
        ],
        bestPractices: ["Use --unit to name transient units so logs and status are easy to find."],
        mistakes: ["Forgetting that --on-calendar uses calendar syntax, not the 5-field cron syntax."],
        alternatives: ["crontab (classic scheduling)", "systemd timers with real unit files (persistent)"],
        summary: "systemd-run launches supervised, schedulable tasks on the fly — cron's modern, logged, resource-limited sibling."
    }],
    transfer: [{
        name: "sftp",
        level: 2,
        meaning: "Transfers files securely over SSH with an interactive, FTP-like interface.",
        memory: "SFTP = Secure FTP. File transfer tunneled through the SSH channel — no plaintext credentials, ever.",
        syntax: "sftp [OPTION]... USER@HOST[:PATH]",
        options: [{
            flag: "-P PORT",
            desc: "Connect to a non-standard SSH port (capital P, like ssh's -p)."
        }, {
            flag: "-i KEYFILE",
            desc: "Use a specific identity key."
        }, {
            flag: "-b BATCHFILE",
            desc: "Run a batch of commands from a file (non-interactive)."
        }],
        examples: [{
            cmd: "sftp deploy@app.example.com",
            desc: "Open an interactive file-transfer session"
        }, {
            cmd: "sftp -b /tmp/upload_cmds.txt deploy@app.example.com",
            desc: "Automate uploads with a batch command file"
        }, {
            cmd: "echo 'put /tmp/report.pdf /srv/reports/' | sftp deploy@app.example.com",
            desc: "Upload a single file via piped commands"
        }],
        lab: {
            objective: "Automate a secure file transfer.",
            steps: ["echo 'hello sftp' > /tmp/upload_test.txt", "echo 'put /tmp/upload_test.txt /tmp/' | sftp -b - localhost 2>/dev/null || echo 'no sshd on localhost'"
            ],
            verify: "The file transfers without an interactive session.",
            cleanup: "rm -f /tmp/upload_test.txt"
        },
        production: "Vendor file drops, backup offloads, and partner exchanges run through sftp batch mode over SSH keys — the enterprise-standard replacement for unencrypted legacy FTP.",
        troubleshooting: "An sftp 'Connection closed' at login usually means the shell or subsystem is misconfigured — check that sshd allows the sftp subsystem and the account's shell is valid.",
        interview: ["Why is sftp preferred over plain FTP for production data movement?",
            "How does sftp batch mode enable automation?",
            "What subsystem does sftp rely on?"
        ],
        bestPractices: ["Use key-based auth and batch mode for scheduled transfers so no passwords sit in scripts."],
        mistakes: ["Using plain FTP which sends credentials and data in clear text."],
        alternatives: ["scp (one-off copies, simpler)", "rsync over ssh (sync + delta transfers)"],
        summary: "sftp moves files through the SSH tunnel with a familiar FTP feel — secure, automatable file transfer."
    }, {
        name: "socat",
        level: 3,
        meaning: "Relays data between two bidirectional streams — the multipurpose network/data plumbing tool.",
        memory: "SOCAT = SOcket CAT. cat, but for sockets: connect any two streams — files, ports, pipes — and pump data through.",
        syntax: "socat [OPTION]... ADDRESS1 ADDRESS2",
        options: [{
            flag: "TCP-LISTEN:PORT",
            desc: "Listen on a TCP port."
        }, {
            flag: "TCP:HOST:PORT",
            desc: "Connect out to a TCP endpoint."
        }, {
            flag: "FILE:PATH",
            desc: "Use a file as an endpoint."
        }, {
            flag: "-",
            desc: "Use stdin/stdout as an endpoint."
        }, {
            flag: "UDP-LISTEN:PORT",
            desc: "Listen for UDP datagrams."
        }],
        examples: [{
            cmd: "socat TCP-LISTEN:8080,fork TCP:10.0.0.5:80",
            desc: "Forward local port 8080 to a backend web server"
        }, {
            cmd: "socat TCP-LISTEN:5432,fork TCP:db.internal:5432",
            desc: "Tunnel to a database port without SSH on the target"
        }, {
            cmd: "socat TCP-LISTEN:9000,reuseaddr FILE:/dev/null",
            desc: "Reserve/open a TCP port to test firewall rules"
        }],
        lab: {
            objective: "Forward a port with socat.",
            steps: ["python3 -m http.server 8000 >/dev/null 2>&1 & P=\\$!; sleep 1",
                "socat TCP-LISTEN:8080,fork,reuseaddr TCP:127.0.0.1:8000 & S=\\$!; sleep 1",
                "curl -s -o /dev/null -w 'via socat: %{http_code}\\n' http://127.0.0.1:8080/", "kill \\$S \\$P 2>/dev/null || true"
            ],
            verify: "curl through the socat forward returns the same HTTP status as direct.",
            cleanup: "pkill -f 'http.server' 2>/dev/null || true"
        },
        production: "Operations teams use socat for quick port forwards and one-off tunnels when SSH tunneling is unavailable — e.g. exposing a legacy port through a bastion, or duplicating a UDP stream for monitoring.",
        troubleshooting: "A service reachable locally but not from another host — socat TCP-LISTEN with fork can bridge the port while the real fix (firewall/service binding) is applied.",
        interview: ["How does socat differ from ssh -L port forwarding?",
            "What does the ,fork option do for concurrent connections?",
            "Give a UDP use case for socat."
        ],
        bestPractices: ["Use reuseaddr and fork on listeners so restarts and concurrent clients behave."],
        mistakes: ["Exposing sensitive backends through ad-hoc socat forwards and forgetting to remove them after the fix."],
        alternatives: ["ssh -L/-R (tunnels over SSH)", "ncat (nc variant with --sh-exec etc.)"],
        summary: "socat connects any two data streams — the universal relay for ports, files, pipes, and UDP."
    }],
    firewall: [{
        name: "ufw",
        level: 2,
        meaning: "Uncomplicated Firewall — a user-friendly front-end to iptables/nftables for managing a host firewall.",
        memory: "UFW = Uncomplicated FireWall. The simple way to say 'allow this port, deny everything else' on Ubuntu.",
        syntax: "ufw [ACTION] [RULE]",
        options: [{
            flag: "enable / disable",
            desc: "Turn the firewall on or off."
        }, {
            flag: "allow PORT",
            desc: "Allow traffic on a port (optionally /proto or from IP)."
        }, {
            flag: "deny PORT",
            desc: "Deny traffic on a port."
        }, {
            flag: "status verbose",
            desc: "Show current rules with details."
        }, {
            flag: "default allow/deny",
            desc: "Set the default policy for incoming/outgoing traffic."
        }],
        examples: [{
            cmd: "ufw allow 22/tcp",
            desc: "Keep SSH open before enabling the firewall"
        }, {
            cmd: "ufw allow 443/tcp",
            desc: "Expose HTTPS"
        }, {
            cmd: "ufw allow from 10.0.0.0/8 to any port 3306",
            desc: "Allow MySQL only from the private network"
        }, {
            cmd: "ufw enable && ufw status verbose",
            desc: "Turn on the firewall and verify the ruleset"
        }],
        lab: {
            objective: "Configure a host firewall safely.",
            steps: ["ufw status", "ufw --dry-run allow 8080/tcp 2>/dev/null || ufw allow 8080/tcp", "ufw status"
            ],
            verify: "The 8080 allow rule appears in status.",
            cleanup: "ufw delete allow 8080/tcp 2>/dev/null || true"
        },
        production: "Ubuntu instances in cloud environments use ufw as the standard host firewall — a tight default-deny policy with only SSH and application ports allowed, protecting services beyond the security group layer.",
        troubleshooting: "A service unreachable from outside but fine locally — check ufw status for an implicit deny; the fix is usually a missing allow rule, not the app.",
        interview: ["Why must you allow SSH before enabling ufw?",
            "What is the difference between the security group and ufw in cloud setups?",
            "How do you restrict a port to a specific source network?"
        ],
        bestPractices: ["Add SSH allow rules before ufw enable, and audit ufw status after every change."],
        mistakes: ["Enabling ufw over an SSH session without allowing port 22 first — instant lockout."],
        alternatives: ["firewalld (RHEL-family)", "iptables (raw rules behind ufw)"],
        summary: "ufw is the simple, safe host firewall on Ubuntu — allow what's needed, deny the rest."
    }, {
        name: "fail2ban",
        level: 3,
        meaning: "Scans service logs for repeated failures and bans the offending IPs at the firewall — automatic intrusion prevention.",
        memory: "FAIL2BAN = ban the failures. After N failed logins, the source IP goes to the naughty list (iptables).",
        syntax: "fail2ban-client [ACTION] [JAIL]",
        options: [{
            flag: "status",
            desc: "List all active jails."
        }, {
            flag: "status JAIL",
            desc: "Show banned IPs and stats for a jail."
        }, {
            flag: "set JAIL unbanip IP",
            desc: "Manually unban an IP."
        }, {
            flag: "set JAIL addip IP",
            desc: "Manually ban an IP."
        }],
        examples: [{
            cmd: "fail2ban-client status sshd",
            desc: "Show bans triggered by the sshd jail"
        }, {
            cmd: "fail2ban-client set sshd unbanip 203.0.113.9",
            desc: "Unban a wrongly-locked IP"
        }, {
            cmd: "tail -f /var/log/fail2ban.log",
            desc: "Watch ban/unban events live"
        }],
        lab: {
            objective: "Inspect fail2ban jail state.",
            steps: ["fail2ban-client status 2>/dev/null || echo 'fail2ban not installed'",
                "fail2ban-client status sshd 2>/dev/null || true"
            ],
            verify: "Jails and banned-IP lists are readable where fail2ban is active.",
            cleanup: "none needed"
        },
        production: "Internet-facing SSH and web services run fail2ban jails with tuned maxretry thresholds, and operators whitelist office/VPN CIDRs so legitimate automation is never banned.",
        troubleshooting: "A legit build agent 'suddenly blocked' — fail2ban-client status sshd shows the ban; unban the IP and add a whitelist rule rather than disabling the jail.",
        interview: ["How does fail2ban decide when to ban an IP?",
            "What are maxretry and bantime and how do they tune behavior?",
            "Why whitelist your own infrastructure ranges?"
        ],
        bestPractices: ["Whitelist trusted CIDRs and tune maxretry so scripted failures don't ban legitimate automation."],
        mistakes: ["Banning without whitelisting CI/IPs — harmless-looking retries lock out your own tooling."],
        alternatives: ["CrowdSec (modern, community-driven)", "cloud security groups with rate limits" ],
        summary: "fail2ban watches logs and bans repeat offenders at the firewall — low-cost intrusion prevention for exposed services."
    }],
    perf: [{
        name: "free",
        level: 1,
        meaning: "Shows total, used, and available memory across the system.",
        memory: "FREE = how much is FREE. The single command for 'is this box out of memory?'",
        syntax: "free [OPTION]...",
        options: [{
            flag: "-h, --human",
            desc: "Human-readable sizes (G/M)."
        }, {
            flag: "-m, --mega",
            desc: "Output in megabytes."
        }, {
            flag: "-s, --seconds=N",
            desc: "Repeat the display every N seconds (watch-like)."
        }, {
            flag: "-t, --total",
            desc: "Show a total line."
        }],
        examples: [{
            cmd: "free -h",
            desc: "Human-readable memory overview"
        }, {
            cmd: "free -h -s 3",
            desc: "Refresh memory stats every 3 seconds"
        }, {
            cmd: "free -m | awk 'NR==2{print $3\\\"MB used\\\"}'",
            desc: "Extract used memory for a monitoring check"
        }],
        lab: {
            objective: "Interpret memory usage correctly.",
            steps: ["free -h", "cat /proc/meminfo | head -5"
            ],
            verify: "free -h reports human-readable totals; the buffers/cache line explains why 'used' looks high.",
            cleanup: "none needed"
        },
        production: "free -h is the first command of any memory incident — but engineers read the 'available' column, not 'used', because Linux counts cache as reclaimable, so a high 'used' is normal.",
        troubleshooting: "An app OOM-killed despite free showing free GB — check the available column and cgroup limits; free shows host memory, not container limits.",
        interview: ["Why does 'used' overstate real pressure on Linux?",
            "What does the 'available' column mean?",
            "How do you monitor memory beyond free -h?"
        ],
        bestPractices: ["Base memory alarms on the available column, not used."],
        mistakes: ["Alerting on 'used' which includes reclaimable cache — produces false alarms all day."],
        alternatives: ["vmstat -s (detailed memory counters)", "cgroup memory.max (container-level truth)"],
        summary: "free -h gives the instant memory picture — read 'available', not 'used', and you'll stop chasing ghosts."
    }, {
        name: "mpstat",
        level: 3,
        meaning: "Reports per-processor (CPU) utilization statistics — the tool for spotting a single saturated core.",
        memory: "MPSTAT = Multi-Processor STATS. One CPU hog can bottleneck a 32-core box — mpstat sees it.",
        syntax: "mpstat [OPTION]... [INTERVAL [COUNT]]",
        options: [{
            flag: "-P ALL",
            desc: "Show stats for every CPU core."
        }, {
            flag: "-u",
            desc: "Report CPU utilization (default)."
        }, {
            flag: "-I CPU",
            desc: "Show per-CPU interrupt rates."
        }],
        examples: [{
            cmd: "mpstat -P ALL 1",
            desc: "Per-core CPU usage, refreshed every second"
        }, {
            cmd: "mpstat 5 3",
            desc: "Overall CPU stats: 3 samples, 5s apart"
        }, {
            cmd: "mpstat -P ALL 2 | grep -v idle",
            desc: "Focus on busy cores"
        }],
        lab: {
            objective: "Spot per-core saturation.",
            steps: ["mpstat -P ALL 1 3 2>/dev/null || echo 'sysstat not installed'"
            ],
            verify: "Per-core %idle/%usr columns print for every core.",
            cleanup: "none needed"
        },
        production: "When an app 'is slow' but total CPU looks fine, mpstat -P ALL reveals one core at 100% while others idle — the classic single-threaded bottleneck that aggregate load averages hide.",
        troubleshooting: "A Go/Python service underperforming — mpstat shows one busy core; the fix is thread/worker tuning or splitting the workload, not more instances.",
        interview: ["Why does overall CPU hide a single-core bottleneck?",
            "What does %steal indicate on cloud instances?",
            "How would you confirm an app is single-threaded from mpstat?"
        ],
        bestPractices: ["Run mpstat -P ALL with a 1-second interval during load tests to catch core imbalance."],
        mistakes: ["Judging CPU health only from the average line of top or load average."],
        alternatives: ["top/htop (per-core view with sorting)", "sar -P ALL (historical per-core archive)"],
        summary: "mpstat exposes per-core CPU utilization — the tool that finds the saturated core the average hides."
    }],
    containers: [{
        name: "podman",
        level: 3,
        meaning: "A daemonless, rootless container engine with a Docker-compatible CLI — designed for Kubernetes-style OCI workloads.",
        memory: "PODMAN = POD MANager. It manages pods and containers without a central daemon — the Docker CLI you can run as a normal user.",
        syntax: "podman [ACTION] [OPTIONS] IMAGE",
        options: [{
            flag: "run IMAGE",
            desc: "Run a container from an image."
        }, {
            flag: "build",
            desc: "Build an image from a Containerfile."
        }, {
            flag: "ps -a",
            desc: "List all containers."
        }, {
            flag: "images",
            desc: "List local images."
        }, {
            flag: "generate systemd",
            desc: "Create a systemd unit to run a container at boot."
        }, {
            flag: "pod create",
            desc: "Create a pod (shared network/namespace group)."
        }],
        examples: [{
            cmd: "podman run -d -p 8080:80 --name web nginx",
            desc: "Run an nginx container detached on port 8080"
        }, {
            cmd: "podman build -t myapp .",
            desc: "Build an image from a Containerfile in the current dir"
        }, {
            cmd: "podman generate systemd --new --name web > /etc/systemd/system/web.service",
            desc: "Run the container as a systemd-managed service"
        }],
        lab: {
            objective: "Run a rootless container.",
            steps: ["podman run --rm -d -p 8080:80 --name lab-web nginx:alpine 2>/dev/null || echo 'needs podman + network'",
                "podman ps 2>/dev/null || true"
            ],
            verify: "The container appears in podman ps.",
            cleanup: "podman rm -f lab-web 2>/dev/null || true"
        },
        production: "RHEL-family and security-hardened hosts run podman rootless with podman generate systemd so each container is a systemd unit — daemonless, SELinux-aware, and patchable without touching Docker Engine.",
        troubleshooting: "A rootless container 'can't bind port 80' — unprivileged ports only; map to 8080+ or enable net.ipv4.ip_unprivileged_port_start. SELinux denials show as AVC messages — resolve with the right label, not setenforce 0.",
        interview: ["What does daemonless mean and why is it important for security?",
            "How do you make a podman container start at boot?",
            "How does podman pods relate to Kubernetes pods?"
        ],
        bestPractices: ["Run containers rootless and manage them as systemd units for a fully auditable deployment."],
        mistakes: ["Expecting rootless containers to bind privileged ports without configuration."],
        alternatives: ["docker (daemon-based, same OCI images)", "kubectl (orchestrated pods at scale)"],
        summary: "podman runs OCI containers without a daemon — the secure, systemd-friendly container engine for enterprise Linux."
    }, {
        name: "helm",
        level: 3,
        meaning: "The package manager for Kubernetes — installs, upgrades, and rolls back applications packaged as 'charts'.",
        memory: "HELM = the K8s app store. Charts are packages; helm is the apt-get of Kubernetes.",
        syntax: "helm [ACTION] [RELEASE] [CHART]",
        options: [{
            flag: "install NAME CHART",
            desc: "Deploy a chart as a release."
        }, {
            flag: "upgrade NAME CHART",
            desc: "Upgrade a release to a new version/config."
        }, {
            flag: "rollback NAME REV",
            desc: "Roll back a release to a previous revision."
        }, {
            flag: "list",
            desc: "List deployed releases."
        }, {
            flag: "repo add NAME URL",
            desc: "Add a chart repository."
        }, {
            flag: "template NAME CHART",
            desc: "Render templates to YAML without deploying (dry-run review)."
        }],
        examples: [{
            cmd: "helm repo add bitnami https://charts.bitnami.com/bitnami",
            desc: "Add the Bitnami chart repository"
        }, {
            cmd: "helm install myapp ./charts/myapp -f values-prod.yaml",
            desc: "Deploy an app with production values"
        }, {
            cmd: "helm upgrade myapp ./charts/myapp --set image.tag=v2.1.0",
            desc: "Roll out a new image version"
        }, {
            cmd: "helm rollback myapp 3",
            desc: "Revert to revision 3"
        }],
        lab: {
            objective: "Preview a chart without deploying.",
            steps: ["helm version 2>/dev/null | head -1 || echo 'helm not installed'",
                "helm repo list 2>/dev/null || true"
            ],
            verify: "Helm reports its version and any configured repos.",
            cleanup: "none needed"
        },
        production: "Enterprise Kubernetes releases are managed with Helm charts and values files per environment — secrets injected via --set from CI, pinned chart versions, and automatic rollbacks when health checks fail.",
        troubleshooting: "A failed helm upgrade leaves the release broken — helm history shows revisions and helm rollback <name> <prev-rev> restores the last good state in one command.",
        interview: ["What is a Helm chart made of?",
            "How does helm rollback protect a bad release?",
            "What is the difference between install and upgrade?"
        ],
        bestPractices: ["Keep charts in git, promote values files per environment, and pin chart versions in CI."],
        mistakes: ["Deploying with mutable latest image tags — helm has no way to know a rollback is needed if tags don't change."],
        alternatives: ["kubectl apply (imperative, no versioning)", "Kustomize (template-free overlays)"],
        summary: "helm packages and version-manages Kubernetes applications — install, upgrade, and roll back with confidence."
    }],
    aws: [{
        name: "aws",
        level: 3,
        meaning: "The AWS Command Line Interface — manages AWS services (EC2, S3, IAM, and hundreds more) from the terminal.",
        memory: "AWS = Amazon Web Services CLI. One binary, every service — the console in your shell.",
        syntax: "aws [OPTION]... SERVICE COMMAND [PARAMETERS]",
        options: [{
            flag: "--profile NAME",
            desc: "Use a named credential profile."
        }, {
            flag: "--region REGION",
            desc: "Target a specific region."
        }, {
            flag: "--output json|text|table",
            desc: "Output format (json is script-friendly)."
        }, {
            flag: "service help",
            desc: "Docs for a service, e.g. aws ec2 help."
        }],
        examples: [{
            cmd: "aws s3 ls",
            desc: "List S3 buckets"
        }, {
            cmd: "aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId' --output text",
            desc: "List instance IDs for automation"
        }, {
            cmd: "aws sts get-caller-identity",
            desc: "Confirm which identity/account is active"
        }, {
            cmd: "aws s3 sync ./build/ s3://my-bucket/releases/",
            desc: "Deploy build artifacts to S3"
        }],
        lab: {
            objective: "Confirm the active AWS identity.",
            steps: ["aws sts get-caller-identity 2>/dev/null || echo 'no AWS credentials configured'",
                "aws s3 ls 2>/dev/null || true"
            ],
            verify: "The active account/ARN prints where credentials exist.",
            cleanup: "none needed"
        },
        production: "Infrastructure-as-Code pipelines drive everything through the aws CLI — creating stacks, syncing artifacts, and running diagnostics with --query for machine-parseable output in CI.",
        troubleshooting: "A confusing AccessDenied — the first command is always aws sts get-caller-identity to confirm which profile/role is actually active before touching IAM policies.",
        interview: ["How do you verify which AWS identity is being used?",
            "What does --query give you over plain JSON output?",
            "Why are profiles essential in multi-account enterprises?"
        ],
        bestPractices: ["Always confirm identity with sts get-caller-identity first and use --output text in scripts."],
        mistakes: ["An active AWS_PROFILE or leftover environment key silently overriding the intended credentials."],
        alternatives: ["AWS Console (human use)", "Terraform (declarative resource management)"],
        summary: "aws is the complete AWS API in a shell — the automation interface for every cloud operation."
    }],
    kernel: [{
        name: "lsmod",
        level: 2,
        meaning: "Lists currently loaded kernel modules and their dependencies.",
        memory: "LSMOD = LiSt MODules. Shows the kernel's loaded drivers and which modules they depend on.",
        syntax: "lsmod",
        options: [{
            flag: "(none)",
            desc: "Prints Module / Size / Used by / name columns from /proc/modules."
        }],
        examples: [{
            cmd: "lsmod",
            desc: "List all loaded kernel modules"
        }, {
            cmd: "lsmod | grep -i nvme",
            desc: "Check if the NVMe driver is loaded"
        }],
        lab: {
            objective: "Audit loaded kernel modules.",
            steps: ["lsmod | head -15", "lsmod | wc -l"
            ],
            verify: "Modules and their usage counts are listed.",
            cleanup: "none needed"
        },
        production: "Hardware troubleshooting starts with lsmod to confirm drivers loaded — a missing NIC or RAID module explains 'no such device' before you rebuild anything.",
        troubleshooting: "A network interface missing after a kernel update — lsmod | grep <driver> reveals the module isn't loaded; modprobe it and add to modules-load.d so it survives reboot.",
        interview: ["What do the three lsmod columns mean?",
            "How is lsmod related to /proc/modules?",
            "Why would a module fail to auto-load after a kernel upgrade?"
        ],
        bestPractices: ["Check lsmod before assuming hardware failure when a device is absent."],
        mistakes: ["Unloading a module in use by others (rmmod fails with 'Module is in use') without checking the Using column."],
        alternatives: ["cat /proc/modules (raw data)", "modinfo <mod> (metadata about a module)"],
        summary: "lsmod shows which kernel drivers are loaded — the first stop when hardware doesn't appear."
    }, {
        name: "modprobe",
        level: 3,
        meaning: "Loads or unloads kernel modules, resolving dependencies automatically.",
        memory: "MODPROBE = MODule ProBE. Load a driver and it pulls in whatever it depends on — no manual dependency juggling.",
        syntax: "modprobe [OPTION]... [MODULE]",
        options: [{
            flag: "-r MODULE",
            desc: "Remove (unload) a module."
        }, {
            flag: "-a MODULE...",
            desc: "Load multiple modules."
        }, {
            flag: "-v, --verbose",
            desc: "Verbose output showing what is loaded and why."
        }, {
            flag: "-n, --dry-run",
            desc: "Show what would happen without doing it."
        }],
        examples: [{
            cmd: "modprobe nvme",
            desc: "Load the NVMe driver and its dependencies"
        }, {
            cmd: "modprobe -r vfio-pci",
            desc: "Unload a module cleanly"
        }, {
            cmd: "modprobe --dry-run -v ip_tables",
            desc: "Preview what loading ip_tables would pull in"
        }],
        lab: {
            objective: "Manage modules safely with dry-run.",
            steps: ["modprobe -n -v dummy 2>/dev/null || echo 'module unavailable'",
                "modprobe dummy 2>/dev/null && lsmod | grep dummy; modprobe -r dummy 2>/dev/null || true"
            ],
            verify: "A dependency resolution preview runs without changing the system.",
            cleanup: "modprobe -r dummy 2>/dev/null || true"
        },
        production: "Kernel module loading for storage, NICs, and virtualization is standardized with /etc/modules-load.d so required drivers load at boot deterministically across the fleet.",
        troubleshooting: "When a driver update requires a new module after kernel patches, modprobe the module to validate it loads, then persist with modules-load.d before rebooting.",
        interview: ["Why is modprobe preferred over insmod?",
            "How do you make a module load at boot?",
            "What does the -r flag do?"
        ],
        bestPractices: ["Persist needed modules in /etc/modules-load.d and dry-run (-n) before loading anything new."],
        mistakes: ["Using insmod (no dependency resolution) when modprobe handles the whole tree."],
        alternatives: ["insmod/rmmod (raw load/unload)", "depmod (regenerate module dependency metadata)"],
        summary: "modprobe loads kernel drivers with dependency resolution — how the right drivers get in and stay in."
    }, {
        name: "lspci",
        level: 2,
        meaning: "Lists PCI devices (network cards, GPUs, storage controllers) attached to the system.",
        memory: "LSPCI = LiSt PCI. The inventory of cards plugged into the motherboard's PCI bus.",
        syntax: "lspci [OPTION]...",
        options: [{
            flag: "-v, --verbose",
            desc: "Verbose device details (driver, IRQ, memory)."
        }, {
            flag: "-k, --kernel",
            desc: "Show which kernel driver handles each device."
        }, {
            flag: "-nn",
            desc: "Show vendor and device IDs (helps find driver support)."
        }],
        examples: [{
            cmd: "lspci | grep -i nvidia",
            desc: "Find the NVIDIA GPU"
        }, {
            cmd: "lspci -k | grep -A2 -i ethernet",
            desc: "See which driver binds the NIC"
        }, {
            cmd: "lspci -nn | head",
            desc: "Vendor/device IDs for driver research"
        }],
        lab: {
            objective: "Inventory hardware and their drivers.",
            steps: ["lspci | head -20", "lspci -k | head -30"
            ],
            verify: "PCI devices with kernel driver assignments are listed.",
            cleanup: "none needed"
        },
        production: "Capacity planning and bare-metal onboarding run lspci to inventory NICs, GPUs, and HBAs — and lspci -k confirms drivers are bound before workloads are scheduled.",
        troubleshooting: "A GPU 'not detected' by the app — lspci -nn gives the device ID to check driver support; lspci -k shows whether a conflicting driver grabbed it.",
        interview: ["What does lspci -k tell you that plain lspci doesn't?",
            "How do you find the vendor/device ID for driver research?",
            "Why would a PCI device appear but have no driver bound?"
        ],
        bestPractices: ["Use lspci -k to verify driver binding after kernel or firmware changes on bare metal."],
        mistakes: ["Assuming a device is faulty when lspci shows it but no driver is bound — check module loading first."],
        alternatives: ["lsusb (USB bus equivalent)", "dmesg | grep pci (boot-time PCI logs)"],
        summary: "lspci inventories PCI hardware and the drivers behind it — the hardware map of a bare-metal server."
    }, {
        name: "lsusb",
        level: 2,
        meaning: "Lists USB devices connected to the system, with vendor and product IDs.",
        memory: "LSUSB = LiSt USB. Which USB gadgets the kernel sees — from keyboards to security tokens.",
        syntax: "lsusb [OPTION]...",
        options: [{
            flag: "-t, --tree",
            desc: "Show the USB device tree with speeds and drivers."
        }, {
            flag: "-v, --verbose",
            desc: "Detailed descriptors for every device."
        }, {
            flag: "-d VID:PID",
            desc: "Filter to one vendor/product pair."
        }],
        examples: [{
            cmd: "lsusb",
            desc: "List all USB devices"
        }, {
            cmd: "lsusb -t",
            desc: "Show the USB tree with driver assignments"
        }, {
            cmd: "lsusb -d 0483:374b",
            desc: "Inspect a specific device by vendor:product"
        }],
        lab: {
            objective: "Inventory USB devices.",
            steps: ["lsusb", "lsusb -t"
            ],
            verify: "Connected USB devices appear with IDs.",
            cleanup: "none needed"
        },
        production: "Security-hardened and IoT servers use lsusb to verify allowed USB hardware — unexpected tokens or storage dongles are flagged by comparing lsusb output against an approved baseline.",
        troubleshooting: "A USB security token 'not working' — lsusb shows whether the device is enumerated at all, separating driver problems from hardware problems.",
        interview: ["What is a VID:PID pair and why does it matter?",
            "How does lsusb -t differ from plain lsusb?",
            "Why would a USB device not appear in lsusb?"
        ],
        bestPractices: ["Use lsusb -d VID:PID in scripts to check for a specific device (e.g. YubiKey) being present."],
        mistakes: ["Troubleshooting a token's software when lsusb already proves the hardware isn't enumerating."],
        alternatives: ["dmesg | grep usb (kernel-level USB messages)", "lsblk (USB storage block devices)"],
        summary: "lsusb lists USB devices and their IDs — the inventory check for every USB-attached gadget."
    }],
    secextra: [{
        name: "getenforce",
        level: 2,
        meaning: "Reports the current SELinux mode: Enforcing, Permissive, or Disabled.",
        memory: "GETENFORCE = GET the SELinux ENFORCEment mode. One word answers 'is SELinux actually policing?'",
        syntax: "getenforce",
        options: [{
            flag: "(none)",
            desc: "Prints Enforcing, Permissive, or Disabled."
        }],
        examples: [{
            cmd: "getenforce",
            desc: "Show the current SELinux mode"
        }],
        lab: {
            objective: "Check SELinux mode.",
            steps: ["getenforce", "sestatus 2>/dev/null | head -5 || true"
            ],
            verify: "The mode prints (and sestatus adds detail where available).",
            cleanup: "none needed"
        },
        production: "First step of any RHEL SELinux denial: getenforce — if Permissive, the audit log records what WOULD be blocked; if Enforcing, AVC denials are actively breaking services.",
        troubleshooting: "A service failing only on RHEL boxes — getenforce shows Enforcing, then ausearch -m avc confirms SELinux is the culprit rather than the app.",
        interview: ["What are the three SELinux modes?",
            "Why is Permissive useful for troubleshooting?",
            "Where is the mode persisted across reboots?"
        ],
        bestPractices: ["Confirm mode with getenforce before troubleshooting any 'works on Ubuntu, fails on RHEL' issue."],
        mistakes: ["Disabling SELinux entirely instead of fixing the policy — weakens the whole host."],
        alternatives: ["sestatus (full SELinux status)", "ausearch -m avc (read the denials)"],
        summary: "getenforce states the SELinux mode at a glance — the first question in any SELinux-related denial."
    }, {
        name: "setenforce",
        level: 3,
        meaning: "Changes the SELinux enforcement mode at runtime (Enforcing <-> Permissive), without a reboot.",
        memory: "SET ENFORCE = set the SELinux ENFORCEment level now. Runtime toggle — no reboot required, but it resets on reboot.",
        syntax: "setenforce 0 | 1 | Enforcing | Permissive",
        options: [{
            flag: "0 / Permissive",
            desc: "Switch to Permissive (log denials, don't block)."
        }, {
            flag: "1 / Enforcing",
            desc: "Switch to Enforcing (block and log)."
        }],
        examples: [{
            cmd: "setenforce 0",
            desc: "Temporarily allow everything while troubleshooting"
        }, {
            cmd: "setenforce 1",
            desc: "Re-enable enforcement after a fix"
        }],
        lab: {
            objective: "Toggle SELinux mode safely for a test.",
            steps: ["getenforce", "setenforce 0 2>/dev/null && getenforce; setenforce 1 2>/dev/null && getenforce || echo 'permission denied'"
            ],
            verify: "The mode flips to Permissive and back to Enforcing.",
            cleanup: "setenforce 1 2>/dev/null || true"
        },
        production: "During an incident, engineers use setenforce 0 to distinguish an SELinux denial from a real app bug, then fix the policy (semanage/restorecon) and setenforce 1 — never leaving hosts Permissive permanently.",
        troubleshooting: "An app 'works after setenforce 0' — that proves SELinux; capture the AVC with ausearch while Permissive, write the correct policy, then re-enforce.",
        interview: ["Why is setenforce not persistent across reboot?",
            "What is the correct permanent way to change SELinux behavior?",
            "Why never leave a host Permissive?"
        ],
        bestPractices: ["Use setenforce 0 only as a diagnostic step and immediately re-enforce after the policy fix."],
        mistakes: ["Disabling enforcement and forgetting — the box drifts into an insecure state silently."],
        alternatives: ["semanage boolean (fine-grained policy toggles)", "selinux-policy changes in /etc/selinux/config"],
        summary: "setenforce flips SELinux enforcement at runtime — the diagnostic toggle for isolating policy denials."
    }, {
        name: "quota",
        level: 3,
        meaning: "Displays disk usage and limits for users or groups, and (as edquota) sets filesystem quotas.",
        memory: "QUOTA = the disk budget. Limits how much space/inodes a user can consume — 'your storage allowance is X'.",
        syntax: "quota [OPTION]... [USER]",
        options: [{
            flag: "-u / -g",
            desc: "Check user or group quotas."
        }, {
            flag: "-v, --verbose",
            desc: "Show quotas even for filesystems with none set."
        }, {
            flag: "-s, --human-readable",
            desc: "Human-readable sizes."
        }],
        examples: [{
            cmd: "quota -vs",
            desc: "Verbose human-readable quota report"
        }, {
            cmd: "edquota -u alice",
            desc: "Edit alice's quota limits interactively"
        }, {
            cmd: "repquota /data",
            desc: "Full quota report for the /data filesystem"
        }],
        lab: {
            objective: "View quota state.",
            steps: ["quota -vs 2>/dev/null || echo 'no quotas configured'", "repquota / 2>/dev/null | head -5 || true"
            ],
            verify: "Quota state is reported or the command clearly says none are set.",
            cleanup: "none needed"
        },
        production: "Shared home and scratch filesystems in enterprises enforce quotas to stop one runaway job from filling storage for everyone — quota reports drive capacity reviews per team.",
        troubleshooting: "A user 'cannot write, disk has space' — quota -s shows they hit their inode or space limit; raise the quota or clean up rather than resizing the disk.",
        interview: ["What is the difference between soft and hard limits?",
            "How do inode quotas differ from space quotas?",
            "Why are quotas essential on shared multi-tenant storage?"
        ],
        bestPractices: ["Set quotas with headroom above expected usage and alert on the soft limit, not the hard limit."],
        mistakes: ["Setting only space limits — a single app dumping millions of small files can exhaust inodes instead."],
        alternatives: ["xfs_quota (XFS-native tooling)", "storage subaccounting in object stores"],
        summary: "quota enforces per-user disk budgets — the capacity governor for shared enterprise storage."
    }, {
        name: "exportfs",
        level: 3,
        meaning: "Manages NFS exports — sharing directories with clients and maintaining the exports table.",
        memory: "EXPORTFS = EXPORT FileS. Publish a directory to NFS clients — and re-publish it after editing /etc/exports.",
        syntax: "exportfs [OPTION]... [CLIENT:DIRECTORY]",
        options: [{
            flag: "-a, --all",
            desc: "Export or unexport all entries in /etc/exports."
        }, {
            flag: "-r, --re-export",
            desc: "Re-read /etc/exports and apply all changes."
        }, {
            flag: "-v, --verbose",
            desc: "Verbose: show exactly what is exported."
        }, {
            flag: "-u",
            desc: "Unexport (remove) a share."
        }, {
            flag: "-ra",
            desc: "Common combined form: re-export all after config edits."
        }],
        examples: [{
            cmd: "exportfs -v",
            desc: "Show current exports with options"
        }, {
            cmd: "exportfs -ra",
            desc: "Apply changes from a freshly edited /etc/exports"
        }, {
            cmd: "exportfs -u *:/data",
            desc: "Unexport the /data share"
        }],
        lab: {
            objective: "Apply and verify NFS export changes.",
            steps: ["exportfs -v 2>/dev/null || echo 'no NFS server'",
                "grep -E '^/' /etc/exports 2>/dev/null | head -3 || true"
            ],
            verify: "Current exports and exports config are visible.",
            cleanup: "none needed"
        },
        production: "Enterprise NFS exports are edited in /etc/exports and applied with exportfs -ra — a change that never touches running clients, making shared-storage reconfiguration non-disruptive.",
        troubleshooting: "An NFS client 'can't mount' — exportfs -v on the server confirms the share and its allowed clients; a missing entry or wrong CIDR is almost always the answer.",
        interview: ["Why run exportfs -ra after editing /etc/exports?",
            "How do you restrict an export to specific clients?",
            "What is the difference between exportfs and mount?"
        ],
        bestPractices: ["Always verify with exportfs -v after applying changes, and restrict exports to specific client CIDRs."],
        mistakes: ["Exporting with no_root_squash to untrusted networks — a classic privilege escalation hole."],
        alternatives: ["showmount -e (view exports from a client)", "nfsstat (NFS server/client counters)"],
        summary: "exportfs publishes and re-publishes NFS shares — the control point for enterprise shared-storage exports."
    }]
};
