import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BREVO_ENDPOINT, MailService, parseSender } from './mail.service';

const configWith = (values: Record<string, string | undefined>): ConfigService =>
  ({ get: (key: string) => values[key] }) as unknown as ConfigService;

describe('parseSender', () => {
  it('separa nombre y correo', () => {
    expect(parseSender('SIVEN · NORCOR <avisos@norcor.com>')).toEqual({ name: 'SIVEN · NORCOR', email: 'avisos@norcor.com' });
  });
  it('acepta el nombre entre comillas', () => {
    expect(parseSender('"SIVEN" <avisos@norcor.com>')).toEqual({ name: 'SIVEN', email: 'avisos@norcor.com' });
  });
  it('acepta un correo suelto', () => {
    expect(parseSender('avisos@norcor.com')).toEqual({ email: 'avisos@norcor.com' });
  });
});

describe('MailService', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  it('elige el proveedor: Brevo antes que SMTP', () => {
    expect(new MailService(configWith({ BREVO_API_KEY: 'xkeysib-1', SMTP_HOST: 'smtp.gmail.com' })).provider).toBe('brevo');
    expect(new MailService(configWith({ SMTP_HOST: 'smtp.gmail.com' })).provider).toBe('smtp');
    expect(new MailService(configWith({})).provider).toBeNull();
  });

  it('envía el código por la API de Brevo con remitente, destinatario y HTML', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
    const mail = new MailService(configWith({ BREVO_API_KEY: 'xkeysib-1', MAIL_FROM: 'SIVEN <avisos@norcor.com>' }));

    await mail.sendResetCode('ana@correo.com', 'Ana <b>', '123456', 15);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(BREVO_ENDPOINT);
    expect(init.headers['api-key']).toBe('xkeysib-1');
    const body = JSON.parse(init.body);
    expect(body.sender).toEqual({ name: 'SIVEN', email: 'avisos@norcor.com' });
    expect(body.to).toEqual([{ email: 'ana@correo.com', name: 'Ana <b>' }]);
    expect(body.subject).toContain('123456');
    expect(body.textContent).toContain('15 minutos');
    expect(body.htmlContent).toContain('123456');
    expect(body.htmlContent).toContain('Ana &lt;b&gt;'); // el nombre va escapado en el HTML
  });

  it('el aviso de cambio va solo en texto', async () => {
    fetchMock.mockResolvedValue({ ok: true, text: async () => '' });
    await new MailService(configWith({ BREVO_API_KEY: 'k' })).sendPasswordChanged('ana@correo.com', 'Ana');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.htmlContent).toBeUndefined();
    expect(body.textContent).toContain('se cambió');
  });

  it('no lanza si Brevo responde con error: solo lo registra', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValue({ ok: false, status: 400, text: async () => '{"message":"sender email is invalid"}' });

    await expect(new MailService(configWith({ BREVO_API_KEY: 'k' })).sendResetCode('a@b.com', 'A', '1', 15)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('Brevo respondió 400'));
  });

  it('no lanza si la red falla', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    fetchMock.mockRejectedValue(new Error('timeout'));
    await expect(new MailService(configWith({ BREVO_API_KEY: 'k' })).sendResetCode('a@b.com', 'A', '1', 15)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('timeout'));
  });

  it('en producción sin proveedor registra el error y nunca muestra el código', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await new MailService(configWith({ NODE_ENV: 'production' })).sendResetCode('a@b.com', 'A', '987654', 15);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0][0])).not.toContain('987654');
  });
});
