import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import { generateRandomPassword } from '../common/utils/password.util';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './user.entity';

export type UserResponse = Omit<User, 'passwordHash' | 'lastLogoutAt' | 'technician'>;
export type CreateUserResponse = UserResponse & { plainPassword: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<UserResponse[]> {
    const users = await this.userRepository.find({ order: { createdAt: 'ASC' } });
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
    return this.toResponse({ ...user, ...dto } as User);
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

    await this.userRepository.update(id, { passwordHash, mustChangePassword: true });
    return { plainPassword };
  }

  private toResponse(user: User): UserResponse {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, lastLogoutAt, technician, ...response } = user;
    return response;
  }
}