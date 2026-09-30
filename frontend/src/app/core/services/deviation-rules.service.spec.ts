import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DeviationRulesService } from './deviation-rules.service';
import { AvailableDeviationSignal, DeviationRuleDto } from '../models/deviation-rule.models';
import { environment } from '../../../environments/environment';

describe('DeviationRulesService', () => {
  let service: DeviationRulesService;
  let http: HttpTestingController;
  const base = `${environment.apiUrl}/deviation-rules`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DeviationRulesService],
    });
    service = TestBed.inject(DeviationRulesService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('getAll hace GET a /deviation-rules', () => {
    const mock: DeviationRuleDto[] = [];
    service.getAll().subscribe(r => expect(r).toEqual(mock));
    http.expectOne(base).flush(mock);
  });

  it('getAvailableSignals hace GET a /deviation-rules/signals', () => {
    const mock: AvailableDeviationSignal[] = [
      { taskType: 'QNAP_MAINTENANCE', key: 'maxUsedSpacePct', label: '% usado', valueType: 'number' },
    ];
    service.getAvailableSignals().subscribe(r => expect(r).toEqual(mock));
    http.expectOne(`${base}/signals`).flush(mock);
  });

  it('create hace POST a /deviation-rules', () => {
    const payload = { taskType: 'QNAP_MAINTENANCE' as const, signalKey: 'maxUsedSpacePct', operator: 'gt' as const, thresholdNumber: 90 };
    service.create(payload).subscribe();
    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({});
  });

  it('update hace PATCH a /deviation-rules/:id', () => {
    service.update('rule-1', { enabled: false }).subscribe();
    const req = http.expectOne(`${base}/rule-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ enabled: false });
    req.flush({});
  });

  it('remove hace DELETE a /deviation-rules/:id', () => {
    service.remove('rule-1').subscribe();
    const req = http.expectOne(`${base}/rule-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });
});
