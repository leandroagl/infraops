#!/usr/bin/env python3
"""Veeam B&R REST API spike — jobs, last run, results, repository storage."""

import argparse
import sys
import urllib3
from datetime import datetime, timezone

import requests

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

VERSION_CANDIDATES = ["1.1-rev2", "1.1-rev1", "1.1-rev0", "1.0-rev1", "1.0-rev0"]
BASE_HEADERS = {"Accept": "application/json"}


def parse_args():
    p = argparse.ArgumentParser(description="Veeam backup status collector")
    p.add_argument("--host", required=True, help="Veeam server hostname or IP")
    p.add_argument("--port", type=int, default=9419)
    p.add_argument("--user", required=True)
    p.add_argument("--pass", dest="password", required=True)
    return p.parse_args()


def base_url(host, port):
    return f"https://{host}:{port}"


def authenticate(base, user, password):
    """Intenta autenticar negociando versión de API (1.1-rev2 → 1.1-rev1 → 1.0-rev0)."""
    last_err = None
    for version in VERSION_CANDIDATES:
        headers = {
            **BASE_HEADERS,
            "x-api-version": version,
            "Content-Type": "application/x-www-form-urlencoded",
        }
        try:
            resp = requests.post(
                f"{base}/api/oauth2/token",
                headers=headers,
                data={"grant_type": "password", "username": user, "password": password},
                verify=False,
                timeout=15,
            )
            if resp.status_code == 400:
                last_err = f"400 Bad Request — versión {version} no soportada. Body: {resp.text[:300]}"
                continue
            resp.raise_for_status()
            token = resp.json().get("access_token")
            if not token:
                raise ValueError("No access_token in auth response")
            return token, version
        except requests.exceptions.HTTPError as e:
            body = e.response.text[:300] if e.response is not None else ""
            last_err = f"{e} — body: {body}"
            if e.response is not None and e.response.status_code == 400:
                continue
            raise
    raise RuntimeError(f"No se encontró versión de API compatible. Último error: {last_err}")


def auth_headers(token, version):
    return {**BASE_HEADERS, "x-api-version": version, "Authorization": f"Bearer {token}"}


def get_jobs(base, headers):
    resp = requests.get(f"{base}/api/v1/jobs", headers=headers, verify=False, timeout=30)
    resp.raise_for_status()
    return resp.json().get("data", [])


SESSION_CANDIDATES = [
    "/api/v1/backupSessions",
    "/api/v1/sessions",
    "/api/v1/jobSessions",
]

REPO_CANDIDATES = [
    "/api/v1/backupRepositories",
    "/api/v1/repositories",
    "/api/v1/backupInfrastructure/repositories",
    "/api/v1/infrastructure/backupRepositories",
]


def probe_endpoints(base, headers):
    """Intenta candidatos de endpoints y devuelve el primer path que responde 200."""
    print("[ DESCUBRIMIENTO DE ENDPOINTS ]\n")
    results = {}
    for path in SESSION_CANDIDATES + REPO_CANDIDATES:
        try:
            r = requests.get(f"{base}{path}", headers=headers, verify=False, timeout=10)
            status = r.status_code
        except Exception as e:
            status = f"ERROR ({e})"
        print(f"  {status}  {path}")
        if status == 200:
            key = "sessions" if path in SESSION_CANDIDATES else "repos"
            if key not in results:
                results[key] = path
    print()
    return results


def get_sessions(base, headers, path="/api/v1/backupSessions", limit=200):
    resp = requests.get(
        f"{base}{path}",
        headers=headers,
        params={"limit": limit, "orderColumn": "CreationTime", "orderAsc": "false"},
        verify=False,
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def get_repositories(base, headers, path="/api/v1/backupRepositories"):
    resp = requests.get(
        f"{base}{path}", headers=headers, verify=False, timeout=15
    )
    resp.raise_for_status()
    return resp.json().get("data", [])


def hours_ago(iso_str):
    if not iso_str:
        return None
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        delta = datetime.now(timezone.utc) - dt
        return round(delta.total_seconds() / 3600, 1)
    except Exception:
        return None


def gb(bytes_val):
    if bytes_val is None:
        return "N/A"
    return f"{bytes_val / (1024**3):.1f} GB"


def main():
    args = parse_args()
    base = base_url(args.host, args.port)

    print(f"\n{'='*60}")
    print(f"  Veeam API Test — {args.host}:{args.port}")
    print(f"{'='*60}\n")

    print("[ AUTH ]")
    try:
        token, version = authenticate(base, args.user, args.password)
        print(f"  OK — token obtenido  (API version: {version})\n")
    except Exception as e:
        print(f"  ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    headers = auth_headers(token, version)

    discovered = probe_endpoints(base, headers)
    sessions_path = discovered.get("sessions", "/api/v1/backupSessions")
    repos_path = discovered.get("repos", "/api/v1/backupRepositories")

    # --- Jobs ---
    print("[ JOBS ]")
    try:
        jobs = get_jobs(base, headers)
        print(f"  {len(jobs)} jobs encontrados\n")
        for j in jobs:
            disabled = " [DISABLED]" if j.get("isDisabled") else ""
            print(f"  • {j.get('name','?')}{disabled}")
            print(f"    id: {j.get('id','?')}")
            print(f"    type: {j.get('type','?')}")
            print()
    except Exception as e:
        print(f"  ERROR al obtener jobs: {e}\n")
        jobs = []

    # --- Sessions (last run per job) ---
    print("[ ÚLTIMA EJECUCIÓN POR JOB ]")
    try:
        sessions = get_sessions(base, headers, path=sessions_path)
        print(f"  {len(sessions)} sesiones recuperadas (últimas {len(sessions)})\n")

        job_ids = {j.get("id"): j.get("name") for j in jobs}

        # última sesión por jobId
        last_by_job = {}
        for s in sessions:
            jid = s.get("jobId")
            if jid and jid not in last_by_job:
                last_by_job[jid] = s

        for job in jobs:
            jid = job.get("id")
            jname = job.get("name", "?")
            s = last_by_job.get(jid)
            if not s:
                print(f"  • {jname}: sin sesiones registradas")
                continue

            result_obj = s.get("result") or {}
            result = result_obj.get("result", "?")
            msg = result_obj.get("message", "")
            creation = s.get("creationTime") or s.get("creationTime")
            end = s.get("endTime")
            h = hours_ago(end or creation)
            h_str = f"{h}h atrás" if h is not None else "fecha desconocida"

            result_icon = {"Success": "✓", "Warning": "!", "Failed": "✗"}.get(result, "?")

            print(f"  {result_icon} {jname}")
            print(f"    resultado : {result}")
            print(f"    última run: {h_str}")
            if msg:
                print(f"    mensaje   : {msg[:100]}")
            print()

    except Exception as e:
        print(f"  ERROR al obtener sesiones: {e}\n")

    # --- Repositories ---
    print("[ REPOSITORIOS DE BACKUP ]")
    try:
        repos = get_repositories(base, headers, path=repos_path)
        print(f"  {len(repos)} repositorios\n")
        for r in repos:
            name = r.get("name", "?")
            capacity = r.get("capacity") or r.get("capacityGB")
            free = r.get("freeSpace") or r.get("freeSpaceGB")

            # Veeam puede devolver bytes o GB según versión — detectamos por magnitud
            if capacity and capacity > 1_000_000:
                cap_str = gb(capacity)
                free_str = gb(free)
            else:
                cap_str = f"{capacity} GB" if capacity else "N/A"
                free_str = f"{free} GB" if free else "N/A"

            used_pct = ""
            if capacity and free and capacity > 0:
                used = capacity - free
                pct = (used / capacity) * 100
                used_pct = f" ({pct:.0f}% usado)"

            print(f"  • {name}")
            print(f"    capacidad : {cap_str}")
            print(f"    disponible: {free_str}{used_pct}")
            print(f"    tipo      : {r.get('type', '?')}")
            print()

    except Exception as e:
        print(f"  ERROR al obtener repositorios: {e}\n")

    print("[ RAW — primer repositorio (list) ]")
    try:
        repos_raw = get_repositories(base, headers, path=repos_path)
        if repos_raw:
            for k, v in repos_raw[0].items():
                print(f"    {k}: {repr(v)[:80]}")
            first_id = repos_raw[0].get("id")
            if first_id:
                print()
                print(f"[ RAW — detalle repositorio {repos_raw[0].get('name')} ]")
                r = requests.get(
                    f"{base}{repos_path}/{first_id}",
                    headers=headers, verify=False, timeout=15
                )
                print(f"  status: {r.status_code}")
                if r.status_code == 200:
                    for k, v in r.json().items():
                        print(f"    {k}: {repr(v)[:80]}")
        else:
            print("  sin datos")
    except Exception as e:
        print(f"  ERROR: {e}")

    print()
    print("[ RAW — primera sesión ]")
    try:
        sessions_raw = get_sessions(base, headers, path=sessions_path, limit=1)
        if sessions_raw:
            for k, v in sessions_raw[0].items():
                print(f"    {k}: {repr(v)[:80]}")
        else:
            print("  sin datos")
    except Exception as e:
        print(f"  ERROR: {e}")

    print(f"\n{'='*60}\n")


if __name__ == "__main__":
    main()
