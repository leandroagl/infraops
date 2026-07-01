#!/usr/bin/env python3
"""
ESXi health check via pyVmomi.
Outputs a single JSON object to stdout matching VmwareHealthResult.
"""
import argparse
import json
import sys
from datetime import datetime, timezone

try:
    from pyVim.connect import SmartConnect, Disconnect
    from pyVmomi import vim
    import ssl
except ImportError:
    print(
        "pyVmomi no instalado. Ejecutá: pip install pyVmomi",
        file=sys.stderr,
    )
    sys.exit(1)


def connect(host: str, port: int, user: str, password: str):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return SmartConnect(host=host, port=port, user=user, pwd=password, sslContext=ctx)


def overall_to_str(status) -> str:
    mapping = {
        vim.ManagedEntity.Status.green:  "green",
        vim.ManagedEntity.Status.yellow: "yellow",
        vim.ManagedEntity.Status.red:    "red",
    }
    return mapping.get(status, "yellow")


def collect(si) -> dict:
    content = si.RetrieveContent()
    container = content.viewManager.CreateContainerView(
        content.rootFolder, [vim.HostSystem], True
    )
    hosts = container.view
    container.Destroy()

    if not hosts:
        print("No se encontró ningún host ESXi", file=sys.stderr)
        sys.exit(1)

    host = hosts[0]
    summary = host.summary
    hw = summary.hardware
    runtime = summary.runtime
    quick = summary.quickStats

    # ---- host info ----
    cpu_total_mhz = hw.numCpuCores * hw.cpuMhz
    cpu_usage_pct = round(quick.overallCpuUsage / cpu_total_mhz * 100, 1) if cpu_total_mhz else 0

    mem_total_mb = hw.memorySize / (1024 * 1024)
    mem_usage_pct = round(quick.overallMemoryUsage / mem_total_mb * 100, 1) if mem_total_mb else 0

    # memory overcommit: sum of all VM configured RAM / physical RAM
    vms_all = host.vm or []
    total_vm_mem_mb = sum((v.config.hardware.memoryMB for v in vms_all if v.config), 0)
    mem_overcommit = round(total_vm_mem_mb / mem_total_mb, 2) if mem_total_mb else 0.0

    hardware_alerts = [
        s.message for s in (host.configIssue or [])
        if hasattr(s, "message")
    ]

    host_info = {
        "name": summary.config.name,
        "esxiVersion": summary.config.product.fullName,
        "uptimeHours": round(runtime.bootTime and
                             (datetime.now(timezone.utc) -
                              runtime.bootTime.replace(tzinfo=timezone.utc)).total_seconds() / 3600
                             or 0, 1),
        "cpuUsagePct": cpu_usage_pct,
        "memUsagePct": mem_usage_pct,
        "memOvercommitRatio": mem_overcommit,
        "overallStatus": overall_to_str(summary.overallStatus),
        "hardwareAlerts": hardware_alerts,
    }

    # ---- datastores ----
    datastores = []
    for ds in (host.datastore or []):
        s = ds.summary
        capacity_gb = round(s.capacity / (1024 ** 3), 2)
        free_gb = round(s.freeSpace / (1024 ** 3), 2)
        used_pct = round((1 - s.freeSpace / s.capacity) * 100, 1) if s.capacity else 0
        datastores.append({
            "name": s.name,
            "type": s.type,
            "capacityGb": capacity_gb,
            "freeGb": free_gb,
            "usedPct": used_pct,
            "accessible": s.accessible,
        })

    # ---- VMs ----
    powered_on = powered_off = suspended = tools_not_ok = 0
    snapshots = []

    for vm in vms_all:
        if not vm.config:
            continue
        state = vm.runtime.powerState
        if state == vim.VirtualMachine.PowerState.poweredOn:
            powered_on += 1
        elif state == vim.VirtualMachine.PowerState.poweredOff:
            powered_off += 1
        elif state == vim.VirtualMachine.PowerState.suspended:
            suspended += 1

        tools = vm.guest.toolsStatus if vm.guest else None
        if tools in (
            vim.vm.GuestInfo.ToolsStatus.toolsNotInstalled,
            vim.vm.GuestInfo.ToolsStatus.toolsNotRunning,
        ):
            tools_not_ok += 1

        # snapshots
        snap_info = vm.snapshot
        if snap_info and snap_info.rootSnapshotList:
            count, oldest = _count_snapshots(snap_info.rootSnapshotList)
            if count:
                now = datetime.now(timezone.utc)
                oldest_dt = oldest.replace(tzinfo=timezone.utc) if oldest.tzinfo is None else oldest
                days = (now - oldest_dt).days
                snapshots.append({
                    "vmName": vm.config.name,
                    "count": count,
                    "oldestDays": days,
                })

    vms_info = {
        "poweredOn": powered_on,
        "poweredOff": powered_off,
        "suspended": suspended,
        "snapshots": snapshots,
        "toolsNotOk": tools_not_ok,
    }

    # ---- network ----
    vswitch_errors = []
    nics_failed = []
    net_config = host.config.network if host.config else None
    if net_config:
        for vswitch in (net_config.vswitch or []):
            if not vswitch.spec.numPorts:
                vswitch_errors.append(f"{vswitch.name}: sin puertos configurados")
        for pnic in (net_config.pnic or []):
            if not pnic.linkSpeed:
                nics_failed.append(pnic.device)

    return {
        "host": host_info,
        "datastores": datastores,
        "vms": vms_info,
        "network": {
            "vswitchErrors": vswitch_errors,
            "nicsFailed": nics_failed,
        },
        "collectedAt": datetime.now(timezone.utc).isoformat(),
    }


def _count_snapshots(snap_list) -> tuple[int, datetime | None]:
    count = 0
    oldest = None
    for snap in snap_list:
        count += 1
        if oldest is None or snap.createTime < oldest:
            oldest = snap.createTime
        child_count, child_oldest = _count_snapshots(snap.childSnapshotList)
        count += child_count
        if child_oldest and (oldest is None or child_oldest < oldest):
            oldest = child_oldest
    return count, oldest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host",  required=True)
    parser.add_argument("--port",  type=int, default=443)
    parser.add_argument("--user",  required=True)
    parser.add_argument("--pass",  dest="password", required=True)
    args = parser.parse_args()

    # Strip protocol prefix if present (e.g. "https://host" → "host")
    host = args.host
    for prefix in ("https://", "http://"):
        if host.startswith(prefix):
            host = host[len(prefix):]
            break

    try:
        si = connect(host, args.port, args.user, args.password)
    except Exception as e:
        print(f"Error conectando a {host}:{args.port} — {e}", file=sys.stderr)
        sys.exit(1)

    try:
        result = collect(si)
        print(json.dumps(result))
    finally:
        Disconnect(si)


if __name__ == "__main__":
    main()
