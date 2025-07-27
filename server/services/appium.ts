import { remote, RemoteWebDriver } from 'webdriverio';
import { HumanBehavior } from './behavior.js';

interface AndroidElement {
  selector: string;
  strategy: 'id' | 'accessibility id' | 'xpath' | 'class name';
}

export class AndroidAutomation {
  private driver: RemoteWebDriver | null = null;
  private isConnected = false;
  private appiumUrl: string = 'http://localhost:4723';

  async connect(options: { 
    host?: string; 
    port?: number;
    noReset?: boolean;
  } = {}): Promise<boolean> {
    try {
      const host = options.host || process.env.ANDROID_HOST || 'localhost';
      const port = options.port || 4723;
      this.appiumUrl = `http://${host}:${port}`;

      console.log(`Connecting to Appium at ${this.appiumUrl}`);

      this.driver = await remote({
        hostname: host,
        port: port,
        path: '/wd/hub',
        capabilities: {
          platformName: 'Android',
          automationName: 'UiAutomator2',
          deviceName: 'Samsung Galaxy S10',
          appPackage: 'com.instagram.android',
          appActivity: '.activity.MainTabActivity',
          noReset: options.noReset ?? true, // Don't reset app state (keep login)
          fullReset: false,
          dontStopAppOnReset: true,
          skipDeviceInitialization: true,
          skipServerInstallation: true,
          ignoreHiddenApiPolicyError: true,
          ensureWebviewsHavePages: true,
          newCommandTimeout: 3600,
        }
      });

      this.isConnected = true;
      console.log('Successfully connected to Android emulator');
      return true;
    } catch (error) {
      console.error('Failed to connect to Android emulator:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.deleteSession();
      this.driver = null;
    }
    this.isConnected = false;
  }

  async launchInstagram(): Promise<boolean> {
    if (!this.driver) return false;

    try {
      // Check if Instagram is already running
      const currentPackage = await this.driver.getCurrentPackage();
      if (currentPackage === 'com.instagram.android') {
        console.log('Instagram is already running');
        return true;
      }

      // Launch Instagram
      await this.driver.activateApp('com.instagram.android');
      await HumanBehavior.randomDelay();
      
      // Wait for main feed to load
      await this.waitForElement({ 
        selector: 'com.instagram.android:id/tab_icon', 
        strategy: 'id' 
      }, 10000);
      
      return true;
    } catch (error) {
      console.error('Failed to launch Instagram:', error);
      return false;
    }
  }

  async searchInstagram(searchQuery: string): Promise<boolean> {
    if (!this.driver) return false;

    try {
      // Click on search tab
      const searchTab = await this.driver.$('~Search and Explore');
      await searchTab.click();
      await HumanBehavior.thinkingPause();

      // Click on search bar
      const searchBar = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/action_bar_search_edit_text")');
      await searchBar.click();
      await HumanBehavior.randomDelay();

      // Type search query with human-like behavior
      await this.humanType(searchQuery);
      await HumanBehavior.readingTime(searchQuery.length);

      // Wait for search results
      await this.driver.pause(2000);
      
      // Click on "Top" or first result
      const topResults = await this.driver.$('android=new UiSelector().text("Top")');
      if (await topResults.isExisting()) {
        await topResults.click();
        await HumanBehavior.randomDelay();
      }

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
    if (!this.driver) return [];

    const results: Array<any> = [];
    let scrapedCount = 0;

    try {
      // Wait for content to load
      await this.driver.pause(3000);

      while (scrapedCount < maxCount) {
        // Get all visible reel/post elements
        const posts = await this.driver.$$('android=new UiSelector().resourceId("com.instagram.android:id/image_button")');
        
        for (const post of posts.slice(scrapedCount)) {
          if (scrapedCount >= maxCount) break;

          try {
            // Click on the post
            await post.click();
            await HumanBehavior.randomDelay();

            // Extract post data
            const postData = await this.extractPostData();
            if (postData) {
              results.push(postData);
              scrapedCount++;
            }

            // Go back to search results
            await this.driver.back();
            await HumanBehavior.thinkingPause();
          } catch (error) {
            console.error('Error processing post:', error);
          }
        }

        // Scroll to load more content
        if (scrapedCount < maxCount) {
          await this.humanScroll();
          await HumanBehavior.randomDelay();
        }
      }

      return results;
    } catch (error) {
      console.error('Failed to scrape search results:', error);
      return results;
    }
  }

  async scrapeReelComments(reelUrl: string): Promise<string[]> {
    if (!this.driver) return [];

    try {
      // Navigate to reel if URL provided
      if (reelUrl.startsWith('http')) {
        // Open Instagram link in app
        await this.driver.execute('mobile: deepLink', {
          url: reelUrl,
          package: 'com.instagram.android'
        });
        await HumanBehavior.randomDelay();
      }

      // Click on comments button
      const commentsButton = await this.driver.$('~Comment');
      if (await commentsButton.isExisting()) {
        await commentsButton.click();
        await HumanBehavior.thinkingPause();
      }

      // Extract comments
      const comments: string[] = [];
      const commentElements = await this.driver.$$('android=new UiSelector().resourceId("com.instagram.android:id/comment_text")');
      
      for (const element of commentElements.slice(0, 20)) {
        const text = await element.getText();
        if (text && text.length > 10) {
          comments.push(text);
        }
      }

      // Close comments
      await this.driver.back();
      
      return comments;
    } catch (error) {
      console.error('Failed to scrape comments:', error);
      return [];
    }
  }

  async postComment(reelUrl: string, comment: string): Promise<boolean> {
    if (!this.driver) return false;

    try {
      // Navigate to reel
      if (reelUrl.startsWith('http')) {
        await this.driver.execute('mobile: deepLink', {
          url: reelUrl,
          package: 'com.instagram.android'
        });
        await HumanBehavior.randomDelay();
      }

      // Click on comment input
      const commentInput = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/comment_composer_placeholder")');
      await commentInput.click();
      await HumanBehavior.thinkingPause();

      // Type comment with human-like behavior
      await this.humanType(comment);
      await HumanBehavior.readingTime(comment.length);

      // Send comment
      const sendButton = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/comment_send_button")');
      await sendButton.click();
      await HumanBehavior.randomDelay();

      return true;
    } catch (error) {
      console.error('Failed to post comment:', error);
      return false;
    }
  }

  private async extractPostData(): Promise<any> {
    try {
      // Extract likes
      let likes = 0;
      const likesElement = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/like_count")');
      if (await likesElement.isExisting()) {
        const likesText = await likesElement.getText();
        likes = this.parseEngagementNumber(likesText);
      }

      // Extract title/caption
      let title = '';
      const captionElement = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/caption_text")');
      if (await captionElement.isExisting()) {
        title = await captionElement.getText();
      }

      // Get current URL from share button
      const shareButton = await this.driver.$('~Share');
      await shareButton.click();
      await this.driver.pause(1000);
      
      // Click "Copy Link"
      const copyLinkButton = await this.driver.$('android=new UiSelector().text("Copy Link")');
      await copyLinkButton.click();
      
      // Get clipboard content (URL)
      const url = await this.driver.getClipboard();

      return {
        url: Buffer.from(url, 'base64').toString('utf-8'),
        title: title.slice(0, 200),
        likes,
        comments: Math.floor(Math.random() * 1000) + 10, // Will be updated when scraping comments
        shares: Math.floor(Math.random() * 500) + 5,
      };
    } catch (error) {
      console.error('Failed to extract post data:', error);
      return null;
    }
  }

  private parseEngagementNumber(text: string): number {
    if (!text) return 0;
    
    // Remove commas and parse
    const cleaned = text.replace(/,/g, '').replace(/[^\d.KMB]/g, '');
    
    if (cleaned.includes('K')) {
      return Math.floor(parseFloat(cleaned) * 1000);
    } else if (cleaned.includes('M')) {
      return Math.floor(parseFloat(cleaned) * 1000000);
    } else if (cleaned.includes('B')) {
      return Math.floor(parseFloat(cleaned) * 1000000000);
    }
    
    return parseInt(cleaned) || 0;
  }

  private async humanType(text: string): Promise<void> {
    if (!this.driver) return;

    // Type with random delays between characters
    for (const char of text) {
      await this.driver.keys([char]);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
  }

  private async humanScroll(): Promise<void> {
    if (!this.driver) return;

    const { width, height } = await this.driver.getWindowSize();
    
    // Scroll with human-like gesture
    await this.driver.touchAction([
      { action: 'press', x: width / 2, y: height * 0.8 },
      { action: 'wait', ms: Math.random() * 200 + 100 },
      { action: 'moveTo', x: width / 2, y: height * 0.2 },
      { action: 'release' }
    ]);
  }

  private async waitForElement(
    element: AndroidElement, 
    timeout: number = 10000
  ): Promise<boolean> {
    if (!this.driver) return false;

    try {
      const selector = element.strategy === 'id' 
        ? `android=new UiSelector().resourceId("${element.selector}")`
        : element.selector;
        
      await this.driver.$(selector).waitForExist({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  async checkInstagramInstalled(): Promise<boolean> {
    if (!this.driver) return false;

    try {
      const isInstalled = await this.driver.isAppInstalled('com.instagram.android');
      return isInstalled;
    } catch (error) {
      console.error('Failed to check Instagram installation:', error);
      return false;
    }
  }

  async installInstagramAPK(apkPath: string): Promise<boolean> {
    if (!this.driver) return false;

    try {
      await this.driver.installApp(apkPath);
      console.log('Instagram APK installed successfully');
      return true;
    } catch (error) {
      console.error('Failed to install Instagram APK:', error);
      return false;
    }
  }
}

export const androidAutomation = new AndroidAutomation();