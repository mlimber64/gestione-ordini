import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { fakeJwt } from '../../core/testing';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([{ path: '', children: [] }]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function open() {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const type = (selector: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(selector)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
    };
    const submit = () => {
      element.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      fixture.detectChanges();
    };
    return { fixture, element, type, submit };
  }

  it('senza dati non chiama il server e segnala i campi obbligatori', () => {
    const { element, submit } = open();
    submit();

    http.expectNone('/api/v1/auth/login');
    expect(element.textContent).toContain('Inserisci il nome utente');
    expect(element.textContent).toContain('Inserisci la password');
  });

  it('con credenziali errate mostra un messaggio chiaro e resta sulla pagina', () => {
    const { fixture, element, type, submit } = open();
    type('input[formcontrolname=username]', 'anna');
    type('input[formcontrolname=password]', 'sbagliata');
    submit();

    http.expectOne('/api/v1/auth/login').flush({ detail: 'x' }, { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(element.querySelector('.error')?.textContent).toContain('Nome utente o password non corretti');
  });

  it('con credenziali giuste entra nell\'applicazione', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const { type, submit } = open();
    type('input[formcontrolname=username]', ' anna ');
    type('input[formcontrolname=password]', 'password');
    submit();

    const request = http.expectOne('/api/v1/auth/login');
    // Gli spazi attorno al nome utente si tolgono, la password non si tocca
    expect(request.request.body).toEqual({ username: 'anna', password: 'password' });
    request.flush({ accessToken: fakeJwt({ sub: 'anna', roles: ['VIEWER'] }), refreshToken: 'r', tokenType: 'Bearer', expiresIn: 900 });

    expect(navigate).toHaveBeenCalledWith(['/']);
  });

  it('se il server non risponde lo dice senza parlare di password', () => {
    const { fixture, element, type, submit } = open();
    type('input[formcontrolname=username]', 'anna');
    type('input[formcontrolname=password]', 'password');
    submit();

    http.expectOne('/api/v1/auth/login').error(new ProgressEvent('error'), { status: 0 });
    fixture.detectChanges();

    expect(element.querySelector('.error')?.textContent).toContain('Impossibile contattare il server');
  });
});
