# l2l-backend deployment

This folder holds the files used to run the backend on the BEM VPS.
The Dockerfile and GitHub Actions workflow live at the repo root
(`Dockerfile`, `.github/workflows/deploy.yml`).

- Image: `ghcr.io/sebastianliew/l2l-backend:latest`
- VPS path: `/opt/l2l-backend/`
- Public URL: `https://api.sebastianliew.com`
- Reverse proxy + TLS: shared `nginx-proxy` + `acme-companion` already running on the VPS.

---

## One-time setup

### 1. DNS

Point `api.sebastianliew.com` at the VPS.

    A   api.sebastianliew.com.   93.127.195.199   TTL 300

Wait for propagation (check with `dig api.sebastianliew.com +short`).

### 2. GitHub Secrets

In the `sebastianliew/l2l-backend` repo → Settings → Secrets and variables → Actions, add:

| Secret            | Value                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------- |
| `VPS_HOST`        | `93.127.195.199`                                                                            |
| `VPS_USER`        | `root`                                                                                      |
| `VPS_PORT`        | `22` (optional, default 22)                                                                 |
| `VPS_SSH_KEY`     | The PRIVATE half of a new SSH keypair — see step 3.                                         |
| `GHCR_PULL_TOKEN` | A GitHub PAT (classic) with `read:packages` scope — used on the VPS to pull private images. |

`GITHUB_TOKEN` used to push images is auto-provided; nothing to configure for that.

### 3. SSH key for GitHub Actions → VPS

On your laptop:

    ssh-keygen -t ed25519 -f ~/.ssh/l2l_deploy -N "" -C "github-actions-l2l-backend"

Install the **public** half on the VPS:

    sshpass -p 'Digitalmission2126-' ssh root@93.127.195.199 \
      "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys" \
      < ~/.ssh/l2l_deploy.pub

Paste the **private** half (`cat ~/.ssh/l2l_deploy`) into the `VPS_SSH_KEY` GitHub secret.

### 4. VPS directory + env file

    ssh root@93.127.195.199
    mkdir -p /opt/l2l-backend && cd /opt/l2l-backend

Copy `deploy/docker-compose.yml` and `deploy/.env.example` from this repo to the VPS:

    # From your laptop, in backend/
    scp deploy/docker-compose.yml root@93.127.195.199:/opt/l2l-backend/docker-compose.yml
    scp deploy/.env.example root@93.127.195.199:/opt/l2l-backend/.env

Then on the VPS, edit `.env` and fill in real secret values (MongoDB URI, JWT secrets, etc.):

    vim /opt/l2l-backend/.env
    chmod 600 /opt/l2l-backend/.env

### 5. First manual pull + boot

On the VPS:

    cd /opt/l2l-backend
    echo <GHCR_PULL_TOKEN> | docker login ghcr.io -u sebastianliew --password-stdin
    docker compose pull        # will fail until the first Actions build has pushed an image
    docker compose up -d
    docker compose logs -f

Hit the health check from the VPS to verify the container is alive:

    curl -s localhost:5000/health   # won't work (container not on host net); use:
    docker compose exec l2l-backend wget -qO- localhost:5000/health

From your laptop once DNS + cert are ready:

    curl https://api.sebastianliew.com/health

The acme-companion container auto-issues the Let's Encrypt cert the first time the
container comes up with `LETSENCRYPT_HOST` set. First issuance takes 30–90s.

---

## Ongoing deploys

Every push to `main` in `sebastianliew/l2l-backend`:

1. GitHub Actions builds the Docker image from the repo Dockerfile.
2. Pushes it to `ghcr.io/sebastianliew/l2l-backend:latest` + a short-SHA tag.
3. SSHes into the VPS, runs `docker compose pull && docker compose up -d`.

No manual step needed after the one-time setup above.

---

## Cutover from Render to VPS

Once the VPS endpoint is confirmed healthy:

1. **Update frontend env:** change `NEXT_PUBLIC_API_URL` on Vercel from
   `https://l2l-backend.onrender.com/api` to `https://api.sebastianliew.com/api`.
2. Redeploy the frontend.
3. Monitor a few transactions.
4. Once stable, shut down the Render service.

---

## Rollback

On the VPS:

    cd /opt/l2l-backend
    docker compose pull ghcr.io/sebastianliew/l2l-backend:sha-<previous_sha>
    # Edit docker-compose.yml to pin that tag, OR:
    docker run -d --name l2l-backend-rollback --network nginx-proxy ... (specific SHA)

Simpler: revert the offending commit on `main`, let CI redeploy.

---

## Troubleshooting

**Cert not issued:** `docker logs acme-companion | tail -40`. Most common cause is
DNS not propagated yet, or `LETSENCRYPT_HOST` mismatch.

**Container keeps restarting:** `docker compose logs --tail=100`. Usually a bad
value in `.env` (missing `MONGODB_URI`, bad `JWT_SECRET`, etc.).

**502 from nginx-proxy:** container up but not on the `nginx-proxy` network, or
`VIRTUAL_PORT` mismatch. Verify with
`docker inspect l2l-backend --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}'`.
