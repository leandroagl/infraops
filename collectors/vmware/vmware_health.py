#!/usr/bin/env python3
"""VMware ESXi standalone health collector. JSON a stdout, errores a stderr."""
import argparse
import json
import ssl
import sys
from datetime import datetime, timezone

from pyVim.connect import SmartConnect, Disconnect
from pyVmomi import vim


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument('--host', required=True)
    p.add_argument('--port', type=int, required=True)
    p.add_argument('--user', required=True)
    p.add_argument('--pass', dest='password', required=True)
    return p.parse_args()


def get_all(content, vimtype):
    view = content.viewManager.CreateContainerView(content.rootFolder, vimtype, True)
    objs = list(view.view)
    view.Destroy()
    return objs


def collect_host(host):
    summary = host.summary
    qs = summary.quickStats
    hw = summary.hardware

    boot = getattr(summary.runtime, 'bootTime', None)
    if boot:
        now = datetime.now(timezone.utc)
        boot_utc = boot.replace(tzinfo=timezone.utc) if boot.tzinfo is None else boot
        uptime_hours = round((now - boot_utc).total_seconds() / 3600, 1)
    else:
        uptime_hours = 0.0

    if hw and hw.numCpuCores and hw.cpuMhz:
        cpu_pct = round((qs.overallCpuUsage / (hw.numCpuCores * hw.cpuMhz)) * 100, 1)
    else:
        cpu_pct = 0.0

    if hw and hw.memorySize:
        mem_pct = round((qs.overallMemoryUsage / (hw.memorySize / (1024 * 1024))) * 100, 1)
    else:
        mem_pct = 0.0

    raw_status = str(summary.overallStatus)
    if raw_status not in ('green', 'yellow', 'red'):
        raw_status = 'green'

    alerts = []
    health_runtime = getattr(summary.runtime, 'healthSystemRuntime', None)
    if health_runtime:
        sys_health = getattr(health_runtime, 'systemHealthInfo', None)
        if sys_health:
            for sensor in (sys_health.numericSensorInfo or []):
                if str(sensor.healthState.key) in ('red', 'yellow'):
                    alerts.append(f"{sensor.name}: {sensor.healthState.label}")

    return {
        'name': summary.config.name,
        'esxiVersion': (
            f"VMware ESXi {summary.config.product.version} "
            f"build-{summary.config.product.build}"
        ),
        'uptimeHours': uptime_hours,
        'cpuUsagePct': cpu_pct,
        'memUsagePct': mem_pct,
        'overallStatus': raw_status,
        'hardwareAlerts': alerts,
    }



def collect_datastores(host):
    result = []
    for ds in (host.datastore or []):
        s = ds.summary
        cap = s.capacity or 0
        free = s.freeSpace or 0
        used_pct = round(((cap - free) / cap) * 100, 1) if cap else 0.0
        result.append({
            'name': s.name,
            'type': s.type,
            'capacityGb': round(cap / (1024 ** 3), 1),
            'freeGb': round(free / (1024 ** 3), 1),
            'usedPct': used_pct,
            'accessible': bool(s.accessible),
        })
    return result


def _flatten_snaptree(tree_list):
    result = []
    for node in (tree_list or []):
        result.append(node)
        result.extend(_flatten_snaptree(node.childSnapshotList))
    return result


def collect_vms(host, all_vms):
    host_id = host._moId
    host_vms = [
        vm for vm in all_vms
        if vm.runtime.host and vm.runtime.host._moId == host_id
    ]

    states = {'poweredOn': 0, 'poweredOff': 0, 'suspended': 0}
    for vm in host_vms:
        raw = str(vm.runtime.powerState)
        for key in states:
            if key in raw:
                states[key] += 1
                break

    now = datetime.now(timezone.utc)
    snapshots = []
    for vm in host_vms:
        if not vm.snapshot:
            continue
        nodes = _flatten_snaptree(vm.snapshot.rootSnapshotList)
        if not nodes:
            continue
        oldest = min(nodes, key=lambda n: n.createTime)
        ct = oldest.createTime
        if ct.tzinfo is None:
            ct = ct.replace(tzinfo=timezone.utc)
        snapshots.append({
            'vmName': vm.name,
            'count': len(nodes),
            'oldestDays': (now - ct).days,
        })

    tools_not_ok = sum(
        1 for vm in host_vms
        if 'poweredOn' in str(vm.runtime.powerState)
        and (vm.guest is None or str(vm.guest.toolsStatus) not in ('toolsOk', 'toolsOld'))
    )

    return {
        'poweredOn': states['poweredOn'],
        'poweredOff': states['poweredOff'],
        'suspended': states['suspended'],
        'snapshotTotal': sum(s['count'] for s in snapshots),
        'snapshots': snapshots,
        'toolsNotOk': tools_not_ok,
    }


def collect_network(host):
    net = host.config.network
    vswitch_errors = [
        f"{vs.name}: sin uplinks físicos"
        for vs in (net.vswitch or [])
        if not vs.pnic
    ]
    nics_failed = []
    nics_online = []
    for pnic in (net.pnic or []):
        if pnic.linkSpeed:
            nics_online.append({
                'device': pnic.device,
                'speedMb': pnic.linkSpeed.speedMb,
            })
        else:
            nics_failed.append(pnic.device)
    return {
        'vswitchErrors': vswitch_errors,
        'nicsFailed': nics_failed,
        'nicsOnline': nics_online,
    }


def main():
    args = parse_args()

    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    si = SmartConnect(
        host=args.host, port=args.port,
        user=args.user, pwd=args.password,
        sslContext=ctx,
    )
    try:
        content = si.RetrieveContent()
        all_vms = get_all(content, [vim.VirtualMachine])
        hosts = get_all(content, [vim.HostSystem])

        if not hosts:
            raise RuntimeError('No se encontró ningún host ESXi en el inventario')

        host = hosts[0]
        host_data = collect_host(host)

        print(json.dumps({
            'host': host_data,
            'datastores': collect_datastores(host),
            'vms': collect_vms(host, all_vms),
            'network': collect_network(host),
            'collectedAt': datetime.now(timezone.utc).isoformat(),
        }))
    finally:
        Disconnect(si)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
