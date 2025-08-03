// server/services/android.ts
import { remote, RemoteOptions } from 'webdriverio';
import { log } from '../vite';

interface ReelData {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  likes: string;
  comments: string;
  shares: string;
}

export class AndroidService {
  private driver: WebdriverIO.Browser | null = null;
  private isConnected = false;
  private readonly DELAY_MIN = 10000; // 10 seconds
  private readonly DELAY_MAX = 20000; // 20 seconds

  private readonly capabilities: RemoteOptions = {
    hostname: process.env.ANDROID_HOST || 'android',
    port: parseInt(process.env.ANDROID_PORT || '4723'),
    capabilities: {
      platformName: 'Android',
      'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Nexus S',
      'appium:automationName': 'UiAutomator2',
      'appium:appPackage': 'com.instagram.android',
      'appium:appActivity': '.activity.MainTabActivity',
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 300,
      'appium:autoGrantPermissions': true,
      'appium:skipUnlock': true,
      'appium:systemPort': 8201
    }
  };

  // Helper method for human-like delays
  private async humanDelay(): Promise<void> {
    const delay = Math.random() * (this.DELAY_MAX - this.DELAY_MIN) + this.DELAY_MIN;
    log(`Waiting ${Math.round(delay / 1000)}s...`);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Check if Appium server is ready
  private async checkAppiumReady(): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.capabilities.hostname}:${this.capabilities.port}/status`);
      const data = await response.json();
      return data.value?.ready === true;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    const maxRetries = 10;
    const retryDelay = 15000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        log('Checking Appium server status...');
        
        // Wait for Appium to be ready
        for (let i = 0; i < 30; i++) {
          if (await this.checkAppiumReady()) {
            log('Appium server is ready');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        log(`Connecting to Android emulator (attempt ${attempt}/${maxRetries})...`);
        this.driver = await remote(this.capabilities);
        this.isConnected = true;
        log('Successfully connected to Android emulator');
        
        // Ensure Instagram is running
        await this.ensureInstagramRunning();
        return;

      } catch (error) {
        log(`Connection attempt ${attempt} failed: ${error}`);
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        } else {
          throw new Error(`Failed to connect after ${maxRetries} attempts`);
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.deleteSession();
      this.driver = null;
      this.isConnected = false;
      log('Disconnected from Android emulator');
    }
  }

  async ensureInstagramRunning(): Promise<void> {
    if (!this.driver) throw new Error('Not connected to Android');

    try {
      const currentPackage = await this.driver.getCurrentPackage();
      
      if (currentPackage !== 'com.instagram.android') {
        log('Launching Instagram...');
        await this.driver.execute('mobile: activateApp', {
          appId: 'com.instagram.android'
        });
        await this.driver.pause(5000);
      }

      // Close any popups
      await this.closePopups();
      
    } catch (error) {
      log(`Error ensuring Instagram is running: ${error}`);
    }
  }

  private async closePopups(): Promise<void> {
    if (!this.driver) return;

    const popupButtons = [
      '//android.widget.Button[@text="Not Now"]',
      '//android.widget.Button[@text="Skip"]',
      '//android.widget.Button[@text="Cancel"]',
      '//android.widget.Button[@text="OK"]',
      '//android.widget.ImageView[@content-desc="Close"]'
    ];

    for (const selector of popupButtons) {
      try {
        const element = await this.driver.$(selector);
        if (await element.isExisting()) {
          await element.click();
          log(`Closed popup: ${selector}`);
          await this.driver.pause(1000);
        }
      } catch {
        // Ignore if element not found
      }
    }
  }


  async searchReels(query: string): Promise<void> {
    if (!this.driver) throw new Error('Not connected to Android');

    try {
      log(`Searching for: "${query}"`);

      // Click on search tab
      const searchTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Search and Explore"]');
      await searchTab.click();
      await this.driver.pause(2000);

      // Click on search field
      const searchField = await this.driver.$('//android.widget.TextView[@text="Search"]');
      await searchField.click();
      await this.driver.pause(1000);

      // Type search query
      const inputField = await this.driver.$('//android.widget.EditText');
      await inputField.setValue(query);
      await this.driver.pause(2000);

      // Press search/enter
      await this.driver.execute('mobile: performEditorAction', {
        action: 'search'
      });
      await this.driver.pause(3000);

      // Navigate to Reels tab in search results
      const reelsTab = await this.driver.$('//android.widget.TextView[@text="Reels"]');
      await reelsTab.click();
      await this.driver.pause(3000);

      // Click on first reel to open fullscreen view
      const firstReel = await this.driver.$('(//android.widget.ImageView[@resource-id="com.instagram.android:id/image"])[1]');
      await firstReel.click();
      await this.driver.pause(3000);

      log('Successfully opened reels search results');
    } catch (error) {
      log(`Search failed: ${error}`);
      throw error;
    }
  }

  async scrapeReels(count: number): Promise<ReelData[]> {
    if (!this.driver) throw new Error('Not connected to Android');

    const reels: ReelData[] = [];
    let processedCount = 0;

    log(`Starting to scrape ${count} reels...`);

    while (processedCount < count) {
      try {
        // Scrape current reel data
        const reelData = await this.scrapeCurrentReel(processedCount);
        if (reelData) {
          reels.push(reelData);
          processedCount++;
          log(`Scraped reel ${processedCount}/${count}`);
        }

        // Human-like delay before next action
        await this.humanDelay();

        // If not last reel, swipe to next
        if (processedCount < count) {
          await this.swipeToNextReel();
          await this.driver.pause(2000); // Wait for animation
        }

      } catch (error) {
        log(`Error scraping reel ${processedCount + 1}: ${error}`);
        // Continue to next reel on error
        await this.swipeToNextReel();
        await this.driver.pause(2000);
      }
    }

    log(`Completed scraping ${reels.length} reels`);
    return reels;
  }

  private async scrapeCurrentReel(index: number): Promise<ReelData | null> {
    if (!this.driver) return null;

    try {
      const reelData: ReelData = {
        id: `reel_${Date.now()}_${index}`,
        url: '', // Will be set later
        title: '',
        thumbnail: null,
        likes: '0',
        comments: '0', 
        shares: '0'
      };

      // Get reel description/title
      try {
        const titleElement = await this.driver.$('//android.widget.TextView[@resource-id="com.instagram.android:id/caption_text_view"]');
        if (await titleElement.isExisting()) {
          reelData.title = await titleElement.getText();
        }
      } catch {
        log('Could not get reel title');
      }

      // Get likes count
      try {
        const likesElement = await this.driver.$('//android.widget.TextView[contains(@content-desc, "likes")]');
        if (await likesElement.isExisting()) {
          const likesText = await likesElement.getAttribute('content-desc');
          reelData.likes = this.extractNumber(likesText);
        }
      } catch {
        log('Could not get likes count');
      }

      // Get comments count
      try {
        const commentsElement = await this.driver.$('//android.widget.TextView[contains(@content-desc, "comments")]');
        if (await commentsElement.isExisting()) {
          const commentsText = await commentsElement.getAttribute('content-desc');
          reelData.comments = this.extractNumber(commentsText);
        }
      } catch {
        log('Could not get comments count');
      }

      // Extract reel ID from current state (for later navigation)
      // Since we can't get URL directly, we'll use our generated ID
      reelData.url = `instagram://reel/${reelData.id}`;

      return reelData;

    } catch (error) {
      log(`Error scraping reel data: ${error}`);
      return null;
    }
  }

  private extractNumber(text: string): string {
    // Extract number from text like "1,234 likes" or "1.2K comments"
    const match = text.match(/[\d,.]+[KMB]?/);
    return match ? match[0] : '0';
  }

  private async swipeToNextReel(): Promise<void> {
    if (!this.driver) return;

    // Swipe up to go to next reel
    const { width, height } = await this.driver.getWindowSize();
    await this.driver.execute('mobile: swipeGesture', {
      left: width / 2,
      top: height * 0.8,
      width: 100,
      height: height * 0.6,
      direction: 'up',
      percent: 0.75
    });
  }

  async getReelComments(reelId: string, maxComments: number = 50): Promise<string[]> {
    if (!this.driver) throw new Error('Not connected to Android');

    const comments: string[] = [];

    try {
      log(`Getting comments for reel ${reelId}...`);

      // Click on comments button
      const commentsButton = await this.driver.$('//android.widget.ImageView[@content-desc="Comment"]');
      await commentsButton.click();
      await this.driver.pause(2000);

      // Scrape comments with scrolling
      let previousCommentsCount = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 10;

      while (comments.length < maxComments && scrollAttempts < maxScrollAttempts) {
        // Get all visible comment texts
        const commentElements = await this.driver.$$('//android.widget.TextView[@resource-id="com.instagram.android:id/comment_text"]');
        //@ts-ignore
        for (const element of commentElements) {
          try {
            const text = await element.getText();
            if (text && !comments.includes(text)) {
              comments.push(text);
            }
          } catch {
            // Skip if unable to get text
          }
        }

        // Check if we got new comments
        if (comments.length === previousCommentsCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
        previousCommentsCount = comments.length;

        // Scroll to load more comments if needed
        if (comments.length < maxComments) {
          await this.driver.execute('mobile: swipeGesture', {
            left: 200,
            top: 600,
            width: 100,
            height: 400,
            direction: 'up',
            percent: 0.5
          });
          await this.driver.pause(1500);
        }
      }

      // Close comments
      const closeButton = await this.driver.$('//android.widget.ImageView[@content-desc="Close"]');
      if (await closeButton.isExisting()) {
        await closeButton.click();
      } else {
        // Alternative: swipe down to close
        await this.driver.execute('mobile: swipeGesture', {
          left: 200,
          top: 200,
          width: 100,
          height: 400,
          direction: 'down',
          percent: 0.75
        });
      }
      await this.driver.pause(1000);

      log(`Collected ${comments.length} comments`);
      return comments.slice(0, maxComments);

    } catch (error) {
      log(`Error getting comments: ${error}`);
      return comments;
    }
  }

  async postComment(reelId: string, comment: string): Promise<boolean> {
    if (!this.driver) throw new Error('Not connected to Android');

    try {
      log(`Posting comment on reel ${reelId}: "${comment}"`);

      // Click on comments button
      const commentsButton = await this.driver.$('//android.widget.ImageView[@content-desc="Comment"]');
      await commentsButton.click();
      await this.driver.pause(2000);

      // Check if comments are disabled
      const disabledText = await this.driver.$('//android.widget.TextView[contains(@text, "Comments are turned off")]');
      if (await disabledText.isExisting()) {
        log('Comments are disabled for this reel');
        // Close comments sheet
        await this.driver.back();
        return false;
      }

      // Click on comment input field
      const commentInput = await this.driver.$('//android.widget.EditText[@text="Add a comment..."]');
      await commentInput.click();
      await this.driver.pause(1000);

      // Type comment
      await commentInput.setValue(comment);
      await this.driver.pause(1000);

      // Post comment
      const postButton = await this.driver.$('//android.widget.TextView[@text="Post"]');
      await postButton.click();
      await this.driver.pause(2000);

      // Close comments
      await this.driver.back();
      await this.driver.pause(1000);

      log('Comment posted successfully');
      return true;

    } catch (error) {
      log(`Failed to post comment: ${error}`);
      return false;
    }
  }

  async scrollFeed(times: number = 1): Promise<void> {
    if (!this.driver) throw new Error('Not connected to Android');

    for (let i = 0; i < times; i++) {
      await this.swipeToNextReel();
      await this.humanDelay();
    }
  }
  isReady(): boolean {
    return this.isConnected && this.driver !== null;
  }
}

export const androidService = new AndroidService();