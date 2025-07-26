export class HumanBehavior {
  // Random delay between actions (2-5 seconds)
  static async randomDelay(): Promise<void> {
    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  // Human-like scroll behavior
  static async humanScroll(page: any): Promise<void> {
    const scrollSteps = Math.floor(Math.random() * 3) + 2; // 2-4 scroll steps
    
    for (let i = 0; i < scrollSteps; i++) {
      const scrollDistance = Math.random() * 500 + 200; // 200-700px
      await page.evaluate((distance: number) => {
        window.scrollBy({
          top: distance,
          behavior: 'smooth'
        });
      }, scrollDistance);
      
      // Random pause between scrolls
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
    }
  }

  // Random mouse movements
  static async randomMouseMovement(page: any): Promise<void> {
    const viewport = await page.viewport();
    const x = Math.random() * (viewport?.width || 1200);
    const y = Math.random() * (viewport?.height || 800);
    
    await page.mouse.move(x, y, { steps: Math.floor(Math.random() * 5) + 3 });
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  }

  // Human-like typing
  static async humanType(page: any, selector: string, text: string): Promise<void> {
    await page.click(selector);
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
    
    // Type with random delays between characters
    for (const char of text) {
      await page.keyboard.type(char);
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    }
  }

  // Random pauses during navigation
  static async thinkingPause(): Promise<void> {
    const pauseTime = Math.random() * 2000 + 1000; // 1-3 seconds
    await new Promise(resolve => setTimeout(resolve, pauseTime));
  }

  // Simulate reading time based on content length
  static async readingTime(contentLength: number): Promise<void> {
    const wordsPerMinute = 200;
    const words = contentLength / 5; // Approximate words
    const readingTimeMs = (words / wordsPerMinute) * 60 * 1000;
    const adjustedTime = Math.max(1000, Math.min(readingTimeMs, 5000)); // 1-5 seconds max
    
    await new Promise(resolve => setTimeout(resolve, adjustedTime));
  }

  // Random interaction patterns
  static async randomInteraction(page: any): Promise<void> {
    const actions = [
      () => this.randomMouseMovement(page),
      () => this.humanScroll(page),
      () => this.thinkingPause(),
    ];
    
    const randomAction = actions[Math.floor(Math.random() * actions.length)];
    await randomAction();
  }
}
