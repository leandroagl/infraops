import { BadGatewayException, GatewayTimeoutException, Injectable } from '@nestjs/common';
import { spawn } from 'child_process';
import { join } from 'path';
import { IntegrationConfigService } from '../../integration-config/integration-config.service';
import { VmwareHealthResult } from './dto/vmware-health-result.dto';

const TIMEOUT_MS = 30_000;

@Injectable()
export class VmwareService {
  constructor(private readonly integrationConfigService: IntegrationConfigService) {}

  async runHealthCheck(hostUri: string): Promise<VmwareHealthResult> {
    const colonIdx = hostUri.lastIndexOf(':');
    const host = colonIdx > 0 ? hostUri.slice(0, colonIdx) : hostUri;
    const port = colonIdx > 0 ? hostUri.slice(colonIdx + 1) : '443';
    const script = join(process.cwd(), 'collectors', 'vmware', 'vmware_health.py');
    const creds = await this.integrationConfigService.getVmwareConfigDecrypted();

    return new Promise<VmwareHealthResult>((resolve, reject) => {
      const proc = spawn('python3', [
        script, '--host', host, '--port', port,
        '--user', creds.username, '--pass', creds.password,
      ]);
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (c: Buffer) => { stdout += c.toString(); });
      proc.stderr.on('data', (c: Buffer) => { stderr += c.toString(); });
      const timer = setTimeout(() => { proc.kill('SIGTERM'); reject(new GatewayTimeoutException('El host ESXi no respondió en 30 segundos')); }, TIMEOUT_MS);
      proc.on('close', (code: number | null) => {
        clearTimeout(timer);
        if (code !== 0) { reject(new BadGatewayException(stderr.trim() || 'Error al ejecutar el health check de VMware')); return; }
        try { resolve(JSON.parse(stdout) as VmwareHealthResult); }
        catch { reject(new BadGatewayException('Respuesta inválida del script Python')); }
      });
    });
  }
}
