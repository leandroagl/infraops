import { of } from 'rxjs';
import { VmwareApiService } from './vmware-api.service';

describe('VmwareApiService', () => {
  let service: VmwareApiService;
  let mockHttp: { post: jasmine.Spy };

  beforeEach(() => {
    mockHttp = { post: jasmine.createSpy('post') };
    service = new VmwareApiService(mockHttp as any);
  });

  it('llama a POST /integrations/vmware/health-check con el hostUri', () => {
    mockHttp.post.and.returnValue(of({ host: { name: 'esxi01' } }));
    service.healthCheck('esxi.cliente.com:344').subscribe();
    expect(mockHttp.post).toHaveBeenCalledWith(
      jasmine.stringContaining('/integrations/vmware/health-check'),
      { hostUri: 'esxi.cliente.com:344' },
    );
  });

  it('retorna el Observable del HttpClient directamente', (done) => {
    const mockResult = { host: { name: 'esxi01' } };
    mockHttp.post.and.returnValue(of(mockResult));
    service.healthCheck('esxi.cliente.com:344').subscribe((result: any) => {
      expect(result).toEqual(mockResult);
      done();
    });
  });
});
