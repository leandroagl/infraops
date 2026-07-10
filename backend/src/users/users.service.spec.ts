import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import * as passwordUtil from '../common/utils/password.util';
import * as cryptoUtil from '../common/utils/crypto.util';
import { OdooUserRpcService } from '../integrations/odoo/odoo-user-rpc.service';
import { ConfigService } from '@nestjs/config';
import { User } from './user.entity';
import { UserRole } from './user-role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOdooCredentialsDto } from './dto/update-odoo-credentials.dto';
import { UsersService } from './users.service';

jest.mock('bcrypt');
jest.mock('../common/utils/password.util');
jest.mock('../common/utils/crypto.util');

describe('UsersService', () => {
  let service: UsersService;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let odooUserRpc: { validateCredentials: jest.Mock };
  let configService: { getOrThrow: jest.Mock };

  const mockUser: User = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    passwordHash: 'hashed_password',
    role: UserRole.TL,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: null,
    technician: null,
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    odooApiEmail: null,
    odooApiKeyEnc: null,
    odooKeyValid: false,
    odooKeyValidatedAt: null,
    odooExempt: false,
    createdAt: new Date('2026-01-01'),
  };

  const userResponse = {
    id: 'user-1',
    name: 'Lea Aguilera',
    email: 'lea@ondra.com',
    role: UserRole.TL,
    mustChangePassword: false,
    isActive: true,
    technicianId: null,
    odooUserId: null,
    odooSyncedAt: null,
    odooEmployeeId: null,
    odooApiEmail: null,
    odooApiKeyEnc: null,
    odooKeyValid: false,
    odooKeyValidatedAt: null,
    odooExempt: false,
    createdAt: mockUser.createdAt,
  };

  beforeEach(async () => {
    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    odooUserRpc = { validateCredentials: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('a'.repeat(64)) };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        { provide: OdooUserRpcService, useValue: odooUserRpc },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('devuelve lista de usuarios sin passwordHash ni lastLogoutAt', async () => {
      userRepository.find.mockResolvedValue([mockUser]);

      const result = await service.findAll();

      expect(result).toEqual([userResponse]);
      expect(userRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const dto: CreateUserDto = {
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
    };

    const savedUser: User = {
      ...mockUser,
      id: 'user-2',
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
      passwordHash: 'hashed_plain123',
      mustChangePassword: true,
    };

    it('crea usuario, hashea la contraseña y devuelve plainPassword', async () => {
      userRepository.findOne.mockResolvedValue(null);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue(
        'plain123',
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_plain123');
      userRepository.create.mockReturnValue(savedUser);
      userRepository.save.mockResolvedValue(savedUser);

      const result = await service.create(dto);

      expect(result.plainPassword).toBe('plain123');
      expect(result.email).toBe('valen@ondra.com');
      expect(result).not.toHaveProperty('passwordHash');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Valen López',
          email: 'valen@ondra.com',
          role: UserRole.TECHNICIAN,
          passwordHash: 'hashed_plain123',
          mustChangePassword: true,
        }),
      );
    });

    it('lanza ConflictException si el email ya existe', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    const dto: UpdateUserDto = { email: 'nuevo@ondra.com' };

    it('actualiza campos y devuelve usuario sin passwordHash', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce(null); // sin conflicto de email
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('user-1', 'admin-id', dto);

      expect(result).toEqual({ ...userResponse, email: 'nuevo@ondra.com' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', dto);
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.update('user-1', 'user-1', dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', 'admin-id', dto),
      ).rejects.toThrow(NotFoundException);
    });

    it('lanza ConflictException si el email ya pertenece a otro usuario', async () => {
      userRepository.findOne.mockResolvedValueOnce(mockUser);
      userRepository.findOne.mockResolvedValueOnce({
        ...mockUser,
        id: 'other-user',
      });

      await expect(service.update('user-1', 'admin-id', dto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('updateStatus', () => {
    it('actualiza isActive y devuelve el usuario actualizado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('user-1', 'admin-id', false);

      expect(result.isActive).toBe(false);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        isActive: false,
      });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(
        service.updateStatus('user-1', 'user-1', false),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'admin-id', false),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetPassword', () => {
    it('genera nueva contraseña, setea mustChangePassword y devuelve solo el texto plano', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (passwordUtil.generateRandomPassword as jest.Mock).mockReturnValue(
        'newplain456',
      );
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed_newplain456');
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.resetPassword('user-1', 'admin-id');

      expect(result).toEqual({ plainPassword: 'newplain456' });
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        passwordHash: 'hashed_newplain456',
        mustChangePassword: true,
      });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(service.resetPassword('user-1', 'user-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resetPassword('nonexistent', 'admin-id'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getMe', () => {
    it('devuelve MeResponseDto sin datos sensibles', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getMe('user-1');

      expect(result).toEqual({
        id: 'user-1',
        name: 'Lea Aguilera',
        email: 'lea@ondra.com',
        role: UserRole.TL,
        technicianId: null,
        odooKeyValid: false,
        odooKeyValidatedAt: null,
        odooApiEmail: null,
        odooExempt: false,
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('odooApiKeyEnc');
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getMe('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateOdooCredentials', () => {
    const dto: UpdateOdooCredentialsDto = {
      odooApiEmail: 'lea@ondra.com',
      odooApiKey: 'api-key-123',
    };

    it('valida credenciales, cifra la key y actualiza el usuario', async () => {
      odooUserRpc.validateCredentials.mockResolvedValue(undefined);
      configService.getOrThrow.mockReturnValue('a'.repeat(64));
      (cryptoUtil.encrypt as jest.Mock).mockReturnValue('iv:encrypted');
      userRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateOdooCredentials('user-1', dto);

      expect(odooUserRpc.validateCredentials).toHaveBeenCalledWith(
        'lea@ondra.com',
        'api-key-123',
      );
      expect(cryptoUtil.encrypt).toHaveBeenCalledWith('api-key-123', 'a'.repeat(64));
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        odooApiEmail: 'lea@ondra.com',
        odooApiKeyEnc: 'iv:encrypted',
        odooKeyValid: true,
        odooKeyValidatedAt: expect.any(Date),
      });
    });

    it('propaga la excepción si validateCredentials falla', async () => {
      odooUserRpc.validateCredentials.mockRejectedValue(
        new BadRequestException('Credenciales Odoo inválidas'),
      );

      await expect(
        service.updateOdooCredentials('user-1', dto),
      ).rejects.toThrow(BadRequestException);

      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe('updateOdooExempt', () => {
    it('actualiza odooExempt y devuelve el usuario actualizado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateOdooExempt('user-1', 'admin-id', true);

      expect(result.odooExempt).toBe(true);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', { odooExempt: true });
    });

    it('lanza ForbiddenException si el id coincide con el usuario actual', async () => {
      await expect(
        service.updateOdooExempt('user-1', 'user-1', true),
      ).rejects.toThrow(ForbiddenException);
    });

    it('lanza NotFoundException si el usuario no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateOdooExempt('nonexistent', 'admin-id', true),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
