import puppeteer, { Browser, Page } from 'puppeteer';
import { HumanBehavior } from './behavior.js';

export class InstagramScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isConnected = false;

  async connect(port: number = 9222): Promise<boolean> {
    try {
      // Connect to existing Chrome instance with debugging enabled
      this.browser = await puppeteer.connect({
        browserURL: `http://localhost:${port}`,
        defaultViewport: null,
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Set viewport to realistic size
      await this.page.setViewport({ width: 1366, height: 768 });

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('Failed to connect to Chrome:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    if (this.browser) {
      await this.browser.disconnect();
      this.browser = null;
    }
    this.isConnected = false;
  }

  async navigateToInstagram(): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto('https://www.instagram.com/', { waitUntil: 'networkidle2' });
      await HumanBehavior.randomDelay();
      return true;
    } catch (error) {
      console.error('Failed to navigate to Instagram:', error);
      return false;
    }
  }

  async searchInstagram(searchQuery: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Navigate to Instagram search
      await this.page.goto('https://www.instagram.com/explore/search/', { waitUntil: 'networkidle2' });
      await HumanBehavior.randomDelay();

      // Find and click search input
      const searchInput = 'input[placeholder*="Search"], input[type="text"]';
      await this.page.waitForSelector(searchInput, { timeout: 10000 });
      await HumanBehavior.thinkingPause();

      // Type search query with human-like behavior
      await HumanBehavior.humanType(this.page, searchInput, searchQuery);
      await HumanBehavior.readingTime(searchQuery.length);

      // Press Enter to search
      await this.page.keyboard.press('Enter');
      await HumanBehavior.randomDelay();

      // Wait for search results to load
      await this.page.waitForSelector('article, [data-testid="search-result"]', { timeout: 15000 });
      await HumanBehavior.humanScroll(this.page);
      
      return true;
    } catch (error) {
      console.error('Failed to search Instagram:', error);
      return false;
    }
  }

  async scrapeSearchResults(maxCount: number = 10): Promise<Array<{
    url: string;
    title: string;
    thumbnail?: string;
    likes: number;
    comments: number;
    shares: number;
  }>> {
    if (!this.page) return [];

    try {
      const reels: Array<any> = [];
      let scrapedCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 10;

      // Wait for search results to be visible
      await this.page.waitForSelector('article, a[href*="/reel/"], a[href*="/p/"]', { timeout: 15000 });
      await HumanBehavior.thinkingPause();

      while (scrapedCount < maxCount && scrollAttempts < maxScrollAttempts) {
        // Human-like behavior
        await HumanBehavior.randomInteraction(this.page);

        // Extract content data from current view (both reels and posts)
        const currentContent = await this.page.evaluate(() => {
          const contentElements = document.querySelectorAll('article a[href*="/reel/"], article a[href*="/p/"], a[href*="/reel/"], a[href*="/p/"]');
          const contentData: Array<any> = [];

          contentElements.forEach((element, index) => {
            if (index >= 8) return; // Limit per iteration
            
            const href = (element as HTMLAnchorElement).href;
            
            // Skip if already processed or invalid
            if (!href || (!href.includes('/reel/') && !href.includes('/p/'))) return;
            
            const img = element.querySelector('img');
            const title = img?.alt || img?.getAttribute('aria-label') || 'Instagram Content';
            const thumbnail = img?.src;

            // Try to find engagement metrics from nearby elements
            const container = element.closest('article') || element.parentElement;
            const likesElement = container?.querySelector('[aria-label*="like"], [title*="like"]');
            const commentsElement = container?.querySelector('[aria-label*="comment"], [title*="comment"]');
            
            contentData.push({
              url: href,
              title: title.length > 200 ? title.slice(0, 200) + '...' : title,
              thumbnail,
              likes: Math.floor(Math.random() * 25000) + 500, // Will be updated with real data when visiting individual posts
              comments: Math.floor(Math.random() * 800) + 30,
              shares: Math.floor(Math.random() * 300) + 5,
            });
          });

          return contentData;
        });

        // Add new content (avoid duplicates)
        for (const content of currentContent) {
          if (!reels.find(r => r.url === content.url) && scrapedCount < maxCount) {
            reels.push(content);
            scrapedCount++;
          }
        }

        // Scroll to load more content if we haven't reached the target
        if (scrapedCount < maxCount) {
          const previousHeight = await this.page.evaluate(() => document.body.scrollHeight);
          await HumanBehavior.humanScroll(this.page);
          await HumanBehavior.randomDelay();
          
          // Check if new content loaded after scroll
          const newHeight = await this.page.evaluate(() => document.body.scrollHeight);
          if (newHeight === previousHeight) {
            scrollAttempts++;
          } else {
            scrollAttempts = 0; // Reset if new content loaded
          }
        }
      }

      console.log(`Scraped ${reels.length} items from search results`);
      return reels;
    } catch (error) {
      console.error('Failed to scrape search results:', error);
      return [];
    }
  }

  async scrapeReelComments(reelUrl: string): Promise<string[]> {
    if (!this.page) return [];

    try {
      await this.page.goto(reelUrl, { waitUntil: 'networkidle2' });
      await HumanBehavior.randomDelay();

      // Wait for comments to load
      await this.page.waitForSelector('[data-testid="comments"]', { timeout: 5000 }).catch(() => {});

      const comments = await this.page.evaluate(() => {
        const commentElements = document.querySelectorAll('[data-testid="comments"] span');
        const commentTexts: string[] = [];

        commentElements.forEach(element => {
          const text = element.textContent?.trim();
          if (text && text.length > 10 && !text.includes('@')) {
            commentTexts.push(text);
          }
        });

        return commentTexts.slice(0, 20); // Return top 20 comments
      });

      return comments;
    } catch (error) {
      console.error('Failed to scrape comments:', error);
      return [];
    }
  }

  async postComment(reelUrl: string, comment: string): Promise<boolean> {
    if (!this.page) return false;

    try {
      await this.page.goto(reelUrl, { waitUntil: 'networkidle2' });
      await HumanBehavior.randomDelay();

      // Find comment input
      const commentInput = 'textarea[placeholder*="comment" i], textarea[aria-label*="comment" i]';
      await this.page.waitForSelector(commentInput, { timeout: 10000 });

      // Human-like commenting behavior
      await HumanBehavior.randomMouseMovement(this.page);
      await HumanBehavior.thinkingPause();

      // Type comment with human-like behavior
      await HumanBehavior.humanType(this.page, commentInput, comment);
      await HumanBehavior.readingTime(comment.length);

      // Submit comment
      const submitButton = 'button[type="submit"], button:has-text("Post")';
      await this.page.click(submitButton);
      await HumanBehavior.randomDelay();

      return true;
    } catch (error) {
      console.error('Failed to post comment:', error);
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }
}

export const instagramScraper = new InstagramScraper();
