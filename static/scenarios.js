// LinuxLab — 100+ Real-World Troubleshooting Scenarios
const SCENARIOS_ALL = [
  {
    id: "scenario-1",
    title: "Disk Full / No Space Left on Device",
    symptom: "Application writes fail with 'No space left on device'",
    category: "disk",
    difficulty: 2,
    commands: ["df -h", "du -sh *", "lsof +L1", "logrotate -f", "ncdu"],
    steps: [
      "Step 1: Run `df -h` to identify which filesystem is at 100% capacity.",
      "Step 2: Use `du -sh /var/log/* | sort -rh | head -10` to find the largest directories.",
      "Step 3: Check for deleted files still held open: `lsof +L1` — these consume space until the process releases them.",
      "Step 4: Inspect logrotate status: `cat /var/lib/logrotate/status` and force a rotation if stalled.",
      "Step 5: Truncate the offending log: `truncate -s 0 /var/log/syslog` or `> /var/log/syslog`.",
      "Step 6: Verify freed space with `df -h` again.",
      "Step 7: Review logrotate config: `cat /etc/logrotate.d/*` and ensure daily rotation with compression.",
      "Step 8: Set up alerting with a threshold at 80% via `df` cron check or monitoring agent."
    ],
    root_cause: "Runaway logs filled /var/log because logrotate was not configured or not running.",
    prevention: "Set up logrotate with proper retention policies, compression, and disk monitoring alerts at 80% usage."
  },
  {
    id: "scenario-2",
    title: "Inode Exhaustion",
    symptom: "Filesystem has free space but creating files fails with 'No space left on device'",
    category: "disk",
    difficulty: 3,
    commands: ["df -i", "df -h", "find /var -type f | wc -l", "ls -la /var/spool/postfix/maildrop", "tune2fs -l /dev/sda1"],
    steps: [
      "Step 1: Run `df -h` to confirm free space exists on the filesystem.",
      "Step 2: Run `df -i` to check inode usage — look for 100% IUse%.",
      "Step 3: Find directories with excessive small files: `for d in /var/*; do echo \"$d: $(find $d -type f | wc -l)\"; done | sort -t: -k2 -rn | head -5`.",
      "Step 4: Check /var/spool/postfix/maildrop for stuck mail messages: `ls /var/spool/postfix/maildrop/ | wc -l`.",
      "Step 5: Delete stale mail spool files: `find /var/spool/postfix/maildrop/ -type f -mtime +7 -delete`.",
      "Step 6: Clean up Docker overlay layers: `docker system prune -f`.",
      "Step 7: Verify inode count recovered with `df -i`.",
      "Step 8: If inodes are still critical, reformat with a higher inode ratio using `mkfs -t ext4 -i 4096 /dev/sda1`."
    ],
    root_cause: "Millions of tiny files (stuck mail spool, session files, or Docker temp layers) exhausted available inodes before disk space ran out.",
    prevention: "Monitor inode usage alongside disk space; set quotas on spool directories; regularly clean temp directories."
  },
  {
    id: "scenario-3",
    title: "High Disk IOPS / I/O Wait Spike",
    symptom: "Applications run slowly; `top` shows high %wa (I/O wait); system load average is elevated",
    category: "disk",
    difficulty: 4,
    commands: ["iostat -x 1", "iotop -o", "pidstat -d 1", "atop", "vmstat 1 10"],
    steps: [
      "Step 1: Run `iostat -x 1 5` to see per-disk avgqu-sz, await, and %util — identify the busy device.",
      "Step 2: Use `iotop -o` to identify which processes are doing the most I/O.",
      "Step 3: Check `pidstat -d 1` for per-process read/write rates in kB/s.",
      "Step 4: Determine if swap is thrashing: `vmstat 1` — look at si (swap in) and so (swap out) columns.",
      "Step 5: Inspect application logs for excessive logging output or misconfigured write cache.",
      "Step 6: If a specific PID is the culprit, trace syscalls: `strace -p <PID> -e trace=read,write -c 2>&1`.",
      "Step 7: Mitigate by adjusting I/O scheduling: `ionice -c 2 -n 7 -p <PID>` to lower priority.",
      "Step 8: Consider adding more RAM to reduce swapping, or migrate data to faster SSD storage."
    ],
    root_cause: "A misbehaving process (unbuffered logging, missing fsync, or swap thrashing) generated excessive disk I/O, saturating the device queue.",
    prevention: "Use buffered logging with logrotate; set I/O limits with cgroups/ionice; monitor iostat as a standard baseline metric."
  },
  {
    id: "scenario-4",
    title: "Filesystem Corruption After Power Loss",
    symptom: "Server fails to boot or remounts filesystem as read-only; 'I/O error' in dmesg",
    category: "filesystem",
    difficulty: 3,
    commands: ["dmesg | grep -i error", "fsck -n /dev/sda1", "mount -o remount,rw /", "fsck -y /dev/sda1", "e2fsck -j /dev/sda1"],
    steps: [
      "Step 1: Check kernel messages: `dmesg -T | grep -i 'error\\|corrupt\\|journal'`.",
      "Step 2: Check if root filesystem is read-only: `mount | grep ' / '`.",
      "Step 3: Boot into single-user mode or recovery shell from GRUB.",
      "Step 4: Attempt to remount root as read-write: `mount -o remount,rw /`.",
      "Step 5: Run filesystem check in dry-run mode: `fsck -n /dev/sda1` to see what would be repaired.",
      "Step 6: Run actual repair: `fsck -y /dev/sda1` (answer yes to all fixes).",
      "Step 7: If journal is corrupt, try: `e2fsck -j /dev/sda1` or use alternate superblock: `e2fsck -b 32768 /dev/sda1`.",
      "Step 8: Reboot and verify the system comes up clean: `dmesg | tail -20`."
    ],
    root_cause: "An ungraceful shutdown (power loss) caused filesystem journal corruption, triggering automatic read-only remount by the kernel to prevent damage.",
    prevention: "Use a UPS battery backup; enable barrier=1 in mount options for ext4; consider using XFS for better recovery behavior."
  },
  {
    id: "scenario-5",
    title: "Mount Point Disappeared After Reboot",
    symptom: "Application data appears missing; mount point directory is empty; /etc/fstab entry still exists",
    category: "filesystem",
    difficulty: 2,
    commands: ["mount", "cat /etc/fstab", "blkid", "lsblk -f", "dmesg | grep -i sdb"],
    steps: [
      "Step 1: Run `mount` to see what is currently mounted — look for the missing filesystem.",
      "Step 2: Check `cat /etc/fstab` to verify the entry still exists.",
      "Step 3: Run `blkid` to list block device UUIDs and compare with fstab entries.",
      "Step 4: Check if device names changed: `lsblk -f` — compare UUIDs with fstab.",
      "Step 5: Try mounting everything in fstab: `mount -a` and note any error messages.",
      "Step 6: If the device is missing, check dmesg: `dmesg -T | grep -i 'sdb\\|error'`.",
      "Step 7: If the mount point directory was deleted, recreate it: `mkdir -p /data`.",
      "Step 8: Update fstab if UUID changed, then run `mount -a` to confirm."
    ],
    root_cause: "The kernel assigned a different device name (e.g., /dev/sdb vs /dev/sdc) on reboot, or the fstab entry used a device name instead of a UUID.",
    prevention: "Always use UUID or LABEL in /etc/fstab instead of device names; back up fstab configuration before making changes."
  },
  {
    id: "scenario-6",
    title: "SSD TRIM Not Running / Performance Degradation",
    symptom: "System feels sluggish on SSD; `iostat` shows high write latency; write speeds have declined over time",
    category: "disk",
    difficulty: 3,
    commands: ["fstrim -v /", "systemctl status fstrim.timer", "iostat -x 1", "lsblk -D", "hdparm -Tt /dev/sda"],
    steps: [
      "Step 1: Check if TRIM is supported: `lsblk -D` — see DISC-GRAN and DISC-MAX columns.",
      "Step 2: Manually run TRIM: `fstrim -v /` and check the output for bytes trimmed.",
      "Step 3: Check if fstrim timer service is enabled: `systemctl status fstrim.timer`.",
      "Step 4: Enable weekly TRIM: `systemctl enable fstrim.timer --now`.",
      "Step 5: Test raw read speed: `hdparm -Tt /dev/sda` to establish a baseline.",
      "Step 6: Verify the SSD is not too full (>90% full significantly degrades SSD performance).",
      "Step 7: Check partition alignment: `fdisk -l` — start sectors should be multiples of 2048.",
      "Step 8: Enable discard mount option if not using fstrim: add `discard` to /etc/fstab."
    ],
    root_cause: "The fstrim.timer service was disabled, so the SSD controller was never informed of free blocks, causing write amplification and degraded performance over time.",
    prevention: "Ensure fstrim.timer is enabled for all SSD mounts; monitor disk usage below 90%; use 4K-aligned partitions."
  },
  {
    id: "scenario-7",
    title: "LVM Volume Group Full",
    symptom: "Cannot create new logical volumes; lvextend fails with 'Volume group has no free space'",
    category: "disk",
    difficulty: 3,
    commands: ["vgs", "lvs", "pvs", "pvcreate /dev/sdb", "vgextend vg0 /dev/sdb", "lvextend -l +100%FREE /dev/vg0/lv0", "resize2fs /dev/vg0/lv0"],
    steps: [
      "Step 1: Check volume group free space: `vgs` — look at VFree column.",
      "Step 2: List all physical volumes: `pvs`.",
      "Step 3: List logical volumes and their sizes: `lvs`.",
      "Step 4: Add a new disk to the VG: `pvcreate /dev/sdb && vgextend vg0 /dev/sdb`.",
      "Step 5: Extend the logical volume: `lvextend -l +100%FREE /dev/vg0/lv0`.",
      "Step 6: Resize the filesystem: `resize2fs /dev/vg0/lv0` (ext4) or `xfs_growfs /mountpoint` (XFS).",
      "Step 7: Verify new space: `df -h /mountpoint` and `lvs`.",
      "Step 8: Document LVM layout: `lvdisplay` and `vgdisplay`."
    ],
    root_cause: "The volume group had no unallocated physical extents because storage was fully provisioned without headroom for growth.",
    prevention: "Always leave 10-20% unallocated space in VGs or plan for hot-add disks; use thin provisioning where appropriate."
  },
  {
    id: "scenario-8",
    title: "NFS Share Stale File Handle",
    symptom: "`ls` on NFS mount hangs or returns 'Stale file handle'; application errors accessing files",
    category: "filesystem",
    difficulty: 2,
    commands: ["mount | grep nfs", "umount -f /mnt/nfs", "lsof /mnt/nfs", "showmount -e nfs-server", "mount -t nfs nfs-server:/export /mnt/nfs"],
    steps: [
      "Step 1: Run `mount | grep nfs` to verify the NFS mount is still present.",
      "Step 2: Force unmount: `umount -f /mnt/nfs` (may fail if busy).",
      "Step 3: If busy, find and kill processes: `lsof /mnt/nfs` then `kill -9 <PID>`.",
      "Step 4: If still stuck, use lazy unmount: `umount -l /mnt/nfs`.",
      "Step 5: Verify NFS server exports: `showmount -e <nfs-server-ip>`.",
      "Step 6: Remount: `mount -t nfs -o rw,hard,intr <nfs-server-ip>:/export /mnt/nfs`.",
      "Step 7: Test with `ls -la /mnt/nfs` and `touch /mnt/nfs/test-file`.",
      "Step 8: Add mount to /etc/fstab with `hard,intr` options for persistence."
    ],
    root_cause: "The NFS server re-exported a filesystem or restarted, invalidating file handles that clients cached — this is a classic stale file handle scenario.",
    prevention: "Use NFS v4 which has better lease-based locking; remount clients after server-side export changes; use `soft` mount option for non-critical mounts."
  },
  {
    id: "scenario-9",
    title: "Hard Link Confusion / Duplicate File Accounting",
    symptom: "`du -sh /var` shows much higher usage than expected; `df` and `du` disagree significantly",
    category: "disk",
    difficulty: 2,
    commands: ["df -h /var", "du -sh /var", "find /var -type f -links +1", "ls -li /var/log/syslog", "find /var -type f -size +100M"],
    steps: [
      "Step 1: Compare `df -h /var` (used space) vs `du -sh /var` (apparent size).",
      "Step 2: A large discrepancy suggests hard-linked or deleted-but-open files.",
      "Step 3: Find hard-linked files: `find /var -type f -links +1 -exec ls -li {} \\; | sort -n`.",
      "Step 4: Check for deleted files held open: `lsof +L1`.",
      "Step 5: Kill processes holding deleted files if safe: `lsof +L1 | awk 'NR>1{print $2}' | sort -u | xargs -r kill`.",
      "Step 6: Run `df -h` again to verify space was reclaimed.",
      "Step 7: Check for large sparse files: `find /var -type f -size +100M -exec ls -lh {} \\;`.",
      "Step 8: Use `filefrag` to check fragmentation on large files."
    ],
    root_cause: "Snapshot or backup processes created hard links, and deleted files were still held open by running processes, inflating the apparent disk usage discrepancy.",
    prevention: "Use cp --reflink (CoW) on supporting filesystems; restart services after log rotation; monitor df vs du divergence."
  },
  {
    id: "scenario-10",
    title: "Temporary Directory Not Writable",
    symptom: "Builds fail with 'could not create temporary file'; /tmp is full or has wrong permissions",
    category: "disk",
    difficulty: 1,
    commands: ["df -h /tmp", "ls -ld /tmp", "stat /tmp", "mount | grep /tmp", "chmod 1777 /tmp"],
    steps: [
      "Step 1: Check disk space on /tmp: `df -h /tmp`.",
      "Step 2: Check permissions: `ls -ld /tmp` — should show `drwxrwxrwt` (sticky bit set).",
      "Step 3: Fix permissions: `chmod 1777 /tmp` and `chown root:root /tmp`.",
      "Step 4: If /tmp is full, clean old files: `find /tmp -atime +2 -delete`.",
      "Step 5: If /tmp is mounted noexec, remount: `mount -o remount,exec /tmp`.",
      "Step 6: Check systemd PrivateTmp: some services get private /tmp via systemd.",
      "Step 7: Verify: `touch /tmp/test-write && rm /tmp/test-write`.",
      "Step 8: Configure TMPDIR environment variable to an alternate location if needed."
    ],
    root_cause: "The /tmp directory was full, had incorrect permissions (sticky bit removed), or was mounted noexec, preventing processes from creating temporary files.",
    prevention: "Monitor /tmp disk usage; never change permissions on /tmp; consider using systemd PrivateTmp for per-service isolation."
  },
  {
    id: "scenario-11",
    title: "DNS Resolution Failure for Specific Domain",
    symptom: "`ping google.com` fails with 'Temporary failure in name resolution'; `ping 8.8.8.8` works",
    category: "network",
    difficulty: 2,
    commands: ["ping 8.8.8.8", "nslookup google.com", "dig google.com", "cat /etc/resolv.conf", "resolvectl status"],
    steps: [
      "Step 1: Test connectivity: `ping 8.8.8.8` — if this fails, it's a network issue; if it works, it's DNS.",
      "Step 2: Query a specific DNS server: `nslookup google.com 8.8.8.8` to isolate the resolver.",
      "Step 3: Check configures resolvers: `cat /etc/resolv.conf` — verify they are reachable.",
      "Step 4: Check systemd-resolved status: `resolvectl status` or `systemd-resolve --status`.",
      "Step 5: Flush DNS cache: `resolvectl flush-caches`.",
      "Step 6: Check if a local firewall blocks UDP 53: `iptables -L -n | grep :53` or `ufw status`.",
      "Step 7: Restart DNS resolver: `systemctl restart systemd-resolved`.",
      "Step 8: Test resolution: `dig google.com` and verify the ANSWER section returns A records."
    ],
    root_cause: "The system's DNS resolver was pointed at an unreachable or misconfigured nameserver (e.g., corporate DNS server IP changed, or DNS server is down).",
    prevention: "Use multiple redundant DNS servers in /etc/resolv.conf; monitor DNS resolution as a basic health check; use systemd-resolved with fallback."
  },
  {
    id: "scenario-12",
    title: "Port Not Listening / Connection Refused",
    symptom: "`curl http://localhost:8080` fails with 'Connection refused'; the service appears to be running",
    category: "network",
    difficulty: 2,
    commands: ["ss -tlnp", "systemctl status myservice", "lsof -i :8080", "telnet localhost 8080", "fuser 8080/tcp"],
    steps: [
      "Step 1: Check if anything is listening on the port: `ss -tlnp | grep 8080`.",
      "Step 2: Verify the service is running: `systemctl status myservice`.",
      "Step 3: Check if the service is listening on the wrong interface: `ss -tlnp` — note the bound IP.",
      "Step 4: Service may bind to 127.0.0.1 (localhost) but you need 0.0.0.0 — update config.",
      "Step 5: Check for firewall blocking: `iptables -L -n | grep 8080` or `ufw status`.",
      "Step 6: Check if another process already owns the port: `fuser 8080/tcp`.",
      "Step 7: Restart the service: `systemctl restart myservice`.",
      "Step 8: Test: `nc -zv localhost 8080` or `telnet localhost 8080`."
    ],
    root_cause: "The application was configured to bind to 127.0.0.1 instead of 0.0.0.0, or it crashed silently after appearing to start.",
    prevention: "Bind to 0.0.0.0 when external access is needed; always test port binding after config changes; use `systemctl enable --now` for auto-restart."
  },
  {
    id: "scenario-13",
    title: "Outbound Network Blocked by Firewall",
    symptom: "Server can't reach external repos (apt update fails); internal connectivity works",
    category: "network",
    difficulty: 3,
    commands: ["curl -I https://google.com", "iptables -L -n -v", "nmap -p 443 google.com", "traceroute google.com", "mtr google.com"],
    steps: [
      "Step 1: Test outbound connectivity: `curl -I https://google.com` — check for timeout or reset.",
      "Step 2: Check local iptables: `iptables -L -n -v` — look for OUTPUT DROP or REJECT rules.",
      "Step 3: Check for a proxy requirement: `echo $http_proxy` and `echo $https_proxy`.",
      "Step 4: Test with traceroute: `traceroute -n google.com`.",
      "Step 5: Check for security groups / cloud firewall if on a cloud provider.",
      "Step 6: Temporarily add an allow rule: `iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT`.",
      "Step 7: If proxy is needed, set in /etc/apt/apt.conf.d/proxy.conf: `Acquire::http::Proxy \"http://proxy:3128\";`.",
      "Step 8: Test again: `wget -O /dev/null https://google.com`."
    ],
    root_cause: "A restrictive iptables OUTPUT policy or intermediate network firewall blocked outbound HTTPS traffic to external hosts.",
    prevention: "Use default ACCEPT policy on OUTPUT unless strict controls are needed; document egress requirements; set up a transparent proxy."
  },
  {
    id: "scenario-14",
    title: "SSL/TLS Certificate Expired",
    symptom: "Browser shows 'NET::ERR_CERT_DATE_INVALID'; curl returns 'SSL certificate problem: certificate has expired'",
    category: "network",
    difficulty: 2,
    commands: ["openssl s_client -connect example.com:443 -servername example.com", "certbot certificates", "certbot renew --force-renewal", "systemctl reload nginx"],
    steps: [
      "Step 1: Check certificate expiration: `echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -dates`.",
      "Step 2: List certbot managed certificates: `certbot certificates`.",
      "Step 3: Renew certificates: `certbot renew` (only renews if <30 days from expiry).",
      "Step 4: Force renewal: `certbot renew --force-renewal`.",
      "Step 5: Reload the web server: `systemctl reload nginx` or `systemctl reload apache2`.",
      "Step 6: Verify new expiry date: `echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates`.",
      "Step 7: Check automatic renewal: `systemctl status certbot.timer`.",
      "Step 8: If using self-signed certs, generate new ones: `openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes`."
    ],
    root_cause: "The TLS certificate was not renewed before its expiration date, because the certbot timer was disabled or skipped due to a network issue.",
    prevention: "Monitor certificate expiry with alerts at 30, 14, and 7 days out; enable certbot.timer; set up automatic renewal with DNS-01 challenges."
  },
  {
    id: "scenario-15",
    title: "HTTP 502 Bad Gateway / Upstream Unreachable",
    symptom: "Web application returns 502 Bad Gateway; backend service is unreachable through reverse proxy",
    category: "network",
    difficulty: 3,
    commands: ["systemctl status nginx", "curl -I http://localhost:3000", "tail -f /var/log/nginx/error.log", "ss -tlnp | grep 3000"],
    steps: [
      "Step 1: Check web server status: `systemctl status nginx`.",
      "Step 2: Check nginx error logs: `tail -50 /var/log/nginx/error.log` — look for 'connect() failed'.",
      "Step 3: Verify the backend is listening: `ss -tlnp | grep 3000`.",
      "Step 4: Test the backend directly: `curl -I http://localhost:3000/health`.",
      "Step 5: If the backend is not running, start it: `systemctl start backend-service`.",
      "Step 6: If the backend is slow, increase proxy_read_timeout in nginx config.",
      "Step 7: Check backend application logs: `journalctl -u backend-service -n 50`.",
      "Step 8: Restart both services: `systemctl restart backend-service nginx`."
    ],
    root_cause: "The backend application process (e.g., Node.js, uWSGI, Gunicorn) crashed or became unresponsive, causing nginx to receive connection refused or timeouts.",
    prevention: "Use health checks on backend; configure nginx with multiple upstream servers and proxy_next_upstream; set up auto-restart for the backend."
  },
  {
    id: "scenario-16",
    title: "TCP Connection Timeout / Slow SSH Login",
    symptom: "SSH connections hang for 30+ seconds before connecting; curl to local services is slow",
    category: "network",
    difficulty: 3,
    commands: ["ssh -vvv user@host", "ssh -o GSSAPIAuthentication=no user@host", "time ssh user@host", "grep UseDNS /etc/ssh/sshd_config"],
    steps: [
      "Step 1: Enable verbose SSH: `ssh -vvv user@host` — look for delays between messages.",
      "Step 2: Check if reverse DNS is causing delay: add `UseDNS no` to /etc/ssh/sshd_config.",
      "Step 3: Check for GSSAPI timeouts: `ssh -o GSSAPIAuthentication=no user@host` — if fast, disable GSSAPI.",
      "Step 4: Check network latency: `ping -c 5 host`.",
      "Step 5: Add options to ~/.ssh/config: `Host *\n  GSSAPIAuthentication no\n  UseDNS no`.",
      "Step 6: Restart SSH: `systemctl restart sshd`.",
      "Step 7: Test connection time: `time ssh -o StrictHostKeyChecking=no user@host exit`.",
      "Step 8: For curl slowness, check UseDNS on the server and local resolver latency."
    ],
    root_cause: "The SSH server attempted reverse DNS lookup and GSSAPI authentication before password auth, causing 15-30 second connection delays.",
    prevention: "Set UseDNS no and GSSAPIAuthentication no in sshd_config; keep SSH debug logging available for analysis."
  },
  {
    id: "scenario-17",
    title: "Duplicate IP Address / ARP Conflict",
    symptom: "Network connectivity drops intermittently; arping shows multiple MACs for the same IP",
    category: "network",
    difficulty: 4,
    commands: ["arp -a", "ip neigh show", "arping -D -I eth0 192.168.1.100", "tcpdump -i eth0 arp", "ip addr show"],
    steps: [
      "Step 1: Check the ARP table: `arp -a` or `ip neigh show` — look for IPs with multiple MAC entries.",
      "Step 2: Probe for duplicate IP: `arping -D -I eth0 192.168.1.100` — 1+ replies means a duplicate exists.",
      "Step 3: Capture ARP traffic: `tcpdump -i eth0 -n arp` and look for 'who-has' / 'is-at' patterns.",
      "Step 4: Check local IP configuration: `ip addr show eth0`.",
      "Step 5: Identify the offending device by MAC lookup against switch logs.",
      "Step 6: Remove the duplicate IP or shut down the conflicting device.",
      "Step 7: Clear the ARP cache: `ip neigh flush all`.",
      "Step 8: Verify clean state: `arp -a` should show one MAC per IP."
    ],
    root_cause: "A second device (rogue VM, misconfigured static IP) was assigned the same IP as the server, causing ARP flapping and intermittent connectivity loss.",
    prevention: "Use DHCP reservations for consistent IP assignment; enable DHCP snooping on switches; use ARP inspection."
  },
  {
    id: "scenario-18",
    title: "MTU Mismatch / Fragmentation Issue",
    symptom: "SSH works but scp/sftp hangs mid-transfer; `ping -M do -s 1472 host` fails with 'Message too long'",
    category: "network",
    difficulty: 4,
    commands: ["ping -M do -s 1472 8.8.8.8", "ip link show eth0", "tracepath 8.8.8.8", "ip link set dev eth0 mtu 1400"],
    steps: [
      "Step 1: Test path MTU with ping: `ping -M do -s 1472 -c 3 8.8.8.8` (1500 - 28 = 1472).",
      "Step 2: Reduce the ping size until it succeeds: 1472, 1400, 1300, 1200...",
      "Step 3: Run tracepath: `tracepath 8.8.8.8` to find the path MTU.",
      "Step 4: Check current interface MTU: `ip link show eth0 | grep mtu`.",
      "Step 5: Lower MTU temporarily: `ip link set dev eth0 mtu 1400`.",
      "Step 6: Make permanent in /etc/network/interfaces or netplan config.",
      "Step 7: If using VPN/tunnel, check the tunnel interface MTU as well.",
      "Step 8: Re-test: `ping -M do -s 1472 8.8.8.8` should now succeed."
    ],
    root_cause: "A router or VPN tunnel along the path had a lower MTU than the sending interface, and ICMP 'fragmentation needed' messages were blocked by a firewall — classic PMTUD black hole.",
    prevention: "Set MTU to 1450 or lower on tunnel/VPN interfaces; never block ICMP type 3 code 4; enable PMTUD discovery helpers."
  },
  {
    id: "scenario-19",
    title: "DHCP Lease Expired / No IP Address Assigned",
    symptom: "`ip a` shows no IP address on the interface; 'No DHCPOFFERS' in syslog",
    category: "network",
    difficulty: 1,
    commands: ["ip addr show", "dhclient -v eth0", "dhcpcd -v eth0", "journalctl -u systemd-networkd -n 20", "ip link set eth0 up"],
    steps: [
      "Step 1: Check current IP assignment: `ip addr show eth0`.",
      "Step 2: Release and renew: `dhclient -r eth0 && dhclient -v eth0`.",
      "Step 3: If using systemd-networkd: `journalctl -u systemd-networkd -n 30`.",
      "Step 4: Ensure the interface is up: `ip link set eth0 up`.",
      "Step 5: Check NetworkManager: `nmcli device status`.",
      "Step 6: Try a static IP to test: `ip addr add 192.168.1.100/24 dev eth0` (if you know the subnet).",
      "Step 7: Check for MAC filtering on the switch or router.",
      "Step 8: Restart networking: `systemctl restart networking`."
    ],
    root_cause: "The DHCP client failed to renew the lease because the DHCP server was unreachable or the address pool was exhausted.",
    prevention: "Use DHCP reservation for servers; configure shorter lease timeout for faster recovery; set up redundant DHCP servers."
  },
  {
    id: "scenario-20",
    title: "IPv6 Misconfiguration Causing Connectivity Issues",
    symptom: "Connections to some services are very slow; system prefers IPv6 but IPv6 routing is broken",
    category: "network",
    difficulty: 3,
    commands: ["curl -6 -I https://google.com", "curl -4 -I https://google.com", "sysctl net.ipv6.conf.all.disable_ipv6", "cat /proc/sys/net/ipv6/conf/all/disable_ipv6"],
    steps: [
      "Step 1: Check if IPv6 is enabled: `cat /proc/sys/net/ipv6/conf/all/disable_ipv6` — 0 means enabled.",
      "Step 2: Test IPv6 connectivity: `curl -6 -I https://google.com`.",
      "Step 3: Test IPv4 connectivity: `curl -4 -I https://google.com`.",
      "Step 4: If IPv4 works but IPv6 is slow/timing out, DNS is preferring AAAA records for broken IPv6.",
      "Step 5: Temporarily disable IPv6: `sysctl -w net.ipv6.conf.all.disable_ipv6=1`.",
      "Step 6: If this fixes the issue, add `net.ipv6.conf.all.disable_ipv6=1` to /etc/sysctl.conf.",
      "Step 7: For a permanent fix, properly configure IPv6 routing and firewall rules.",
      "Step 8: Test both protocols to confirm resolution."
    ],
    root_cause: "IPv6 was enabled on the host but the network lacked proper IPv6 routing, causing timeouts on IPv6 connections before falling back to IPv4.",
    prevention: "Disable IPv6 on hosts that don't need it; or ensure full IPv6 routing, firewall, and DNS AAAA records."
  }
,
  {
    id: "scenario-21",
    title: "OOM Killer Terminating Application",
    symptom: "Application process disappears; kernel logs show 'Out of memory: Kill process'",
    category: "process",
    difficulty: 3,
    commands: ["dmesg | grep -i oom", "journalctl -k | grep oom", "free -m", "top -o %MEM", "cat /proc/meminfo"],
    steps: [
      "Step 1: Check kernel logs for OOM: `dmesg -T | grep -i 'oom\\|killed process'`.",
      "Step 2: Identify the killed process and its memory usage at time of death from OOM logs.",
      "Step 3: Check current memory usage: `free -m` and `top -o %MEM`.",
      "Step 4: Look for memory leaks: `ps aux --sort=-%mem | head -10`.",
      "Step 5: Protect critical processes: `echo -1000 > /proc/<PID>/oom_score_adj`.",
      "Step 6: Increase memory or add swap: `fallocate -l 2G /swapfile && mkswap /swapfile && swapon /swapfile`.",
      "Step 7: Set systemd OOM policy: `OOMPolicy=continue` and `MemoryMax=` in unit file.",
      "Step 8: Set vm.overcommit_memory=2 in /etc/sysctl.conf to prevent overcommit."
    ],
    root_cause: "The application had a memory leak or grew beyond available RAM+swap, triggering the OOM killer to reclaim memory by terminating the process.",
    prevention: "Set memory limits with systemd MemoryMax= or cgroups; monitor memory usage trends; protect critical services with oom_score_adj."
  },
  {
    id: "scenario-22",
    title: "Zombie Processes Accumulating",
    symptom: "`ps aux` shows many processes in 'Z' (zombie) state; PID numbers are being exhausted",
    category: "process",
    difficulty: 3,
    commands: ["ps aux | grep ' Z'", "top -b -n1 | grep zombie", "cat /proc/<PID>/status", "kill -SIGCHLD <parent_pid>", "ps -eo pid,ppid,stat,comm"],
    steps: [
      "Step 1: Count zombie processes: `ps aux | grep -c ' Z'`.",
      "Step 2: Identify the parent process: `ps -eo pid,ppid,stat,comm | grep ' Z'` — note the PPID column.",
      "Step 3: Check if the parent is still alive: `ps -p <PPID> -o pid,stat,comm`.",
      "Step 4: Send SIGCHLD to the parent to prompt reaping: `kill -SIGCHLD <PPID>`.",
      "Step 5: If the parent is buggy, restart the parent process: `systemctl restart <parent-service>`.",
      "Step 6: If the parent can't be restarted, check if it's waiting on something else.",
      "Step 7: As a last resort, reboot the system to clear all zombies.",
      "Step 8: Verify: `ps aux | grep ' Z' | wc -l` should be 0."
    ],
    root_cause: "The parent process failed to call wait()/waitpid() to reap terminated child processes, leaving them in zombie (Z) state until the parent itself dies or reaps them.",
    prevention: "Ensure parent processes handle SIGCHLD properly; use double-fork for long-running children; monitor zombie count via alerting."
  },
  {
    id: "scenario-23",
    title: "High CPU Usage / Runaway Process",
    symptom: "Server load average is >10; one process uses 100% CPU; service is unresponsive",
    category: "process",
    difficulty: 2,
    commands: ["top", "ps aux --sort=-%cpu | head", "htop", "perf top", "strace -p <PID> -c"],
    steps: [
      "Step 1: Run `top` and press 'P' to sort by CPU — identify the offending PID.",
      "Step 2: Get process details: `ps -p <PID> -o pid,ppid,user,cmd,%cpu,%mem`.",
      "Step 3: Check recent log entries: `journalctl -u <service> --since '5 min ago'`.",
      "Step 4: Sample system calls: `strace -p <PID> -c 2>&1` to see which syscall dominates.",
      "Step 5: If it's a Java process, get a thread dump: `jstack <PID>`.",
      "Step 6: If unresponsive, stop gracefully: `kill -15 <PID>` then `kill -9 <PID>` if needed.",
      "Step 7: Restart the service: `systemctl restart <service>`.",
      "Step 8: Monitor the service to confirm the issue doesn't recur."
    ],
    root_cause: "A software bug caused an infinite loop or hot polling loop, consuming 100% CPU and starving other processes.",
    prevention: "Set CPU limits with systemd CPUQuota=; implement watchdog timers in applications; add backoff delays in polling loops."
  },
  {
    id: "scenario-24",
    title: "Too Many Open Files (ulimit)",
    symptom: "Application logs 'Too many open files'; socket() fails with EMFILE error",
    category: "process",
    difficulty: 2,
    commands: ["ulimit -n", "lsof -p <PID> | wc -l", "cat /proc/<PID>/limits", "ls /proc/<PID>/fd | wc -l", "sysctl fs.file-max"],
    steps: [
      "Step 1: Check system-wide limit: `cat /proc/sys/fs/file-max`.",
      "Step 2: Check the per-process limit: `cat /proc/<PID>/limits | grep 'open files'`.",
      "Step 3: Count current open FDs: `ls /proc/<PID>/fd/ | wc -l`.",
      "Step 4: Identify leaked file handles: `lsof -p <PID> | head -30`.",
      "Step 5: Increase limit temporarily: `ulimit -n 65536` for current shell.",
      "Step 6: Make permanent in /etc/security/limits.conf: `<user> soft nofile 65536\\n<user> hard nofile 65536`.",
      "Step 7: For systemd services, add `LimitNOFILE=65536` in the unit file.",
      "Step 8: Restart the service: `systemctl daemon-reload && systemctl restart <service>`."
    ],
    root_cause: "The application opened many file descriptors (connections, files, sockets) without closing them, hitting the default ulimit of 1024.",
    prevention: "Set appropriate file descriptor limits in service definitions; implement FD leak detection; monitor FD usage."
  },
  {
    id: "scenario-25",
    title: "Process in D (Uninterruptible Sleep) State",
    symptom: "`ps aux` shows a process in 'D' state; cannot be killed with SIGKILL; systemd stop times out",
    category: "process",
    difficulty: 4,
    commands: ["ps aux | grep ' D'", "cat /proc/<PID>/status | grep State", "dmesg -T | grep -i 'hung_task\\|blocked'", "iostat -x 1", "sysctl kernel.hung_task_timeout_secs"],
    steps: [
      "Step 1: Confirm the process is in D state: `cat /proc/<PID>/status | grep State`.",
      "Step 2: Check which file descriptor it's waiting on: `ls -la /proc/<PID>/fd/`.",
      "Step 3: Check kernel hung task warnings: `dmesg -T | grep -i 'hung_task'`.",
      "Step 4: Check if the underlying filesystem is unresponsive (NFS server down, disk failure).",
      "Step 5: If NFS, try forced unmount: `umount -f /mnt/nfs`.",
      "Step 6: If disk issue, check S.M.A.R.T.: `smartctl -a /dev/sda`.",
      "Step 7: Reboot is often the only recovery for stuck D-state processes.",
      "Step 8: After reboot, check filesystem integrity."
    ],
    root_cause: "The process is waiting on I/O from a failed NFS mount or failing disk, putting it in uninterruptible sleep (D state) where even SIGKILL can't terminate it.",
    prevention: "Mount NFS with soft,intr options (not hard); set kernel.hung_task_panic=0 and monitor hung_task_timeout_secs; use redundant storage."
  },
  {
    id: "scenario-26",
    title: "User Not in sudoers File",
    symptom: "`sudo any-command` returns 'user is not in the sudoers file. This incident will be reported.'",
    category: "permission",
    difficulty: 1,
    commands: ["whoami", "id", "su -", "usermod -aG sudo username", "grep '^sudo' /etc/group"],
    steps: [
      "Step 1: Verify current user: `whoami` and `id`.",
      "Step 2: Check current sudo privileges: `sudo -l` (will fail — that's the symptom).",
      "Step 3: Switch to root if you have the password: `su -`.",
      "Step 4: Add user to the sudo group: `usermod -aG sudo username` (Debian) or `usermod -aG wheel username` (RHEL).",
      "Step 5: Verify the group addition: `groups username`.",
      "Step 6: Log out and back in for the group change to take effect.",
      "Step 7: Try `newgrp sudo` or `exec su - $USER` to refresh groups without logout.",
      "Step 8: Test: `sudo whoami` should return 'root'."
    ],
    root_cause: "The user account was created but never added to the sudo (or wheel) group, and sudoers only grants privileges to members of that group.",
    prevention: "Add new users to the appropriate admin group at account creation time; use Ansible for consistent sudoers configuration."
  },
  {
    id: "scenario-27",
    title: "File Permission Denied / Wrong Ownership",
    symptom: "Application logs 'Permission denied' when reading/writing a file; `ls -la` shows wrong owner",
    category: "permission",
    difficulty: 1,
    commands: ["ls -la /path/to/file", "id", "stat /path/to/file", "chown appuser:appgroup /path/to/file", "chmod 644 /path/to/file"],
    steps: [
      "Step 1: Check file permissions: `ls -la /path/to/file` — note owner, group, and mode.",
      "Step 2: Verify the user running the application: `ps aux | grep <app>`.",
      "Step 3: Check for ACLs: `getfacl /path/to/file`.",
      "Step 4: Change ownership: `chown appuser:appgroup /path/to/file`.",
      "Step 5: Set appropriate permissions: `chmod 644 /path/to/file`.",
      "Step 6: For directories, ensure executable bit: `chmod 755 /path/to/dir`.",
      "Step 7: Test: `su appuser -c 'cat /path/to/file'`.",
      "Step 8: For directories where files are created, set setgid: `chmod g+s /path/to/dir`."
    ],
    root_cause: "The file was owned by root (or another user) but the application runs as a non-privileged user without read/write access.",
    prevention: "Never run applications as root; use dedicated service users with proper umask; audit file ownership with periodic checks."
  },
  {
    id: "scenario-28",
    title: "SELinux Blocking Service Access",
    symptom: "Service fails to start or access files; `journalctl` shows 'AVC avc: denied'; disabling SELinux fixes it",
    category: "permission",
    difficulty: 4,
    commands: ["ausearch -m avc -ts recent", "sealert -a /var/log/audit/audit.log", "getenforce", "setenforce 0", "chcon -t httpd_sys_content_t /path", "semanage fcontext -a -t httpd_sys_content_t '/path(/.*)?'"],
    steps: [
      "Step 1: Check SELinux state: `getenforce` (Enforcing, Permissive, or Disabled).",
      "Step 2: View recent denials: `ausearch -m avc -ts recent`.",
      "Step 3: Get human-readable messages: `sealert -a /var/log/audit/audit.log`.",
      "Step 4: Temporarily set permissive to test: `setenforce 0` — if service works, SELinux is the issue.",
      "Step 5: Reset to enforcing: `setenforce 1`.",
      "Step 6: Fix file context: `chcon -R -t httpd_sys_content_t /var/www/html`.",
      "Step 7: Make persistent: `semanage fcontext -a -t httpd_sys_content_t '/var/www/html(/.*)?' && restorecon -Rv /var/www/html`.",
      "Step 8: Create a custom policy if needed: `grep AVC /var/log/audit/audit.log | audit2allow -M mypol && semodule -i mypol.pp`."
    ],
    root_cause: "SELinux enforced mandatory access controls that denied the service's legitimate access to files or ports based on its security context.",
    prevention: "Use SELinux booleans (getsebool -a, setsebool -P) rather than disabling SELinux; audit new services before deployment."
  },
  {
    id: "scenario-29",
    title: "AppArmor Denying Execution",
    symptom: "Application crashes on start; dmesg shows 'apparmor=\"DENIED\"' or 'cache_profile=\"<name>\"'",
    category: "permission",
    difficulty: 3,
    commands: ["aa-status", "dmesg | grep apparmor", "cat /etc/apparmor.d/<profile>", "aa-complain /usr/bin/<binary>", "aa-enforce /usr/bin/<binary>"],
    steps: [
      "Step 1: Check AppArmor status: `aa-status` — list loaded profiles.",
      "Step 2: Check kernel logs: `dmesg -T | grep -i apparmor`.",
      "Step 3: Set the profile to complain mode: `aa-complain /usr/bin/<binary>` (logs but doesn't block).",
      "Step 4: Test the app — if it works, AppArmor was the blocker.",
      "Step 5: Review the profile: `cat /etc/apparmor.d/usr.bin.<binary>`.",
      "Step 6: Update profile: `aa-logprof` for guided updates or edit manually.",
      "Step 7: Set back to enforce: `aa-enforce /usr/bin/<binary>`.",
      "Step 8: Verify: `aa-status | grep <binary>` should show 'enforce'."
    ],
    root_cause: "The AppArmor profile was too restrictive for the application's runtime behavior (e.g., reading files outside allowed paths).",
    prevention: "Test applications in complain mode first; audit logs regularly; use aa-logprof for guided policy updates."
  },
  {
    id: "scenario-30",
    title: "SSH Permission Denied (Public Key)",
    symptom: "SSH returns 'Permission denied (publickey)' even though the key is added to authorized_keys",
    category: "permission",
    difficulty: 2,
    commands: ["ssh -vvv user@host", "ls -la ~/.ssh", "chmod 700 ~/.ssh", "chmod 600 ~/.ssh/authorized_keys", "grep PubkeyAuthentication /etc/ssh/sshd_config"],
    steps: [
      "Step 1: Check SSH verbose output: `ssh -vvv user@host` — see what auth methods are tried.",
      "Step 2: Verify .ssh directory permissions: `ls -la ~/.ssh` — should be 700 (drwx------).",
      "Step 3: Verify authorized_keys permissions: `ls -la ~/.ssh/authorized_keys` — should be 600 (-rw-------).",
      "Step 4: Check home directory permissions: `ls -ld ~` — should not be group/other-writable.",
      "Step 5: Verify authorized_keys contains the correct public key.",
      "Step 6: Check sshd config: `grep -E 'PubkeyAuthentication|AuthorizedKeysFile|PermitRootLogin' /etc/ssh/sshd_config`.",
      "Step 7: Check SELinux/AppArmor isn't blocking: `getenforce` / `aa-status`.",
      "Step 8: Restart SSH: `systemctl restart sshd` and test again."
    ],
    root_cause: "The .ssh directory or authorized_keys file had incorrect permissions (group-writable or world-readable), causing sshd to reject the key for security reasons.",
    prevention: "Use `ssh-copy-id` for key deployment; automate permission setting in provisioning scripts; audit SSH config."
  }
  ,
  {
    id: "scenario-31",
    title: "Broken APT Package / dpkg Database Corrupt",
    symptom: "`apt install` fails with 'dpkg was interrupted, you must run sudo dpkg --configure -a'",
    category: "package",
    difficulty: 2,
    commands: ["sudo dpkg --configure -a", "sudo apt --fix-broken install", "dpkg -l | grep ^..R", "sudo rm /var/lib/dpkg/lock-frontend", "sudo apt clean"],
    steps: [
      "Step 1: Run `sudo dpkg --configure -a` to reconfigure unpacked packages.",
      "Step 2: Fix broken dependencies: `sudo apt --fix-broken install`.",
      "Step 3: If lock files block: `sudo rm /var/lib/dpkg/lock-frontend` and `sudo rm /var/lib/apt/lists/lock`.",
      "Step 4: Check for half-installed packages: `dpkg -l | grep ^..R`.",
      "Step 5: Force reconfiguration: `sudo dpkg --configure -a` again.",
      "Step 6: If a specific package fails: `sudo dpkg --remove --force-remove-reinstreq <package>`.",
      "Step 7: Clean apt cache: `sudo apt clean && sudo apt autoremove`.",
      "Step 8: Run `sudo apt update && sudo apt upgrade` to verify system health."
    ],
    root_cause: "A previous package installation was interrupted (SSH drop, power loss, Ctrl+C), leaving dpkg in an inconsistent state with unpacked but unconfigured packages.",
    prevention: "Never interrupt apt/dpkg operations; run them in tmux/screen sessions; use unattended-upgrades with proper lock handling."
  },
  {
    id: "scenario-32",
    title: "PPA / Repository Not Found (HTTP 404)",
    symptom: "`apt update` fails with '404 Not Found' for a PPA; the repository URL is stale",
    category: "package",
    difficulty: 2,
    commands: ["sudo apt update 2>&1 | grep 404", "ls /etc/apt/sources.list.d/", "sudo add-apt-repository --remove ppa:old/ppa", "sudo apt update"],
    steps: [
      "Step 1: Run `sudo apt update 2>&1 | grep 404` to find the failing repository.",
      "Step 2: List all third-party repos: `ls /etc/apt/sources.list.d/`.",
      "Step 3: Check if the PPA still exists online (it may have been removed or renamed).",
      "Step 4: Comment out the invalid PPA: `sed -i 's/^deb/# deb/' /etc/apt/sources.list.d/<bad-ppa>.list`.",
      "Step 5: Remove the PPA: `sudo add-apt-repository --remove ppa:old/ppa`.",
      "Step 6: If the PPA is for an old Ubuntu release, update the codename in the URL.",
      "Step 7: Update package lists: `sudo apt update` and verify no errors.",
      "Step 8: Search for replacement PPAs or use the official package instead."
    ],
    root_cause: "The PPA host removed the repository or the distribution codename (e.g., 'bionic') is no longer supported, returning HTTP 404.",
    prevention: "Pin third-party repos to specific releases; remove PPAs when upgrading distro; use official repositories when possible."
  },
  {
    id: "scenario-33",
    title: "Package Dependency Hell / Held Broken Packages",
    symptom: "`apt upgrade` fails with 'The following packages have unmet dependencies'",
    category: "package",
    difficulty: 3,
    commands: ["sudo apt --fix-broken install", "apt-cache depends <package>", "dpkg --get-selections | grep hold", "sudo dpkg --remove --force-depends <package>", "apt-cache policy <package>"],
    steps: [
      "Step 1: Run `sudo apt --fix-broken install` for automatic resolution.",
      "Step 2: Inspect the specific dependency: `apt-cache depends <problem-package>`.",
      "Step 3: Check for held packages: `dpkg --get-selections | grep hold`.",
      "Step 4: Use aptitude for advanced resolution: `sudo aptitude install <package>`.",
      "Step 5: Remove conflicting packages: `sudo dpkg --remove --force-depends <conflicting-package>`.",
      "Step 6: Manually install the correct version: `sudo dpkg -i /path/to/correct.deb`.",
      "Step 7: Pin specific versions in /etc/apt/preferences.d/ to avoid future conflicts.",
      "Step 8: Run `sudo apt update && sudo apt upgrade` to verify all dependencies are satisfied."
    ],
    root_cause: "Mixing repositories from different Ubuntu releases (bionic + focal) or third-party repos supplying conflicting package versions.",
    prevention: "Never mix release repositories; use apt pinning for third-party repos; test upgrades in staging first."
  },
  {
    id: "scenario-34",
    title: "YUM/DNF Repository Metadata Error",
    symptom: "`yum update` fails with 'Error: Cannot retrieve repository metadata' or 'repomd.xml' error",
    category: "package",
    difficulty: 2,
    commands: ["yum clean all", "yum makecache", "yum repolist", "rm -rf /var/cache/yum", "yum update"],
    steps: [
      "Step 1: Clean YUM cache: `yum clean all` or `dnf clean all`.",
      "Step 2: Rebuild cache: `yum makecache` or `dnf makecache`.",
      "Step 3: Check repolist: `yum repolist` — look for disabled or missing repos.",
      "Step 4: Check repo config: `cat /etc/yum.repos.d/<repo>.repo`.",
      "Step 5: Verify GPG keys: `rpm --import /etc/pki/rpm-gpg/RPM-GPG-KEY-*`.",
      "Step 6: Manually delete cache: `rm -rf /var/cache/yum/*` and retry.",
      "Step 7: If the mirror is down, change baseurl in .repo file to a different mirror.",
      "Step 8: Run `yum update` to verify the resolution."
    ],
    root_cause: "YUM cache became corrupted or a repository metadata file changed (e.g., new GPG key, retired mirror), causing sync failure.",
    prevention: "Validate repo configurations before deployment; use multiple fallback mirrors; regularly run yum makecache via cron."
  },
  {
    id: "scenario-35",
    title: "Service Won't Start — Address Already in Use",
    symptom: "`systemctl start nginx` fails; journal shows 'Address already in use' or 'bind() to 0.0.0.0:80 failed'",
    category: "service",
    difficulty: 2,
    commands: ["systemctl status nginx", "journalctl -u nginx -n 20", "ss -tlnp | grep :80", "fuser 80/tcp", "systemctl restart nginx"],
    steps: [
      "Step 1: Check service status: `systemctl status nginx` — look for 'Failed' or 'bind' errors.",
      "Step 2: Check logs: `journalctl -u nginx -n 30 | grep -i bind`.",
      "Step 3: Find what's using the port: `ss -tlnp | grep :80` or `fuser 80/tcp`.",
      "Step 4: If another instance of the same service: `systemctl stop nginx` before restarting.",
      "Step 5: If a different service (e.g., Apache) is on port 80, decide which should run.",
      "Step 6: Change the new service to a different port (e.g., 8080) in its config.",
      "Step 7: If stale PID file: `rm /var/run/nginx.pid` and restart.",
      "Step 8: Start the service and verify: `systemctl start nginx && ss -tlnp | grep :80`."
    ],
    root_cause: "Another process (Apache httpd or a previous nginx instance) was already bound to TCP port 80, preventing the new service from binding.",
    prevention: "Always check port availability before deploying services; use consistent port allocation; stop old instances first."
  },
  {
    id: "scenario-36",
    title: "Service Crash Loop / Restart Limit Exceeded",
    symptom: "`systemctl status myservice` shows 'Active: failed' or 'start-limit-hit'; service starts then immediately dies",
    category: "service",
    difficulty: 2,
    commands: ["systemctl status myservice", "journalctl -u myservice -n 50", "systemctl reset-failed myservice", "systemctl start myservice"],
    steps: [
      "Step 1: Check status: `systemctl status myservice` — look for 'start-limit-hit'.",
      "Step 2: View logs: `journalctl -u myservice -n 50` to see why it fails.",
      "Step 3: If 'start-limit-hit', reset the failed state: `systemctl reset-failed myservice`.",
      "Step 4: Fix the underlying issue (config error, missing dependency, etc.).",
      "Step 5: Increase start limit in the unit file: `StartLimitIntervalSec=30` `StartLimitBurst=10`.",
      "Step 6: Reload systemd: `systemctl daemon-reload`.",
      "Step 7: Start the service: `systemctl start myservice`.",
      "Step 8: Monitor: `journalctl -u myservice -f`."
    ],
    root_cause: "The service exited repeatedly within a short time, hitting systemd's StartLimitIntervalSec/StartLimitBurst thresholds to prevent infinite restart loops.",
    prevention: "Set reasonable StartLimitIntervalSec/Burst; fix application crashes rather than relying on restarts; add health checks."
  },
  {
    id: "scenario-37",
    title: "Service Won't Start — Configuration Syntax Error",
    symptom: "`systemctl start nginx` fails; journal shows 'syntax error' or 'unexpected end of file'",
    category: "service",
    difficulty: 1,
    commands: ["nginx -t", "journalctl -u nginx -n 20", "apache2ctl configtest", "systemctl restart nginx"],
    steps: [
      "Step 1: Validate config syntax: `nginx -t` for nginx, `apache2ctl configtest` for Apache.",
      "Step 2: The output will tell you the exact file and line number with the error.",
      "Step 3: Fix the syntax error in the config (missing semicolon, unmatched bracket, etc.).",
      "Step 4: Re-validate: `nginx -t` should return 'syntax is ok'.",
      "Step 5: Reload gracefully: `systemctl reload nginx` or `nginx -s reload`.",
      "Step 6: If reload fails, restart: `systemctl restart nginx`.",
      "Step 7: Check status: `systemctl status nginx` — should show 'active (running)'.",
      "Step 8: Check error log: `tail /var/log/nginx/error.log` for remaining issues."
    ],
    root_cause: "A recent edit to the service configuration file introduced a syntax error, preventing the service from starting.",
    prevention: "Always validate config before restart: `nginx -t && systemctl reload nginx`; use version control for config files."
  },
  {
    id: "scenario-38",
    title: "Service Masked by systemd",
    symptom: "`systemctl enable myservice` fails with 'Unit is masked, ignoring'",
    category: "service",
    difficulty: 2,
    commands: ["systemctl status myservice", "systemctl is-enabled myservice", "systemctl unmask myservice", "systemctl enable --now myservice"],
    steps: [
      "Step 1: Check if the unit is masked: `systemctl is-enabled myservice` — returns 'masked'.",
      "Step 2: List masked units: `systemctl list-unit-files | grep masked`.",
      "Step 3: Check if there's a symlink to /dev/null: `ls -la /etc/systemd/system/myservice.service`.",
      "Step 4: Unmask the service: `systemctl unmask myservice`.",
      "Step 5: Enable and start: `systemctl enable --now myservice`.",
      "Step 6: Verify status: `systemctl status myservice`.",
      "Step 7: Investigate why it was masked (it blocks the unit intentionally).",
      "Step 8: Document which services are masked and why."
    ],
    root_cause: "The unit file was masked (symlinked to /dev/null), preventing systemd from starting, stopping, or enabling it.",
    prevention: "Use `systemctl mask` sparingly and document masking; prefer `systemctl disable` over mask for most cases."
  },
  {
    id: "scenario-39",
    title: "Service Starts Then Immediately Stops (Exit Code 0)",
    symptom: "`systemctl start myservice` succeeds but service is 'inactive (dead)' right after",
    category: "service",
    difficulty: 3,
    commands: ["systemctl status myservice", "journalctl -u myservice -n 50", "type -a myservice_binary", "ldd $(which myservice_binary)", "systemctl cat myservice"],
    steps: [
      "Step 1: Check status: `systemctl status myservice` — note the exit code and 'dead' status.",
      "Step 2: Check logs: `journalctl -u myservice -n 100`.",
      "Step 3: Some services are Type=oneshot by design — verify the unit Type.",
      "Step 4: If Type=forking, the daemon might not be forking properly.",
      "Step 5: Test the binary directly: `sudo -u serviceuser /usr/bin/myservice_binary`.",
      "Step 6: Check library dependencies: `ldd $(which myservice_binary)` — look for 'not found'.",
      "Step 7: Check if a PID file is created at the path systemd expects.",
      "Step 8: Update the unit file with correct Type= and PIDFile=."
    ],
    root_cause: "The service binary exited immediately with status 0 because Type= was wrong (forking vs simple), or the PIDFile path didn't match what the daemon created.",
    prevention: "Match the unit Type to the service: simple for foreground processes, forking for traditional daemons with correct PIDFile."
  },
  {
    id: "scenario-40",
    title: "Service Dependency Failure in systemd",
    symptom: "`systemctl start myservice` fails with 'Dependency failed for ...' or 'Required dependency'",
    category: "service",
    difficulty: 2,
    commands: ["systemctl status myservice", "systemctl list-dependencies myservice", "systemctl status <dependency>", "journalctl -u <dependency> -n 20"],
    steps: [
      "Step 1: Check status: `systemctl status myservice` — look for 'Dependency failed for'.",
      "Step 2: Show the dependency tree: `systemctl list-dependencies myservice`.",
      "Step 3: Check each required dependency: `systemctl status network.target` etc.",
      "Step 4: If a dependency fails to start, fix it first.",
      "Step 5: Check dependency logs: `journalctl -u <dependency> -n 30`.",
      "Step 6: Fix the dependency (network not available, disk not mounted, etc.).",
      "Step 7: Start the dependency: `systemctl start <dependency>`.",
      "Step 8: Start the target service: `systemctl start myservice`."
    ],
    root_cause: "systemd tracks dependencies through Wants=, Requires=, and After= directives. When a dependency fails, the dependent service won't start.",
    prevention: "Use Wants= instead of Requires= for non-critical dependencies; use `systemd-analyze verify` to validate unit files."
  },
  {
    id: "scenario-41",
    title: "Failed SSH Login Attempts / Brute Force Attack",
    symptom: "auth.log shows thousands of 'Failed password for root' entries from unknown IPs",
    category: "security",
    difficulty: 2,
    commands: ["grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr", "lastb", "fail2ban-client status sshd", "ufw status"],
    steps: [
      "Step 1: Analyze the attack: `grep 'Failed password' /var/log/auth.log | awk '{print $(NF-3)}' | sort | uniq -c | sort -nr | head -10`.",
      "Step 2: Check currently banned IPs: `fail2ban-client status sshd`.",
      "Step 3: Check iptables bans: `iptables -L -n | grep DROP`.",
      "Step 4: Disable password auth: set `PasswordAuthentication no` in /etc/ssh/sshd_config.",
      "Step 5: Restart SSH: `systemctl restart sshd`.",
      "Step 6: Install and configure fail2ban if not present.",
      "Step 7: Add firewall rules to block offending subnets: `ufw deny from <subnet>`.",
      "Step 8: Verify SSH key-based auth: `ssh -o PasswordAuthentication=no user@host`."
    ],
    root_cause: "SSH was exposed to the internet with password authentication enabled, making it a target for brute-force dictionary attacks.",
    prevention: "Disable password auth, use SSH keys only, deploy fail2ban, restrict access by source IP, consider changing the SSH port."
  },
  {
    id: "scenario-42",
    title: "Firewall Blocking Legitimate Traffic",
    symptom: "Users can't reach the application on port 443; `nmap -p 443 localhost` shows 'open' but external shows 'filtered'",
    category: "security",
    difficulty: 2,
    commands: ["iptables -L -n -v", "ufw status verbose", "nmap -p 443 localhost", "curl -I https://localhost", "tcpdump -i eth0 port 443"],
    steps: [
      "Step 1: Check iptables: `iptables -L -n -v` — look for DROP/REJECT on INPUT.",
      "Step 2: Check ufw: `ufw status verbose` — confirm port 443 is allowed.",
      "Step 3: Test locally: `curl -I https://localhost` — if it works, the service is up.",
      "Step 4: Test from another host: `curl -I https://<server-ip>`.",
      "Step 5: 'Connection refused' suggests firewall at host or network level.",
      "Step 6: Allow the port: `ufw allow 443/tcp` or `iptables -A INPUT -p tcp --dport 443 -j ACCEPT`.",
      "Step 7: Check cloud security groups / network ACLs if on cloud.",
      "Step 8: Verify externally: `nmap -p 443 <server-ip>` from outside."
    ],
    root_cause: "A local firewall rule (iptables/ufw) or cloud security group was blocking inbound traffic on the application port.",
    prevention: "Use infrastructure-as-code for firewall rules; document all open ports; perform external port scans during deployment validation."
  },
  {
    id: "scenario-43",
    title: "Unattended Upgrades / Pending Reboot",
    symptom: "Server has been running for 200+ days; critical security patches not applied; kernel outdated",
    category: "security",
    difficulty: 1,
    commands: ["uname -a", "uptime", "cat /var/run/reboot-required", "apt list --upgradable", "systemctl reboot"],
    steps: [
      "Step 1: Check uptime: `uptime` — how long since last reboot?",
      "Step 2: Check if reboot is pending: `cat /var/run/reboot-required` (exists after kernel updates).",
      "Step 3: Check for available updates: `apt list --upgradable`.",
      "Step 4: Apply security updates: `apt update && apt upgrade -y`.",
      "Step 5: Install unattended-upgrades: `apt install unattended-upgrades && dpkg-reconfigure --priority=low unattended-upgrades`.",
      "Step 6: Schedule a maintenance window and reboot: `systemctl reboot`.",
      "Step 7: After reboot, verify kernel: `uname -a` shows the new version.",
      "Step 8: Check services: `systemctl list-units --state=failed`."
    ],
    root_cause: "The server was not configured with unattended-upgrades and hadn't been rebooted for kernel updates, leaving it vulnerable to known exploits.",
    prevention: "Enable unattended-upgrades for security patches; use livepatch for rebootless kernel patching; schedule monthly maintenance reboots."
  },
  {
    id: "scenario-44",
    title: "SELinux Preventing Port Binding",
    symptom: "Service fails to bind to a non-standard port; audit.log shows SELinux denial for 'name_bind'",
    category: "security",
    difficulty: 4,
    commands: ["ausearch -m avc -ts recent | grep name_bind", "semanage port -l | grep http_port_t", "semanage port -a -t http_port_t -p tcp 8081"],
    steps: [
      "Step 1: Check for name_bind denials: `ausearch -m avc -ts recent | grep name_bind`.",
      "Step 2: List allowed ports: `semanage port -l | grep http_port_t`.",
      "Step 3: Add the port: `semanage port -a -t http_port_t -p tcp 8081`.",
      "Step 4: Verify: `semanage port -l | grep 8081`.",
      "Step 5: Restart the service: `systemctl restart myservice`.",
      "Step 6: Check for new denials: `ausearch -m avc -ts recent`.",
      "Step 7: If semanage not found, install policycoreutils-python-utils.",
      "Step 8: Add this to Ansible for repeatable deployments."
    ],
    root_cause: "SELinux restricts which ports each service type can bind. Binding to a non-standard port without updating the SELinux policy triggers an AVC denial.",
    prevention: "Define all ports in SELinux policy before deployment; use semanage port to add custom ports; keep port-to-service mapping documentation."
  },
  {
    id: "scenario-45",
    title: "System Compromise / Suspicious Process",
    symptom: "Unknown process using high CPU; strange outbound connections; /tmp has suspicious files",
    category: "security",
    difficulty: 5,
    commands: ["ps aux --sort=-%cpu | head -20", "ss -tunap", "lsof -i", "rkhunter --check", "chkrootkit"],
    steps: [
      "Step 1: Isolate the server from the network immediately.",
      "Step 2: Capture running processes: `ps aux --sort=-%cpu | head -20` and save to file.",
      "Step 3: Capture network connections: `ss -tunap` and `lsof -i`.",
      "Step 4: Check for suspicious cron jobs: `crontab -l` and `ls -la /var/spool/cron/crontabs/`.",
      "Step 5: Run rootkit detection: `rkhunter --check` and `chkrootkit`.",
      "Step 6: Check for unauthorized SSH keys: `cat ~/.ssh/authorized_keys`.",
      "Step 7: Check system binary integrity: `dpkg --verify` or `rpm -Va`.",
      "Step 8: Preserve evidence, rebuild from clean backup or reimage the server."
    ],
    root_cause: "An attacker gained access through a vulnerable application or exposed service and deployed a cryptocurrency miner or backdoor on the system.",
    prevention: "Keep all software patched; use intrusion detection (OSSEC, Wazuh); restrict outbound traffic; monitor for crypto mining patterns."
  },
  {
    id: "scenario-46",
    title: "Slow Database Queries / Missing Index",
    symptom: "Web application is slow; database CPU is high; query execution time spiked after deployment",
    category: "performance",
    difficulty: 4,
    commands: ["mysqladmin processlist", "EXPLAIN SELECT ...", "pg_top", "SELECT * FROM pg_stat_activity", "SHOW INDEX FROM table"],
    steps: [
      "Step 1: Check current database processes: `SHOW FULL PROCESSLIST` (MySQL) or `SELECT * FROM pg_stat_activity` (PostgreSQL).",
      "Step 2: Identify slow queries — note their duration and query text.",
      "Step 3: Run EXPLAIN on the slow query to see the execution plan.",
      "Step 4: Look for 'Seq Scan' (PostgreSQL) or 'Using where; Using filesort' (MySQL) — signs of missing index.",
      "Step 5: Check index usage: `SHOW INDEX FROM table` or `SELECT * FROM pg_stat_user_indexes`.",
      "Step 6: Add the missing index: `CREATE INDEX CONCURRENTLY idx_name ON table (column)`.",
      "Step 7: Re-run EXPLAIN to confirm an index scan is now used.",
      "Step 8: Monitor query performance after the change."
    ],
    root_cause: "A new application feature introduced a query that accessed a large table without an appropriate index, causing full table scans and degrading performance.",
    prevention: "Review indexes during database migration reviews; enable slow query logging with alerting; load-test queries in staging."
  },
  {
    id: "scenario-47",
    title: "Memory Leak in Application",
    symptom: "Application memory usage grows over time; `free -m` shows decreasing available memory; OOM killer eventually triggers",
    category: "performance",
    difficulty: 3,
    commands: ["ps aux --sort=-%mem", "top -o %MEM", "grep VmRSS /proc/<PID>/status", "pmap -x <PID>", "valgrind --leak-check=full ./app"],
    steps: [
      "Step 1: Monitor memory over time: `watch -n 5 'ps aux --sort=-%mem | head -10'`.",
      "Step 2: Check VmRSS: `grep VmRSS /proc/<PID>/status`.",
      "Step 3: Capture heap analysis: `pmap -x <PID>` to see memory mapping sections.",
      "Step 4: Generate a heap dump or core dump for offline analysis.",
      "Step 5: For Java: use `jstack` and `jmap -heap <PID>`.",
      "Step 6: For Python: use tracemalloc or objgraph.",
      "Step 7: For C/C++: use Valgrind: `valgrind --leak-check=full ./binary`.",
      "Step 8: Restart the service as a temporary measure; fix the code for permanent resolution."
    ],
    root_cause: "The application allocates memory (caching, object pools, connections) but fails to release it, causing unbounded memory growth.",
    prevention: "Implement memory limits per container/process; set -Xmx for JVM; use connection pooling with limits; monitor memory trends with Prometheus/Grafana."
  },
  {
    id: "scenario-48",
    title: "Swap Thrashing / High Swap Usage",
    symptom: "System is slow; `vmstat 1` shows high si/so (swap in/out); `free -m` shows most of swap is used",
    category: "performance",
    difficulty: 3,
    commands: ["free -m", "vmstat 1 10", "swapon --show", "cat /proc/sys/vm/swappiness", "sysctl vm.swappiness=10"],
    steps: [
      "Step 1: Check memory and swap: `free -m` — see how much swap is used.",
      "Step 2: Monitor swap activity: `vmstat 1 10` — watch si (swap in) and so (swap out).",
      "Step 3: Check swappiness: `cat /proc/sys/vm/swappiness` (default is 60).",
      "Step 4: Reduce swappiness: `sysctl -w vm.swappiness=10`.",
      "Step 5: Identify swap consumers: `for f in /proc/*/status; do awk '/VmSwap|Name/{printf $2\" \"} END{print \"\"}' $f 2>/dev/null; done | sort -k2 -n -r | head -10`.",
      "Step 6: Add more RAM or reduce application memory usage.",
      "Step 7: Clear swap if enough free RAM: `swapoff -a && swapon -a`.",
      "Step 8: Make swappiness permanent in /etc/sysctl.conf."
    ],
    root_cause: "The system ran out of physical RAM and started aggressive swapping. High swappiness (60) caused the kernel to swap even when free RAM existed.",
    prevention: "Set vm.swappiness to 5-10 for database/application servers; ensure adequate RAM; set alerts before swap usage exceeds 20%."
  },
  {
    id: "scenario-49",
    title: "Network Bandwidth Saturation",
    symptom: "Application latency spikes; iftop shows 1 Gbps link saturated; packet drops at interface",
    category: "performance",
    difficulty: 3,
    commands: ["iftop", "nload", "sar -n DEV 1", "ip -s link show eth0", "tc -s qdisc show dev eth0"],
    steps: [
      "Step 1: Check interface utilization: `sar -n DEV 1 5` — look at rxkB/s vs interface speed.",
      "Step 2: Monitor live traffic: `iftop -n` or `nload` to see top talkers.",
      "Step 3: Check for dropped packets: `ip -s link show eth0`.",
      "Step 4: Identify top hosts: `tcpdump -i eth0 -n -c 10000 2>/dev/null | awk '{print $3}' | cut -d. -f1-4 | sort | uniq -c | sort -nr | head -10`.",
      "Step 5: If legitimate traffic, upgrade bandwidth or implement QoS: `tc`.",
      "Step 6: If malicious (DDoS), add rate limiting: `iptables -A INPUT -p tcp --dport 80 -m limit --limit 100/second -j ACCEPT`.",
      "Step 7: Check per-process bandwidth: `nethogs`.",
      "Step 8: Schedule large transfers during off-peak hours."
    ],
    root_cause: "A large data transfer (backup, file sync, streaming) saturated the network link, causing packet drops and latency for critical traffic.",
    prevention: "Use traffic shaping to prioritize production traffic; schedule large transfers off-peak; monitor bandwidth with SNMP/NetFlow."
  },
  {
    id: "scenario-50",
    title: "Runaway Process Using All Memory",
    symptom: "`free -m` shows memory nearly exhausted; one process shows abnormally high RES/RSS; system starts swapping",
    category: "performance",
    difficulty: 2,
    commands: ["ps aux --sort=-%mem | head -5", "top -o %MEM", "grep VmRSS /proc/<PID>/status", "kill -9 <PID>", "systemctl restart myservice"],
    steps: [
      "Step 1: Find the memory hog: `ps aux --sort=-%mem | head -5`.",
      "Step 2: Confirm memory usage: `grep VmRSS /proc/<PID>/status`.",
      "Step 3: Get process details: `ps -p <PID> -o user,pid,cmd`.",
      "Step 4: If it's a known bug, restart: `systemctl restart myservice`.",
      "Step 5: Kill if unresponsive: `kill -15 <PID>` then `kill -9 <PID>`.",
      "Step 6: Verify memory reclaimed: `free -m`.",
      "Step 7: Set memory limits: `MemoryMax=1G` in systemd unit or use cgroups.",
      "Step 8: Investigate root cause — app logs, recent deployments, code changes."
    ],
    root_cause: "A software bug (memory leak) or a bad configuration caused the process to consume all available memory, degrading the entire system.",
    prevention: "Set per-process memory limits with systemd MemoryMax=; use monitoring to detect memory growth; alert at 80% memory usage."
  }
  ,
  {
    id: "scenario-51",
    title: "Docker Daemon Not Running",
    symptom: "`docker ps` returns 'Cannot connect to the Docker daemon. Is the docker daemon running?'",
    category: "container",
    difficulty: 1,
    commands: ["systemctl status docker", "journalctl -u docker -n 50", "dockerd --debug", "systemctl start docker", "docker run hello-world"],
    steps: [
      "Step 1: Check Docker daemon status: `systemctl status docker`.",
      "Step 2: View daemon logs: `journalctl -u docker -n 50`.",
      "Step 3: Check if docker socket exists: `ls -la /var/run/docker.sock`.",
      "Step 4: Start Docker: `systemctl start docker`.",
      "Step 5: If it fails, run dockerd manually for more verbose output: `dockerd --debug 2>&1 | head -50`.",
      "Step 6: Check user is in docker group: `groups $USER` — if not: `sudo usermod -aG docker $USER`.",
      "Step 7: Enable auto-start: `systemctl enable docker`.",
      "Step 8: Test: `docker run hello-world`."
    ],
    root_cause: "The Docker daemon (dockerd) was not running because it was never started, it crashed, or a systemd dependency failed.",
    prevention: "Enable Docker to start on boot: `systemctl enable docker`; set Restart=always in Docker Compose; monitor daemon health."
  },
  {
    id: "scenario-52",
    title: "Docker Image Pull Failure / Rate Limit",
    symptom: "`docker pull` fails with 'toomanyrequests: You have reached your pull rate limit' or 'TLS handshake timeout'",
    category: "container",
    difficulty: 2,
    commands: ["docker pull nginx:latest", "docker login", "cat ~/.docker/config.json", "cat /etc/docker/daemon.json"],
    steps: [
      "Step 1: Note the error — if 'pull rate limit', you hit Docker Hub's anonymous limit (100 pulls/6h).",
      "Step 2: Log in to Docker Hub: `docker login` (free tier increases limit).",
      "Step 3: Check for registry mirrors: `cat /etc/docker/daemon.json` for `registry-mirrors`.",
      "Step 4: If 'TLS handshake timeout', it's a network issue — check DNS and connectivity.",
      "Step 5: Retry the pull: `docker pull nginx:latest`.",
      "Step 6: Set up credential helpers: `docker-credential-secretservice`.",
      "Step 7: Configure a local mirror registry: `docker run -d -p 5000:5000 --name registry registry:2`.",
      "Step 8: Use the mirror: add `\"registry-mirrors\": [\"http://localhost:5000\"]` to daemon.json."
    ],
    root_cause: "Docker Hub enforces pull rate limits for anonymous users. The server hit this limit by pulling images without authentication.",
    prevention: "Authenticate docker with a Docker Hub account; use a local mirror registry; cache base images in CI artifacts."
  },
  {
    id: "scenario-53",
    title: "Container Exits Immediately (Crash Loop)",
    symptom: "`docker run myapp` exits immediately with code 1; `docker ps -a` shows 'Exited' state",
    category: "container",
    difficulty: 2,
    commands: ["docker logs <container-id>", "docker inspect <container-id> --format '{{.State.ExitCode}}'", "docker run -it --entrypoint sh myapp", "docker ps -a"],
    steps: [
      "Step 1: Check logs: `docker logs <container>` — look for application errors.",
      "Step 2: Check the exit code: `docker inspect <container> --format '{{.State.ExitCode}}'`.",
      "Step 3: Override entrypoint to debug: `docker run -it --entrypoint sh myapp`.",
      "Step 4: If entrypoint is a script, check chmod +x and line endings (CRLF vs LF).",
      "Step 5: Pass environment variables: `docker run -e KEY=VALUE myapp`.",
      "Step 6: Check for missing volume mounts: `docker run -v /host/path:/container/path myapp`.",
      "Step 7: If the app needs a database, start the dependency first.",
      "Step 8: Fix the Dockerfile CMD/ENTRYPOINT and rebuild."
    ],
    root_cause: "The application inside the container crashes on startup due to missing dependencies, misconfigured environment, or incorrect CMD/ENTRYPOINT.",
    prevention: "Use HEALTHCHECK in Dockerfiles; test containers with docker-compose locally; use proper error handling in entrypoint scripts."
  },
  {
    id: "scenario-54",
    title: "Docker Volume Permission Mismatch",
    symptom: "Container writes fail with 'Permission denied' on mounted volume; files are owned by root",
    category: "container",
    difficulty: 3,
    commands: ["docker inspect <container>", "ls -la /host/mount/path", "id -u", "docker run -u $(id -u):$(id -g) -v /host:/container myapp"],
    steps: [
      "Step 1: Check file ownership on host: `ls -la /host/mount/path`.",
      "Step 2: Check the user inside the container: `docker exec <container> id`.",
      "Step 3: UID mismatch: container user (often root, UID 0) doesn't match host user's UID.",
      "Step 4: Run container with matching UID: `docker run -u $(id -u):$(id -g) -v /host:/container myapp`.",
      "Step 5: Or change host directory ownership: `chown -R 1000:1000 /host/mount/path`.",
      "Step 6: Use USER directive in Dockerfile to match host UID.",
      "Step 7: Use Docker named volumes for better permission handling.",
      "Step 8: Test: `docker run --rm -v /host:/container alpine touch /container/test`."
    ],
    root_cause: "The UID inside the container doesn't match the UID of the host mount directory owner, causing permission conflicts on bind mounts.",
    prevention: "Use the same UID inside and outside containers; use named volumes; avoid running containers as root."
  },
  {
    id: "scenario-55",
    title: "Docker Container DNS Resolution Failure",
    symptom: "`docker run alpine ping google.com` fails; container can't resolve hostnames",
    category: "container",
    difficulty: 2,
    commands: ["docker run alpine cat /etc/resolv.conf", "docker run --dns 8.8.8.8 alpine ping google.com", "cat /etc/docker/daemon.json", "systemctl restart docker"],
    steps: [
      "Step 1: Check container DNS config: `docker run alpine cat /etc/resolv.conf`.",
      "Step 2: Use explicit DNS: `docker run --dns 8.8.8.8 alpine ping -c 3 google.com`.",
      "Step 3: Check host DNS: `cat /etc/resolv.conf` — Docker copies this to containers.",
      "Step 4: If host uses systemd-resolved (127.0.0.53), containers can't reach it.",
      "Step 5: Fix by setting Docker DNS in daemon.json: `echo '{\"dns\": [\"8.8.8.8\", \"1.1.1.1\"]}' > /etc/docker/daemon.json`.",
      "Step 6: Restart Docker: `systemctl restart docker`.",
      "Step 7: Test: `docker run alpine ping -c 3 google.com`.",
      "Step 8: Use user-defined bridge networks for embedded DNS resolution."
    ],
    root_cause: "Docker containers inherit the host's /etc/resolv.conf, which may point to systemd-resolved's local stub (127.0.0.53) that's inaccessible from containers.",
    prevention: "Configure explicit DNS servers in /etc/docker/daemon.json; avoid using localhost resolvers on the host."
  },
  {
    id: "scenario-56",
    title: "Docker Disk Full (Overlay Layers)",
    symptom: "`docker system df` shows high disk usage; /var/lib/docker consumes 50GB+; old images accumulate",
    category: "container",
    difficulty: 2,
    commands: ["docker system df", "docker container prune", "docker image prune -a", "docker volume prune", "docker system prune -a --volumes"],
    steps: [
      "Step 1: Check Docker disk usage: `docker system df`.",
      "Step 2: Remove stopped containers: `docker container prune`.",
      "Step 3: Remove unused images: `docker image prune -a`.",
      "Step 4: Remove unused volumes: `docker volume prune`.",
      "Step 5: Full cleanup: `docker system prune -a --volumes` (removes all unused resources).",
      "Step 6: Check overlay2 size: `du -sh /var/lib/docker/overlay2`.",
      "Step 7: Move Docker data root: set `data-root` in /etc/docker/daemon.json.",
      "Step 8: Set up automated cleanup: `docker system prune -af --filter 'until=$((30*24))h'` via cron."
    ],
    root_cause: "Docker accumulated unused images, stopped containers, anonymous volumes, and build cache layers over time, consuming significant disk space.",
    prevention: "Set up automated Docker cleanup cron; use .dockerignore to reduce layer sizes; regularly audit with docker system df."
  },
  {
    id: "scenario-57",
    title: "Docker Compose Service Dependencies Not Ready",
    symptom: "Application container starts but immediately fails because the database isn't ready for connections",
    category: "container",
    difficulty: 2,
    commands: ["docker-compose logs", "docker-compose ps", "docker-compose up -d", "docker-compose run app sh", "grep depends_on docker-compose.yml"],
    steps: [
      "Step 1: Check logs: `docker-compose logs app` — likely 'connection refused' to DB.",
      "Step 2: depends_on only waits for container start, not service readiness.",
      "Step 3: Use a wait-for-it script: `./wait-for-it.sh db:5432 --timeout=30` in entrypoint.",
      "Step 4: Add a polling loop: `while ! nc -z db 5432; do sleep 1; done` in entrypoint.",
      "Step 5: Add healthcheck: `healthcheck: test: [\"CMD\", \"pg_isready\"]`.",
      "Step 6: Use depends_on with condition: `condition: service_healthy` (Compose v2.1+).",
      "Step 7: Rebuild and restart: `docker-compose up -d --build`.",
      "Step 8: Verify: `docker-compose logs app | tail -10` should show successful DB connection."
    ],
    root_cause: "depends_on only ensures the container starts, not that the service inside is ready to accept connections (e.g., PostgreSQL still initializing).",
    prevention: "Use healthchecks with depends_on condition: service_healthy; implement startup probes in the application."
  },
  {
    id: "scenario-58",
    title: "Container Out of Memory (OOMKilled)",
    symptom: "`docker ps` shows 'Exited (137)' or 'OOMKilled'; container was killed by kernel OOM",
    category: "container",
    difficulty: 2,
    commands: ["docker inspect <container> --format '{{.State.OOMKilled}}'", "docker logs <container>", "docker stats", "docker run -m 512m myapp"],
    steps: [
      "Step 1: Check OOMKilled: `docker inspect <container> --format '{{.State.OOMKilled}}'`.",
      "Step 2: View logs: `docker logs <container>`.",
      "Step 3: Check host OOM logs: `journalctl -k | grep -i oom`.",
      "Step 4: Increase memory limit: `docker run -m 1g myapp` or `mem_limit: 1g` in compose.",
      "Step 5: For Java, also set JVM heap: `-Xmx512m` inside the container.",
      "Step 6: Add swap limit: `--memory-swap=2g`.",
      "Step 7: Monitor with `docker stats` over time.",
      "Step 8: Consider horizontal scaling instead of vertical."
    ],
    root_cause: "The container exceeded its memory limit (--memory) and was killed by the OOM killer. Default is no limit, using all host memory.",
    prevention: "Always set memory limits on containers; use docker stats for monitoring; set JVM -Xmx to 75% of container memory limit."
  },
  {
    id: "scenario-59",
    title: "Docker Port Already Allocated",
    symptom: "`docker run -p 80:80 nginx` fails with 'port is already allocated'",
    category: "container",
    difficulty: 1,
    commands: ["docker ps", "ss -tlnp | grep :80", "docker stop <existing-container>", "docker run -p 8080:80 nginx", "docker rm <container>"],
    steps: [
      "Step 1: List running containers: `docker ps` — look for one using host port 80.",
      "Step 2: Check what process is using the port: `ss -tlnp | grep :80`.",
      "Step 3: Stop the existing container: `docker stop <container-name>`.",
      "Step 4: Or use a different host port: `docker run -p 8080:80 -d nginx`.",
      "Step 5: If a host process uses the port: `systemctl stop nginx`.",
      "Step 6: Remove the container: `docker rm <container-name>` if no longer needed.",
      "Step 7: Run the new container: `docker run -p 80:80 -d nginx`.",
      "Step 8: Verify: `curl -I http://localhost:80`."
    ],
    root_cause: "The host port was already bound by another container or a host process. Docker cannot share the same host port across containers.",
    prevention: "Document port mappings; use dynamic port mapping (-p 80); use docker-compose with port conflict detection."
  },
  {
    id: "scenario-60",
    title: "Docker Build Fails — Network Timeout",
    symptom: "`docker build` fails during apt/apk/yum install steps with 'Could not resolve host' or 'Connection timed out'",
    category: "container",
    difficulty: 2,
    commands: ["docker build --network=host -t myapp .", "docker build --no-cache -t myapp .", "cat /etc/docker/daemon.json", "DOCKER_BUILDKIT=1 docker build ."],
    steps: [
      "Step 1: Build with host network: `docker build --network=host -t myapp .`.",
      "Step 2: Use --no-cache to avoid bad DNS cache: `docker build --no-cache -t myapp .`.",
      "Step 3: Check Docker DNS config: `cat /etc/docker/daemon.json`.",
      "Step 4: Enable BuildKit: `DOCKER_BUILDKIT=1 docker build .`.",
      "Step 5: Set proxy build args: `--build-arg http_proxy=http://proxy:3128`.",
      "Step 6: Check internet connectivity: `ping google.com`.",
      "Step 7: Use a different base image that caches packages.",
      "Step 8: Consider using a Docker Hub mirror for base images."
    ],
    root_cause: "Docker build couldn't reach external package repositories because the default bridge network DNS was misconfigured or the host lacked internet access.",
    prevention: "Configure DNS properly in daemon.json; use --network=host for builds; cache apt/yum repos locally or use a proxy."
  },
  {
    id: "scenario-61",
    title: "systemd Unit File Not Found After Install",
    symptom: "`systemctl start myservice` returns 'Failed to start myservice.service: Unit not found.'",
    category: "systemd",
    difficulty: 1,
    commands: ["systemctl list-unit-files | grep myservice", "ls /etc/systemd/system/", "systemctl daemon-reload", "systemctl enable --now myservice"],
    steps: [
      "Step 1: List unit files: `systemctl list-unit-files | grep myservice`.",
      "Step 2: Check if the unit file exists: `ls /etc/systemd/system/myservice.service`.",
      "Step 3: If the file exists but systemd doesn't see it: `systemctl daemon-reload`.",
      "Step 4: If not installed, install the package: `apt install myservice-package`.",
      "Step 5: Create the unit file manually: copy to /etc/systemd/system/.",
      "Step 6: Reload and enable: `systemctl daemon-reload && systemctl enable myservice`.",
      "Step 7: Start: `systemctl start myservice`.",
      "Step 8: Verify: `systemctl status myservice`."
    ],
    root_cause: "The systemd unit file was not present in systemd's search paths, or systemd wasn't reloaded after the file was added.",
    prevention: "Always run systemctl daemon-reload after adding/modifying unit files; use package managers for service installation."
  },
  {
    id: "scenario-62",
    title: "systemd Journal Corrupted",
    symptom: "`journalctl` fails with 'Cannot assign requested address' or 'Journal file corrupted'",
    category: "systemd",
    difficulty: 3,
    commands: ["journalctl --verify", "journalctl --rotate", "journalctl --vacuum-size=500M", "rm -rf /var/log/journal/*", "systemctl restart systemd-journald"],
    steps: [
      "Step 1: Verify journal integrity: `journalctl --verify`.",
      "Step 2: Rotate journal files: `journalctl --rotate`.",
      "Step 3: Vacuum old logs: `journalctl --vacuum-size=500M`.",
      "Step 4: Vacuum by time: `journalctl --vacuum-time=7d`.",
      "Step 5: If corruption persists, remove old files: `rm -rf /var/log/journal/*` (logs lost).",
      "Step 6: Restart journald: `systemctl restart systemd-journald`.",
      "Step 7: Verify: `journalctl --verify` and `journalctl -n 10`.",
      "Step 8: Configure limits in /etc/systemd/journald.conf: `SystemMaxUse=1G`."
    ],
    root_cause: "The systemd journal file became corrupted due to an unclean shutdown, disk error, or running out of disk space while writing journal entries.",
    prevention: "Set SystemMaxUse= in journald.conf; store journal on a reliable filesystem; ensure journal is on a separate partition if possible."
  },
  {
    id: "scenario-63",
    title: "systemd Exec Format Error",
    symptom: "`systemctl start myservice` fails; journal shows 'Exec format error'",
    category: "systemd",
    difficulty: 2,
    commands: ["journalctl -u myservice -n 10", "file /usr/bin/myservice_binary", "head -1 /usr/bin/myservice_script", "ls -la /usr/bin/myservice_binary"],
    steps: [
      "Step 1: Check the error: `journalctl -u myservice -n 10`.",
      "Step 2: Check binary type: `file /usr/bin/myservice_binary`.",
      "Step 3: If it's a script, check shebang: `head -1 /usr/bin/myservice_script`.",
      "Step 4: If shebang points to missing interpreter: install the interpreter.",
      "Step 5: For ELF binaries, check architecture: `readelf -h /usr/bin/myservice_binary | grep Machine`.",
      "Step 6: Wrong architecture? Install the correct package version.",
      "Step 7: Check execute permission: `ls -la /usr/bin/myservice_binary`.",
      "Step 8: Fix and restart: `systemctl daemon-reload && systemctl restart myservice`."
    ],
    root_cause: "The executable in ExecStart= had invalid format: wrong architecture, missing interpreter, missing execute permission, or a corrupted file.",
    prevention: "Verify binaries with `file` and `ldd` before deploying; use absolute paths in ExecStart=."
  },
  {
    id: "scenario-64",
    title: "systemd Timer Not Triggering",
    symptom: "A scheduled systemd timer (e.g., logrotate, backup) doesn't run; `systemctl list-timers` shows it's not triggering",
    category: "systemd",
    difficulty: 2,
    commands: ["systemctl list-timers --all", "systemctl status mytimer.timer", "systemctl status mytimer.service", "journalctl -u mytimer.timer"],
    steps: [
      "Step 1: List all timers: `systemctl list-timers --all`.",
      "Step 2: Check timer status: `systemctl status mytimer.timer`.",
      "Step 3: Check the associated service: `systemctl status mytimer.service`.",
      "Step 4: Check timer logs: `journalctl -u mytimer.timer -n 20`.",
      "Step 5: Verify the timer unit: `systemctl cat mytimer.timer` — check OnCalendar=.",
      "Step 6: Test manually: `systemctl start mytimer.timer`.",
      "Step 7: Validate OnCalendar= with: `systemd-analyze calendar '*-*-* 02:00:00'`.",
      "Step 8: Enable the timer: `systemctl enable --now mytimer.timer`."
    ],
    root_cause: "The systemd timer was not enabled, so it never started monitoring the schedule. It existed as a file but wasn't linked to timers.target.",
    prevention: "Always use `systemctl enable --now` for timers; validate calendar expressions with `systemd-analyze calendar`."
  },
  {
    id: "scenario-65",
    title: "Resource Temporarily Unavailable (Fork Failed)",
    symptom: "`systemctl start myservice` fails; journal shows 'Resource temporarily unavailable' or 'fork failed'",
    category: "systemd",
    difficulty: 3,
    commands: ["journalctl -u myservice -n 20", "cat /proc/sys/kernel/pid_max", "ulimit -u", "ps aux --no-heading | wc -l", "sysctl -w kernel.pid_max=65536"],
    steps: [
      "Step 1: Check the error: `journalctl -u myservice -n 20`.",
      "Step 2: Usually means process limit (ulimit -u or kernel.pid_max) was reached.",
      "Step 3: Count current processes: `ps aux --no-heading | wc -l`.",
      "Step 4: Check max user processes: `ulimit -u`.",
      "Step 5: Check kernel PID limit: `cat /proc/sys/kernel/pid_max`.",
      "Step 6: Increase user limits in /etc/security/limits.conf.",
      "Step 7: For systemd services, add `LimitNPROC=65536` in the unit.",
      "Step 8: Increase kernel.pid_max: `sysctl -w kernel.pid_max=65536`."
    ],
    root_cause: "The system or user process limit was exhausted, preventing systemd from forking a new process to start the service.",
    prevention: "Set appropriate LimitsNPROC and LimitsNOFILE in unit files; monitor process count; configure kernel.pid_max for the workload."
  },
  {
    id: "scenario-66",
    title: "systemd Service Hangs at Stop (Timeout)",
    symptom: "`systemctl stop myservice` hangs and eventually times out with 'Timed out waiting for'",
    category: "systemd",
    difficulty: 3,
    commands: ["systemctl status myservice", "systemctl kill -s SIGKILL myservice", "systemctl show myservice -p TimeoutStopUSec", "journalctl -u myservice -n 20"],
    steps: [
      "Step 1: Check status: `systemctl status myservice` — look for 'deactivating' state.",
      "Step 2: Try to kill: `systemctl kill -s SIGKILL myservice`.",
      "Step 3: Increase stop timeout: `systemctl edit myservice` and add `TimeoutStopSec=120`.",
      "Step 4: Find the main PID: `systemctl show myservice -p MainPID`.",
      "Step 5: Kill the process manually: `kill -9 <PID>`.",
      "Step 6: After the process dies, systemd should transition to 'dead'.",
      "Step 7: If stuck in D state, check NFS/disk issues.",
      "Step 8: Fix the app to handle SIGTERM and exit promptly."
    ],
    root_cause: "The service ignored SIGTERM or was stuck in D state, exceeding the default 90s TimeoutStopSec, preventing systemd from stopping the unit.",
    prevention: "Implement proper signal handlers; set reasonable TimeoutStopSec; use KillSignal=SIGQUIT if needed."
  },
  {
    id: "scenario-67",
    title: "Network Target Not Reached at Boot",
    symptom: "Services depending on networking fail at boot; `systemctl` shows 'network target' not reached",
    category: "systemd",
    difficulty: 2,
    commands: ["systemctl list-dependencies network.target", "systemctl status systemd-networkd", "systemctl status NetworkManager", "journalctl -b -u systemd-networkd"],
    steps: [
      "Step 1: Check network target dependencies: `systemctl list-dependencies network.target`.",
      "Step 2: Check NetworkManager status: `systemctl status NetworkManager`.",
      "Step 3: Check systemd-networkd: `systemctl status systemd-networkd`.",
      "Step 4: Check actual network state: `ip addr show`.",
      "Step 5: Check boot-time logs: `journalctl -b | grep -i network`.",
      "Step 6: If using netplan, apply: `netplan apply`.",
      "Step 7: Start network target: `systemctl start network.target`.",
      "Step 8: Ensure services use `After=network-online.target` instead of `network.target`."
    ],
    root_cause: "network.target only indicates networking was *started*, not that it's *online*. Services that need connectivity should depend on network-online.target.",
    prevention: "Use `After=network-online.target` instead of `After=network.target` for services requiring network connectivity."
  },
  {
    id: "scenario-68",
    title: "systemd Cgroup Permission Error",
    symptom: "Service fails to start with 'Failed to create cgroup' or 'Delegate: refused'",
    category: "systemd",
    difficulty: 4,
    commands: ["systemctl status myservice", "journalctl -u myservice -n 20", "mount | grep cgroup", "grep cgroup /proc/filesystems", "systemd-run --scope -p MemoryMax=1G /bin/true"],
    steps: [
      "Step 1: Check the error: `journalctl -u myservice -n 20` — look for cgroup errors.",
      "Step 2: Check cgroup filesystem: `mount | grep cgroup` (v1 or v2?).",
      "Step 3: Check for cgroup v2: `grep cgroup /proc/filesystems`.",
      "Step 4: If in container/nspawn, cgroup delegation may be denied.",
      "Step 5: Add `Delegate=yes` to the service unit for nested cgroup management.",
      "Step 6: Enable cgroup v2: `systemd.unified_cgroup_hierarchy=1` kernel parameter.",
      "Step 7: Reboot and test: `systemctl restart myservice`.",
      "Step 8: Verify cgroup mode: `stat -fc %T /sys/fs/cgroup/`."
    ],
    root_cause: "The service tried to create or manage cgroups but lacked permission due to cgroup v1/v2 mode mismatch or missing Delegate= flag.",
    prevention: "Use unified cgroup hierarchy (v2) on modern systems; add Delegate=yes for services managing containers."
  },
  {
    id: "scenario-69",
    title: "Slow Boot — systemd-analyze blame",
    symptom: "Server takes too long to boot; `systemd-analyze blame` shows one unit taking >30s",
    category: "systemd",
    difficulty: 2,
    commands: ["systemd-analyze", "systemd-analyze blame", "systemd-analyze critical-chain", "systemctl disable slow-service", "systemctl mask slow-service"],
    steps: [
      "Step 1: Check total boot time: `systemd-analyze`.",
      "Step 2: Find slow units: `systemd-analyze blame | head -10`.",
      "Step 3: Check critical chain: `systemd-analyze critical-chain`.",
      "Step 4: Identify the slow unit (e.g., network service with timeout).",
      "Step 5: If non-essential, disable it: `systemctl disable slow-service`.",
      "Step 6: If essential, optimize: add TimeoutStartSec=5 or fix underlying issue.",
      "Step 7: Reboot and verify: `systemd-analyze`.",
      "Step 8: Use `systemd-analyze plot > boot.svg` for visual analysis."
    ],
    root_cause: "A systemd service had a long start timeout (waiting for network/remote mount) that blocked the boot sequence.",
    prevention: "Set reasonable TimeoutStartSec; use systemd-analyze blame in deployment; minimize boot blockers."
  },
  {
    id: "scenario-70",
    title: "PID File Mismatch in systemd Unit",
    symptom: "`systemctl start myservice` starts but shows as failed; 'PID file /run/myservice.pid not readable'",
    category: "systemd",
    difficulty: 2,
    commands: ["systemctl status myservice", "journalctl -u myservice -n 20", "cat /run/myservice.pid", "ps aux | grep myservice", "systemctl edit myservice --full"],
    steps: [
      "Step 1: Check status: `systemctl status myservice` — look for PID file errors.",
      "Step 2: Check if PID file exists: `ls -la /run/myservice.pid`.",
      "Step 3: Check its content: `cat /run/myservice.pid` and `ps -p <PID>`.",
      "Step 4: PIDFile= path in unit may not match where the daemon writes it.",
      "Step 5: Fix the path in the unit file.",
      "Step 6: For Type=forking, ensure daemon creates PID file before parent exits.",
      "Step 7: Reload and restart: `systemctl daemon-reload && systemctl restart myservice`.",
      "Step 8: If PID path is wrong in daemon, fix daemon config instead."
    ],
    root_cause: "The systemd unit's PIDFile= directive pointed to a location where the daemon did not write its PID, causing systemd to think the process died.",
    prevention: "Match PIDFile= to the daemon's pidfile; use Type=simple for foreground services."
  },
  {
    id: "scenario-71",
    title: "Filesystem Mounted Read-Only",
    symptom: "`touch /test` fails with 'Read-only file system'; `mount` shows filesystem mounted 'ro'",
    category: "filesystem",
    difficulty: 2,
    commands: ["mount | grep ' / '", "dmesg | grep -i 'remount\\|error\\|journal'", "fsck -n /dev/sda1", "mount -o remount,rw /", "smartctl -a /dev/sda"],
    steps: [
      "Step 1: Check mount status: `mount | grep ' / '` — look for 'ro'.",
      "Step 2: Check kernel messages: `dmesg -T | grep -i 'remount\\|I/O error'`.",
      "Step 3: If filesystem errors: `fsck -n /dev/sda1` to check without repairing.",
      "Step 4: Remount as RW: `mount -o remount,rw /`.",
      "Step 5: If remount fails, check disk health: `smartctl -a /dev/sda`.",
      "Step 6: If disk failing, back up: `ddrescue -f /dev/sda /dev/sdb`.",
      "Step 7: If transient error, reboot: `reboot`.",
      "Step 8: Verify: `touch /test-write && rm /test-write`."
    ],
    root_cause: "The kernel detected a filesystem error and automatically remounted as read-only to prevent further damage.",
    prevention: "Use UPS for graceful shutdown; schedule regular fsck; monitor smartctl metrics; use journaling filesystems."
  },
  {
    id: "scenario-72",
    title: "GRUB Rescue Shell at Boot",
    symptom: "Server boots to 'grub rescue>' prompt; cannot find the normal boot partition",
    category: "filesystem",
    difficulty: 4,
    commands: ["ls", "set root=(hd0,msdos1)", "insmod linux", "linux /vmlinuz root=/dev/sda1", "boot", "grub-install /dev/sda"],
    steps: [
      "Step 1: At grub rescue> prompt, list available drives: `ls`.",
      "Step 2: Find the boot partition: `ls (hd0,msdos1)/boot/grub` or `ls (hd0,gpt1)/`.",
      "Step 3: Set the root and prefix: `set root=(hd0,msdos1)` and `set prefix=(hd0,msdos1)/boot/grub`.",
      "Step 4: Load normal module: `insmod normal` and `normal` — should bring up GRUB menu.",
      "Step 5: Boot: select kernel or manually: `linux /vmlinuz root=/dev/sda1 ro` and `boot`.",
      "Step 6: Once booted, reinstall GRUB: `grub-install /dev/sda` and `update-grub`.",
      "Step 7: If MBR corrupted: `grub-install --recheck /dev/sda`.",
      "Step 8: Reboot to verify: `reboot`."
    ],
    root_cause: "GRUB's configuration (grub.cfg) was corrupted, deleted, or the boot partition changed, causing GRUB to fall back to the rescue shell.",
    prevention: "Back up GRUB config; use grub-install --removable for fallback; be careful when repartitioning disks."
  },
  {
    id: "scenario-73",
    title: "Forced fsck at Boot / Maximum Mount Count Reached",
    symptom: "Server drops to emergency shell at boot with 'Press Ctrl+D to continue' or filesystem needs manual fsck",
    category: "filesystem",
    difficulty: 2,
    commands: ["journalctl -xb | grep -i error", "fsck -y /dev/sda1", "mount -o remount,rw /", "tune2fs -c 60 /dev/sda1", "tune2fs -l /dev/sda1 | grep -i 'mount count'"],
    steps: [
      "Step 1: From the emergency shell, check what failed: `journalctl -xb | grep -i 'mount\\|fsck'`.",
      "Step 2: Check if the filesystem needs fsck: `fsck -n /dev/sda1`.",
      "Step 3: Repair: `fsck -y /dev/sda1`.",
      "Step 4: After repair, mount: `mount /dev/sda1 /mnt`.",
      "Step 5: Exit the emergency shell or reboot: `systemctl reboot`.",
      "Step 6: Check mount count: `tune2fs -l /dev/sda1 | grep -i 'mount count'`.",
      "Step 7: Adjust interval: `tune2fs -c 60 /dev/sda1` (check every 60 mounts).",
      "Step 8: Set to -1 to disable forced checks: `tune2fs -c -1 /dev/sda1`."
    ],
    root_cause: "The filesystem's maximum mount count threshold was exceeded (default ~30 mounts), triggering a forced fsck at boot that found errors.",
    prevention: "Set fsck interval with tune2fs -c; or set to -1 if using LVM/RAID with regular monitoring."
  },
  {
    id: "scenario-74",
    title: "Backup Script Fails — Permission Denied",
    symptom: "Nightly backup cron job fails; log shows 'Permission denied' when reading certain files",
    category: "backup",
    difficulty: 2,
    commands: ["sudo -u backup_user tar czf /tmp/test.tar.gz /var/www", "ls -la /var/www/protected/", "id backup_user", "usermod -aG www-data backup_user"],
    steps: [
      "Step 1: Run backup manually as backup user: `sudo -u backup_user tar czf /tmp/backup.tar.gz /var/www`.",
      "Step 2: Note which files cause 'Permission denied'.",
      "Step 3: Check file ownership: `ls -la /var/www/protected/`.",
      "Step 4: Check backup user groups: `groups backup_user`.",
      "Step 5: Add backup user to necessary group: `usermod -aG www-data backup_user`.",
      "Step 6: Run backup with sudo in the script: `sudo /usr/local/bin/backup.sh`.",
      "Step 7: Use ACLs: `setfacl -m u:backup_user:rx /var/www/protected/`.",
      "Step 8: Re-run the backup and verify."
    ],
    root_cause: "The backup user lacked read access to certain files because it wasn't in the appropriate group.",
    prevention: "Use a dedicated backup user with proper group memberships; test backup scripts as that user."
  },
  {
    id: "scenario-75",
    title: "Backup Destination Full",
    symptom: "Backup fails with 'No space left on device' at the backup destination",
    category: "backup",
    difficulty: 1,
    commands: ["df -h /backup", "du -sh /backup/*", "find /backup -mtime +30 -delete", "tar tzf backup.tar.gz | head"],
    steps: [
      "Step 1: Check backup destination: `df -h /backup`.",
      "Step 2: Check space used by backups: `du -sh /backup/* | sort -rh`.",
      "Step 3: Remove old backups: `find /backup -name '*.tar.gz' -mtime +30 -delete`.",
      "Step 4: Compress existing backups: `gzip -9 /backup/old_backup.tar`.",
      "Step 5: Implement rotation: keep only N most recent backups.",
      "Step 6: Add more storage: mount a new volume to /backup.",
      "Step 7: Use incremental backups instead of full each time.",
      "Step 8: Set up monitoring for /backup usage with alerts at 80%."
    ],
    root_cause: "The backup destination ran out of disk space because old backups were never rotated or pruned.",
    prevention: "Implement backup rotation (keep N days); set up disk usage alerts; use incremental backups."
  }
  ,
  {
    id: "scenario-76",
    title: "Cron Job Not Executing At All",
    symptom: "A cron job doesn't run at the scheduled time; no output or errors are generated",
    category: "cron",
    difficulty: 2,
    commands: ["crontab -l", "grep CRON /var/log/syslog", "systemctl status cron", "journalctl -u cron -n 20", "ls -la /path/to/script.sh"],
    steps: [
      "Step 1: Verify the cron entry: `crontab -l` — check if it's for the correct user.",
      "Step 2: Check cron logs: `grep CRON /var/log/syslog` or `journalctl -u cron -n 50`.",
      "Step 3: Ensure cron service is running: `systemctl status cron`.",
      "Step 4: Check script permissions: `ls -la /path/to/script.sh` — must be executable.",
      "Step 5: Test the script manually: `su - $(whoami) -c /path/to/script.sh`.",
      "Step 6: Verify cron syntax: validate at crontab.guru or check man 5 crontab.",
      "Step 7: Add logging: redirect output to a log file in the cron entry.",
      "Step 8: Review the cron entry for full paths and environment variables."
    ],
    root_cause: "The cron job had incorrect syntax, the script had no execute permission, or the cron daemon was not running.",
    prevention: "Use full paths in cron jobs; redirect output to a log file; test scripts manually before adding to cron."
  },
  {
    id: "scenario-77",
    title: "Cron Job Works Manually But Not via Cron",
    symptom: "Manual execution of the script works perfectly, but running via cron produces different results or fails silently",
    category: "cron",
    difficulty: 3,
    commands: ["crontab -e", "env > /tmp/cron_env.txt", "* * * * * /usr/bin/env > /tmp/cron_env.txt", "diff /tmp/cron_env.txt /tmp/interactive_env.txt"],
    steps: [
      "Step 1: Use cron to capture its environment: add `* * * * * env > /tmp/cron_env.txt 2>&1` to crontab.",
      "Step 2: Wait for the job to run, then compare environments: `diff /tmp/cron_env.txt <(env)`.",
      "Step 3: Note that cron has minimal PATH (usually /usr/bin:/bin) and no interactive shell.",
      "Step 4: Fix PATH in the script: `export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`.",
      "Step 5: Use absolute paths for all commands in the script.",
      "Step 6: Add extensive logging: `* * * * * /path/to/script.sh >> /var/log/cron_script.log 2>&1`.",
      "Step 7: Check the log: `cat /var/log/cron_script.log`.",
      "Step 8: Ensure any config files sourced use absolute paths too."
    ],
    root_cause: "Cron jobs execute with a minimal PATH and no interactive shell environment. Scripts relying on .bashrc or relative paths fail silently.",
    prevention: "Set PATH explicitly in cron scripts; use full paths; redirect output to log files; write scripts without dependency on interactive shell."
  },
  {
    id: "scenario-78",
    title: "Cron Job Timezone Mismatch",
    symptom: "Cron job runs an hour early or late after daylight saving time change",
    category: "cron",
    difficulty: 2,
    commands: ["date", "timedatectl", "cat /etc/timezone", "cat /etc/crontab | head -5"],
    steps: [
      "Step 1: Check system timezone: `timedatectl` or `cat /etc/timezone`.",
      "Step 2: Check current time: `date` — verify against expected time.",
      "Step 3: System may be UTC while expecting local time (or vice versa).",
      "Step 4: Check if DST just transitioned — cron adjusts for DST if using local time.",
      "Step 5: Set CRON_TZ at top of crontab: `CRON_TZ=America/New_York`.",
      "Step 6: Or change system timezone: `timedatectl set-timezone America/New_York`.",
      "Step 7: Verify that `date` now shows the correct local time.",
      "Step 8: Test with a near-future cron entry to confirm."
    ],
    root_cause: "The system runs in UTC but cron schedule was intended for local time, or DST transition shifted the cron execution by 1 hour.",
    prevention: "Standardize all systems to UTC for logs and cron; use CRON_TZ if local time is absolutely required."
  },
  {
    id: "scenario-79",
    title: "User Account Locked After Failed Logins",
    symptom: "SSH authentication fails with 'Account locked due to N failed logins' or pam_tally2 deny message",
    category: "user",
    difficulty: 2,
    commands: ["pam_tally2 --user username", "faillog -u username", "pam_tally2 --user username --reset", "faillog -u username -r", "passwd -u username"],
    steps: [
      "Step 1: Check the auth log: `grep 'username' /var/log/auth.log | tail -10`.",
      "Step 2: Check failed login count: `pam_tally2 --user username` or `faillog -u username`.",
      "Step 3: Reset the failed counter: `pam_tally2 --user username --reset` or `faillog -u username -r`.",
      "Step 4: Check account expiration: `chage -l username`.",
      "Step 5: Unlock the account: `passwd -u username` (if locked with passwd -l).",
      "Step 6: Determine why so many failures (brute force? user forgot password?).",
      "Step 7: If brute force, implement fail2ban or rate limiting on SSH.",
      "Step 8: Test login: `ssh user@host` with correct credentials."
    ],
    root_cause: "The user account was locked by pam_tally2 after exceeding the maximum failed login attempts threshold (usually 3-5).",
    prevention: "Set realistic deny thresholds; use fail2ban to block IPs instead of locking accounts; educate users on password management."
  },
  {
    id: "scenario-80",
    title: "User Password Expired",
    symptom: "SSH login fails with 'Your password has expired' or 'Password expired. Change it now'",
    category: "user",
    difficulty: 1,
    commands: ["chage -l username", "chage -d 0 username", "passwd username", "chage -M 99999 username"],
    steps: [
      "Step 1: Check password expiration: `chage -l username` — look at 'Password expires'.",
      "Step 2: Force password change on next login: `chage -d 0 username`.",
      "Step 3: Change password: `passwd username` (as root).",
      "Step 4: Set password to never expire: `chage -M 99999 username`.",
      "Step 5: Check account expiry: `chage -l username` — look at 'Account expires'.",
      "Step 6: If the account itself is expired: `chage -E -1 username` (set no expiry).",
      "Step 7: Test login: `su - username` or `ssh user@host`.",
      "Step 8: Document password policies and communicate with the user."
    ],
    root_cause: "The user's password reached its maximum age (PasswordMaxDays), causing it to expire. SSH prompts for a new password on login.",
    prevention: "Set appropriate password expiration policies (90 days recommended); implement self-service password reset; notify users before expiry."
  },
  {
    id: "scenario-81",
    title: "User Cannot 'su' or 'sudo'",
    symptom: "`su -` fails with 'Authentication failure' even though the password is correct; `sudo` says 'not in sudoers'",
    category: "user",
    difficulty: 2,
    commands: ["su - root", "sudo -l", "sudo usermod -aG sudo username", "cat /etc/pam.d/su", "grep pam_wheel /etc/pam.d/su"],
    steps: [
      "Step 1: Check if the user is in the correct group: `groups username`.",
      "Step 2: On Debian, su to root requires being in the 'sudo' group if pam_wheel is configured.",
      "Step 3: Check PAM config: `grep pam_wheel /etc/pam.d/su`.",
      "Step 4: If pam_wheel is enabled with 'deny', only users in the wheel group can su.",
      "Step 5: Add user to the required group: `usermod -aG sudo username`.",
      "Step 6: For sudo, check sudoers: `visudo -c` and `cat /etc/sudoers`.",
      "Step 7: Ensure the sudo group line is uncommented: `%sudo ALL=(ALL:ALL) ALL`.",
      "Step 8: Log out and back in for group changes to take effect."
    ],
    root_cause: "PAM was configured to restrict su access to the sudo/wheel group, but the user was not a member of that group.",
    prevention: "Document PAM authentication requirements for new users; use consistent group membership for administrative access."
  },
  {
    id: "scenario-82",
    title: "Searching for Root Cause in Application Logs",
    symptom: "Application is misbehaving (errors, slow, crashes); need to find the root cause in log files",
    category: "log",
    difficulty: 2,
    commands: ["journalctl -u myservice --since '1 hour ago'", "tail -100 /var/log/nginx/error.log", "grep -i 'error\\|exception\\|timeout' /var/log/app.log", "less +F /var/log/syslog"],
    steps: [
      "Step 1: Start with journald: `journalctl -u myservice --since '1 hour ago' --no-pager -n 200`.",
      "Step 2: Check application logs: `tail -200 /var/log/app/app.log`.",
      "Step 3: Search for error keywords: `grep -i 'error\\|exception\\|fatal\\|timeout' /var/log/app.log`.",
      "Step 4: Grep for timestamps around the incident: `grep '2024-03-15 14:' /var/log/app.log`.",
      "Step 5: Use context flags: `grep -B5 -A10 'ERROR' /var/log/app.log`.",
      "Step 6: Check web server logs: `tail -100 /var/log/nginx/access.log | awk '{print $9}' | sort | uniq -c | sort -rn` — look for 5xx codes.",
      "Step 7: Check system logs for the same time: `journalctl --since '2024-03-15 14:00' --until '2024-03-15 15:00' --no-pager`.",
      "Step 8: Correlate timestamps across logs to find the sequence of events."
    ],
    root_cause: "Varies — the methodology is to systematically isolate the error by examining journald, application logs, and web server logs around the incident timeframe.",
    prevention: "Centralize logging (ELK, Loki, Graylog); use structured logging (JSON); ensure log timestamps are consistent (use UTC)."
  },
  {
    id: "scenario-83",
    title: "Logrotate Not Rotating Logs",
    symptom: "Log file is gigabytes in size; date in filename hasn't changed in weeks; logrotate status shows no recent rotation",
    category: "log",
    difficulty: 2,
    commands: ["cat /var/lib/logrotate/status", "logrotate -d /etc/logrotate.d/nginx", "logrotate -f /etc/logrotate.d/nginx", "ls -lah /var/log/nginx/"],
    steps: [
      "Step 1: Check logrotate status: `cat /var/lib/logrotate/status | grep nginx`.",
      "Step 2: Dry-run logrotate: `logrotate -d /etc/logrotate.d/nginx` — see what it would do.",
      "Step 3: Force logrotate: `logrotate -f /etc/logrotate.d/nginx`.",
      "Step 4: Check the logrotate config: `cat /etc/logrotate.d/nginx`.",
      "Step 5: Verify that the log file path in config matches the actual log path.",
      "Step 6: Check for copytruncate option if the app doesn't support SIGHUP.",
      "Step 7: Ensure logrotate cron job is active: `grep logrotate /etc/crontab` or check systemd timer.",
      "Step 8: Verify size-based rotation: `cat /etc/logrotate.d/nginx | grep size`."
    ],
    root_cause: "logrotate's last rotation date was weeks ago because the daily cron job wasn't running or the config had an error (e.g., wrong path).",
    prevention: "Test logrotate configs with -d flag; monitor log file sizes; ensure logrotate cron or timer is enabled."
  },
  {
    id: "scenario-84",
    title: "Extracting Traffic from PCAP for Analysis",
    symptom: "Network issue suspected; need to capture and analyze packets to find the root cause",
    category: "network",
    difficulty: 4,
    commands: ["tcpdump -i eth0 -w capture.pcap port 80", "tcpdump -r capture.pcap -X", "tshark -r capture.pcap -Y 'http.response.status_code >= 500'", "ngrep -d eth0 'POST /api' port 8080"],
    steps: [
      "Step 1: Start a packet capture: `tcpdump -i eth0 -s 0 -w capture.pcap host <target-ip>`.",
      "Step 2: Reproduce the issue while capturing.",
      "Step 3: Stop the capture (Ctrl+C) and analyze: `tcpdump -r capture.pcap -n | head -50`.",
      "Step 4: Filter for specific traffic: `tcpdump -r capture.pcap -n 'tcp port 443 and host 10.0.0.1'`.",
      "Step 5: Use tshark for deeper analysis: `tshark -r capture.pcap -Y 'http.response.code == 500'`.",
      "Step 6: Look for TCP retransmissions: `tcpdump -r capture.pcap -n 'tcp[tcpflags] & (tcp-syn|tcp-ack) != 0'`.",
      "Step 7: Check for TCP window issues: `tshark -r capture.pcap -Y 'tcp.analysis.window_update'`.",
      "Step 8: Analyze latency: `tshark -r capture.pcap -Y 'tcp.analysis.ack_rtt' -T fields -e tcp.analysis.ack_rtt`."
    ],
    root_cause: "Varies — PCAP analysis is a diagnostic method to identify packet loss, retransmissions, latency spikes, or protocol errors.",
    prevention: "Set up sFlow/NetFlow for continuous monitoring; use packet capture sparingly for targeted investigations."
  },
  {
    id: "scenario-85",
    title: "Python Script Not Found / Module Import Error",
    symptom: "`python3 script.py` fails with 'ModuleNotFoundError: No module named 'xyz''",
    category: "package",
    difficulty: 1,
    commands: ["python3 --version", "which python3", "pip3 list | grep xyz", "pip3 install xyz", "python3 -c 'import sys; print(sys.path)'"],
    steps: [
      "Step 1: Check Python version: `python3 --version`.",
      "Step 2: Check if the module is installed: `pip3 list | grep -i xyz`.",
      "Step 3: Install the missing module: `pip3 install xyz`.",
      "Step 4: If it's installed but not found, check Python path: `python3 -c 'import sys; print(sys.path)'`.",
      "Step 5: If running in a virtual environment, activate it: `source venv/bin/activate`.",
      "Step 6: Check if the module is installed for the right Python version (Python 2 vs 3).",
      "Step 7: Use python3 -m pip instead: `python3 -m pip install xyz`.",
      "Step 8: If it's a project dependency, check requirements.txt and install all: `pip3 install -r requirements.txt`."
    ],
    root_cause: "A required Python module was not installed in the environment where the script is running, or the wrong Python interpreter was used.",
    prevention: "Use virtual environments for projects; always include requirements.txt; use `python3 -m pip` for consistent behavior."
  },
  {
    id: "scenario-86",
    title: "SSH Service Not Responding (Port 22 Closed)",
    symptom: "`ssh user@host` hangs or returns 'Connection refused'; SSH daemon may be down or firewalled",
    category: "security",
    difficulty: 2,
    commands: ["systemctl status sshd", "ss -tlnp | grep :22", "iptables -L -n | grep :22", "journalctl -u sshd -n 30", "nc -zv localhost 22"],
    steps: [
      "Step 1: Try accessing via out-of-band (iDRAC, IPMI, console) or another port.",
      "Step 2: Check SSH daemon status: `systemctl status sshd`.",
      "Step 3: Check if port 22 is listening: `ss -tlnp | grep :22`.",
      "Step 4: Check firewall rules: `iptables -L -n | grep 22` or `ufw status`.",
      "Step 5: Check SSH logs: `journalctl -u sshd -n 30`.",
      "Step 6: Start SSH if stopped: `systemctl start sshd`.",
      "Step 7: If the port was changed, check /etc/ssh/sshd_config for Port directive.",
      "Step 8: Allow SSH through firewall: `ufw allow 22/tcp` or `iptables -A INPUT -p tcp --dport 22 -j ACCEPT`."
    ],
    root_cause: "The SSH daemon crashed or was stopped, or a firewall rule was added that blocked port 22.",
    prevention: "Always have out-of-band access (console, iDRAC) for emergencies; monitor SSH daemon health; document firewall changes."
  },
  {
    id: "scenario-87",
    title: "TCP TIME_WAIT Sockets Exhausting Ports",
    symptom: "Application cannot create outbound connections; `ss -s` shows thousands of TIME_WAIT sockets",
    category: "network",
    difficulty: 3,
    commands: ["ss -s", "ss -tan state time-wait | wc -l", "cat /proc/sys/net/ipv4/ip_local_port_range", "sysctl net.ipv4.tcp_fin_timeout=15", "sysctl net.ipv4.tcp_tw_reuse=1"],
    steps: [
      "Step 1: Check socket statistics: `ss -s` — look at 'timewait' count.",
      "Step 2: Count TIME_WAIT: `ss -tan state time-wait | wc -l`.",
      "Step 3: Check ephemeral port range: `cat /proc/sys/net/ipv4/ip_local_port_range`.",
      "Step 4: If TIME_WAIT sockets exceed available ports, new connections fail.",
      "Step 5: Enable tcp_tw_reuse: `sysctl -w net.ipv4.tcp_tw_reuse=1`.",
      "Step 6: Reduce FIN timeout: `sysctl -w net.ipv4.tcp_fin_timeout=15` (default 60).",
      "Step 7: Increase port range: `sysctl -w net.ipv4.ip_local_port_range='1024 65535'`.",
      "Step 8: Make permanent in /etc/sysctl.conf."
    ],
    root_cause: "A high-traffic application created many short-lived connections, exhausting the ephemeral port range due to accumulated TIME_WAIT sockets.",
    prevention: "Enable tcp_tw_reuse and tcp_tw_recycle (deprecated in newer kernels); reduce tcp_fin_timeout; use connection pooling."
  },
  {
    id: "scenario-88",
    title: "Application Can't Connect to Redis/Memcached",
    symptom: "Application logs 'Cannot connect to Redis' or 'Connection refused' to cache server",
    category: "network",
    difficulty: 2,
    commands: ["redis-cli ping", "systemctl status redis", "ss -tlnp | grep 6379", "redis-cli -h 127.0.0.1 -p 6379 ping", "cat /etc/redis/redis.conf | grep bind"],
    steps: [
      "Step 1: Test Redis connectivity: `redis-cli ping` — should return 'PONG'.",
      "Step 2: Check Redis service: `systemctl status redis`.",
      "Step 3: Check if Redis is listening: `ss -tlnp | grep 6379`.",
      "Step 4: Check Redis config: `grep -E '^bind |^port ' /etc/redis/redis.conf`.",
      "Step 5: If Redis binds to 127.0.0.1 only, the app must also connect to localhost.",
      "Step 6: If the app is in a container, 'localhost' refers to the container, not host Redis.",
      "Step 7: Use the host IP or Docker hostname (host.docker.internal) instead of localhost.",
      "Step 8: Restart Redis after config changes: `systemctl restart redis`."
    ],
    root_cause: "The application was trying to connect to Redis on a different host/port than where Redis was listening, or Redis was bound to localhost only.",
    prevention: "Use environment variables for cache connection strings; document Redis binding and port in runbooks."
  },
  {
    id: "scenario-89",
    title: "Load Balancer Health Check Failing",
    symptom: "Server is removed from the load balancer pool; health check endpoint returns non-200 status",
    category: "network",
    difficulty: 3,
    commands: ["curl -I http://localhost/health", "curl -I http://localhost:8080/health", "tail -50 /var/log/nginx/access.log", "journalctl -u app-service -n 30"],
    steps: [
      "Step 1: Check the health check endpoint directly: `curl -I http://localhost/health`.",
      "Step 2: Expected response is HTTP 200. If 5xx, the app has an issue.",
      "Step 3: If 404, the health check path may be wrong — check the load balancer config.",
      "Step 4: Check app logs for health check errors: `tail -50 /var/log/app.log | grep health`.",
      "Step 5: If the health check is on a different port, check that port: `curl -I http://localhost:8080/health`.",
      "Step 6: Ensure the health check endpoint doesn't require authentication.",
      "Step 7: Check if the server is overloaded and health check is timing out.",
      "Step 8: Fix the health check endpoint or the application issue and verify."
    ],
    root_cause: "The application's health check endpoint returned a non-200 status (5xx, 404) or timed out, causing the load balancer to mark the server as unhealthy.",
    prevention: "Implement simple, reliable health check endpoints; separate health check from application logic; monitor health check pass rates."
  },
  {
    id: "scenario-90",
    title: "Certificate Chain Incomplete",
    symptom: "Browser shows 'NET::ERR_CERT_AUTHORITY_INVALID' or 'missing intermediate certificate'",
    category: "network",
    difficulty: 3,
    commands: ["openssl s_client -connect example.com:443 -servername example.com -showcerts", "cat /etc/nginx/ssl/fullchain.pem | openssl x509 -noout -issuer -subject", "cat /etc/nginx/ssl/chain.pem"],
    steps: [
      "Step 1: Test with openssl: `echo | openssl s_client -connect example.com:443 -showcerts 2>/dev/null`.",
      "Step 2: Look for 'verify error:num=20:unable to get local issuer certificate'.",
      "Step 3: The server sent only its own certificate but not the intermediate CA chain.",
      "Step 4: Check the certificate file: does it contain both the cert and the intermediates?",
      "Step 5: Concatenate the certs in order: `cat example.com.crt intermediate.crt > fullchain.crt`.",
      "Step 6: Update web server config to use the full chain file.",
      "Step 7: Reload web server: `systemctl reload nginx`.",
      "Step 8: Verify with SSL Labs or openssl: `echo | openssl s_client -connect localhost:443 2>/dev/null | openssl x509 -noout -dates`."
    ],
    root_cause: "The web server was configured with only the leaf certificate, without the intermediate CA certificates needed to complete the trust chain.",
    prevention: "Use Let's Encrypt's fullchain.pem; always chain the full certificate; test with SSL Labs after deployment."
  },
  {
    id: "scenario-91",
    title: "System Clock Drift / NTP Not Syncing",
    symptom: "Log timestamps are off; Kerberos authentication fails; certificate validation fails due to clock skew",
    category: "process",
    difficulty: 2,
    commands: ["date", "timedatectl status", "ntpq -p", "chronyc tracking", "systemctl restart chronyd", "timedatectl set-ntp true"],
    steps: [
      "Step 1: Check current time: `date` — compare to actual time.",
      "Step 2: Check NTP status: `timedatectl status` — see if NTP service is active.",
      "Step 3: Check NTP peers: `ntpq -p` (ntpd) or `chronyc sources -v` (chronyd).",
      "Step 4: If NTP is not syncing, restart the service: `systemctl restart chronyd` or `systemctl restart ntp`.",
      "Step 5: Force sync: `timedatectl set-ntp false && timedatectl set-ntp true`.",
      "Step 6: Manual sync: `ntpdate -s pool.ntp.org` (if ntpd is stopped).",
      "Step 7: Check firewall for NTP port (UDP 123).",
      "Step 8: Set timezone if wrong: `timedatectl set-timezone UTC`."
    ],
    root_cause: "The NTP service (chronyd or ntpd) was not running or could not reach NTP servers due to a firewall blocking UDP 123.",
    prevention: "Enable NTP/chrony on all servers; monitor clock skew via monitoring; configure multiple NTP servers for redundancy."
  },
  {
    id: "scenario-92",
    title: "RAID Array Degraded / Failed Disk",
    symptom: "Server logs show 'RAID array degraded' or 'Disk failure predicted'; performance degradation",
    category: "disk",
    difficulty: 4,
    commands: ["cat /proc/mdstat", "mdadm --detail /dev/md0", "smartctl -a /dev/sda", "mdadm --manage /dev/md0 --add /dev/sdb", "mdadm --replace /dev/md0 --with /dev/sdb"],
    steps: [
      "Step 1: Check RAID status: `cat /proc/mdstat` — look for [U_] or [_U] patterns (U=up, _=down).",
      "Step 2: Get detailed info: `mdadm --detail /dev/md0`.",
      "Step 3: Identify the failed disk: `mdadm --detail /dev/md0 | grep 'Faulty'`.",
      "Step 4: Check disk health: `smartctl -a /dev/sda` — look for Reallocated_Sector_Ct.",
      "Step 5: If confirmed failed, mark as failed: `mdadm --manage /dev/md0 --fail /dev/sda`.",
      "Step 6: Remove the failed disk: `mdadm --manage /dev/md0 --remove /dev/sda`.",
      "Step 7: Add a new disk: `mdadm --manage /dev/md0 --add /dev/sdb` (resync starts automatically).",
      "Step 8: Monitor resync: `cat /proc/mdstat` and `watch -n 5 cat /proc/mdstat`."
    ],
    root_cause: "A physical disk in the RAID array developed bad sectors or failed completely, causing the array to operate in degraded mode.",
    prevention: "Configure RAID monitoring with email alerts; keep hot spares; regularly check smartctl metrics; replace disks proactively."
  },
  {
    id: "scenario-93",
    title: "Server Rebooted Unexpectedly",
    symptom: "`uptime` shows server recently rebooted; need to determine why and check for issues",
    category: "process",
    difficulty: 3,
    commands: ["uptime -s", "last reboot", "journalctl -b -1 --no-pager | tail -50", "journalctl -b 0 | grep -i 'reboot\\|shutdown\\|panic\\|hung_task'", "cat /var/log/kern.log | tail -50"],
    steps: [
      "Step 1: Check when the system booted: `uptime -s` or `last reboot`.",
      "Step 2: Check logs from the previous boot: `journalctl -b -1 --no-pager | tail -50`.",
      "Step 3: Look for panic or crash: `journalctl -b -1 | grep -i 'panic\\|oops\\|hung_task\\|kernel BUG'`.",
      "Step 4: Check if it was a hardware issue: `journalctl -b -1 | grep -i 'temperature\\|power\\|hard reset'`.",
      "Step 5: Check if it was a clean reboot: `journalctl -b -1 | grep -i 'shutdown\\|reboot'`.",
      "Step 6: Check for OOM at the end of the previous boot: `journalctl -b -1 | grep -i oom`.",
      "Step 7: Check /var/crash/ for crash dumps.",
      "Step 8: If no crash found, check if another admin rebooted (ask team, check change mgmt)."
    ],
    root_cause: "Could be kernel panic, OOM killer, hardware failure, power loss, watchdog timeout, or another admin performing maintenance.",
    prevention: "Configure kdump/crashdump for kernel panics; use UPS with graceful shutdown; document all maintenance reboots."
  },
  {
    id: "scenario-94",
    title: "NTP Service Not Running / Chrony Disabled",
    symptom: "System time gradually drifts; clock skew warnings from databases; Kerberos errors",
    category: "service",
    difficulty: 1,
    commands: ["systemctl status chronyd", "chronyc sources", "timedatectl status", "systemctl enable --now chronyd", "chronyc tracking"],
    steps: [
      "Step 1: Check chronyd status: `systemctl status chronyd`.",
      "Step 2: Check if it was disabled: `systemctl is-enabled chronyd`.",
      "Step 3: Start and enable chronyd: `systemctl enable --now chronyd`.",
      "Step 4: Check its peers: `chronyc sources -v`.",
      "Step 5: Check tracking: `chronyc tracking` — look at 'Last offset'.",
      "Step 6: If using ntpd instead: `systemctl status ntp` then enable that.",
      "Step 7: Verify time sync: `timedatectl status` — should show 'NTP service: active'.",
      "Step 8: Compare with accurate time: `date` vs `date --date='$(wget -qO- http://worldtimeapi.org/api/ip)'`."
    ],
    root_cause: "The chronyd or ntpd service was not installed, disabled, or stopped, causing the system time to drift from the actual time.",
    prevention: "Enable and start NTP on all servers; monitor clock drift as a metric; configure multiple NTP servers."
  },
  {
    id: "scenario-95",
    title: "SSH X11 Forwarding Not Working",
    symptom: "`ssh -X user@host` launches GUI apps but they fail with 'Can't open display'",
    category: "network",
    difficulty: 3,
    commands: ["echo $DISPLAY", "ssh -X -v user@host", "grep X11Forwarding /etc/ssh/sshd_config", "xauth list", "xclock"],
    steps: [
      "Step 1: Test with ssh -X: `ssh -X user@host xclock` — see if it works.",
      "Step 2: Check sshd config: `grep -E 'X11Forwarding|X11DisplayOffset|X11UseLocalhost' /etc/ssh/sshd_config`.",
      "Step 3: Enable X11Forwarding: set `X11Forwarding yes` in sshd_config.",
      "Step 4: Check that xauth is installed on the server: `which xauth` or `apt install xauth`.",
      "Step 5: If using -X, try -Y (trusted X11 forwarding): `ssh -Y user@host xclock`.",
      "Step 6: Check that DISPLAY is set: `echo $DISPLAY` inside the SSH session.",
      "Step 7: If DISPLAY is not set, export it: `export DISPLAY=localhost:10.0`.",
      "Step 8: Restart SSH: `systemctl restart sshd`."
    ],
    root_cause: "X11Forwarding was disabled in sshd_config, xauth was missing on the server, or the SSH client didn't pass -X/-Y.",
    prevention: "Enable X11Forwarding if needed; ensure xauth package is installed; use ssh -X (untrusted) or ssh -Y (trusted)."
  },
  {
    id: "scenario-96",
    title: "apt update GPG Key Error",
    symptom: "`apt update` fails with 'The following signatures couldn't be verified because the public key is not available'",
    category: "package",
    difficulty: 2,
    commands: ["sudo apt update 2>&1 | grep 'NO_PUBKEY'", "sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys <KEYID>", "gpg --keyserver keyserver.ubuntu.com --recv <KEYID>", "sudo apt update"],
    steps: [
      "Step 1: Run `apt update 2>&1 | grep NO_PUBKEY` to find the missing key ID.",
      "Step 2: Add the missing key: `sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys <KEYID>`.",
      "Step 3: Alternative with gpg: `gpg --keyserver keyserver.ubuntu.com --recv <KEYID> && gpg --export <KEYID> | sudo tee /etc/apt/trusted.gpg.d/<repo>.asc`.",
      "Step 4: If the keyserver is blocked, download the key from the repository's website.",
      "Step 5: For third-party repos, the key may need to be added differently: check the repo's setup instructions.",
      "Step 6: Reload apt: `sudo apt update`.",
      "Step 7: If the key is compromised or wrong, verify the key fingerprint against the official source.",
      "Step 8: Do NOT use apt-key (deprecated); use the trusted.gpg.d directory approach for new installs."
    ],
    root_cause: "A third-party repository's GPG key was missing from the local trusted keyring, preventing apt from verifying package authenticity.",
    prevention: "Store third-party keys in /etc/apt/trusted.gpg.d/; verify key fingerprints against official sources; automate key management with config management."
  },
  {
    id: "scenario-97",
    title: "Kernel Module Not Loading",
    symptom: "Device not working; `lsmod` doesn't show the driver; `dmesg` shows 'module not found' or 'permission denied'",
    category: "process",
    difficulty: 4,
    commands: ["lsmod | grep <module>", "modprobe <module>", "dmesg | grep -i <module>", "cat /etc/modules-load.d/<module>.conf", "depmod -a"],
    steps: [
      "Step 1: Check if the module is loaded: `lsmod | grep <module>`.",
      "Step 2: Try to load it: `modprobe <module>` — check output for errors.",
      "Step 3: Check dmesg: `dmesg -T | grep -i '<module>\\|error'`.",
      "Step 4: Check if the module file exists: `modinfo <module>`.",
      "Step 5: If modinfo fails, the module may be built into the kernel or not available.",
      "Step 6: Check kernel version vs module version: `uname -a` and `modinfo <module> | grep depends`.",
      "Step 7: If module is blacklisted: `grep -r blacklist /etc/modprobe.d/`.",
      "Step 8: Add module to auto-load: `echo '<module>' > /etc/modules-load.d/<module>.conf`."
    ],
    root_cause: "The kernel module was not available for the current kernel version, was blacklisted, or had unsatisfied dependencies.",
    prevention: "Match kernel modules to kernel versions; verify module compatibility during kernel upgrades; document required modules."
  },
  {
    id: "scenario-98",
    title: "Debian/Ubuntu Release Upgrade Failure",
    symptom: "`do-release-upgrade` fails partway through; system is in an inconsistent state between releases",
    category: "package",
    difficulty: 5,
    commands: ["lsb_release -a", "cat /etc/apt/sources.list", "sudo apt update && sudo apt upgrade", "sudo do-release-upgrade -d", "sudo dpkg --configure -a"],
    steps: [
      "Step 1: Check current release: `lsb_release -a`.",
      "Step 2: Check if the upgrade stalled: `dpkg --configure -a`.",
      "Step 3: Check for held/broken packages: `dpkg --get-selections | grep hold`.",
      "Step 4: Fix all current issues: `apt --fix-broken install && apt update && apt upgrade -y`.",
      "Step 5: Remove third-party PPAs that may conflict with the new release.",
      "Step 6: Attempt the upgrade again: `do-release-upgrade`.",
      "Step 7: If it fails, restore from backup and try a clean upgrade path.",
      "Step 8: After success, verify: `lsb_release -a` and `cat /etc/os-release`."
    ],
    root_cause: "Third-party PPAs, held packages, or network issues caused a dist-upgrade to fail mid-way, leaving the system with packages from mixed releases.",
    prevention: "Always backup before major upgrades; remove third-party repos before upgrading; test upgrades in a staging environment first."
  },
  {
    id: "scenario-99",
    title: "System Randomly Freezes / Hard Lockup",
    symptom: "Server becomes completely unresponsive; no SSH, no ping, no console response; hard reset required",
    category: "process",
    difficulty: 5,
    commands: ["journalctl -b -1 | grep -i 'lockup\\|watchdog\\|nmi\\|hung_task'", "dmesg | grep -i 'soft lockup\\|hard lockup'", "cat /proc/sys/kernel/watchdog", "mcelog --client"],
    steps: [
      "Step 1: After reboot, check logs from the previous boot: `journalctl -b -1 --no-pager -n 200`.",
      "Step 2: Look for kernel lockup messages: `journalctl -b -1 | grep -i 'lockup\\|watchdog\\|nmi'`.",
      "Step 3: Check hardware errors: `dmesg | grep -i 'mce\\|machine check\\|hardware error'`.",
      "Step 4: Check if watchdog is enabled: `cat /proc/sys/kernel/watchdog` — 1=enabled.",
      "Step 5: Run memory tests: `memtester 1G 1` or schedule a memtest86 run.",
      "Step 6: Check disk health: `smartctl -a /dev/sda` — look for reallocated sectors.",
      "Step 7: Check CPU temperature: `sensors` or `cat /sys/class/thermal/thermal_zone*/temp`.",
      "Step 8: Update firmware, BIOS, and kernel to latest stable versions."
    ],
    root_cause: "Could be faulty hardware (memory, CPU, PSU), overheating, kernel bug, or a driver issue causing a hard lockup.",
    prevention: "Configure kdump/crashdump; enable NMI watchdog; monitor hardware sensors; keep firmware and kernel updated."
  },
  {
    id: "scenario-100",
    title: "SSH Multiplexing / Connection Sharing Problem",
    symptom: "SSH connections hang or fail with 'mux_client_request_session: read from master failed: Connection reset by peer'",
    category: "network",
    difficulty: 2,
    commands: ["ssh -S none user@host", "rm -f ~/.ssh/controlmasters/*", "ssh -o ControlMaster=no user@host", "ls -la ~/.ssh/controlmasters/"],
    steps: [
      "Step 1: Check if control socket exists: `ls -la ~/.ssh/controlmasters/` or `~/.ssh/cm_socket`.",
      "Step 2: If the SSH master connection died, the control socket is stale.",
      "Step 3: Remove stale control sockets: `rm -f ~/.ssh/controlmasters/*`.",
      "Step 4: Disable multiplexing for this session: `ssh -o ControlMaster=no user@host`.",
      "Step 5: Or use a new socket path: `ssh -S /tmp/custom-socket user@host`.",
      "Step 6: Check SSH config: `cat ~/.ssh/config | grep -A5 Control`.",
      "Step 7: Fix ControlPath if needed: set `ControlPath ~/.ssh/controlmasters/%r@%h:%p`.",
      "Step 8: Create the controlmasters directory: `mkdir -p ~/.ssh/controlmasters && chmod 700 ~/.ssh/controlmasters`."
    ],
    root_cause: "A stale SSH multiplexing control socket from a previous session caused connection sharing to fail when the master connection was lost.",
    prevention: "Set ControlPath to include %r@%h:%p for uniqueness; enable ControlPersist for clean cleanup."
  },
  {
    id: "scenario-101",
    title: "SysRq / Magic Key Combination Not Working",
    symptom: "System is hung; need to use SysRq (Magic SysRq) keys but they don't respond",
    category: "process",
    difficulty: 3,
    commands: ["cat /proc/sys/kernel/sysrq", "echo 1 > /proc/sys/kernel/sysrq", "sysctl -w kernel.sysrq=1", "echo b > /proc/sysrq-trigger", "echo o > /proc/sysrq-trigger"],
    steps: [
      "Step 1: Check if SysRq is enabled: `cat /proc/sys/kernel/sysrq` — 0=disabled.",
      "Step 2: Temporarily enable: `echo 1 > /proc/sys/kernel/sysrq`.",
      "Step 3: Make permanent: `kernel.sysrq = 1` in /etc/sysctl.conf or /etc/sysctl.d/.",
      "Step 4: Use SysRq safely: `echo b > /proc/sysrq-trigger` (reboot without sync).",
      "Step 5: Better: `echo s > /proc/sysrq-trigger` (sync), then `echo u > /proc/sysrq-trigger` (remount ro), then `echo b > /proc/sysrq-trigger` (reboot).",
      "Step 6: Show SysRq help: `echo h > /proc/sysrq-trigger` (logged to kernel ring buffer).",
      "Step 7: In real situations, use Alt+SysRq+<key> on console.",
      "Step 8: Verify: `dmesg | tail` should show SysRq actions."
    ],
    root_cause: "The kernel SysRq facility was disabled (kernel.sysrq = 0) in /etc/sysctl.conf, making the magic key combinations non-functional.",
    prevention: "Set kernel.sysrq = 1 in sysctl for all servers (or 0 for strict security); document SysRq procedures in runbooks."
  },
  {
    id: "scenario-102",
    title: "AWS EC2 Instance Metadata Service Timeout",
    symptom: "Application can't retrieve IAM role credentials or user-data; `curl http://169.254.169.254/latest/meta-data/` times out",
    category: "network",
    difficulty: 3,
    commands: ["curl -I http://169.254.169.254/latest/meta-data/", "ip route show table local", "ip route add 169.254.169.254/32 dev eth0", "systemctl restart networking"],
    steps: [
      "Step 1: Test IMDS: `curl -I http://169.254.169.254/latest/meta-data/`.",
      "Step 2: Check routing: `ip route show table local | grep 169.254`.",
      "Step 3: Check if a firewall or iptables rule is blocking the link-local address.",
      "Step 4: Check if the network interface is eth0 (IMDS is accessible via the primary ENI).",
      "Step 5: If using IMDSv2, need a token first: `TOKEN=$(curl -X PUT 'http://169.254.169.254/latest/api/token' -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')`.",
      "Step 6: Try IMDSv2: `curl -H \"X-aws-ec2-metadata-token: $TOKEN\" http://169.254.169.254/latest/meta-data/`.",
      "Step 7: Check if the instance was launched without metadata enabled.",
      "Step 8: Reboot the instance or reattach the primary ENI if needed."
    ],
    root_cause: "The route to 169.254.169.254 was missing (e.g., after a routing table modification), or iptables blocked the link-local address.",
    prevention: "Use IMDSv2 for enhanced security; don't modify routes for the primary ENI; use IAM roles for EC2 to avoid hardcoded credentials."
  },
  {
    id: "scenario-103",
    title: "ulimits Too Low for Database Connection Pool",
    symptom: "Database application logs 'Can't create a new thread' or 'Resource temporarily unavailable' with high concurrency",
    category: "process",
    difficulty: 3,
    commands: ["ulimit -a", "cat /proc/<pid>/limits", "cat /proc/sys/kernel/threads-max", "sysctl -w kernel.threads-max=65536", "cat /etc/security/limits.d/90-nproc.conf"],
    steps: [
      "Step 1: Check current limits: `ulimit -a` — note nproc (max user processes).",
      "Step 2: Check for the specific process: `cat /proc/<PID>/limits | grep processes`.",
      "Step 3: Check the system thread limit: `cat /proc/sys/kernel/threads-max`.",
      "Step 4: Increase user nproc: `echo '* soft nproc 65536' >> /etc/security/limits.conf` and `echo '* hard nproc 65536' >> /etc/security/limits.conf`.",
      "Step 5: For systemd services, add `LimitNPROC=65536` and `TasksMax=65536`.",
      "Step 6: Increase threads-max: `sysctl -w kernel.threads-max=65536`.",
      "Step 7: Reload systemd: `systemctl daemon-reload` and restart the service.",
      "Step 8: Monitor: `ps huH p <PID> | wc -l` to count threads for the process."
    ],
    root_cause: "The default ulimit for max user processes (nproc) was too low for the database connection pool, causing thread creation failures under load.",
    prevention: "Set LimitsNPROC and TasksMax appropriately in systemd service definitions; profile thread usage during load testing; set global nproc limits."
  },
  {
    id: "scenario-104",
    title: "Outbound SMTP Port 25 Blocked",
    symptom: "Application can't send emails; telnet to smtp-relay.com 25 fails; other ports work",
    category: "network",
    difficulty: 2,
    commands: ["nc -zv smtp.gmail.com 25", "nc -zv smtp.gmail.com 587", "curl -I https://smtp.gmail.com:465", "telnet smtp.gmail.com 25", "iptables -L OUTPUT -n | grep ':25'"],
    steps: [
      "Step 1: Test SMTP port 25: `nc -zv smtp.gmail.com 25`.",
      "Step 2: Test alternate SMTP ports: `nc -zv smtp.gmail.com 587` and `nc -zv smtp.gmail.com 465`.",
      "Step 3: If port 25 is blocked but 587 works, change the app config to use port 587 (submission).",
      "Step 4: Check local firewall: `iptables -L OUTPUT -n | grep ':25'`.",
      "Step 5: Many ISPs/cloud providers block outbound port 25 to prevent spam.",
      "Step 6: Use a relay service that supports port 587 or 465 instead.",
      "Step 7: Update application mail settings to use port 587 with STARTTLS.",
      "Step 8: Request port 25 unblock from your ISP/cloud provider if absolutely necessary."
    ],
    root_cause: "The ISP or cloud provider blocked outbound SMTP port 25 as an anti-spam measure, but the application was hardcoded to use port 25.",
    prevention: "Use port 587 (SMTP submission with STARTTLS) for email sending; use a dedicated email API service; never hardcode port numbers."
  },
  {
    id: "scenario-105",
    title: "Git SSH Authentication Failed",
    symptom: "`git clone git@github.com:org/repo.git` fails with 'Permission denied (publickey)'",
    category: "permission",
    difficulty: 2,
    commands: ["ssh -T git@github.com", "ssh-add -l", "ssh-add ~/.ssh/id_rsa", "cat ~/.ssh/id_rsa.pub", "eval $(ssh-agent -s) && ssh-add"],
    steps: [
      "Step 1: Test SSH connection: `ssh -T git@github.com` — 'Hi username! You've successfully authenticated...' is success.",
      "Step 2: Check if the key is loaded in ssh-agent: `ssh-add -l`.",
      "Step 3: If 'The agent has no identities', add your key: `ssh-add ~/.ssh/id_rsa`.",
      "Step 4: If the key file doesn't exist, generate a new one: `ssh-keygen -t ed25519 -C \"you@email.com\"`.",
      "Step 5: Add the public key to your Git hosting account (GitHub/GitLab/Bitbucket).",
      "Step 6: If using a non-standard port or host, check ~/.ssh/config for Host blocks.",
      "Step 7: Verify the key permissions: `chmod 600 ~/.ssh/id_rsa` and `chmod 644 ~/.ssh/id_rsa.pub`.",
      "Step 8: Test again: `ssh -T git@github.com`."
    ],
    root_cause: "The SSH key was not loaded in the ssh-agent, or the public key was not added to the Git hosting account.",
    prevention: "Use ssh-agent for key management; add keys to agent on login via .bashrc; document SSH key setup in onboarding."
  },
  {
    id: "scenario-106",
    title: "Docker Networking — Cross-Container Communication",
    symptom: "Container A can't reach Container B by hostname; `docker exec -it containerA ping containerB` fails",
    category: "container",
    difficulty: 3,
    commands: ["docker network ls", "docker network inspect bridge", "docker network create my-network", "docker run --network my-network --name containerB ..."],
    steps: [
      "Step 1: Check that both containers are on the same Docker network.",
      "Step 2: They must be on a user-defined bridge network (not the default bridge).",
      "Step 3: Create a custom network: `docker network create my-network`.",
      "Step 4: Connect both containers: `docker network connect my-network containerA` and `docker network connect my-network containerB`.",
      "Step 5: Or run them directly on the network: `docker run --network my-network --name containerB nginx`.",
      "Step 6: Test: `docker exec containerA ping containerB` (or use the --name as hostname).",
      "Step 7: Check embedded DNS: `docker exec containerA cat /etc/resolv.conf`.",
      "Step 8: User-defined networks provide automatic DNS resolution between containers using their names."
    ],
    root_cause: "Containers were running on the default bridge network where Docker's embedded DNS doesn't provide name resolution between containers.",
    prevention: "Always use user-defined bridge networks for multi-container apps; use docker-compose for automatic network setup."
  },
  {
    id: "scenario-107",
    title: "sudo Passwordless Not Working",
    symptom: "`sudo command` still asks for a password even though the sudoers file has NOPASSWD",
    category: "permission",
    difficulty: 2,
    commands: ["sudo -l", "cat /etc/sudoers | grep NOPASSWD", "cat /etc/sudoers.d/* | grep NOPASSWD", "visudo -c"],
    steps: [
      "Step 1: Check current sudo privileges: `sudo -l`.",
      "Step 2: The NOPASSWD entry must be placed AFTER the entry that grants the permission.",
      "Step 3: Correct syntax: `username ALL=(ALL) NOPASSWD: ALL`.",
      "Step 4: If a line with PASSWD comes after the NOPASSWD line, it overrides it.",
      "Step 5: Check all included files: `grep -r NOPASSWD /etc/sudoers.d/`.",
      "Step 6: Check for Defaults requiretty that may interfere.",
      "Step 7: Also check `Defaults targetpw` which forces password for all.",
      "Step 8: Use `visudo` to edit and validate syntax."
    ],
    root_cause: "The NOPASSWD directive was placed before the actual privilege entry, or another sudoers rule (PASSWD) came after it and overrode it.",
    prevention: "Place NOPASSWD at the end of the specific privilege line; test with `sudo -l`; use visudo syntax checking."
  },
  {
    id: "scenario-108",
    title: "Journald Fills Up /var/log",
    symptom: "`df -h` shows /var/log is 100% full; `journalctl` shows logs going back months",
    category: "log",
    difficulty: 2,
    commands: ["journalctl --disk-usage", "journalctl --vacuum-size=500M", "journalctl --vacuum-time=7d", "cat /etc/systemd/journald.conf", "systemctl restart systemd-journald"],
    steps: [
      "Step 1: Check journal size: `journalctl --disk-usage`.",
      "Step 2: Vacuum to reduce size: `journalctl --vacuum-size=500M`.",
      "Step 3: Or vacuum by time: `journalctl --vacuum-time=7d`.",
      "Step 4: Edit journald.conf: set `SystemMaxUse=500M` and `MaxRetentionSec=1week`.",
      "Step 5: Rotate journal: `journalctl --rotate`.",
      "Step 6: Restart journald: `systemctl restart systemd-journald`.",
      "Step 7: Monitor with `df -h /var/log`.",
      "Step 8: Consider forwarding logs to a remote syslog server and reducing local retention."
    ],
    root_cause: "SystemMaxUse was not set in journald.conf, allowing journald to use unlimited disk space for logs (default is 10% of the filesystem).",
    prevention: "Always set SystemMaxUse= in journald.conf; forward important logs to a central logging system; implement log rotation policies."
  },
  {
    id: "scenario-109",
    title: "Nginx 413 Request Entity Too Large",
    symptom: "Users trying to upload files get '413 Request Entity Too Large' error",
    category: "service",
    difficulty: 1,
    commands: ["grep client_max_body_size /etc/nginx/nginx.conf", "grep proxy_max_temp_file_size /etc/nginx/sites-enabled/*", "nginx -t", "systemctl reload nginx"],
    steps: [
      "Step 1: Check nginx config for client_max_body_size: `grep client_max_body_size /etc/nginx/nginx.conf`.",
      "Step 2: The default is 1MB — too small for file uploads.",
      "Step 3: Set a larger value: `client_max_body_size 100M;` in http, server, or location block.",
      "Step 4: Validate config: `nginx -t`.",
      "Step 5: Reload nginx: `systemctl reload nginx`.",
      "Step 6: If using a reverse proxy, also check proxy_max_temp_file_size.",
      "Step 7: Also check PHP upload_max_filesize and post_max_size if using PHP backend.",
      "Step 8: Test the upload with a large file."
    ],
    root_cause: "Nginx's default client_max_body_size is 1MB, which blocks file uploads larger than that.",
    prevention: "Set client_max_body_size appropriately for the application's upload requirements; test upload functionality in staging."
  },
  {
    id: "scenario-110",
    title: "apt update Hangs / Slow Metadata Download",
    symptom: "`apt update` hangs for minutes or times out; specific repositories are slow to respond",
    category: "package",
    difficulty: 2,
    commands: ["sudo apt update 2>&1", "ping -c 3 archive.ubuntu.com", "cat /etc/apt/sources.list | grep -v '^#'", "sudo sed -i 's|http://archive.ubuntu.com|http://us.archive.ubuntu.com|' /etc/apt/sources.list"],
    steps: [
      "Step 1: Run `apt update` and note which repository is slow.",
      "Step 2: Test connectivity: `ping -c 3 archive.ubuntu.com`.",
      "Step 3: Check if it's a DNS issue: `nslookup archive.ubuntu.com`.",
      "Step 4: Change to a faster mirror: use `sed` to replace the URL or use `sed -i 's|http://|https://|'` to switch to HTTPS.",
      "Step 5: Use a CDN mirror: replace with `http://us.archive.ubuntu.com/ubuntu/` or use the built-in mirror selection.",
      "Step 6: Increase apt timeout: create `/etc/apt/apt.conf.d/99timeout` with `Acquire::http::Timeout \"10\";`.",
      "Step 7: Enable apt retries: `Acquire::Retries \"3\";`.",
      "Step 8: Try again: `sudo apt update`."
    ],
    root_cause: "The default apt repository mirror was slow to respond or experiencing packet loss, causing apt update to hang while waiting for metadata.",
    prevention: "Configure a local apt cache proxy (apt-cacher-ng) or mirror; use the fastest geographically close mirror; set Acquire::Retries."
  }
];
