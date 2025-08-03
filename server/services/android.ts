// server/services/android.ts
import { remote } from 'webdriverio';
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

class AndroidService {
  private driver: WebdriverIO.Browser | null = null;
  private connected = false;

  async connect(): Promise<void> {
    try {
      log('Connecting to Android emulator...');
      
      this.driver = await remote({
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
      });
      
      this.connected = true;
      log('Connected to Android emulator');
      
      // Launch Instagram
      await this.launchInstagram();
    } catch (error) {
      throw new Error(`Failed to connect: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.deleteSession();
      this.driver = null;
      this.connected = false;
      log('Disconnected from Android');
    }
  }

  async launchInstagram(): Promise<void> {
    if (!this.driver) throw new Error('Not connected');
    
    try {
      const currentPackage = await this.driver.getCurrentPackage();
      if (currentPackage !== 'com.instagram.android') {
        await this.driver.execute('mobile: activateApp', {
          appId: 'com.instagram.android'
        });
        await this.driver.pause(3000);
      }
    } catch (error) {
      log(`Error launching Instagram: ${error}`);
    }
  }

  async searchReels(query: string): Promise<void> {
    if (!this.driver) throw new Error('Not connected');

    // Click search tab
    const searchTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Search and Explore"]');
    await searchTab.click();
    await this.driver.pause(2000);

    // Click search field
    const searchField = await this.driver.$('//android.widget.TextView[@text="Search"]');
    await searchField.click();
    await this.driver.pause(1000);

    // Type query
    const inputField = await this.driver.$('//android.widget.EditText');
    await inputField.setValue(query);
    await this.driver.pause(2000);

    // Search
    await this.driver.execute('mobile: performEditorAction', { action: 'search' });
    await this.driver.pause(3000);

    // Go to Reels tab
    const reelsTab = await this.driver.$('//android.widget.TextView[@text="Reels"]');
    await reelsTab.click();
    await this.driver.pause(3000);

    // Open first reel
    const firstReel = await this.driver.$('(//android.widget.ImageView[@resource-id="com.instagram.android:id/image"])[1]');
    await firstReel.click();
    await this.driver.pause(3000);
  }

  async scrapeReels(count: number): Promise<ReelData[]> {
    if (!this.driver) throw new Error('Not connected');

    const reels: ReelData[] = [];
    
    for (let i = 0; i < count; i++) {
      const reel = await this.scrapeCurrentReel(i);
      if (reel) reels.push(reel);
      
      // Wait 10-20 seconds
      await this.driver.pause(10000 + Math.random() * 10000);
      
      // Swipe to next
      if (i < count - 1) {
        await this.swipeNext();
        await this.driver.pause(2000);
      }
    }
    
    return reels;
  }

  private async scrapeCurrentReel(index: number): Promise<ReelData | null> {
    if (!this.driver) return null;

    const reel: ReelData = {
      id: `reel_${Date.now()}_${index}`,
      url: `instagram://reel/reel_${Date.now()}_${index}`,
      title: '',
      thumbnail: null,
      likes: '0',
      comments: '0',
      shares: '0'
    };

    try {
      // Get title
      const titleEl = await this.driver.$('//android.widget.TextView[@resource-id="com.instagram.android:id/caption_text_view"]');
      if (await titleEl.isExisting()) {
        reel.title = await titleEl.getText();
      }

      // Get likes
      const likesEl = await this.driver.$('//android.widget.TextView[contains(@content-desc, "likes")]');
      if (await likesEl.isExisting()) {
        const text = await likesEl.getAttribute('content-desc');
        reel.likes = text.match(/[\d,.]+[KMB]?/)?.[0] || '0';
      }

      // Get comments
      const commentsEl = await this.driver.$('//android.widget.TextView[contains(@content-desc, "comments")]');
      if (await commentsEl.isExisting()) {
        const text = await commentsEl.getAttribute('content-desc');
        reel.comments = text.match(/[\d,.]+[KMB]?/)?.[0] || '0';
      }
    } catch (error) {
      log(`Error scraping reel: ${error}`);
    }

    return reel;
  }

  private async swipeNext(): Promise<void> {
    if (!this.driver) return;
    
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
    if (!this.driver) throw new Error('Not connected');

    const comments: string[] = [];

    // Open comments
    const commentBtn = await this.driver.$('//android.widget.ImageView[@content-desc="Comment"]');
    await commentBtn.click();
    await this.driver.pause(2000);

    // Scrape comments
    for (let i = 0; i < 5; i++) { // Max 5 scrolls
      const commentEls = await this.driver.$$('//android.widget.TextView[@resource-id="com.instagram.android:id/comment_text"]');
      
      for (const el of commentEls) {
        const text = await el.getText();
        if (text && !comments.includes(text)) {
          comments.push(text);
        }
        if (comments.length >= maxComments) break;
      }
      
      if (comments.length >= maxComments) break;
      
      // Scroll for more
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

    // Close comments
    await this.driver.back();
    await this.driver.pause(1000);

    return comments.slice(0, maxComments);
  }

  async postComment(reelId: string, comment: string): Promise<boolean> {
    if (!this.driver) throw new Error('Not connected');

    try {
      // Open comments
      const commentBtn = await this.driver.$('//android.widget.ImageView[@content-desc="Comment"]');
      await commentBtn.click();
      await this.driver.pause(2000);

      // Check if disabled
      const disabled = await this.driver.$('//android.widget.TextView[contains(@text, "Comments are turned off")]');
      if (await disabled.isExisting()) {
        await this.driver.back();
        return false;
      }

      // Type comment
      const input = await this.driver.$('//android.widget.EditText[@text="Add a comment..."]');
      await input.click();
      await this.driver.pause(1000);
      await input.setValue(comment);
      await this.driver.pause(1000);

      // Post
      const postBtn = await this.driver.$('//android.widget.TextView[@text="Post"]');
      await postBtn.click();
      await this.driver.pause(2000);

      // Close
      await this.driver.back();
      await this.driver.pause(1000);

      return true;
    } catch (error) {
      log(`Failed to post comment: ${error}`);
      return false;
    }
  }

  async ensureInstagramRunning(): Promise<void> {
    await this.launchInstagram();
  }

  isReady(): boolean {
    return this.connected && this.driver !== null;
  }
}

export const androidService = new AndroidService();