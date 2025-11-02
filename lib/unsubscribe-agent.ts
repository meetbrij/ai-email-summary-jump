import { chromium, Page } from 'playwright';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import {
  BROWSER_CONFIG,
  PAGE_TIMEOUTS,
  USER_AGENT,
  SUCCESS_PATTERNS,
  UNSUBSCRIBE_PATTERNS,
  ERROR_PATTERNS,
} from './playwright-config';

export interface UnsubscribeResult {
  success: boolean;
  method: 'header' | 'simple-click' | 'ai-form' | 'manual';
  message: string;
  screenshotPaths?: {
    before?: string;
    after?: string;
  };
  error?: string;
}

/**
 * Tier 1: Unsubscribe via List-Unsubscribe Header
 * Attempts to unsubscribe using RFC 8058 List-Unsubscribe header
 */
export async function executeHeaderUnsubscribe(
  url: string
): Promise<UnsubscribeResult> {
  console.log(`[Tier 1] Attempting header unsubscribe: ${url}`);

  try {
    // Check if it's a mailto: link
    if (url.startsWith('mailto:')) {
      return {
        success: false,
        method: 'header',
        message: 'Mailto unsubscribe requires email sending (not implemented)',
        error: 'Mailto method not supported in this implementation',
      };
    }

    // HTTP GET/POST to unsubscribe URL
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        success: false,
        method: 'header',
        message: `HTTP ${response.status}: ${response.statusText}`,
        error: `Failed to access unsubscribe URL: ${response.status}`,
      };
    }

    // Check response body for success indicators
    const body = await response.text();
    const hasSuccessIndicator = SUCCESS_PATTERNS.some((pattern) =>
      pattern.test(body)
    );

    if (hasSuccessIndicator) {
      console.log(`[Tier 1] ✓ Success via List-Unsubscribe header`);
      return {
        success: true,
        method: 'header',
        message: 'Successfully unsubscribed via List-Unsubscribe header',
      };
    }

    // If no clear success indicator, consider it uncertain
    console.log(`[Tier 1] ⚠ Uncertain result from header method`);
    return {
      success: false,
      method: 'header',
      message: 'No clear confirmation from header method, will try browser automation',
      error: 'Could not confirm unsubscribe via header method',
    };
  } catch (error: any) {
    console.error(`[Tier 1] ✗ Error:`, error);
    return {
      success: false,
      method: 'header',
      message: `Failed to execute header unsubscribe: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Tier 2: Simple Unsubscribe via Browser Automation
 * Uses Playwright to navigate to page, find and click unsubscribe button
 */
export async function executeSimpleUnsubscribe(
  url: string,
  attemptId: string
): Promise<UnsubscribeResult> {
  console.log(`[Tier 2] Attempting simple click unsubscribe: ${url}`);

  const browser = await chromium.launch(BROWSER_CONFIG);
  let page: Page | null = null;

  try {
    // Create browser page
    page = await browser.newPage({
      viewport: { width: 1920, height: 1080 },
      userAgent: USER_AGENT,
    });

    // Set default timeouts
    page.setDefaultNavigationTimeout(PAGE_TIMEOUTS.navigation);
    page.setDefaultTimeout(PAGE_TIMEOUTS.action);

    console.log(`[Tier 2] Navigating to: ${url}`);

    // Navigate to unsubscribe URL
    const response = await page.goto(url, { waitUntil: 'networkidle' });

    if (!response || !response.ok()) {
      throw new Error(`Failed to load page: ${response?.status()}`);
    }

    // Take "before" screenshot
    const beforePath = await saveScreenshot(page, attemptId, 'before');
    console.log(`[Tier 2] Saved before screenshot: ${beforePath}`);

    // Check for error indicators (CAPTCHA, login wall)
    const pageContent = await page.content();
    const hasError = ERROR_PATTERNS.some((pattern) => pattern.test(pageContent));

    if (hasError) {
      await browser.close();
      return {
        success: false,
        method: 'simple-click',
        message: 'Page requires CAPTCHA or login',
        error: 'CAPTCHA or authentication required',
        screenshotPaths: { before: beforePath },
      };
    }

    // Try to find unsubscribe button/link
    console.log(`[Tier 2] Looking for unsubscribe button...`);

    let clicked = false;
    let clickedElement: string | null = null;

    // Try different selectors for unsubscribe elements
    for (const pattern of UNSUBSCRIBE_PATTERNS) {
      // Try buttons
      const buttons = await page.locator('button').all();
      for (const button of buttons) {
        const text = await button.textContent();
        if (text && pattern.test(text)) {
          console.log(`[Tier 2] Found button: "${text}"`);
          await button.click();
          clicked = true;
          clickedElement = `button: "${text}"`;
          break;
        }
      }

      if (clicked) break;

      // Try links
      const links = await page.locator('a').all();
      for (const link of links) {
        const text = await link.textContent();
        if (text && pattern.test(text)) {
          console.log(`[Tier 2] Found link: "${text}"`);
          await link.click();
          clicked = true;
          clickedElement = `link: "${text}"`;
          break;
        }
      }

      if (clicked) break;
    }

    if (!clicked) {
      const afterPath = await saveScreenshot(page, attemptId, 'after-not-found');
      await browser.close();

      return {
        success: false,
        method: 'simple-click',
        message: 'Could not find unsubscribe button or link',
        error: 'No matching unsubscribe element found',
        screenshotPaths: { before: beforePath, after: afterPath },
      };
    }

    // Wait for navigation or content change
    console.log(`[Tier 2] Clicked ${clickedElement}, waiting for response...`);
    await page.waitForTimeout(3000); // Wait 3 seconds for page update

    // Take "after" screenshot
    const afterPath = await saveScreenshot(page, attemptId, 'after');
    console.log(`[Tier 2] Saved after screenshot: ${afterPath}`);

    // Check for success indicators
    const afterContent = await page.content();
    const hasSuccess = SUCCESS_PATTERNS.some((pattern) =>
      pattern.test(afterContent)
    );

    await browser.close();

    if (hasSuccess) {
      console.log(`[Tier 2] ✓ Success - Found confirmation message`);
      return {
        success: true,
        method: 'simple-click',
        message: `Successfully unsubscribed by clicking ${clickedElement}`,
        screenshotPaths: { before: beforePath, after: afterPath },
      };
    }

    // Uncertain result
    console.log(`[Tier 2] ⚠ Clicked button but no clear confirmation`);
    return {
      success: false,
      method: 'simple-click',
      message: `Clicked ${clickedElement} but could not confirm success`,
      error: 'No confirmation message found after clicking',
      screenshotPaths: { before: beforePath, after: afterPath },
    };
  } catch (error: any) {
    console.error(`[Tier 2] ✗ Error:`, error);

    // Try to take error screenshot
    let errorScreenshotPath: string | undefined;
    if (page) {
      try {
        errorScreenshotPath = await saveScreenshot(page, attemptId, 'error');
      } catch (screenshotError) {
        console.error(`Failed to capture error screenshot:`, screenshotError);
      }
    }

    await browser.close();

    return {
      success: false,
      method: 'simple-click',
      message: `Browser automation failed: ${error.message}`,
      error: error.message,
      screenshotPaths: errorScreenshotPath
        ? { after: errorScreenshotPath }
        : undefined,
    };
  }
}

/**
 * Main unsubscribe function - tries Tier 1, then Tier 2
 */
export async function unsubscribeEmail(
  url: string,
  attemptId: string
): Promise<UnsubscribeResult> {
  console.log(`\n=== Starting Unsubscribe Automation ===`);
  console.log(`URL: ${url}`);
  console.log(`Attempt ID: ${attemptId}`);

  // Tier 1: Try List-Unsubscribe header method first (faster, less resource intensive)
  console.log(`\n--- Tier 1: List-Unsubscribe Header ---`);
  const tier1Result = await executeHeaderUnsubscribe(url);

  if (tier1Result.success) {
    console.log(`✓ Unsubscribe succeeded via Tier 1 (header method)`);
    return tier1Result;
  }

  console.log(`✗ Tier 1 failed, proceeding to Tier 2...`);

  // Tier 2: Try browser automation with simple click
  console.log(`\n--- Tier 2: Browser Automation (Simple Click) ---`);
  const tier2Result = await executeSimpleUnsubscribe(url, attemptId);

  if (tier2Result.success) {
    console.log(`✓ Unsubscribe succeeded via Tier 2 (browser automation)`);
    return tier2Result;
  }

  console.log(`✗ Tier 2 failed`);

  // Both tiers failed - return Tier 2 result (has more info and screenshots)
  console.log(`\n=== Unsubscribe Failed - Manual Action Required ===\n`);
  return {
    ...tier2Result,
    message: `Automated unsubscribe failed. ${tier2Result.message}. Manual unsubscribe recommended.`,
  };
}

/**
 * Helper: Save screenshot to public/unsubscribe-logs directory
 */
async function saveScreenshot(
  page: Page,
  attemptId: string,
  suffix: string
): Promise<string> {
  const dir = join(process.cwd(), 'public', 'unsubscribe-logs', attemptId);

  // Create directory if it doesn't exist
  await mkdir(dir, { recursive: true });

  const filename = `${suffix}-${Date.now()}.png`;
  const filepath = join(dir, filename);

  // Take screenshot
  await page.screenshot({ path: filepath, fullPage: true });

  // Return relative path (for storing in database and serving via Next.js)
  return `/unsubscribe-logs/${attemptId}/${filename}`;
}
