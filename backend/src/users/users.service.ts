import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import { join } from 'path';
import { Not, Repository } from 'typeorm';
import { generateRandomPassword } from '../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRole } from './user-role.enum';
import { User } from './user.entity';

export type UserResponse = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  isActive: boolean;
  technicianId: string | null;
  odooUserId: number | null;
  odooSyncedAt: Date | null;
  odooEmployeeId: number | null;
  avatarUrl: string | null;
  createdAt: Date;
};

export type CreateUserResponse = UserResponse & { plainPassword: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({
      order: { createdAt: 'ASC' },
    });
    return users.map((u) => this.toResponse(u));
  }

  async create(dto: CreateUserDto): Promise<CreateUserResponse> {
    const existing = await this.userRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('El email ya está en uso');
    }

    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      passwordHash,
      mustChangePassword: true,
    });

    const saved = await this.userRepository.save(user);
    return { ...this.toResponse(saved), plainPassword };
  }

  async update(
    id: string,
    currentUserId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponse> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    if (dto.email) {
      const conflict = await this.userRepository.findOne({
        where: { email: dto.email, id: Not(id) },
      });
      if (conflict) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    await this.userRepository.update(id, dto);
    return this.toResponse({ ...user, ...dto });
  }

  async updateStatus(
    id: string,
    currentUserId: string,
    isActive: boolean,
  ): Promise<UserResponse> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.userRepository.update(id, { isActive });
    return this.toResponse({ ...user, isActive });
  }

  async resetPassword(
    id: string,
    currentUserId: string,
  ): Promise<{ plainPassword: string }> {
    if (id === currentUserId) {
      throw new ForbiddenException('No podés editar tu propio usuario');
    }

    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const plainPassword = generateRandomPassword();
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    await this.userRepository.update(id, {
      passwordHash,
      mustChangePassword: true,
    });
    return { plainPassword };
  }

  async getMe(userId: string): Promise<UserResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toResponse(user);
  }

  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<UserResponse> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { fromBuffer } = require('file-type');
    const detected = await fromBuffer(file.buffer);
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!detected || !allowedMimes.includes(detected.mime)) {
      throw new BadRequestException('Tipo de archivo no permitido');
    }

    const filename = `${randomUUID()}.${detected.ext}`;
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (user.avatarPath) {
      await fs.rm(
        join(process.cwd(), 'uploads', 'avatars', user.avatarPath),
        { force: true },
      );
    }

    const dir = join(process.cwd(), 'uploads', 'avatars');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(join(dir, filename), file.buffer);
    await this.userRepository.update(userId, { avatarPath: filename });

    return this.toResponse({ ...user, avatarPath: filename });
  }

  private toResponse(user: User): UserResponse {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
      isActive: user.isActive,
      technicianId: user.technicianId,
      odooUserId: user.odooUserId,
      odooSyncedAt: user.odooSyncedAt,
      odooEmployeeId: user.odooEmployeeId,
      avatarUrl: user.avatarPath ? `/avatars/${user.avatarPath}` : null,
      createdAt: user.createdAt,
    };
  }
}
