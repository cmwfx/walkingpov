-- Fix thumbnail URLs for videos uploaded via bulk upload
-- This script updates relative URLs to full URLs

-- First, let's see what we need to fix
-- Run this to check which videos have relative paths:
-- SELECT id, title, thumbnail_url FROM videos WHERE thumbnail_url LIKE '/uploads/%';

-- Update relative URLs to full URLs
-- Replace 'http://localhost:3001' with your actual server URL
UPDATE videos 
SET thumbnail_url = CONCAT('http://localhost:3001', thumbnail_url)
WHERE thumbnail_url LIKE '/uploads/%';

-- Verify the update
SELECT id, title, thumbnail_url FROM videos ORDER BY created_at DESC LIMIT 10;
