-- migrations/0000_init.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create videos table
CREATE TABLE IF NOT EXISTS videos (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id VARCHAR,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  thumbnail TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  relevance_score INTEGER,
  status TEXT NOT NULL DEFAULT 'queued',
  generated_comment TEXT,
  posted_comment TEXT,
  error_message TEXT,
  extracted_comments JSONB,
  analysis_data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create scraping_sessions table
CREATE TABLE IF NOT EXISTS scraping_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT NOT NULL,
  video_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  processed_count INTEGER DEFAULT 0,
  approved_count INTEGER DEFAULT 0,
  rejected_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create system_prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create android_connection table
CREATE TABLE IF NOT EXISTS android_connection (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'disconnected',
  host TEXT DEFAULT 'localhost',
  port INTEGER DEFAULT 4723,
  last_connected TIMESTAMP,
  error_message TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_videos_session_id ON videos(session_id);
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_scraping_sessions_status ON scraping_sessions(status);
CREATE INDEX idx_system_prompts_type_active ON system_prompts(type, is_active);