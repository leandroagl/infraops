// backend/src/integrations/jetbackup/jetbackup.module.ts
import * as https from 'https';
import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JetbackupService } from './jetbackup.service';

// El WHM suele usar un certificado autofirmado, igual que los servidores Veeam.
@Module({
  imports: [HttpModule.register({ httpsAgent: new https.Agent({ rejectUnauthorized: false }) })],
  providers: [JetbackupService],
  exports: [JetbackupService],
})
export class JetbackupModule {}
