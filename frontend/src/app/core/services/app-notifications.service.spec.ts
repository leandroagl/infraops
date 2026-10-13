import { TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { AppNotificationsService } from './app-notifications.service';
import { AppNotification } from '../models/app-notification.models';
import { environment } from '../../../environments/environment';

const makeNotif = (id: string): AppNotification => ({
  id,
  type: 'EXPIRATION_TICKET_CREATED',
  payload: { clientName: 'ACME', expirationType: 'domain', itemName: 'acme.com', daysUntil: 5, odooTicketId: 100 },
  createdAt: '2026-10-12T08:00:00Z',
});

describe('AppNotificationsService', () => {
  let service: AppNotificationsService;
  let httpMock: HttpTestingController;
  const url = `${environment.apiUrl}/app-notifications`;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(AppNotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stopPolling();
    httpMock.verify();
  });

  it('emite la lista recibida al iniciar el polling (primera request inmediata)', fakeAsync(() => {
    const notifications = [makeNotif('n-1')];
    service.startPolling();

    httpMock.expectOne(url).flush(notifications);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual(notifications);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
    discardPeriodicTasks();
  }));

  it('no lanza un segundo polling si startPolling ya está activo', fakeAsync(() => {
    service.startPolling();
    service.startPolling();

    const reqs = httpMock.match(url);
    expect(reqs.length).toBe(1);
    reqs[0].flush([]);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
    discardPeriodicTasks();
  }));

  it('stopPolling detiene las requests periódicas', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([]);
    service.stopPolling();

    tick(60_000);
    httpMock.expectNone(url);
  }));

  it('markAsRead filtra la notificación del subject local antes de recibir respuesta HTTP', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    service.markAsRead('n-1');
    httpMock.expectOne(`${url}/n-1/read`).flush(null);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result!.map(n => n.id)).toEqual(['n-2']);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
    discardPeriodicTasks();
  }));

  it('markAllAsRead vacía el subject local antes de recibir respuesta HTTP', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    service.markAllAsRead();
    httpMock.expectOne(`${url}/read-all`).flush(null);

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual([]);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
    discardPeriodicTasks();
  }));

  it('unreadCount$ emite el número de notificaciones actuales', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).flush([makeNotif('n-1'), makeNotif('n-2')]);

    let count: number | undefined;
    service.unreadCount$.subscribe(c => (count = c));
    expect(count).toBe(2);

    tick(60_000);
    httpMock.expectOne(url).flush([]);
    discardPeriodicTasks();
  }));

  it('un error HTTP en el poll no rompe la suscripción — próximo tick sigue funcionando', fakeAsync(() => {
    service.startPolling();
    httpMock.expectOne(url).error(new ErrorEvent('network error'));

    let result: AppNotification[] | undefined;
    service.notifications.subscribe(n => (result = n));
    expect(result).toEqual([]);

    tick(60_000);
    httpMock.expectOne(url).flush([makeNotif('n-1')]);
    expect(result!.length).toBe(1);
    discardPeriodicTasks();
  }));
});
