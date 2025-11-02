import { LaunchOptions } from 'playwright';

/**
 * Playwright Browser Configuration
 * Optimized settings for unsubscribe automation
 */

export const BROWSER_CONFIG: LaunchOptions = {
  // Run in headless mode for automation
  headless: true,

  // Browser channel (use chromium)
  channel: undefined,

  // Viewport size (desktop resolution)
  args: [
    '--window-size=1920,1080',
    '--disable-blink-features=AutomationControlled', // Hide automation detection
    '--no-sandbox', // Required for some environments
    '--disable-setuid-sandbox',
  ],

  // Timeouts
  timeout: 30000, // 30 seconds to launch browser

  // Slow down operations for stability (0 = normal speed)
  slowMo: 0,
};

/**
 * Page navigation and interaction timeouts
 */
export const PAGE_TIMEOUTS = {
  navigation: 30000, // 30 seconds for page load
  action: 10000, // 10 seconds for button clicks
  screenshot: 5000, // 5 seconds to take screenshot
};

/**
 * Realistic user agent to avoid detection
 */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Success indicators after unsubscribe action
 * Case-insensitive patterns to detect successful unsubscribe
 */
export const SUCCESS_PATTERNS = [
  /unsubscribed/i,
  /successfully\s+removed/i,
  /you\s+have\s+been\s+removed/i,
  /you\s+will\s+no\s+longer\s+receive/i,
  /email\s+preferences\s+updated/i,
  /subscription\s+cancelled/i,
  /opt.out\s+confirmed/i,
  /removed\s+from.*list/i,
  /thank\s+you/i, // Often accompanied with unsubscribe confirmation
];

/**
 * Button/link patterns to identify unsubscribe elements
 * Case-insensitive patterns to find unsubscribe buttons
 */
export const UNSUBSCRIBE_PATTERNS = [
  /unsubscribe/i,
  /opt.?out/i,
  /remove.*email/i,
  /stop.*emails/i,
  /cancel.*subscription/i,
  /do.*not.*send/i,
  /delete.*subscription/i,
  /confirm.*unsubscribe/i,
];

/**
 * Error patterns that indicate failure
 */
export const ERROR_PATTERNS = [
  /captcha/i,
  /recaptcha/i,
  /verification/i,
  /sign\s+in/i,
  /log\s+in/i,
  /authentication\s+required/i,
  /access\s+denied/i,
];
