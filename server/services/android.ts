// server/services/android.ts
import { remote } from 'webdriverio';
import { log } from '../vite';

interface ReelData {
  id: string;
  url: string;
  title: string;
  author: string;
  likes: string;
  comments: string;
  shares: string;
  playCount: string;
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
      
      await this.ensureInstagramRunning();
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

  async ensureInstagramRunning(): Promise<void> {
    if (!this.driver) throw new Error('Not connected');
    
    try {
      const currentPackage = await this.driver.getCurrentPackage();
      if (currentPackage !== 'com.instagram.android') {
        await this.driver.execute('mobile: activateApp', {
          appId: 'com.instagram.android'
        });
        await this.driver.pause(3000);
      }
      log('Instagram app is running');
    } catch (error) {
      log(`Error ensuring Instagram is running: ${error}`);
    }
  }

  async searchReels(query: string): Promise<void> {
    if (!this.driver) throw new Error('Not connected');
    log(`Starting search for: ${query}`);

    try {
      // Click search tab
      const searchTab = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/search_tab")');
      await searchTab.click();
      await this.driver.pause(2000);

      // Click search field
      const searchField = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/action_bar_search_edit_text")');
      await searchField.click();
      await this.driver.pause(1000);

      // Clear and type query
      await searchField.clearValue();
      await searchField.setValue(query);
      await this.driver.pause(2000);

      // Press enter to search
      await this.driver.pressKeyCode(66); // Enter key
      await this.driver.pause(3000);

      // Navigate to Reels tab
      const reelsTab = await this.driver.$('android=new UiSelector().text("Reels")');
      if (await reelsTab.isExisting()) {
        await reelsTab.click();
        log('Navigated to Reels tab');
        await this.driver.pause(3000);
      }

      // Click first reel to open fullscreen
      const firstReel = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/image_preview").instance(0)');
      if (await firstReel.isExisting()) {
        await firstReel.click();
        log('Opened first reel');
        await this.driver.pause(3000);
      }
    } catch (error) {
      log(`Search error: ${error}`);
      throw error;
    }
  }

  async scrapeReels(count: number): Promise<ReelData[]> {
    if (!this.driver) throw new Error('Not connected');
    log(`Starting to scrape ${count} reels`);

    const reels: ReelData[] = [];
    const processedUrls = new Set<string>();
    
    for (let i = 0; i < count; i++) {
      try {
        const reel = await this.scrapeCurrentReel();
        
        // Skip if duplicate
        if (reel && !processedUrls.has(reel.url)) {
          reels.push(reel);
          processedUrls.add(reel.url);
          log(`Scraped reel ${i + 1}/${count}: ${reel.author}`);
        }
        
        // Wait between reels
        await this.driver.pause(10000 + Math.random() * 10000);
        
        // Swipe to next
        if (i < count - 1) {
          await this.swipeToNextReel();
          await this.driver.pause(3000);
        }
      } catch (error) {
        log(`Error scraping reel ${i + 1}: ${error}`);
      }
    }
    
    log(`Completed scraping. Found ${reels.length} unique reels`);
    return reels;
  }

  private async scrapeCurrentReel(): Promise<ReelData | null> {
    if (!this.driver) return null;

    const reel: ReelData = {
      id: '',
      url: '',
      title: '',
      author: '',
      likes: '0',
      comments: '0',
      shares: '0',
      playCount: '0'
    };

    try {
      // Get author username
      const authorEl = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/row_feed_photo_profile_name")');
      if (await authorEl.isExisting()) {
        reel.author = await authorEl.getText();
        reel.url = `https://instagram.com/reel/${reel.author}_${Date.now()}`;
        reel.id = reel.url;
      }

      // Get caption/title
      const captionEl = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/row_feed_comment_textview_layout")');
      if (await captionEl.isExisting()) {
        reel.title = await captionEl.getText();
      }

      // Get likes
      const likesEl = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/row_feed_textview_likes")');
      if (await likesEl.isExisting()) {
        const likesText = await likesEl.getText();
        reel.likes = this.parseCount(likesText);
      }

      // Get comments count
      const viewCommentsEl = await this.driver.$('android=new UiSelector().textContains("View").textContains("comment")');
      if (await viewCommentsEl.isExisting()) {
        const text = await viewCommentsEl.getText();
        reel.comments = this.parseCount(text);
      }

      // Get play count if visible
      const playCountEl = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/play_count_text")');
      if (await playCountEl.isExisting()) {
        const playText = await playCountEl.getText();
        reel.playCount = this.parseCount(playText);
      }

      return reel;
    } catch (error) {
      log(`Error scraping current reel: ${error}`);
      return null;
    }
  }

  async getReelComments(reelId: string, maxComments: number = 50): Promise<string[]> {
    if (!this.driver) throw new Error('Not connected');
    log(`Getting comments for reel: ${reelId}`);

    const comments: string[] = [];

    try {
      // Click comment button
      const commentBtn = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/row_feed_button_comment")');
      if (!await commentBtn.isExisting()) {
        // Try alternative selector
        const altCommentBtn = await this.driver.$('android=new UiSelector().description("Comment")');
        if (await altCommentBtn.isExisting()) {
          await altCommentBtn.click();
        }
      } else {
        await commentBtn.click();
      }
      await this.driver.pause(2000);

      // Scrape visible comments
      let previousCount = 0;
      let scrollAttempts = 0;
      const maxScrolls = 10;

      while (comments.length < maxComments && scrollAttempts < maxScrolls) {
        // Get all comment text elements
        const commentEls = await this.driver.$$('android=new UiSelector().resourceId("com.instagram.android:id/row_comment_textview_comment")');
        
        for (const el of commentEls) {
          try {
            const text = await el.getText();
            if (text && !comments.includes(text)) {
              comments.push(text);
            }
          } catch (e) {
            // Element might be stale
          }
        }
        
        // Check if we got new comments
        if (comments.length === previousCount) {
          scrollAttempts++;
        } else {
          scrollAttempts = 0;
        }
        previousCount = comments.length;
        
        if (comments.length >= maxComments) break;
        
        // Scroll for more comments
        await this.scrollComments();
        await this.driver.pause(1500);
      }

      // Close comments
      await this.driver.back();
      await this.driver.pause(1000);
      
      log(`Collected ${comments.length} comments`);
      return comments.slice(0, maxComments);
    } catch (error) {
      log(`Error getting comments: ${error}`);
      // Try to close comments if open
      await this.driver.back().catch(() => {});
      return comments;
    }
  }

  async postComment(reelUrl: string, comment: string): Promise<boolean> {
    if (!this.driver) throw new Error('Not connected');
    log(`Posting comment on reel: ${reelUrl}`);

    try {
      // Open comments if not already open
      const commentBtn = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/row_feed_button_comment")');
      if (await commentBtn.isExisting()) {
        await commentBtn.click();
        await this.driver.pause(2000);
      }

      // Check if comments are disabled
      const disabledText = await this.driver.$('android=new UiSelector().textContains("Comments on this post have been limited")');
      const turnedOffText = await this.driver.$('android=new UiSelector().textContains("Commenting has been turned off")');
      
      if (await disabledText.isExisting() || await turnedOffText.isExisting()) {
        log('Comments are disabled for this reel');
        await this.driver.back();
        return false;
      }

      // Find comment input
      const commentInput = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/layout_comment_thread_edittext")');
      if (!await commentInput.isExisting()) {
        // Try alternative selector
        const altInput = await this.driver.$('android=new UiSelector().text("Add a comment...")');
        if (await altInput.isExisting()) {
          await altInput.click();
        }
      } else {
        await commentInput.click();
      }
      await this.driver.pause(1000);

      // Type comment
      await this.driver.execute('mobile: shell', {
        command: 'input',
        args: ['text', comment.replace(/'/g, "\\'").replace(/"/g, '\\"')]
      });
      await this.driver.pause(1000);

      // Find and click post button
      const postBtn = await this.driver.$('android=new UiSelector().resourceId("com.instagram.android:id/layout_comment_thread_post_button_click_area")');
      if (!await postBtn.isExisting()) {
        // Try text selector
        const textPostBtn = await this.driver.$('android=new UiSelector().text("Post")');
        if (await textPostBtn.isExisting()) {
          await textPostBtn.click();
        }
      } else {
        await postBtn.click();
      }
      await this.driver.pause(3000);

      // Close comments
      await this.driver.back();
      await this.driver.pause(1000);
      
      log('Comment posted successfully');
      return true;
    } catch (error) {
      log(`Failed to post comment: ${error}`);
      // Try to close comments if open
      await this.driver.back().catch(() => {});
      return false;
    }
  }

  private async swipeToNextReel(): Promise<void> {
    if (!this.driver) return;
    
    const { width, height } = await this.driver.getWindowSize();
    
    await this.driver.execute('mobile: swipeGesture', {
      left: width / 2,
      top: height * 0.7,
      width: 100,
      height: height * 0.5,
      direction: 'up',
      percent: 0.75
    });
  }

  private async scrollComments(): Promise<void> {
    if (!this.driver) return;
    
    const { width, height } = await this.driver.getWindowSize();
    
    await this.driver.execute('mobile: swipeGesture', {
      left: width / 2,
      top: height * 0.6,
      width: 100,
      height: height * 0.3,
      direction: 'up',
      percent: 0.5
    });
  }

  private parseCount(text: string): string {
    // Extract numbers with K, M, B suffixes
    const match = text.match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);
    if (match) {
      return match[0].trim();
    }
    // Try to extract just numbers
    const numbers = text.match(/\d+/);
    return numbers ? numbers[0] : '0';
  }

  isReady(): boolean {
    return this.connected && this.driver !== null;
  }
}

export const androidService = new AndroidService();