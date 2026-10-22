import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import {
  MapLocationMaintenanceService,
  type MapLocationMaintenanceReport,
} from '../modules/map-location/map-location-maintenance.service';

function readNumberArgument(name: string, fallback: number): number {
  const raw = process.argv.find((argument) => argument.startsWith(`${name}=`));
  if (!raw) return fallback;
  const value = Number(raw.slice(name.length + 1));
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} phải là số nguyên dương`);
  }
  return value;
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const service = app.get(MapLocationMaintenanceService);
    const retryArg = process.argv.find((argument) =>
      argument.startsWith('--retry='),
    );
    let report: MapLocationMaintenanceReport;
    if (retryArg) {
      const requested = retryArg.slice('--retry='.length).split(',');
      const statuses = requested.filter(
        (status): status is 'failed' | 'unresolved' =>
          status === 'failed' || status === 'unresolved',
      );
      if (statuses.length === 0 || statuses.length !== requested.length) {
        throw new Error('--retry chỉ nhận failed, unresolved hoặc cả hai');
      }
      report = await service.retry(statuses);
    } else {
      report = await service.backfill({
        dryRun: process.argv.includes('--dry-run'),
        batchSize: readNumberArgument('--batch-size', 100),
      });
    }
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown error';
  process.stderr.write(`Map-location maintenance failed: ${message}\n`);
  process.exitCode = 1;
});
