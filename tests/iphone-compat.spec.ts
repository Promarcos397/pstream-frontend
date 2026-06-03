import { test, expect, devices } from '@playwright/test';

// ── Run everything as iPhone 14 on WebKit (Safari engine) ──────────────────
// Playwright ships its own WebKit build so this works on Windows with no Mac needed.
const iPhone = devices['iPhone 14'];

test.use({
  ...iPhone,
  // Force WebKit so we get real Safari behaviour (touch events, HLS restrictions, etc.)
  browserName: 'webkit',
});

const BASE_URL = 'http://localhost:5173';

// ── Mock Supabase Authentication for all tests ─────────────────────────────
test.beforeEach(async ({ page }) => {
  // Inject the test flag BEFORE the page loads so the Supabase client mock is triggered
  await page.addInitScript(() => {
    (window as any).__PLAYWRIGHT_TEST__ = true;
  });
});

// ── 1. Basic load ──────────────────────────────────────────────────────────
test('homepage loads on iPhone WebKit', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  // At minimum the root element should be rendered
  await expect(page.locator('#root')).toBeVisible();
});

// ── 2. Mobile search open & cancel flow ────────────────────────────────────
// On mobile, NavbarMobile is rendered — there is NO #searchbar-toggle.
// Instead the bottom nav has an inline search <div> that sets ?search=true in the URL,
// which then swaps the top header to a full-width search bar.
test('Mobile search opens and can be dismissed via Home tap', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // The mobile bottom nav search icon carries the i18n label 'Search'.
  // We use a span text match since there is no id on the element.
  const searchNavIcon = page.locator('span').filter({ hasText: /^Search$/ }).first();
  await expect(searchNavIcon).toBeVisible({ timeout: 10_000 });
  await searchNavIcon.tap();

  // After tapping, the URL should contain ?search=true
  await page.waitForURL(/search=true/, { timeout: 5_000 });

  // The full-width search input should now be visible in the top header
  const searchInput = page.locator('input[placeholder*="Search"]');
  await expect(searchInput).toBeVisible({ timeout: 5_000 });

  // Tap the Home nav icon to dismiss search
  const homeNavIcon = page.locator('span').filter({ hasText: /^Home$/ }).first();
  await homeNavIcon.tap();

  // URL should no longer contain search=true
  await page.waitForFunction(
    () => !window.location.search.includes('search=true'),
    { timeout: 5_000 }
  );

  // Search input should be gone
  await expect(searchInput).not.toBeVisible();
});

// ── 3. No unwanted horizontal scroll ──────────────────────────────────────
test('no horizontal overflow on iPhone 14 viewport', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  // Wait a short bit for content / animations to settle
  await page.waitForTimeout(1000);

  // Scroll to the far right — if scrollWidth > clientWidth, we have overflow
  const { hasHorizontalScroll, overflowingElements } = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const hasOverflow = scrollWidth > clientWidth;

    const badElements: { tagName: string; className: string; id: string; rect: any }[] = [];
    if (hasOverflow) {
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth) {
          badElements.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            rect: { left: rect.left, right: rect.right, width: rect.width }
          });
        }
      });
    }

    return {
      hasHorizontalScroll: hasOverflow,
      overflowingElements: badElements
    };
  });

  if (hasHorizontalScroll) {
    console.log('Overflow detected! Elements sticking out beyond viewport width:', JSON.stringify(overflowingElements, null, 2));
  }

  expect(hasHorizontalScroll).toBe(false);
});

// ── 4. Inline video attribute check ────────────────────────────────────────
// On iOS, video elements MUST have `playsinline` to avoid full-screen hijacking.
test('all video elements have playsinline attribute', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');

  // Navigate to a title page — adjust the path to match a real movie/show
  await page.goto(`${BASE_URL}/movie/550`); // Fight Club as an example
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);

  const videoElements = await page.locator('video').all();
  for (const video of videoElements) {
    // playsinline must be present (even if empty string value)
    const hasPlaysinline = await video.getAttribute('playsinline');
    expect(hasPlaysinline).not.toBeNull();
  }
});

// ── 5. Touch scroll inertia class check ────────────────────────────────────
// Elements that scroll should have -webkit-overflow-scrolling: touch applied via CSS.
test('scrollable containers exist on the homepage', async ({ page }) => {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(500);

  // Look for elements with our scroll utility classes
  const scrollContainers = page.locator('.overflow-x-auto, .overflow-y-auto, [class*="scroll"]');
  const count = await scrollContainers.count();
  // At least some scrollable containers should exist on the homepage
  expect(count).toBeGreaterThan(0);
});

// ── 6. LoginPage overflow test ─────────────────────────────────────────────
test('no horizontal overflow on LoginPage iPhone 14 viewport', async ({ page }) => {
  // Override test flag to stay on LoginPage
  await page.addInitScript(() => {
    (window as any).__PLAYWRIGHT_TEST__ = false;
    window.localStorage.clear();
  });

  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);

  const { hasHorizontalScroll, overflowingElements } = await page.evaluate(() => {
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;
    const hasOverflow = scrollWidth > clientWidth;

    const badElements: { tagName: string; className: string; id: string; rect: any }[] = [];
    if (hasOverflow) {
      const allElements = Array.from(document.querySelectorAll('*'));
      allElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > clientWidth) {
          badElements.push({
            tagName: el.tagName,
            className: el.className,
            id: el.id,
            rect: { left: rect.left, right: rect.right, width: rect.width }
          });
        }
      });
    }

    return {
      hasHorizontalScroll: hasOverflow,
      overflowingElements: badElements
    };
  });

  if (hasHorizontalScroll) {
    console.log('LoginPage Overflow detected! Elements:', JSON.stringify(overflowingElements, null, 2));
  }

  expect(hasHorizontalScroll).toBe(false);
});
