# Setting up the ChoiceMi server on UpCloud

A step-by-step guide to put the ChoiceMi website and API on a server in Helsinki. Menu names in the UpCloud console change from time to time, so if a button is named slightly differently, follow the meaning.

What you will end up with:

- One Ubuntu server in Helsinki running the site and API in Docker.
- Caddy in front of it, giving free HTTPS that renews by itself.
- A deploy that runs by itself every time you merge into `main`.
- A locked-down server: keys only, firewall, automatic security updates.

Files that make this work (already in the repo): `web/Dockerfile`, `deploy/docker-compose.yml`, `deploy/Caddyfile`, `deploy/.env.example`, `deploy/server-setup.sh`, `deploy/deploy.sh`, `deploy/backup-data.sh`, `.github/workflows/deploy.yml`.

Time needed: about 1 hour the first time.

## Part 0. Before you start

You need: access to the DNS settings of `choicemi.com`, admin access to the GitHub repository, and a password manager for the keys and secrets below.

## Part 1. SSH keys

You need two keys. The first is yours, to log in to the server. The second is for GitHub, so it can deploy for you.

In PowerShell on your computer:

```powershell
# your personal key (note the capital -C)
ssh-keygen -t ed25519 -C "anyadaniel1@gmail.com" -f "$env:USERPROFILE\.ssh\choicemi_upcloud"

# the key GitHub will use to deploy (press Enter for NO passphrase)
ssh-keygen -t ed25519 -C "choicemi-github-deploy" -f "$env:USERPROFILE\.ssh\choicemi_deploy"
```

Show the two public halves (the files ending in `.pub`):

```powershell
Get-Content "$env:USERPROFILE\.ssh\choicemi_upcloud.pub"
Get-Content "$env:USERPROFILE\.ssh\choicemi_deploy.pub"
```

Rules: the `.pub` files are safe to paste into websites. The files without `.pub` are private. Never send them, never put them in the repo. Store a backup of your personal private key and its passphrase in your password manager.

## Part 2. UpCloud console

1. **Turn on two-factor login.** Click the red "Activate 2FA" button at the top and follow it. Do this before anything else.
2. **Set a billing alert** in your account settings, so nothing surprises you.
3. **Create the server.** Servers, Deploy now (or Deploy server):
   - Location: **Helsinki** (`fi-hel1` or `fi-hel2`).
   - Plan: **General Purpose, 2 vCPU, 4 GB RAM**. If you see a cheaper "Developer" plan, it is fine for a test server only.
   - Storage: 80 GB, MaxIOPS, with **backups** switched on (daily).
   - Operating system: **Ubuntu 24.04 LTS**.
   - Networking: a public IPv4 address (and IPv6 if offered). Also attach a private network so the database can join it later.
   - Authentication: choose **SSH keys only**. Add your personal public key (the output of the first `Get-Content` above) and give it a name like `choicemi-upcloud`.
   - Hostname: `choicemi-prod`.
4. **Firewall.** Open the server, Firewall tab, turn it on, and add rules:
   - Allow TCP 22 from **your own IP address only**. If your IP changes often, allow it from anywhere for now and rely on keys.
   - Allow TCP 80 and TCP 443 (and UDP 443) from anywhere.
   - Block everything else coming in.
5. Write down the server's public IP address. Below it is called `SERVER_IP`.

## Part 3. DNS

At the company where you manage `choicemi.com`, add these records:

| Type | Name | Value |
|---|---|---|
| A | `@` (the main domain) | `SERVER_IP` |
| A | `www` | `SERVER_IP` |

If you want to test first, use a separate name such as `staging` instead of `@`, and set `DOMAIN=staging.choicemi.com` in Part 6. Keep the time-to-live low (300 seconds) until everything works.

Wait a few minutes, then check from PowerShell: `nslookup choicemi.com`. It must show `SERVER_IP`. Caddy cannot get a certificate until it does.

## Part 4. First login and server setup

From PowerShell (answer `yes` the first time and enter your passphrase):

```powershell
ssh -i "$env:USERPROFILE\.ssh\choicemi_upcloud" root@SERVER_IP
```

Copy the setup script to the server. In a second PowerShell window, from the repo folder:

```powershell
scp -i "$env:USERPROFILE\.ssh\choicemi_upcloud" deploy\server-setup.sh root@SERVER_IP:/root/
```

On the server:

```bash
sed -i 's/\r$//' server-setup.sh     # fixes Windows line endings if any
bash server-setup.sh
```

It takes a few minutes. It installs Docker, creates a `deploy` user with your key, turns on the firewall, fail2ban, automatic security updates and 2 GB of swap, and turns off password logins.

**Test the new user before closing anything.** In a second PowerShell window:

```powershell
ssh -i "$env:USERPROFILE\.ssh\choicemi_upcloud" deploy@SERVER_IP
```

If that works, go back to the root window and lock root login:

```bash
bash server-setup.sh --lock-root
```

If the `deploy` login does not work, do NOT run `--lock-root`. Check that `/home/deploy/.ssh/authorized_keys` contains your public key.

## Part 5. Let GitHub deploy

GitHub ships the source to the server over SSH and the server builds the image itself, so no container registry or access token is needed.

1. **Authorize the deploy key on the server.** Logged in as `deploy`:
   ```bash
   echo "PASTE THE choicemi_deploy.pub LINE HERE" >> ~/.ssh/authorized_keys
   ```
2. **Add repository secrets.** GitHub, the repository, Settings, Secrets and variables, Actions, New repository secret:
   - `SERVER_HOST`: `SERVER_IP`
   - `SERVER_USER`: `deploy`
   - `SERVER_SSH_KEY`: the full contents of the private file `choicemi_deploy`. Copy it with `Get-Content "$env:USERPROFILE\.ssh\choicemi_deploy" -Raw | Set-Clipboard`, paste, and include the first and last lines.
   - `SERVER_KNOWN_HOSTS`: run `ssh-keyscan -t ed25519 SERVER_IP` on your computer and paste the output line.

## Part 6. Settings file and first start

On the server as `deploy`:

```bash
cd /opt/choicemi
nano .env
```

Paste the contents of `deploy/.env.example` and set:

- `DOMAIN` to your domain (`choicemi.com`)
- `ACME_EMAIL` to `admin@choicemi.com`
- `SESSION_SECRET` to a random value: run `openssl rand -base64 48` and paste the result
- `POSTGRES_PASSWORD` to a random hex value: run `openssl rand -hex 24` and paste the result (hex only, it goes inside a URL)
- `APP_BASE_URL` to `https://choicemi.com` (with `https://`)
- Leave `RESEND_API_KEY`, `MAIL_FROM` and the `SIGNICAT_*` lines empty until you have them (see `AUTH_API.md`). The site works without them: sign-up and sign-in are live; email confirmation and identity verification switch on when you fill them in.

Then lock the file: `chmod 600 .env`.

Now merge into `main`. That starts the "Deploy" workflow (GitHub, the Actions tab), which builds the image on the server and starts it. If it fails at the deploy step, fix the cause (see Part 11) and use "Re-run all jobs".

## Part 7. Check it works

- Open `https://choicemi.com/api/health`. You should see `{"ok":true,...}`.
- Open `https://choicemi.com`. You should see the coming-soon page, with a padlock.
- On the server: `cd /opt/choicemi && docker compose ps` should show both containers as running and the app as `healthy`.

## Part 8. The database

PostgreSQL 16 runs as the `db` container next to the app, on the server's own disk, reachable only from the app (no public port). Tables are created automatically the first time the app starts. Nothing to do here except set `POSTGRES_PASSWORD` in Part 6.

Check it: `docker compose exec db psql -U choicemi -c '\dt'` lists the tables.

When you outgrow one server, move to UpCloud Managed PostgreSQL:

1. UpCloud, Databases, create **PostgreSQL** in the same Helsinki location on the private network. Allow connections only from the server's private address and require TLS. Create the database `choicemi` and a user `app`.
2. Copy the data across: `docker compose exec -T db pg_dump -U choicemi choicemi > dump.sql`, then load it into the managed database with `psql`.
3. In `.env` set `DATABASE_URL=postgres://app:PASSWORD@PRIVATE-DB-HOST:11550/choicemi?sslmode=require` and `DATABASE_SSL=1`, remove the `db` service from `docker-compose.yml`, and run `./deploy.sh`.

## Part 9. Backups

- **Server backups:** already on from Part 2. Check in the console that the schedule is daily and keeps at least 7.
- **Database and app data:** `backup-data.sh` writes a `pg_dump` of the database and a copy of the app volume. Run it daily. On the server as `deploy`:
  ```bash
  crontab -e
  ```
  Add the line:
  ```
  15 3 * * * /opt/choicemi/backup-data.sh >> /opt/choicemi/backups/backup.log 2>&1
  ```
  It keeps the last 14 days in `/opt/choicemi/backups`. Copy those off the server too (UpCloud Object Storage or your own machine); a backup on the same disk does not survive losing the server.
- **Restore drill:** once, restore a backup somewhere harmless and confirm it opens. A backup you have never restored is a guess.

## Part 10. Everyday operations

| Task | Command (on the server, in `/opt/choicemi`) |
|---|---|
| See what is running | `docker compose ps` |
| Live app logs | `docker compose logs -f app` |
| Live web server logs | `docker compose logs -f caddy` |
| Re-apply config after editing `.env` | `./deploy.sh` |
| Roll back to an older version | `docker images choicemi-web` lists what is kept (newest 5), then `./deploy.sh <tag>` |
| Restart | `docker compose restart app` |
| Free disk space | `docker system df` then `docker image prune -a` |

Monitoring: add `https://choicemi.com/api/health` to a free uptime checker (Better Stack or UptimeRobot) with email alerts, and watch the server graphs in the UpCloud console.

## Part 11. If something goes wrong

| Symptom | Cause and fix |
|---|---|
| `Permission denied (publickey)` | Wrong key or user. Use `-i` with the right file and `deploy@` (or `root@` before locking). |
| `$'\r': command not found` | Windows line endings. Run `sed -i 's/\r$//' file.sh`. |
| Browser shows a certificate error | DNS does not point at the server yet, or port 80 is blocked. Check `nslookup`, the UpCloud firewall, then `docker compose logs caddy`. |
| Site shows 502 | The app is not healthy. `docker compose logs app`. |
| Workflow fails at "Copy deploy files" | `SERVER_HOST`, `SERVER_USER` or the key secrets are wrong, or the deploy public key is not in `~/.ssh/authorized_keys`. |
| Workflow fails at "Build and roll out" | Open the step's log. Usually a build error, or the server is out of disk (`docker system df`, `docker image prune -a`). |
| Workflow host key error | `SERVER_KNOWN_HOSTS` is wrong or the server was rebuilt. Run `ssh-keyscan -t ed25519 SERVER_IP` again and update the secret. |
| Out of memory | Check `free -h`. Resize the server to 4 vCPU / 8 GB in the console. |

## Part 12. Moving from Vercel to this server

1. Keep Vercel running until the new server passes Part 7 and a full test (sign up, onboarding, discover, dates).
2. Lower the DNS time-to-live a day before, then change the `choicemi.com` A record to `SERVER_IP`.
3. Update every place that holds the old web address:
   - Signicat redirect URIs (see `SIGNICAT_VERIFICATION.md`)
   - The Android app: set `CHOICEMI_WEB_URL` and the `TARGET` address inside `mobile/www/offline.html` to the new domain, then rebuild the APK.
4. After a week with no problems, remove the site from Vercel.

## Part 13. Security checklist

- [ ] 2FA on UpCloud, GitHub and your email
- [ ] Password logins off, root login off, key passphrase set
- [ ] Firewall on in UpCloud and on the server
- [ ] `.env` is `chmod 600` and never committed
- [ ] Backups run daily and a restore has been tested
- [ ] Automatic security updates on (checked: `systemctl status unattended-upgrades`)
- [ ] Uptime alerts go to a real inbox
- [ ] The deploy key can only log in as `deploy`, which has no admin rights
- [ ] UpCloud data processing agreement signed and listed in the privacy policy

## What this does not include yet

The accounts, sign-in and Signicat flow are built (see `AUTH_API.md`); you still add the email provider key and Signicat credentials. The older demo features (profile answers, read-checks, date proposals) still store their data in the file store inside the Docker volume until they are moved to the database (see `BACKEND_PLAN.md`); the backup script covers that volume. A single server has no automatic failover; a second server with a load balancer comes at launch.
