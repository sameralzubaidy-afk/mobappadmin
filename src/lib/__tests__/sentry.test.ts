import serverSentry from '../../../sentry.server.config';

describe('Sentry server config', () => {
  it('should export an initialized Sentry object or a stub', () => {
    expect(serverSentry).toBeDefined();
    expect(typeof serverSentry.init === 'function' || typeof serverSentry.captureException === 'function').toBeTruthy();
  });
});
