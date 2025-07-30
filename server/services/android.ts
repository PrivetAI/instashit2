import { remote, RemoteOptions } from 'webdriverio';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { log } from '../vite';

const execAsync = promisify(exec);

export class AndroidService {
  private driver: WebdriverIO.Browser | null = null;
  private isConnected = false;

  private readonly capabilities: RemoteOptions = {
    hostname: process.env.ANDROID_HOST,
    port: parseInt(process.env.ANDROID_PORT || '4723'),
    path: '/',
    capabilities: {
      platformName: 'Android',
      'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Nexus 5',
      'appium:automationName': 'UiAutomator2',
      'appium:appPackage': process.env.APP_PACKAGE || 'com.instagram.android',
      'appium:appActivity': process.env.APP_ACTIVITY || 'com.instagram.android.activity.MainTabActivity',
      'appium:noReset': true,
      'appium:fullReset': false,
      'appium:newCommandTimeout': 300,
      'appium:skipDeviceInitialization': true,
    } as any
  };

  async connect(): Promise<void> {
    const retries = 10;
    const delay = 15000; // 15 seconds

    for (let i = 0; i < retries; i++) {
      try {
        log(`Connecting to Android emulator (attempt ${i + 1}/${retries})...`);
        this.driver = await remote({
          ...this.capabilities,
          logLevel: 'trace',
        });
        this.isConnected = true;
        log('Successfully connected to Android emulator');
        return;
      } catch (error) {
        log(`Attempt ${i + 1} failed. Retrying in ${delay / 1000}s...`);
        console.error(error);
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          log(`Failed to connect to Android after ${retries} attempts: ${error}`);
          throw error;
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.driver) {
      await this.driver.deleteSession();
      this.driver = null;
      this.isConnected = false;
    }
  }

  async installInstagram(): Promise<void> {
    try {
      const apkPath = path.join(process.cwd(), 'apks', 'instagram.apk');
      
      // Check if APK exists
      await fs.access(apkPath);
      
      // Install APK via ADB
      const { stdout, stderr } = await execAsync(
        `docker exec android_emulator adb install -r /apks/instagram.apk`
      );
      
      log(`Instagram installation: ${stdout}`);
      if (stderr) log(`Installation warnings: ${stderr}`);
    } catch (error) {
      log(`Failed to install Instagram: ${error}`);
      throw error;
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    if (!this.driver) throw new Error('Not connected to Android');

    try {
      // Wait for app to load
      await this.driver.pause(3000);

      // Check if already logged in
      const profileTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Profile"]');
      if (await profileTab.isExisting()) {
        log('Already logged in');
        return true;
      }

      // Click login button
      const loginBtn = await this.driver.$('//android.widget.Button[@text="Log in"]');
      if (await loginBtn.isExisting()) {
        await loginBtn.click();
      }

      // Enter username
      const usernameField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/login_username"]');
      await usernameField.setValue(username);

      // Enter password
      const passwordField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/password"]');
      await passwordField.setValue(password);

      // Submit
      const submitBtn = await this.driver.$('//android.widget.Button[@text="Log in"]');
      await submitBtn.click();

      // Wait for login to complete
      await this.driver.pause(5000);

      // Check if login successful
      const homeTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Home"]');
      return await homeTab.isExisting();
    } catch (error) {
      log(`Login failed: ${error}`);
      return false;
    }
  }

  async navigateToProfile(username: string): Promise<void> {
    if (!this.driver) throw new Error('Not connected to Android');

    // Click search tab
    const searchTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Search and explore"]');
    await searchTab.click();

    // Enter username in search
    const searchField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/action_bar_search_edit_text"]');
    await searchField.setValue(username);

    // Click on first result
    await this.driver.pause(2000);
    const firstResult = await this.driver.$(`//android.widget.TextView[@text="${username}"]`);
    await firstResult.click();
  }

  async getProfileData(): Promise<any> {
    if (!this.driver) throw new Error('Not connected to Android');

    const data: any = {};

    try {
      // Get username
      const usernameEl = await this.driver.$('//android.widget.TextView[@resource-id="com.instagram.android:id/action_bar_title"]');
      data.username = await usernameEl.getText();

      // Get bio
      const bioEl = await this.driver.$('//android.widget.TextView[@resource-id="com.instagram.android:id/profile_header_bio_text"]');
      if (await bioEl.isExisting()) {
        data.bio = await bioEl.getText();
      }

      // Get follower count
      const followersEl = await this.driver.$('//android.widget.TextView[contains(@text, "followers")]/../android.widget.TextView[1]');
      if (await followersEl.isExisting()) {
        data.followers = await followersEl.getText();
      }

      // Get following count
      const followingEl = await this.driver.$('//android.widget.TextView[contains(@text, "following")]/../android.widget.TextView[1]');
      if (await followingEl.isExisting()) {
        data.following = await followingEl.getText();
      }

      // Get posts count
      const postsEl = await this.driver.$('//android.widget.TextView[contains(@text, "posts")]/../android.widget.TextView[1]');
      if (await postsEl.isExisting()) {
        data.posts = await postsEl.getText();
      }

      return data;
    } catch (error) {
      log(`Failed to get profile data: ${error}`);
      throw error;
    }
  }

  async postComment(url: string, comment: string): Promise<boolean> {
    if (!this.driver) throw new Error('Not connected to Android');
    try {
      await this.driver.url(url);
      const commentButton = await this.driver.$('~Comment');
      await commentButton.click();
      const commentInput = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/comment_composer_edit_text"]');
      await commentInput.setValue(comment);
      const postButton = await this.driver.$('~Post');
      await postButton.click();
      return true;
    } catch (error) {
      log(`Failed to post comment: ${error}`);
      return false;
    }
  }

  async scrollFeed(times: number = 1): Promise<void> {
    if (!this.driver) throw new Error('Not connected to Android');

    for (let i = 0; i < times; i++) {
      await this.driver.execute('mobile: scroll', { direction: 'down' });
      await this.driver.pause(1000);
    }
  }

  async takeScreenshot(): Promise<string> {
    if (!this.driver) throw new Error('Not connected to Android');
    
    const screenshot = await this.driver.takeScreenshot();
    const filename = `screenshot_${Date.now()}.png`;
    const filepath = path.join(process.cwd(), 'uploads', filename);
    
    await fs.writeFile(filepath, screenshot, 'base64');
    return filename;
  }

  async getPageSource(): Promise<string> {
    if (!this.driver) throw new Error('Not connected to Android');
    return await this.driver.getPageSource();
  }

  isReady(): boolean {
    return this.isConnected && this.driver !== null;
  }
}

export const androidService = new AndroidService();
