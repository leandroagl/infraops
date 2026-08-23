import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { Between, DataSource } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Client } from '../clients/client.entity';
import { Technician } from '../technicians/technician.entity';
import { User } from '../users/user.entity';

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find(a => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

function monthRange(year: number, month: number): { firstDay: string; lastDay: string } {
  const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const lastDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDayNum).padStart(2, '0')}`;
  return { firstDay, lastDay };
}

async function resetMonth(): Promise<void> {
  if (process.env.ALLOW_TASK_RESET !== 'true') {
    process.stderr.write(
      'reset-month está deshabilitado: falta ALLOW_TASK_RESET=true en el .env de este servidor. Abortado.\n',
    );
    process.exit(1);
  }

  const year = parseInt(parseArg('year') ?? '', 10);
  const month = parseInt(parseArg('month') ?? '', 10);
  const confirm = process.argv.includes('--confirm');

  if (!year || !month || month < 1 || month > 12) {
    process.stderr.write(
      'Uso: npm run db:reset-month -- --year=YYYY --month=MM [--confirm]\n',
    );
    process.exit(1);
  }

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'infraops',
    entities: [Task, MaintenanceLog, Client, Technician, User],
    synchronize: false,
  });

  await dataSource.initialize();

  try {
    const taskRepository = dataSource.getRepository(Task);
    const logRepository = dataSource.getRepository(MaintenanceLog);

    const { firstDay, lastDay } = monthRange(year, month);
    const tasks = await taskRepository.find({
      where: { scheduledDate: Between(firstDay, lastDay) as unknown as string },
    });

    if (tasks.length === 0) {
      process.stdout.write(`No hay tareas para ${year}-${String(month).padStart(2, '0')}.\n`);
      return;
    }

    const withOdooTicket = tasks.filter(t => t.odooTicketId !== null);

    process.stdout.write(
      `${tasks.length} tarea(s) encontradas para ${year}-${String(month).padStart(2, '0')} ` +
        `(${withOdooTicket.length} con ticket Odoo asociado, que quedará huérfano).\n`,
    );

    if (!confirm) {
      process.stdout.write('Dry-run: no se borró nada. Repetí el comando con --confirm para aplicar.\n');
      return;
    }

    for (const task of tasks) {
      await logRepository.delete({ taskId: task.id });
    }
    await taskRepository.delete(tasks.map(t => t.id));

    process.stdout.write(`${tasks.length} tarea(s) borradas de InfraOps.\n`);
    if (withOdooTicket.length > 0) {
      process.stdout.write(
        `Tickets Odoo huérfanos (no se tocaron): ${withOdooTicket.map(t => t.odooTicketId).join(', ')}\n`,
      );
    }
  } finally {
    await dataSource.destroy();
  }
}

resetMonth().catch((err: unknown) => {
  process.stderr.write(`Error en reset-month: ${String(err)}\n`);
  process.exit(1);
});
