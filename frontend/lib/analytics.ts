/**
 * Analytics tracking module for conversion events
 * Configure with your analytics provider (GA4, Mixpanel, Segment, etc.)
 */

interface ConversionEvent {
  event: string;
  properties?: Record<string, any>;
  value?: number;
}

export const analytics = {
  /**
   * Track page view events
   */
  pageView: (url: string) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID!, {
        page_path: url,
      });
    }
    
    // TODO: Add other analytics providers
    console.log('[Analytics] Page view:', url);
  },

  /**
   * Track conversion events
   */
  track: (eventName: string, properties?: Record<string, any>) => {
    const event: ConversionEvent = {
      event: eventName,
      properties,
    };

    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, properties);
    }

    // TODO: Add other analytics providers (Mixpanel, Segment, etc.)
    console.log('[Analytics] Event tracked:', event);
  },

  /**
   * Track signup conversions
   */
  trackSignup: (method: string = 'email') => {
    analytics.track('sign_up', {
      method,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track CTA clicks
   */
  trackCTAClick: (location: string, label: string) => {
    analytics.track('cta_click', {
      location,
      label,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track trial starts
   */
  trackTrialStart: () => {
    analytics.track('trial_start', {
      trial_length_days: 7,
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track payment/subscription events
   */
  trackSubscription: (plan: string, amount: number) => {
    analytics.track('subscribe', {
      plan,
      amount,
      currency: 'USD',
      timestamp: new Date().toISOString(),
    });
  },

  /**
   * Track feature usage
   */
  trackFeatureUse: (feature: string) => {
    analytics.track('feature_use', {
      feature,
      timestamp: new Date().toISOString(),
    });
  },
};

// Type declaration for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}