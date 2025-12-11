/* eslint-env jest */
import * as Sentry from '@sentry/nextjs';
import { register } from '../../instrumentation';

jest.mock('@sentry/nextjs', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  setTag: jest.fn(),
}));

describe('Sentry instrumentation', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls Sentry.init on register', () => {
    register();
    expect(Sentry.init).toHaveBeenCalled();
  });

  it('captureException can be called after init', () => {
    register();
    Sentry.captureException(new Error('integration test'));
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });
});
