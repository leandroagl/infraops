import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from './app-notification.entity';
import { UserNotificationRead } from './user-notification-read.entity';

const makeQb = (getMany: any[] = []) => {
  const qb: any = {
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(getMany),
    insert: jest.fn().mockReturnThis(),
    into: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    orIgnore: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };
  return qb;
};

const makeNotif = (id: string) => ({
  id, type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME' }, createdAt: new Date(),
});

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let notifRepo: { save: jest.Mock; findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let readRepo: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    notifRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    readRepo = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppNotificationsService,
        { provide: getRepositoryToken(AppNotification), useValue: notifRepo },
        { provide: getRepositoryToken(UserNotificationRead), useValue: readRepo },
      ],
    }).compile();

    service = module.get<AppNotificationsService>(AppNotificationsService);
  });

  describe('create', () => {
    it('persiste tipo y payload y devuelve la notificación guardada', async () => {
      const saved = makeNotif('n-1');
      notifRepo.save.mockResolvedValue(saved);

      const result = await service.create('EXPIRATION_TICKET_CREATED', { clientName: 'ACME' });

      expect(notifRepo.save).toHaveBeenCalledWith({
        type: 'EXPIRATION_TICKET_CREATED',
        payload: { clientName: 'ACME' },
      });
      expect(result).toEqual(saved);
    });
  });

  describe('getUnreadForUser', () => {
    it('devuelve las notificaciones del QueryBuilder para el userId dado', async () => {
      const notifications = [makeNotif('n-1')];
      const qb = makeQb(notifications);
      notifRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.getUnreadForUser('user-1');

      expect(notifRepo.createQueryBuilder).toHaveBeenCalledWith('n');
      expect(qb.where).toHaveBeenCalledWith('unr.id IS NULL');
      expect(result).toEqual(notifications);
    });

    it('devuelve array vacío si no hay no leídas', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeQb([]));
      expect(await service.getUnreadForUser('user-1')).toEqual([]);
    });
  });

  describe('markAsRead', () => {
    it('lanza NotFoundException si la notificación no existe', async () => {
      notifRepo.findOne.mockResolvedValue(null);
      await expect(service.markAsRead('user-1', 'n-missing')).rejects.toThrow(NotFoundException);
    });

    it('inserta la lectura cuando la notificación existe', async () => {
      notifRepo.findOne.mockResolvedValue({ id: 'n-1' });
      const qb = makeQb();
      readRepo.createQueryBuilder.mockReturnValue(qb);

      await service.markAsRead('user-1', 'n-1');

      expect(qb.values).toHaveBeenCalledWith({ userId: 'user-1', notificationId: 'n-1' });
      expect(qb.orIgnore).toHaveBeenCalled();
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  describe('markAllAsRead', () => {
    it('no inserta nada si no hay no leídas', async () => {
      notifRepo.createQueryBuilder.mockReturnValue(makeQb([]));

      await service.markAllAsRead('user-1');

      expect(readRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('inserta una fila por cada notificación no leída', async () => {
      const notifications = [makeNotif('n-1'), makeNotif('n-2')];
      notifRepo.createQueryBuilder.mockReturnValue(makeQb(notifications));
      const qb = makeQb();
      readRepo.createQueryBuilder.mockReturnValue(qb);

      await service.markAllAsRead('user-1');

      expect(qb.values).toHaveBeenCalledWith([
        { userId: 'user-1', notificationId: 'n-1' },
        { userId: 'user-1', notificationId: 'n-2' },
      ]);
      expect(qb.orIgnore).toHaveBeenCalled();
    });
  });
});
