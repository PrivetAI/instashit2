# ReelSensei - Instagram Reels Analysis & Automation Tool

ReelSensei is an AI-powered automation tool designed to analyze and interact with Instagram Reels. It uses a Node.js backend to control an Android emulator, enabling intelligent content analysis and automated commenting based on configurable AI prompts.

## 🎯 Purpose

The tool is designed to help businesses and marketers:
- Find relevant Instagram Reels based on search queries
- Analyze content and comments for relevance using AI
- Generate and post contextual comments automatically
- Track engagement metrics and campaign performance

## 🚀 Key Features

- **Automated Reel Discovery**: Search Instagram for reels using keywords
- **AI-Powered Analysis**: Analyze reel content and comments for relevance scoring
- **Smart Comment Generation**: Generate natural, contextual comments using OpenAI
- **Human-like Behavior**: Implements realistic delays (10-20 seconds) between actions
- **Real-time Monitoring**: WebSocket-based UI for tracking progress
- **Batch Processing**: Process multiple reels in a single session

## 🛠 Technology Stack

- **Backend**: Node.js with TypeScript
- **Mobile Automation**: Appium + Android Emulator
- **AI Integration**: OpenAI GPT-4 for content analysis
- **Database**: PostgreSQL (with in-memory storage option)
- **Containerization**: Docker & Docker Compose
- **Real-time Updates**: WebSockets

## 📦 Services

The application consists of three main Docker services:

1. **`postgres`**: Database for storing sessions, videos, and prompts
2. **`android`**: Android emulator with Appium for Instagram automation
3. **`app`**: Main Node.js application orchestrating the workflow


### Accessing the Application

- **Web Interface**: http://localhost:5000
- **Android Emulator (VNC)**: http://localhost:6080

## 📱 How It Works

1. **Connect to Android**: The app connects to the Android emulator via Appium
2. **Search Reels**: Enter a search query to find relevant Instagram Reels
3. **Analyze Content**: AI analyzes each reel's content and comments for relevance
4. **Generate Comments**: AI creates contextual, natural comments
5. **Review & Approve**: Manual review before posting comments
6. **Track Results**: Monitor success rates and engagement metrics

## 🎮 Usage Flow

1. **Start Session**:
   - Enter search query (e.g., "job search", "remote work")
   - Set number of reels to process
   - Configure AI prompts for analysis and comment generation

2. **Automated Processing**:
   - Searches Instagram for matching reels
   - Opens each reel and collects data (title, likes, comments)
   - Analyzes content relevance (1-10 score)
   - Generates appropriate comment

3. **Review & Action**:
   - Review generated comments
   - Approve to post or reject
   - Track posted comments and success rates

## 🤖 AI Configuration

The system uses two customizable prompts:

1. **Analysis Prompt**: Determines content relevance and scoring
2. **Comment Prompt**: Generates natural, contextual comments

Both can be configured through the web interface to match your specific use case.

## ⚙️ API Endpoints

- `POST /api/android/connect` - Connect to Android emulator
- `POST /api/sessions/start` - Start new scraping session
- `GET /api/videos` - Get analyzed videos
- `POST /api/videos/:id/approve` - Approve and post comment
- `GET /api/prompts` - Get/update AI prompts

## 🔒 Safety Features

- Human-like delays between actions (10-20 seconds)
- Handles disabled comments gracefully
- Continues processing on individual reel errors
- Manual review before posting
- Real-time session monitoring

## 📊 Data Collected

For each reel:
- Title/Description
- Engagement metrics (likes, comments, shares)
- Top 50 comments
- AI relevance score
- Generated comment
- Posting status

## 🚨 Important Notes

- Use responsibly and in accordance with Instagram's terms of service
- Ensure you have permission to interact with content
- Monitor for any unusual activity or restrictions
- The tool is designed for legitimate business use cases

## 🔧 Development

The codebase is organized as follows:
- `/server` - Backend Node.js application
- `/client` - React frontend (if applicable)
- `/shared` - Shared TypeScript types and schemas
- `/apks` - Android application packages

## 📝 License

This project is for educational and business automation purposes. Users are responsible for complying with Instagram's terms of service and applicable laws.