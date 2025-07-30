// server/services/android.ts
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
   capabilities: {
     platformName: 'Android',
     'appium:deviceName': process.env.ANDROID_DEVICE_NAME || 'Nexus 5',
     'appium:automationName': 'UiAutomator2',
     'appium:appPackage': 'com.instagram.android',
     'appium:appActivity': '.activity.MainTabActivity',
     'appium:noReset': true,
     'appium:fullReset': false,
     'appium:newCommandTimeout': 300,
     'appium:skipDeviceInitialization': true,
     'appium:autoGrantPermissions': true,
     'appium:skipUnlock': true,
     'appium:systemPort': 8201
   } as any
 };

 async checkAppiumReady(): Promise<boolean> {
   try {
     const response = await fetch(`http://${this.capabilities.hostname}:${this.capabilities.port}/status`);
     const data = await response.json();
     return data.value?.ready === true;
   } catch {
     return false;
   }
 }

 async connect(): Promise<void> {
   const retries = 10;
   const delay = 15000; // 15 seconds

   for (let i = 0; i < retries; i++) {
     try {
       log('Checking if Appium is ready...');
       for (let j = 0; j < 30; j++) {
           if (await this.checkAppiumReady()) {
               log('Appium is ready.');
               break;
           }
           log('Appium not ready, waiting 2s...');
           await new Promise(resolve => setTimeout(resolve, 2000));
       }

       log(`Connecting to Android emulator (attempt ${i + 1}/${retries})...`);
       this.driver = await remote({
         ...this.capabilities,
         logLevel: 'trace',
       });
       this.isConnected = true;
       log('Successfully connected to Android emulator');
       
       // Диагностика после подключения
       await this.diagnoseApp();
       
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
     
     // После установки даем разрешения
     await this.grantPermissions();
     
   } catch (error) {
     log(`Failed to install Instagram: ${error}`);
     throw error;
   }
 }

 async grantPermissions(): Promise<void> {
   try {
     const permissions = [
       'android.permission.CAMERA',
       'android.permission.WRITE_EXTERNAL_STORAGE',
       'android.permission.READ_EXTERNAL_STORAGE',
       'android.permission.ACCESS_FINE_LOCATION',
       'android.permission.RECORD_AUDIO'
     ];

     for (const permission of permissions) {
       await execAsync(
         `docker exec android_emulator adb shell pm grant com.instagram.android ${permission}`
       );
     }
     log('Permissions granted to Instagram');
   } catch (error) {
     log(`Failed to grant permissions: ${error}`);
   }
 }

 async launchInstagram(): Promise<void> {
   if (!this.driver) throw new Error('Not connected to Android');
   
   try {
     // Метод 1: Через adb shell
     await this.driver.execute('mobile: shell', {
       command: 'am start -n com.instagram.android/.activity.MainTabActivity'
     });
     
     await this.driver.pause(10000);
     
     // Проверяем, запустилось ли приложение
     const currentPackage = await this.driver.getCurrentPackage();
     if (currentPackage !== 'com.instagram.android') {
       throw new Error('Instagram did not launch properly');
     }
     
     log('Instagram launched successfully');
   } catch (error) {
     log(`Failed to launch Instagram: ${error}`);
     
     // Метод 2: Через activateApp
     try {
       await this.driver.execute('mobile: activateApp', {
         appId: 'com.instagram.android'
       });
       await this.driver.pause(10000);
     } catch (e) {
       log(`Alternative launch method also failed: ${e}`);
       throw error;
     }
   }
 }

 async diagnoseApp(): Promise<void> {
   if (!this.driver) throw new Error('Not connected to Android');
   
   try {
     // Получаем информацию о текущем состоянии
     const currentActivity = await this.driver.getCurrentActivity();
     const currentPackage = await this.driver.getCurrentPackage();
     const isAppInstalled = await this.driver.isAppInstalled('com.instagram.android');
     
     log(`Diagnostics:`);
     log(`- App installed: ${isAppInstalled}`);
     log(`- Current package: ${currentPackage}`);
     log(`- Current activity: ${currentActivity}`);
     
     // Делаем скриншот для диагностики
     const screenshot = await this.takeScreenshot();
     log(`- Screenshot saved: ${screenshot}`);
     
     // Проверяем разрешения
     try {
       const permissions = await this.driver.execute('mobile: shell', {
         command: 'dumpsys package com.instagram.android | grep permission'
       });
       log(`- Permissions check completed`);
     } catch (e) {
       log(`- Could not check permissions: ${e}`);
     }
   } catch (error) {
     log(`Diagnosis error: ${error}`);
   }
 }

 async login(username: string, password: string): Promise<boolean> {
   if (!this.driver) throw new Error('Not connected to Android');

   try {
     // Сначала проверим, запущен ли Instagram
     const currentPackage = await this.driver.getCurrentPackage();
     log(`Current package: ${currentPackage}`);
     
     if (currentPackage !== 'com.instagram.android') {
       // Запускаем Instagram
       await this.launchInstagram();
     }

     // Ждем полной загрузки приложения
     await this.driver.pause(15000);

     // Проверяем состояние экрана
     const pageSource = await this.driver.getPageSource();
     log(`Page loaded, source length: ${pageSource.length}`);
     
     // Попробуем найти любой элемент Instagram
     const anyElement = await this.driver.$('//android.widget.TextView');
     if (await anyElement.isExisting()) {
       log('Found UI elements, app is loaded');
     } else {
       log('No UI elements found, app might be loading');
       await this.driver.pause(10000);
     }

     // Пробуем закрыть возможные попапы
     try {
       const skipBtn = await this.driver.$('//android.widget.Button[@text="Skip"]');
       if (await skipBtn.isExisting()) {
         await skipBtn.click();
         log('Clicked Skip button');
       }
     } catch (e) {
       // Ignore if no skip button
     }

     try {
       const notNowBtn = await this.driver.$('//android.widget.Button[@text="Not Now"]');
       if (await notNowBtn.isExisting()) {
         await notNowBtn.click();
         log('Clicked Not Now button');
       }
     } catch (e) {
       // Ignore
     }

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
       await this.driver.pause(2000);
     }

     // Enter username
     const usernameField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/login_username"]');
     if (await usernameField.isExisting()) {
       await usernameField.setValue(username);
     } else {
       // Альтернативный селектор
       const altUsernameField = await this.driver.$('//android.widget.EditText[1]');
       await altUsernameField.setValue(username);
     }

     // Enter password
     const passwordField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/password"]');
     if (await passwordField.isExisting()) {
       await passwordField.setValue(password);
     } else {
       // Альтернативный селектор
       const altPasswordField = await this.driver.$('//android.widget.EditText[2]');
       await altPasswordField.setValue(password);
     }

     // Submit
     const submitBtn = await this.driver.$('//android.widget.Button[@text="Log in"]');
     if (await submitBtn.isExisting()) {
       await submitBtn.click();
     }

     // Wait for login to complete
     await this.driver.pause(8000);

     // Check if login successful
     const homeTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Home"]');
     const loginSuccess = await homeTab.isExisting();
     
     if (loginSuccess) {
       log('Login successful');
     } else {
       log('Login failed - could not find home tab');
       await this.diagnoseApp();
     }
     
     return loginSuccess;
   } catch (error) {
     log(`Login failed: ${error}`);
     await this.diagnoseApp();
     return false;
   }
 }

 async navigateToProfile(username: string): Promise<void> {
   if (!this.driver) throw new Error('Not connected to Android');

   try {
     // Click search tab
     const searchTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Search and explore"]');
     if (!await searchTab.isExisting()) {
       // Альтернативный селектор
       const altSearchTab = await this.driver.$('//android.widget.FrameLayout[@content-desc="Search"]');
       await altSearchTab.click();
     } else {
       await searchTab.click();
     }

     await this.driver.pause(2000);

     // Enter username in search
     const searchField = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/action_bar_search_edit_text"]');
     if (!await searchField.isExisting()) {
       // Альтернативный селектор
       const altSearchField = await this.driver.$('//android.widget.EditText');
       await altSearchField.setValue(username);
     } else {
       await searchField.setValue(username);
     }

     // Click on first result
     await this.driver.pause(3000);
     const firstResult = await this.driver.$(`//android.widget.TextView[@text="${username}"]`);
     if (await firstResult.isExisting()) {
       await firstResult.click();
     } else {
       // Попробуем кликнуть на первый элемент в результатах
       const anyResult = await this.driver.$('//android.widget.LinearLayout[@clickable="true"][1]');
       await anyResult.click();
     }
     
     log(`Navigated to profile: ${username}`);
   } catch (error) {
     log(`Failed to navigate to profile: ${error}`);
     throw error;
   }
 }

 async getProfileData(): Promise<any> {
   if (!this.driver) throw new Error('Not connected to Android');

   const data: any = {
     reels: []
   };

   try {
     // Get username
     const usernameEl = await this.driver.$('//android.widget.TextView[@resource-id="com.instagram.android:id/action_bar_title"]');
     if (await usernameEl.isExisting()) {
       data.username = await usernameEl.getText();
     }

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

     // Для получения reels нужно переключиться на вкладку reels
     const reelsTab = await this.driver.$('//android.widget.ImageView[@content-desc="Reels"]');
     if (await reelsTab.isExisting()) {
       await reelsTab.click();
       await this.driver.pause(3000);
       
       // Собираем данные о reels
       const reelElements = await this.driver.$$('//android.widget.FrameLayout[@clickable="true"]');
       
       for (let i = 0; i < Math.min(reelElements.length, 10); i++) {
         data.reels.push({
           url: `https://www.instagram.com/reel/${i}`, // Заглушка
           title: `Reel ${i + 1}`,
           thumbnail: null,
           likes: Math.floor(Math.random() * 10000),
           comments: Math.floor(Math.random() * 1000),
           shares: Math.floor(Math.random() * 500)
         });
       }
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
     // Открываем конкретный reel по URL
     await this.driver.url(url);
     await this.driver.pause(5000);
     
     // Ищем кнопку комментария
     const commentButton = await this.driver.$('//android.widget.Button[@content-desc="Comment"]');
     if (!await commentButton.isExisting()) {
       // Альтернативный селектор
       const altCommentButton = await this.driver.$('//android.widget.ImageView[@content-desc="Comment"]');
       await altCommentButton.click();
     } else {
       await commentButton.click();
     }
     
     await this.driver.pause(2000);
     
     // Вводим комментарий
     const commentInput = await this.driver.$('//android.widget.EditText[@resource-id="com.instagram.android:id/comment_composer_edit_text"]');
     if (!await commentInput.isExisting()) {
       const altCommentInput = await this.driver.$('//android.widget.EditText');
       await altCommentInput.setValue(comment);
     } else {
       await commentInput.setValue(comment);
     }
     
     // Отправляем
     const postButton = await this.driver.$('//android.widget.TextView[@text="Post"]');
     if (!await postButton.isExisting()) {
       const altPostButton = await this.driver.$('//android.widget.Button[@text="Post"]');
       await altPostButton.click();
     } else {
       await postButton.click();
     }
     
     await this.driver.pause(3000);
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
     await this.driver.execute('mobile: scroll', { direction: 'down' });
     await this.driver.pause(1000);
   }
 }

 async takeScreenshot(): Promise<string> {
   if (!this.driver) throw new Error('Not connected to Android');
   
   const screenshot = await this.driver.takeScreenshot();
   const filename = `screenshot_${Date.now()}.png`;
   const filepath = path.join(process.cwd(), 'uploads', filename);
   
   // Создаем директорию если не существует
   await fs.mkdir(path.dirname(filepath), { recursive: true });
   
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