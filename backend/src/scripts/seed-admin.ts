import 'reflect-metadata';
import { config } from 'dotenv';
config();

import { DataSource } from 'typeorm';
import bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';
import { generateRandomPassword } from '../common/utils/password.util';

const SEED_EMAIL = 'admininfraops@ondra.com.ar';

async function seed(): Promise<void> {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'infraops',
    entities: [User],
    synchronize: false,
  });

  await dataSource.initialize();

  let plainPassword: string | null = null;

  try {
    const userRepository = dataSource.getRepository(User);

    const existing = await userRepository.findOne({
      where: { role: UserRole.ADMIN },
    });

    if (existing) {
      process.stdout.write(`El usuario admin ya existe (${existing.email}). Seed omitido.\n`);
      return;
    }

    plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const admin = userRepository.create({
      email: SEED_EMAIL,
      passwordHash,
      role: UserRole.ADMIN,
      mustChangePassword: true,
      isActive: true,
    });

    await userRepository.save(admin);
  } finally {
    await dataSource.destroy();
  }

  if (!plainPassword) return;

  process.stdout.write('\n─────────────────────────────────────────────\n');
  process.stdout.write('Usuario admin creado:\n');
  process.stdout.write(`  Email:      ${SEED_EMAIL}\n`);
  process.stdout.write(`  Contraseña: ${plainPassword}\n`);
  process.stdout.write('  Guardá esta contraseña — no se volverá a mostrar.\n');
  process.stdout.write('─────────────────────────────────────────────\n\n');
}

seed().catch((err: unknown) => {
  process.stderr.write(`Error en seed: ${String(err)}\n`);
  process.exit(1);
});
