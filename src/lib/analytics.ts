import { init, track, identify, setUserId, Identify } from '@amplitude/analytics-browser';

const AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY || '';

export const initAnalytics = () => {
  if (!AMPLITUDE_API_KEY) {
    console.warn('Amplitude API key not found');
    return;
  }
  try {
    init(AMPLITUDE_API_KEY, undefined, {
      trackingOptions: {
        // don't collect IP address automatically
        ipAddress: false,
      },
    });
    console.log('✅ Amplitude initialized (Admin)');
  } catch (err) {
    console.warn('Amplitude init error (Admin)', err);
  }
};

export const trackEvent = (eventName: string, eventProperties?: Record<string, unknown>) => {
  try {
    track(eventName, eventProperties);
  } catch (err) {
    console.warn('Amplitude track error (Admin)', err);
  }
};

export const identifyUser = (userId: string, userProperties?: Record<string, unknown>) => {
  try {
    setUserId(userId);
    if (userProperties) {
      const identifyObj = new Identify();
      Object.entries(userProperties).forEach(([k, v]) => {
      const val = (typeof v === 'object'
        ? JSON.stringify(v)
        : (v === null || v === undefined ? 'null' : v)) as string | number | boolean;
      identifyObj.set(k, val);
    });
      identify(identifyObj);
    }
  } catch (err) {
    console.warn('Amplitude identify error (Admin)', err);
  }
};

export const clearUser = () => {
  try {
    setUserId(undefined);

    const identifyObj = new Identify();
    // Clear properties by setting to null or empty values if needed
    identify(identifyObj);
  } catch (err) {
    console.warn('Amplitude clear user error (Admin)', err);
  }
};
